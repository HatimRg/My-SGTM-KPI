<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\DeviationsExport;
use App\Models\SorReport;
use App\Models\Project;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;

class SorReportController extends Controller
{
    /**
     * Get all SOR reports with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = SorReport::with(['project', 'submitter', 'closer']);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        // Apply filters
        if ($request->has('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('from_date')) {
            $query->where('observation_date', '>=', $request->from_date);
        }

        if ($request->has('to_date')) {
            $query->where('observation_date', '<=', $request->to_date);
        }

        if ($request->has('is_pinned') && $request->is_pinned) {
            $query->where('is_pinned', true);
        }

        // Order by pinned first, then by date
        $reports = $query->orderBy('is_pinned', 'desc')
                         ->orderBy('observation_date', 'desc')
                         ->paginate($request->get('per_page', 15));

        return response()->json($reports);
    }

    public function export(Request $request)
    {
        $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'status' => 'nullable|string',
            'category' => 'nullable|string',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
        ]);

        $user = $request->user();
        $query = SorReport::with(['project', 'submitter', 'closer']);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('from_date')) {
            $query->whereDate('observation_date', '>=', $request->from_date);
        }

        if ($request->filled('to_date')) {
            $query->whereDate('observation_date', '<=', $request->to_date);
        }

        $filters = [
            'project_id' => $request->get('project_id'),
            'status' => $request->get('status'),
            'category' => $request->get('category'),
            'from_date' => $request->get('from_date'),
            'to_date' => $request->get('to_date'),
        ];

        $filename = 'deviations_' . date('Y-m-d_His') . '.xlsx';

        return Excel::download(new DeviationsExport($filters), $filename);
    }

    public function viewPhoto(Request $request, SorReport $sorReport)
    {
        $user = $request->user();

        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        if (!$sorReport->photo_path || !Storage::disk('public')->exists($sorReport->photo_path)) {
            abort(404, 'File not found');
        }

        $path = $sorReport->photo_path;
        $filename = basename($path);
        $mime = Storage::disk('public')->mimeType($path) ?: 'application/octet-stream';

        return response()->stream(function () use ($path) {
            $stream = Storage::disk('public')->readStream($path);
            if ($stream === false) {
                return;
            }
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    public function viewCorrectivePhoto(Request $request, SorReport $sorReport)
    {
        $user = $request->user();

        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        if (!$sorReport->corrective_action_photo_path || !Storage::disk('public')->exists($sorReport->corrective_action_photo_path)) {
            abort(404, 'File not found');
        }

        $path = $sorReport->corrective_action_photo_path;
        $filename = basename($path);
        $mime = Storage::disk('public')->mimeType($path) ?: 'application/octet-stream';

        return response()->stream(function () use ($path) {
            $stream = Storage::disk('public')->readStream($path);
            if ($stream === false) {
                return;
            }
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    /**
     * Get pinned SOR reports (pending corrective action)
     */
    public function pinned(Request $request)
    {
        $user = $request->user();
        $query = SorReport::with(['project', 'submitter', 'closer'])
                          ->where('is_pinned', true);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        $reports = $query->orderBy('pinned_at', 'desc')->get();

        return response()->json(['data' => $reports]);
    }

