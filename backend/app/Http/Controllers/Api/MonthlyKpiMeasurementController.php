<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MonthlyKpiMeasurement;
use App\Models\Project;
use App\Services\AuditLogService;
use Illuminate\Http\Request;

class MonthlyKpiMeasurementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = MonthlyKpiMeasurement::with(['project:id,name,code,pole', 'submitter:id,name']);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', (int) $request->project_id);
        }

        if ($request->filled('year')) {
            $query->where('year', (int) $request->year);
        }

        if ($request->filled('month')) {
            $query->where('month', (int) $request->month);
        }

        if ($request->filled('indicator')) {
            $query->where('indicator', $request->indicator);
        }

        if ($request->boolean('include_archived')) {
            $query->withTrashed();
        }

        $rows = $query
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($request->get('per_page', 50));

        return $this->paginated($rows);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user->isAdminLike() && !$user->isHseManager() && !$user->isResponsable()) {
            return $this->error('Access denied', 403);
        }

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'year' => 'required|integer|min:2000|max:2100',
            'month' => 'required|integer|min:1|max:12',
            'indicator' => 'required|string|max:50',
            'value' => 'required|numeric',
            'method' => 'nullable|string|max:255',
        ]);

        $project = Project::findOrFail($validated['project_id']);
        if (!$user->canAccessProject($project)) {
            return $this->error('You do not have access to this project', 403);
        }

        $key = [
            'project_id' => (int) $validated['project_id'],
            'year' => (int) $validated['year'],
            'month' => (int) $validated['month'],
            'indicator' => $validated['indicator'],
        ];

        $existing = MonthlyKpiMeasurement::withTrashed()->where($key)->first();
        $old = $existing?->toArray();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }

            $existing->fill([
                'entered_by' => $user->id,
                'value' => $validated['value'],
                'method' => $validated['method'] ?? null,
            ]);
            $existing->save();
            $row = $existing;

            AuditLogService::record($request, $row, 'update', $old, $row->toArray());
        } else {
            $row = MonthlyKpiMeasurement::create(array_merge($key, [
                'entered_by' => $user->id,
                'value' => $validated['value'],
                'method' => $validated['method'] ?? null,
            ]));

            AuditLogService::record($request, $row, 'create', null, $row->toArray());
        }

        return $this->success($row->load(['project:id,name,code,pole', 'submitter:id,name']), 'Monthly KPI measurement saved successfully', 201);
    }

    public function show(Request $request, MonthlyKpiMeasurement $monthlyKpiMeasurement)
    {
        $user = $request->user();
        $project = Project::findOrFail($monthlyKpiMeasurement->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        return $this->success($monthlyKpiMeasurement->load(['project:id,name,code,pole', 'submitter:id,name']));
    }

    public function update(Request $request, MonthlyKpiMeasurement $monthlyKpiMeasurement)
    {
        $user = $request->user();
        $project = Project::findOrFail($monthlyKpiMeasurement->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        if (!$user->isAdminLike() && $monthlyKpiMeasurement->entered_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $validated = $request->validate([
            'value' => 'sometimes|numeric',
            'method' => 'nullable|string|max:255',
        ]);

        $old = $monthlyKpiMeasurement->toArray();
        $monthlyKpiMeasurement->update($validated);
        AuditLogService::record($request, $monthlyKpiMeasurement, 'update', $old, $monthlyKpiMeasurement->toArray());

        return $this->success($monthlyKpiMeasurement->fresh()->load(['project:id,name,code,pole', 'submitter:id,name']), 'Monthly KPI measurement updated successfully');
    }

    public function destroy(Request $request, MonthlyKpiMeasurement $monthlyKpiMeasurement)
    {
        $user = $request->user();
        $project = Project::findOrFail($monthlyKpiMeasurement->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        if (!$user->isAdminLike() && $monthlyKpiMeasurement->entered_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $old = $monthlyKpiMeasurement->toArray();
        $monthlyKpiMeasurement->delete();
        AuditLogService::record($request, $monthlyKpiMeasurement, 'delete', $old, null);

        return $this->success(null, 'Monthly KPI measurement archived successfully');
    }
}
