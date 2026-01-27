<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Training;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TrainingController extends Controller
{
    /**
     * Get all trainings with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Training::with(['project', 'submitter']);

        // Filter by user's projects if not admin
        if (!$user->hasGlobalProjectScope()) {
            $projectIds = $user->visibleProjectIds();
            if ($projectIds !== null) {
                $query->whereIn('project_id', $projectIds);
            }
        }

        // Apply filters
        if ($request->has('project_id') && $request->project_id) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->has('week') && $request->week) {
            $query->where('week_number', $request->week);
        }

        if ($request->has('year') && $request->year) {
            $query->where('week_year', $request->year);
        }

        if ($request->has('from_date')) {
            $query->where('date', '>=', $request->from_date);
        }

        if ($request->has('to_date')) {
            $query->where('date', '<=', $request->to_date);
        }

        // Order by date descending
        $trainings = $query->orderBy('date', 'desc')
                           ->paginate($request->get('per_page', 50));

        return response()->json($trainings);
    }

    /**
     * Store a new training
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'date' => 'required|date',
            'week_number' => 'required|integer|min:1|max:52',
            'week_year' => 'required|integer|min:2020|max:2100',
            'by_internal' => 'required|boolean',
            'by_name' => 'nullable|string|max:255',
            'external_company' => 'nullable|string|max:255',
            'theme' => 'required|string|max:500',
            'duration_label' => 'required|string|max:50',
            'duration_hours' => 'required|numeric|min:0',
            'participants' => 'required|integer|min:1',
            'training_hours' => 'required|numeric|min:0',
            'photo' => 'nullable|image|max:5120', // 5MB max
        ]);

        $validated['submitted_by'] = $request->user()->id;

        // Handle photo upload
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('trainings', 'public');
            $validated['photo_path'] = $path;
        }

        unset($validated['photo']);

        $training = Training::create($validated);
        $training->load(['project', 'submitter']);

        // Notify admins
        NotificationService::trainingSubmitted($training);

        return response()->json([
            'message' => 'Training created successfully',
            'data' => $training,
        ], 201);
    }

    /**
     * Show a specific training
     */
    public function show(Training $training)
    {
        $user = request()->user();

        // Check access
        $project = \App\Models\Project::findOrFail($training->project_id);
        if (!$user->canAccessProject($project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'data' => $training->load(['project', 'submitter']),
        ]);
    }

    public function photo(Training $training)
    {
        $user = request()->user();

        $project = \App\Models\Project::findOrFail($training->project_id);
        if (!$user->canAccessProject($project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!$training->photo_path || !Storage::disk('public')->exists($training->photo_path)) {
            return response()->json(['message' => 'Photo not found'], 404);
        }

        try {
            $path = Storage::disk('public')->path($training->photo_path);

            if (!is_string($path) || $path === '' || !is_file($path) || !is_readable($path)) {
                return response()->json(['message' => 'Photo not found'], 404);
            }

            $mime = Storage::disk('public')->mimeType($training->photo_path);
            $headers = [];
            if (is_string($mime) && $mime !== '') {
                $headers['Content-Type'] = $mime;
            }

            return response()->file($path, $headers);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to load photo'], 422);
        }
    }

    /**
     * Update a training
     */
    public function update(Request $request, Training $training)
    {
        $user = $request->user();

        $project = \App\Models\Project::findOrFail($training->project_id);
        if (!$user->canAccessProject($project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Check access
        if (!$user->canManageProjectActions() && $training->submitted_by !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'project_id' => 'sometimes|exists:projects,id',
            'date' => 'sometimes|date',
            'week_number' => 'sometimes|integer|min:1|max:52',
            'week_year' => 'sometimes|integer|min:2020|max:2100',
            'by_internal' => 'sometimes|boolean',
            'by_name' => 'nullable|string|max:255',
            'external_company' => 'nullable|string|max:255',
            'theme' => 'sometimes|string|max:500',
            'duration_label' => 'sometimes|string|max:50',
            'duration_hours' => 'sometimes|numeric|min:0',
            'participants' => 'sometimes|integer|min:1',
            'training_hours' => 'sometimes|numeric|min:0',
            'photo' => 'nullable|image|max:5120',
        ]);

        // Handle photo upload
        if ($request->hasFile('photo')) {
            // Delete old photo if exists
            if ($training->photo_path) {
                Storage::disk('public')->delete($training->photo_path);
            }
            $path = $request->file('photo')->store('trainings', 'public');
            $validated['photo_path'] = $path;
        }

        unset($validated['photo']);

        $training->update($validated);

        return response()->json([
            'message' => 'Training updated successfully',
            'data' => $training->fresh()->load(['project', 'submitter']),
        ]);
    }

    /**
     * Delete a training
     */
    public function destroy(Training $training)
    {
        $user = request()->user();

        $project = \App\Models\Project::findOrFail($training->project_id);
        if (!$user->canAccessProject($project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Only admin or submitter can delete
        if (!$user->canManageProjectActions() && $training->submitted_by !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Delete photo if exists
        if ($training->photo_path) {
            Storage::disk('public')->delete($training->photo_path);
        }

        $training->delete();

        return response()->json([
            'message' => 'Training deleted successfully',
        ]);
    }

    /**
     * Get training statistics
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $query = Training::query();

        if (!$user->hasGlobalProjectScope()) {
            $projectIds = $user->visibleProjectIds();
            if ($projectIds !== null) {
                $query->whereIn('project_id', $projectIds);
            }
        }

        if ($request->has('project_id') && $request->project_id) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->has('year') && $request->year) {
            $query->where('week_year', $request->year);
        }

        $stats = [
            'total_trainings' => $query->count(),
            'total_participants' => $query->sum('participants'),
            'total_hours' => $query->sum('training_hours'),
            'internal_trainings' => (clone $query)->where('by_internal', true)->count(),
            'external_trainings' => (clone $query)->where('by_internal', false)->count(),
        ];

        return response()->json(['data' => $stats]);
    }
}