    /**
     * Store a new SOR report (Problem part)
     * If submit_corrective_action is true, also saves corrective action and marks as closed
     * If submit_later is true, pins the SOR for all users
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            // Problem fields
            'project_id' => 'required|exists:projects,id',
            'company' => 'nullable|string|max:255',
            'observation_date' => 'required|date',
            'observation_time' => 'nullable|string|max:10',
            'zone' => 'nullable|string|max:255',
            'supervisor' => 'nullable|string|max:255',
            'non_conformity' => 'required|string',
            'photo' => 'nullable|image|max:5120',
            'category' => 'required|string',
            'responsible_person' => 'nullable|string|max:255',
            
            // Corrective action fields (optional)
            'deadline' => 'nullable|date',
            'corrective_action' => 'nullable|string',
            'corrective_action_date' => 'nullable|date',
            'corrective_action_time' => 'nullable|string|max:10',
            'corrective_action_photo' => 'nullable|image|max:5120',
            
            // Workflow flags
            'submit_corrective_action' => 'nullable|boolean',
            'submit_later' => 'nullable|boolean',
            
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();
        $project = Project::findOrFail($validated['project_id']);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        $validated['submitted_by'] = $request->user()->id;
        $submitCorrectiveAction = $request->boolean('submit_corrective_action');
        $submitLater = $request->boolean('submit_later');
        
        unset($validated['photo'], $validated['corrective_action_photo'], 
              $validated['submit_corrective_action'], $validated['submit_later']);

        // Set status based on workflow
        if ($submitCorrectiveAction && $request->filled('corrective_action')) {
            $validated['status'] = 'closed';
            $validated['closed_at'] = now();
            $validated['closed_by'] = $request->user()->id;
            $validated['is_pinned'] = false;
        } elseif ($submitLater) {
            $validated['status'] = 'open';
            $validated['is_pinned'] = true;
            $validated['pinned_at'] = now();
        } else {
            $validated['status'] = 'open';
        }

        // Create the report
        $report = SorReport::create($validated);
        $project = Project::find($validated['project_id']);
        $projectCode = $project ? preg_replace('/[^a-zA-Z0-9]/', '_', $project->code ?? $project->name) : 'unknown';

        // Handle problem photo upload
        if ($request->hasFile('photo')) {
            $photo = $request->file('photo');
            $extension = $photo->getClientOriginalExtension();
            $filename = "SOR_{$report->id}_{$projectCode}_problem_" . date('Ymd') . ".{$extension}";
            $path = $photo->storeAs('sor-photos', $filename, 'public');
            $report->update(['photo_path' => $path]);
        }

        // Handle corrective action photo upload
        if ($request->hasFile('corrective_action_photo')) {
            $photo = $request->file('corrective_action_photo');
            $extension = $photo->getClientOriginalExtension();
            $filename = "SOR_{$report->id}_{$projectCode}_corrective_" . date('Ymd') . ".{$extension}";
            $path = $photo->storeAs('sor-photos', $filename, 'public');
            $report->update(['corrective_action_photo_path' => $path]);
        }

        $report->load(['project', 'submitter']);

        // Notify admins and project users
        NotificationService::sorSubmitted($report);

        $message = $submitLater 
            ? 'SOR report created and pinned for follow-up'
            : ($submitCorrectiveAction ? 'SOR report created and closed' : 'SOR report created successfully');

        return response()->json([
            'message' => $message,
            'data' => $report
        ], 201);
    }

    /**
     * Submit corrective action for a pinned SOR report
     */
    public function submitCorrectiveAction(Request $request, SorReport $sorReport)
    {
        $user = $request->user();

        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        $validated = $request->validate([
            'deadline' => 'nullable|date',
            'corrective_action' => 'required|string',
            'corrective_action_date' => 'nullable|date',
            'corrective_action_time' => 'nullable|string|max:10',
            'corrective_action_photo' => 'nullable|image|max:5120',
        ]);

        unset($validated['corrective_action_photo']);

        // Mark as closed and unpin
        $validated['status'] = 'closed';
        $validated['is_pinned'] = false;
        if ($sorReport->status !== 'closed') {
            $validated['closed_at'] = now();
            $validated['closed_by'] = $request->user()->id;
        }

        // Handle corrective action photo
        if ($request->hasFile('corrective_action_photo')) {
            // Delete old corrective action photo if exists
            if ($sorReport->corrective_action_photo_path) {
                Storage::disk('public')->delete($sorReport->corrective_action_photo_path);
            }
            
            $photo = $request->file('corrective_action_photo');
            $extension = $photo->getClientOriginalExtension();
            $project = $sorReport->project;
            $projectCode = $project ? preg_replace('/[^a-zA-Z0-9]/', '_', $project->code ?? $project->name) : 'unknown';
            $filename = "SOR_{$sorReport->id}_{$projectCode}_corrective_" . date('Ymd_His') . ".{$extension}";
            $path = $photo->storeAs('sor-photos', $filename, 'public');
            $validated['corrective_action_photo_path'] = $path;
        }

        $sorReport->update($validated);
        $sorReport->load(['project', 'submitter', 'closer']);

        // Notify admins of corrective action
        NotificationService::sorCorrected($sorReport);

        return response()->json([
            'message' => 'Corrective action submitted and SOR closed',
            'data' => $sorReport
        ]);
    }

    /**
     * Get a specific SOR report
     */
    public function show(SorReport $sorReport)
    {
        $user = request()->user();
        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        return response()->json([
            'data' => $sorReport->load(['project', 'submitter', 'closer'])
        ]);
    }

