<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AwarenessSession;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class AwarenessSessionController extends Controller
{
    /**
     * Get all awareness sessions with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = AwarenessSession::with(['project', 'submitter']);

        // Filter by user's projects if not admin
        if (!$user->isAdmin()) {
            $projectIds = $user->projects()->pluck('projects.id');
            $query->whereIn('project_id', $projectIds);
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
        $sessions = $query->orderBy('date', 'desc')
                          ->paginate($request->get('per_page', 50));

        return response()->json($sessions);
    }

    /**
     * Store a new awareness session
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'date' => 'required|date',
            'week_number' => 'required|integer|min:1|max:52',
            'week_year' => 'required|integer|min:2020|max:2100',
            'by_name' => 'required|string|max:255',
            'theme' => 'required|string|max:500',
            'duration_minutes' => 'required|integer|min:15|max:60',
            'participants' => 'required|integer|min:1',
            'session_hours' => 'required|numeric|min:0',
        ]);

        $validated['submitted_by'] = $request->user()->id;

        $session = AwarenessSession::create($validated);
        $session->load(['project', 'submitter']);

        // Notify admins
        NotificationService::awarenessSubmitted($session);

        return response()->json([
            'message' => 'Awareness session created successfully',
            'data' => $session,
        ], 201);
    }

    /**
     * Show a specific awareness session
     */
    public function show(AwarenessSession $awarenessSession)
    {
        $user = request()->user();

        // Check access
        if (!$user->isAdmin()) {
            $projectIds = $user->projects()->pluck('projects.id')->toArray();
            if (!in_array($awarenessSession->project_id, $projectIds)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        return response()->json([
            'data' => $awarenessSession->load(['project', 'submitter']),
        ]);
    }

    /**
     * Update an awareness session
     */
    public function update(Request $request, AwarenessSession $awarenessSession)
    {
        $user = $request->user();

        // Check access
        if (!$user->isAdmin() && $awarenessSession->submitted_by !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'project_id' => 'sometimes|exists:projects,id',
            'date' => 'sometimes|date',
            'week_number' => 'sometimes|integer|min:1|max:52',
            'week_year' => 'sometimes|integer|min:2020|max:2100',
            'by_name' => 'sometimes|string|max:255',
            'theme' => 'sometimes|string|max:500',
            'duration_minutes' => 'sometimes|integer|min:15|max:60',
            'participants' => 'sometimes|integer|min:1',
            'session_hours' => 'sometimes|numeric|min:0',
        ]);

        $awarenessSession->update($validated);

        return response()->json([
            'message' => 'Awareness session updated successfully',
            'data' => $awarenessSession->fresh()->load(['project', 'submitter']),
        ]);
    }

    /**
     * Delete an awareness session
     */
    public function destroy(AwarenessSession $awarenessSession)
    {
        $user = request()->user();

        // Only admin or submitter can delete
        if (!$user->isAdmin() && $awarenessSession->submitted_by !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $awarenessSession->delete();

        return response()->json([
            'message' => 'Awareness session deleted successfully',
        ]);
    }

    /**
     * Get awareness session statistics
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $query = AwarenessSession::query();

        if (!$user->isAdmin()) {
            $projectIds = $user->projects()->pluck('projects.id');
            $query->whereIn('project_id', $projectIds);
        }

        if ($request->has('project_id') && $request->project_id) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->has('year') && $request->year) {
            $query->where('week_year', $request->year);
        }

        $stats = [
            'total_sessions' => $query->count(),
            'total_participants' => $query->sum('participants'),
            'total_hours' => $query->sum('session_hours'),
        ];

        return response()->json(['data' => $stats]);
    }
}
