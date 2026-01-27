<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\InspectionsExport;
use App\Models\Inspection;
use App\Models\Project;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Maatwebsite\Excel\Facades\Excel;

class InspectionController extends Controller
{
    /**
     * Get all inspections with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        $query = Inspection::with(['project:id,name,code', 'creator:id,name']);

        // Filter by project
        if ($request->project_id) {
            $projectId = (int) $request->project_id;
            if (!$user->hasGlobalProjectScope()) {
                $allowed = Project::query()->visibleTo($user)->whereKey($projectId)->exists();
                if (!$allowed) {
                    return $this->error('Access denied', 403);
                }
            }
            $query->where('project_id', $projectId);
        } else if (!$user->hasGlobalProjectScope()) {
            $projectIds = $user->visibleProjectIds();
            if (is_iterable($projectIds) && count($projectIds) === 0) {
                return $this->success($query->whereRaw('1 = 0')->paginate($request->per_page ?? 50));
            }
            if ($projectIds !== null) {
                $query->whereIn('project_id', $projectIds);
            }
        }

        // Filter by week
        if ($request->week_number && $request->year) {
            $query->forWeek($request->week_number, $request->year);
        }

        // Filter by status
        if ($request->status) {
            $query->where('status', $request->status);
        }

        // Filter by nature
        if ($request->nature) {
            $query->where('nature', $request->nature);
        }

        // Filter by type
        if ($request->type) {
            $query->where('type', $request->type);
        }

        $inspections = $query->orderBy('inspection_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 50);

        return $this->success($inspections);
    }

    public function export(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'status' => 'nullable|in:open,closed',
            'nature' => 'nullable|string',
            'type' => 'nullable|in:internal,external',
        ]);

        $user = $request->user();
        $projectId = (int) $request->project_id;

        if (!$user->hasGlobalProjectScope()) {
            $allowed = Project::query()->visibleTo($user)->whereKey($projectId)->exists();
            if (!$allowed) {
                return $this->error('Access denied', 403);
            }
        }

        $project = Project::findOrFail($projectId);

        $filters = [
            'project_id' => $projectId,
            'status' => $request->get('status'),
            'nature' => $request->get('nature'),
            'type' => $request->get('type'),
        ];

        $filename = 'Inspections_' . ($project->code ?? $project->id) . '_' . date('Y-m-d_His') . '.xlsx';

        return Excel::download(new InspectionsExport($filters), $filename);
    }

    /**
     * Store a new inspection
     */
    public function store(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'inspection_date' => 'required|date',
            'nature' => 'required|string',
            'nature_other' => 'nullable|string|required_if:nature,other',
            'type' => 'required|in:internal,external',
            'location' => 'nullable|string|max:255',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'zone' => 'nullable|string|max:255',
            'inspector' => 'required|string|max:255',
            'enterprise' => 'nullable|string|max:255',
            'status' => 'required|in:open,closed',
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();

        // Check if user has access to this project
        if (!$user->hasGlobalProjectScope()) {
            $hasAccess = Project::query()->visibleTo($user)->whereKey((int) $request->project_id)->exists();
            if (!$hasAccess) {
                return $this->error('Access denied', 403);
            }
        }

        // Calculate week info from inspection date
        $weekInfo = Inspection::calculateWeekFromDate($request->inspection_date);

        $inspection = Inspection::create([
            'project_id' => $request->project_id,
            'created_by' => $user->id,
            'inspection_date' => $request->inspection_date,
            'nature' => $request->nature,
            'nature_other' => $request->nature === 'other' ? $request->nature_other : null,
            'type' => $request->type,
            'location' => $request->location,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'zone' => $request->zone,
            'inspector' => $request->inspector,
            'enterprise' => $request->enterprise,
            'status' => $request->status,
            'week_number' => $weekInfo['week_number'],
            'week_year' => $weekInfo['week_year'],
            'notes' => $request->notes,
        ]);

        return $this->success(
            $inspection->load(['project:id,name,code', 'creator:id,name']),
            'Inspection created successfully',
            201
        );
    }