    /**
     * Update a SOR report
     */
    public function update(Request $request, SorReport $sorReport)
    {
        $user = $request->user();
        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        $validated = $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'company' => 'nullable|string|max:255',
            'observation_date' => 'nullable|date',
            'observation_time' => 'nullable|string|max:10',
            'zone' => 'nullable|string|max:255',
            'supervisor' => 'nullable|string|max:255',
            'non_conformity' => 'nullable|string',
            'photo' => 'nullable|image|max:5120',
            'category' => 'nullable|string',
            'responsible_person' => 'nullable|string|max:255',
            'deadline' => 'nullable|date',
            'corrective_action' => 'nullable|string',
            'corrective_action_date' => 'nullable|date',
            'corrective_action_time' => 'nullable|string|max:10',
            'corrective_action_photo' => 'nullable|image|max:5120',
            'status' => 'nullable|in:open,in_progress,closed',
            'notes' => 'nullable|string',
        ]);

        // Filter out null values so we don't overwrite existing data
        $validated = array_filter($validated, fn($value) => $value !== null);
        unset($validated['photo'], $validated['corrective_action_photo']);

        // Handle photo upload with custom naming
        if ($request->hasFile('photo')) {
            // Delete old photo
            if ($sorReport->photo_path) {
                Storage::disk('public')->delete($sorReport->photo_path);
            }
            
            $photo = $request->file('photo');
            $extension = $photo->getClientOriginalExtension();
            $project = $sorReport->project;
            $projectCode = $project ? preg_replace('/[^a-zA-Z0-9]/', '_', $project->code ?? $project->name) : 'unknown';
            $date = date('Ymd_His');
            
            // Create filename: SOR_{ID}_{PROJECT}_{DATE}.{ext}
            $filename = "SOR_{$sorReport->id}_{$projectCode}_{$date}.{$extension}";
            
            // Store in public/sor-photos directory
            $path = $photo->storeAs('sor-photos', $filename, 'public');
            $validated['photo_path'] = $path;
        }

        // Handle corrective action photo upload
        if ($request->hasFile('corrective_action_photo')) {
            // Delete old corrective action photo
            if ($sorReport->corrective_action_photo_path) {
                Storage::disk('public')->delete($sorReport->corrective_action_photo_path);
            }

            $photo = $request->file('corrective_action_photo');
            $extension = $photo->getClientOriginalExtension();
            $project = $sorReport->project;
            $projectCode = $project ? preg_replace('/[^a-zA-Z0-9]/', '_', $project->code ?? $project->name) : 'unknown';
            $date = date('Ymd_His');

            $filename = "SOR_{$sorReport->id}_{$projectCode}_corrective_{$date}.{$extension}";
            $path = $photo->storeAs('sor-photos', $filename, 'public');
            $validated['corrective_action_photo_path'] = $path;
        }

        // Handle status change to closed
        if (isset($validated['status']) && $validated['status'] === 'closed' && $sorReport->status !== 'closed') {
            $validated['closed_at'] = now();
            $validated['closed_by'] = $request->user()->id;
        }

        $sorReport->update($validated);

        return response()->json([
            'message' => 'SOR report updated successfully',
            'data' => $sorReport->fresh()->load(['project', 'submitter', 'closer'])
        ]);
    }

    /**
     * Delete a SOR report
     */
    public function destroy(SorReport $sorReport)
    {
        $user = request()->user();
        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        // Delete photo if exists
        if ($sorReport->photo_path) {
            Storage::disk('public')->delete($sorReport->photo_path);
        }

        $sorReport->delete();

        return response()->json([
            'message' => 'SOR report deleted successfully'
        ]);
    }

    /**
     * Get available categories
     */
    public function categories()
    {
        return response()->json([
            'data' => SorReport::CATEGORIES
        ]);
    }

    /**
     * Get SOR statistics for dashboard
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $query = SorReport::query();

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($request->has('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        $stats = [
            'total' => (clone $query)->count(),
            'open' => (clone $query)->where('status', 'open')->count(),
            'in_progress' => (clone $query)->where('status', 'in_progress')->count(),
            'closed' => (clone $query)->where('status', 'closed')->count(),
            'overdue' => (clone $query)->overdue()->count(),
            'by_category' => (clone $query)->selectRaw('category, count(*) as count')
                                           ->groupBy('category')
                                           ->pluck('count', 'category'),
        ];

        return response()->json(['data' => $stats]);
    }
}
