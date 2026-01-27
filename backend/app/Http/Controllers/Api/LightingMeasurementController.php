<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LightingMeasurement;
use App\Models\Project;
use App\Services\AuditLogService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class LightingMeasurementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = LightingMeasurement::with(['project:id,name,code,pole', 'submitter:id,name']);

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

        if ($request->boolean('include_archived')) {
            $query->withTrashed();
        }

        $rows = $query
            ->orderBy('measured_at', 'desc')
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
            'measured_at' => 'required|date',
            'location' => 'required|string|max:255',
            'lux_value' => 'required|numeric|min:0',
            'threshold' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $project = Project::findOrFail($validated['project_id']);
        if (!$user->canAccessProject($project)) {
            return $this->error('You do not have access to this project', 403);
        }

        $date = Carbon::parse($validated['measured_at']);
        $threshold = array_key_exists('threshold', $validated) ? $validated['threshold'] : null;
        $isCompliant = null;
        if ($threshold !== null) {
            $isCompliant = (float) $validated['lux_value'] >= (float) $threshold;
        }

        $row = LightingMeasurement::create([
            'project_id' => (int) $validated['project_id'],
            'entered_by' => $user->id,
            'measured_at' => $date->toDateString(),
            'year' => (int) $date->format('Y'),
            'month' => (int) $date->format('m'),
            'location' => $validated['location'],
            'lux_value' => $validated['lux_value'],
            'threshold' => $threshold,
            'is_compliant' => $isCompliant,
            'notes' => $validated['notes'] ?? null,
        ]);

        AuditLogService::record($request, $row, 'create', null, $row->toArray());

        return $this->success($row->load(['project:id,name,code,pole', 'submitter:id,name']), 'Lighting measurement created successfully', 201);
    }

    public function show(Request $request, LightingMeasurement $lightingMeasurement)
    {
        $user = $request->user();
        $project = Project::findOrFail($lightingMeasurement->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        return $this->success($lightingMeasurement->load(['project:id,name,code,pole', 'submitter:id,name']));
    }

    public function update(Request $request, LightingMeasurement $lightingMeasurement)
    {
        $user = $request->user();
        $project = Project::findOrFail($lightingMeasurement->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        if (!$user->canManageProjectActions() && $lightingMeasurement->entered_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $validated = $request->validate([
            'measured_at' => 'sometimes|date',
            'location' => 'sometimes|string|max:255',
            'lux_value' => 'sometimes|numeric|min:0',
            'threshold' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $old = $lightingMeasurement->toArray();

        if (array_key_exists('measured_at', $validated)) {
            $date = Carbon::parse($validated['measured_at']);
            $validated['measured_at'] = $date->toDateString();
            $validated['year'] = (int) $date->format('Y');
            $validated['month'] = (int) $date->format('m');
        }

        $luxValue = array_key_exists('lux_value', $validated) ? $validated['lux_value'] : $lightingMeasurement->lux_value;
        $threshold = array_key_exists('threshold', $validated) ? $validated['threshold'] : $lightingMeasurement->threshold;
        if ($threshold !== null) {
            $validated['is_compliant'] = (float) $luxValue >= (float) $threshold;
        } else {
            $validated['is_compliant'] = null;
        }

        $lightingMeasurement->update($validated);
        AuditLogService::record($request, $lightingMeasurement, 'update', $old, $lightingMeasurement->toArray());

        return $this->success($lightingMeasurement->fresh()->load(['project:id,name,code,pole', 'submitter:id,name']), 'Lighting measurement updated successfully');
    }

    public function destroy(Request $request, LightingMeasurement $lightingMeasurement)
    {
        $user = $request->user();
        $project = Project::findOrFail($lightingMeasurement->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        if (!$user->canManageProjectActions() && $lightingMeasurement->entered_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $old = $lightingMeasurement->toArray();
        $lightingMeasurement->delete();
        AuditLogService::record($request, $lightingMeasurement, 'delete', $old, null);

        return $this->success(null, 'Lighting measurement archived successfully');
    }
}
