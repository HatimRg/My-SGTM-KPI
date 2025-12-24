<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkPermit;
use App\Models\Project;
use App\Exports\WorkPermitsExport;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Maatwebsite\Excel\Facades\Excel;

class WorkPermitController extends Controller
{
    /**
     * Get all work permits with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        // Check permission
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        // Include archived (soft-deleted) permits if requested
        if ($request->include_archived) {
            $query = WorkPermit::withTrashed()->with(['project:id,name,code', 'creator:id,name']);
        } elseif ($request->only_archived) {
            $query = WorkPermit::onlyTrashed()->with(['project:id,name,code', 'creator:id,name']);
        } else {
            $query = WorkPermit::with(['project:id,name,code', 'creator:id,name']);
        }

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
            $query->where('week_number', $request->week_number)
                  ->where('year', $request->year);
        }

        // Filter by status
        if ($request->status) {
            $query->where('status', $request->status);
        }

        $permits = $query->orderBy('year', 'desc')
            ->orderBy('week_number', 'desc')
            ->orderBy('serial_number', 'asc')
            ->paginate($request->per_page ?? 50);

        return $this->success($permits);
    }

    /**
     * Get permits for a specific week (with previous week's permits for reference)
     */
    public function getWeekPermits(Request $request)
    {
        $user = $request->user();
        
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020',
        ]);

        $projectId = $request->project_id;
        $weekNumber = $request->week_number;
        $year = $request->year;

        if (!$user->hasGlobalProjectScope()) {
            $allowed = Project::query()->visibleTo($user)->whereKey((int) $projectId)->exists();
            if (!$allowed) {
                return $this->error('Access denied', 403);
            }
        }

        // Get current week's permits
        $currentWeekPermits = WorkPermit::with(['project:id,name,code', 'creator:id,name'])
            ->where('project_id', $projectId)
            ->where('week_number', $weekNumber)
            ->where('year', $year)
            ->orderBy('serial_number')
            ->get();

        // Calculate previous week
        $prevWeek = $weekNumber - 1;
        $prevYear = $year;
        if ($prevWeek < 1) {
            $prevWeek = 52;
            $prevYear = $year - 1;
        }

        // Get previous week's permits for reference
        $previousWeekPermits = WorkPermit::with(['project:id,name,code', 'creator:id,name'])
            ->where('project_id', $projectId)
            ->where('week_number', $prevWeek)
            ->where('year', $prevYear)
            ->orderBy('serial_number')
            ->get();

        // Get week dates
        $weekDates = WorkPermit::getWeekDates($weekNumber, $year);
        $prevWeekDates = WorkPermit::getWeekDates($prevWeek, $prevYear);

        return $this->success([
            'current_week' => [
                'week_number' => $weekNumber,
                'year' => $year,
                'week_label' => 'S' . str_pad($weekNumber, 2, '0', STR_PAD_LEFT),
                'start_date' => $weekDates['start'],
                'end_date' => $weekDates['end'],
                'permits' => $currentWeekPermits,
            ],
            'previous_week' => [
                'week_number' => $prevWeek,
                'year' => $prevYear,
                'week_label' => 'S' . str_pad($prevWeek, 2, '0', STR_PAD_LEFT),
                'start_date' => $prevWeekDates['start'],
                'end_date' => $prevWeekDates['end'],
                'permits' => $previousWeekPermits,
            ],
        ]);
    }

    /**
     * Get week info (dates, current week number)
     */
    public function getWeekInfo(Request $request)
    {
        $weekNumber = $request->week_number ?? WorkPermit::getCurrentWeek();
        $year = $request->year ?? WorkPermit::getCurrentYear();
        
        $weekDates = WorkPermit::getWeekDates($weekNumber, $year);

        return $this->success([
            'current_week' => WorkPermit::getCurrentWeek(),
            'current_year' => WorkPermit::getCurrentYear(),
            'requested_week' => $weekNumber,
            'requested_year' => $year,
            'week_label' => 'S' . str_pad($weekNumber, 2, '0', STR_PAD_LEFT),
            'start_date' => $weekDates['start'],
            'end_date' => $weekDates['end'],
        ]);
    }

    /**
     * Store a new work permit
     */
    public function store(Request $request)
    {
        $user = $request->user();
        
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020',
            'is_prolongation' => 'boolean',
            'type_cold' => 'boolean',
            'type_work_at_height' => 'boolean',
            'type_hot_work' => 'boolean',
            'type_confined_spaces' => 'boolean',
            'type_electrical_isolation' => 'boolean',
            'type_energized_work' => 'boolean',
            'type_excavation' => 'boolean',
            'type_mechanical_isolation' => 'boolean',
            'type_7inch_grinder' => 'boolean',
            'description' => 'nullable|string',
            'area' => 'nullable|string|max:255',
            'permit_user' => 'required|string|max:255',
            'signed_by' => 'nullable|string|max:255',
            'authorizer' => 'nullable|string|max:255',
            'commence_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:commence_date',
            'enterprise' => 'nullable|string|max:255',
        ]);

        // Check if user has access to this project
        if (!$user->hasGlobalProjectScope()) {
            $hasAccess = Project::query()->visibleTo($user)->whereKey((int) $request->project_id)->exists();
            if (!$hasAccess) {
                return $this->error('You do not have access to this project', 403);
            }
        }

        $project = Project::find($request->project_id);
        $serialNumber = WorkPermit::getNextSerialNumber(
            $request->project_id,
            $request->week_number,
            $request->year
        );

        $permitNumber = WorkPermit::generatePermitNumber(
            $project->code,
            $request->week_number,
            $serialNumber
        );
        
        // Find next available serial number if current one is taken
        while (WorkPermit::withTrashed()->where('permit_number', $permitNumber)->exists()) {
            $serialNumber++;
            $permitNumber = WorkPermit::generatePermitNumber(
                $project->code,
                $request->week_number,
                $serialNumber
            );
        }

        $permit = WorkPermit::create([
            'project_id' => $request->project_id,
            'week_number' => $request->week_number,
            'year' => $request->year,
            'is_prolongation' => $request->is_prolongation ?? false,
            'permit_number' => $permitNumber,
            'serial_number' => $serialNumber,
            'type_cold' => $request->type_cold ?? true, // Always true by default
            'type_work_at_height' => $request->type_work_at_height ?? false,
            'type_hot_work' => $request->type_hot_work ?? false,
            'type_confined_spaces' => $request->type_confined_spaces ?? false,
            'type_electrical_isolation' => $request->type_electrical_isolation ?? false,
            'type_energized_work' => $request->type_energized_work ?? false,
            'type_excavation' => $request->type_excavation ?? false,
            'type_mechanical_isolation' => $request->type_mechanical_isolation ?? false,
            'type_7inch_grinder' => $request->type_7inch_grinder ?? false,
            'description' => $request->description,
            'area' => $request->area,
            'permit_user' => $request->permit_user,
            'signed_by' => $request->signed_by,
            'authorizer' => $request->authorizer,
            'commence_date' => $request->commence_date,
            'end_date' => $request->end_date,
            'enterprise' => $request->enterprise,
            'status' => WorkPermit::STATUS_DRAFT,
            'created_by' => $user->id,
        ]);

        $permit->load(['project:id,name,code', 'creator:id,name']);

        return $this->success($permit, 'Work permit created successfully', 201);
    }

    /**
     * Show a single work permit
     */
    public function show(Request $request, WorkPermit $workPermit)
    {
        $user = $request->user();
        
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        // Check project access
        if (!$user->hasGlobalProjectScope()) {
            $hasAccess = Project::query()->visibleTo($user)->whereKey((int) $workPermit->project_id)->exists();
            if (!$hasAccess) {
                return $this->error('Access denied', 403);
            }
        }

        $workPermit->load(['project:id,name,code', 'creator:id,name']);

        return $this->success($workPermit);
    }

    /**
     * Update a work permit
     */
    public function update(Request $request, WorkPermit $workPermit)
    {
        $user = $request->user();
        
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        // Check project access
        if (!$user->hasGlobalProjectScope()) {
            $hasAccess = Project::query()->visibleTo($user)->whereKey((int) $workPermit->project_id)->exists();
            if (!$hasAccess) {
                return $this->error('Access denied', 403);
            }
        }

        $request->validate([
            'is_prolongation' => 'boolean',
            'type_cold' => 'boolean',
            'type_work_at_height' => 'boolean',
            'type_hot_work' => 'boolean',
            'type_confined_spaces' => 'boolean',
            'type_electrical_isolation' => 'boolean',
            'type_energized_work' => 'boolean',
            'type_excavation' => 'boolean',
            'type_mechanical_isolation' => 'boolean',
            'type_7inch_grinder' => 'boolean',
            'description' => 'nullable|string',
            'area' => 'nullable|string|max:255',
            'permit_user' => 'sometimes|required|string|max:255',
            'signed_by' => 'nullable|string|max:255',
            'authorizer' => 'nullable|string|max:255',
            'commence_date' => 'sometimes|required|date',
            'end_date' => 'sometimes|required|date|after_or_equal:commence_date',
            'enterprise' => 'nullable|string|max:255',
            'status' => 'sometimes|in:draft,active,closed,cancelled',
        ]);

        $workPermit->update($request->only([
            'is_prolongation',
            'type_cold',
            'type_work_at_height',
            'type_hot_work',
            'type_confined_spaces',
            'type_electrical_isolation',
            'type_energized_work',
            'type_excavation',
            'type_mechanical_isolation',
            'type_7inch_grinder',
            'description',
            'area',
            'permit_user',
            'signed_by',
            'authorizer',
            'commence_date',
            'end_date',
            'enterprise',
            'status',
        ]));

        $workPermit->load(['project:id,name,code', 'creator:id,name']);

        return $this->success($workPermit, 'Work permit updated successfully');
    }

    /**
     * Delete a work permit
     */
    public function destroy(Request $request, WorkPermit $workPermit)
    {
        $user = $request->user();
        
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        // Check project access
        if (!$user->hasGlobalProjectScope()) {
            $hasAccess = Project::query()->visibleTo($user)->whereKey((int) $workPermit->project_id)->exists();
            if (!$hasAccess) {
                return $this->error('Access denied', 403);
            }
        }

        // Draft permits should be truly deleted so they do not reserve serial numbers.
        if ($workPermit->status === WorkPermit::STATUS_DRAFT) {
            $workPermit->forceDelete();
            return $this->success(null, 'Work permit deleted successfully');
        }

        $workPermit->delete();

        return $this->success(null, 'Work permit archived successfully');
    }

    /**
     * Restore an archived work permit
     */
    public function restore(Request $request, $id)
    {
        $user = $request->user();
        
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        $workPermit = WorkPermit::onlyTrashed()->findOrFail($id);

        // Check project access
        if (!$user->hasGlobalProjectScope()) {
            $hasAccess = Project::query()->visibleTo($user)->whereKey((int) $workPermit->project_id)->exists();
            if (!$hasAccess) {
                return $this->error('Access denied', 403);
            }
        }

        $workPermit->restore();
        $workPermit->load(['project:id,name,code', 'creator:id,name']);

        return $this->success($workPermit, 'Work permit restored successfully');
    }

    /**
     * Copy permits from previous week
     */
    public function copyFromPreviousWeek(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
                return $this->error('Access denied', 403);
            }

            $request->validate([
                'project_id' => 'required|exists:projects,id',
                'week_number' => 'required|integer|min:1|max:53',
                'year' => 'required|integer|min:2020',
                'permit_ids' => 'required|array|min:1',
                'permit_ids.*' => 'integer',
            ]);

            $projectId = $request->project_id;
            $weekNumber = $request->week_number;
            $year = $request->year;

            $project = Project::findOrFail($projectId);
            $weekDates = WorkPermit::getWeekDates($weekNumber, $year);
            $copiedPermits = [];

            foreach ($request->permit_ids as $permitId) {
                $sourcePermit = WorkPermit::find($permitId);
                if (!$sourcePermit) {
                    continue;
                }

                $serialNumber = WorkPermit::getNextSerialNumber($projectId, $weekNumber, $year);

                // Find next available serial number
                while (WorkPermit::withTrashed()->where('permit_number', 
                    WorkPermit::generatePermitNumber($project->code, $weekNumber, $serialNumber)
                )->exists()) {
                    $serialNumber++;
                }
                $permitNumber = WorkPermit::generatePermitNumber($project->code, $weekNumber, $serialNumber);

                $newPermit = WorkPermit::create([
                    'project_id' => $projectId,
                    'week_number' => $weekNumber,
                    'year' => $year,
                    'is_prolongation' => false,
                    'permit_number' => $permitNumber,
                    'serial_number' => $serialNumber,
                    'type_cold' => $sourcePermit->type_cold,
                    'type_work_at_height' => $sourcePermit->type_work_at_height,
                    'type_hot_work' => $sourcePermit->type_hot_work,
                    'type_confined_spaces' => $sourcePermit->type_confined_spaces,
                    'type_electrical_isolation' => $sourcePermit->type_electrical_isolation,
                    'type_energized_work' => $sourcePermit->type_energized_work,
                    'type_excavation' => $sourcePermit->type_excavation,
                    'type_mechanical_isolation' => $sourcePermit->type_mechanical_isolation,
                    'type_7inch_grinder' => $sourcePermit->type_7inch_grinder,
                    'description' => $sourcePermit->description,
                    'area' => $sourcePermit->area,
                    'permit_user' => $sourcePermit->permit_user,
                    'signed_by' => $sourcePermit->signed_by,
                    'authorizer' => $sourcePermit->authorizer,
                    'commence_date' => $weekDates['start'],
                    'end_date' => $weekDates['end'],
                    'enterprise' => $sourcePermit->enterprise,
                    'status' => WorkPermit::STATUS_DRAFT,
                    'created_by' => $user->id,
                ]);

                $copiedPermits[] = $newPermit;
            }

            return $this->success([
                'copied_count' => count($copiedPermits),
                'permits' => $copiedPermits,
            ], count($copiedPermits) . ' permit(s) copied successfully');
        } catch (\Exception $e) {
            \Log::error('Copy permits error', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            return $this->error('Failed to copy permits: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Reinitialize permit numbers for a week
     */
    public function reinitializeNumbers(Request $request)
    {
        $user = $request->user();
        
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020',
        ]);

        // Check project access
        if (!$user->hasGlobalProjectScope()) {
            $hasAccess = Project::query()->visibleTo($user)->whereKey((int) $request->project_id)->exists();
            if (!$hasAccess) {
                return $this->error('Access denied', 403);
            }
        }

        $count = WorkPermit::reinitializePermitNumbers(
            $request->project_id,
            $request->week_number,
            $request->year
        );

        return $this->success([
            'updated_count' => $count,
        ], "Permit numbers reinitialized for {$count} permits");
    }

    /**
     * Activate all draft permits for a week (launch)
     */
    public function launchWeek(Request $request)
    {
        $user = $request->user();
        
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:53',
            'year' => 'required|integer|min:2020',
        ]);

        try {
            // First reinitialize numbers
            WorkPermit::reinitializePermitNumbers(
                $request->project_id,
                $request->week_number,
                $request->year
            );

            // Then activate all draft permits
            $updated = WorkPermit::where('project_id', $request->project_id)
                ->where('week_number', $request->week_number)
                ->where('year', $request->year)
                ->where('status', WorkPermit::STATUS_DRAFT)
                ->update(['status' => WorkPermit::STATUS_ACTIVE]);

            return $this->success([
                'activated_count' => $updated,
            ], "{$updated} permit(s) launched successfully");
        } catch (\Exception $e) {
            \Log::error('Launch week error', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            return $this->error('Failed to launch week: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Export permits for a week to Excel
     */
    public function export(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:53',
            'year' => 'required|integer|min:2020',
        ]);

        $user = $request->user();
        
        // Check permission
        if (!$user->isAdminLike() && !$user->canAccessWorkPermits()) {
            return $this->error('Access denied', 403);
        }

        // Non-admins can only export permits for their projects
        if (!$user->hasGlobalProjectScope()) {
            $hasAccess = Project::query()->visibleTo($user)->whereKey((int) $request->project_id)->exists();
            if (!$hasAccess) {
                return $this->error('Access denied', 403);
            }
        }

        $project = Project::find($request->project_id);
        $weekFormatted = 'S' . str_pad($request->week_number, 2, '0', STR_PAD_LEFT);
        $filename = "Permis_{$project->code}_{$weekFormatted}_{$request->year}.xlsx";

        return Excel::download(
            new WorkPermitsExport($request->project_id, $request->week_number, $request->year),
            $filename
        );
    }
}