    /**
     * Get a specific inspection
     */
    public function show(Inspection $inspection)
    {
        return $this->success(
            $inspection->load(['project:id,name,code', 'creator:id,name'])
        );
    }

    /**
     * Update an inspection
     */
    public function update(Request $request, Inspection $inspection)
    {
        $request->validate([
            'project_id' => 'sometimes|exists:projects,id',
            'inspection_date' => 'sometimes|date',
            'nature' => 'sometimes|string',
            'nature_other' => 'nullable|string',
            'type' => 'sometimes|in:internal,external',
            'location' => 'nullable|string|max:255',
            'start_date' => 'sometimes|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'zone' => 'nullable|string|max:255',
            'inspector' => 'sometimes|string|max:255',
            'enterprise' => 'nullable|string|max:255',
            'status' => 'sometimes|in:open,closed',
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();

        $project = Project::findOrFail($inspection->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        // Check access
        if (!$user->canManageProjectActions() && $inspection->created_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $data = $request->only([
            'project_id', 'inspection_date', 'nature', 'nature_other',
            'type', 'location', 'start_date', 'end_date', 'zone',
            'inspector', 'enterprise', 'status', 'notes'
        ]);

        // Recalculate week if inspection_date changed
        if ($request->has('inspection_date')) {
            $weekInfo = Inspection::calculateWeekFromDate($request->inspection_date);
            $data['week_number'] = $weekInfo['week_number'];
            $data['week_year'] = $weekInfo['week_year'];
        }

        // Handle nature_other
        if (isset($data['nature']) && $data['nature'] !== 'other') {
            $data['nature_other'] = null;
        }

        $inspection->update($data);

        return $this->success(
            $inspection->fresh()->load(['project:id,name,code', 'creator:id,name']),
            'Inspection updated successfully'
        );
    }

    /**
     * Delete an inspection
     */
    public function destroy(Request $request, Inspection $inspection)
    {
        $user = $request->user();

        $project = Project::findOrFail($inspection->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        // Check access
        if (!$user->canManageProjectActions() && $inspection->created_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $inspection->delete();

        return $this->success(null, 'Inspection deleted successfully');
    }

    /**
     * Get inspection statistics for KPI
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $year = $request->year ?? date('Y');

        $query = Inspection::where('week_year', $year);

        // Filter by project if specified
        if ($request->project_id) {
            $projectId = (int) $request->project_id;
            if (!$user->hasGlobalProjectScope()) {
                $allowed = Project::query()->visibleTo($user)->whereKey($projectId)->exists();
                if (!$allowed) {
                    return $this->error('Access denied', 403);
                }
            }
            $query->where('project_id', $projectId);
        } else if (!$user->hasGlobalProjectScope()) {
            $projectIds = $user->visibleProjectIds();
            if (is_iterable($projectIds) && count($projectIds) === 0) {
                return $this->success($stats = [
                    'total' => 0,
                    'open' => 0,
                    'closed' => 0,
                    'internal' => 0,
                    'external' => 0,
                    'by_nature' => collect(),
                ]);
            }
            if ($projectIds !== null) {
                $query->whereIn('project_id', $projectIds);
            }
        }

        $stats = [
            'total' => (clone $query)->count(),
            'open' => (clone $query)->open()->count(),
            'closed' => (clone $query)->closed()->count(),
            'internal' => (clone $query)->where('type', 'internal')->count(),
            'external' => (clone $query)->where('type', 'external')->count(),
            'by_nature' => (clone $query)
                ->selectRaw('nature, COUNT(*) as count')
                ->groupBy('nature')
                ->pluck('count', 'nature'),
        ];

        return $this->success($stats);
    }

    /**
     * Get inspection count for a specific week (for KPI auto-fill)
     */
    public function weekCount(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer',
            'year' => 'required|integer',
        ]);

        $count = Inspection::where('project_id', $request->project_id)
            ->forWeek($request->week_number, $request->year)
            ->count();

        return $this->success(['count' => $count]);
    }
}
