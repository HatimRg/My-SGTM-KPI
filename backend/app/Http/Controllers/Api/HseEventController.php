<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HseEvent;
use App\Models\Project;
use App\Services\AuditLogService;
use App\Helpers\WeekHelper;
use Carbon\Carbon;
use Illuminate\Http\Request;

class HseEventController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = HseEvent::with(['project:id,name,code,pole', 'submitter:id,name']);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', (int) $request->project_id);
        }

        if (($pole = $request->get('pole')) !== null && $pole !== '') {
            $query->where('pole', $pole);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('year')) {
            $query->where('event_year', (int) $request->year);
        }

        if ($request->filled('month')) {
            $query->where('event_month', (int) $request->month);
        }

        if ($request->filled('week') && $request->filled('week_year')) {
            $query->where('week_number', (int) $request->week)
                ->where('week_year', (int) $request->week_year);
        }

        if ($request->filled('from_date')) {
            $query->where('event_date', '>=', $request->from_date);
        }

        if ($request->filled('to_date')) {
            $query->where('event_date', '<=', $request->to_date);
        }

        if ($request->boolean('include_archived')) {
            $query->withTrashed();
        }

        $events = $query
            ->orderBy('event_date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($request->get('per_page', 50));

        return $this->paginated($events);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user->isAdminLike() && !$user->isHseManager() && !$user->isResponsable()) {
            return $this->error('Access denied', 403);
        }

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'event_date' => 'required|date',
            'type' => 'required|string|max:50',
            'description' => 'nullable|string',
            'severity' => 'nullable|string|max:30',
            'lost_time' => 'nullable|boolean',
            'lost_days' => 'nullable|integer|min:0',
            'location' => 'nullable|string|max:255',
        ]);

        $project = Project::findOrFail($validated['project_id']);
        if (!$user->canAccessProject($project)) {
            return $this->error('You do not have access to this project', 403);
        }

        $date = Carbon::parse($validated['event_date']);
        $weekInfo = WeekHelper::getWeekFromDate($date);

        $payload = [
            'project_id' => (int) $validated['project_id'],
            'entered_by' => $user->id,
            'event_date' => $date->toDateString(),
            'event_year' => (int) $date->format('Y'),
            'event_month' => (int) $date->format('m'),
            'week_number' => (int) $weekInfo['week'],
            'week_year' => (int) $weekInfo['year'],
            'pole' => $project->pole,
            'type' => $validated['type'],
            'description' => $validated['description'] ?? null,
            'severity' => $validated['severity'] ?? null,
            'lost_time' => (bool) ($validated['lost_time'] ?? false),
            'lost_days' => (int) ($validated['lost_days'] ?? 0),
            'location' => $validated['location'] ?? null,
        ];

        $event = HseEvent::create($payload);
        AuditLogService::record($request, $event, 'create', null, $event->toArray());

        return $this->success($event->load(['project:id,name,code,pole', 'submitter:id,name']), 'HSE event created successfully', 201);
    }

    public function show(Request $request, HseEvent $hseEvent)
    {
        $user = $request->user();
        $project = Project::findOrFail($hseEvent->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        return $this->success($hseEvent->load(['project:id,name,code,pole', 'submitter:id,name']));
    }

    public function update(Request $request, HseEvent $hseEvent)
    {
        $user = $request->user();
        $project = Project::findOrFail($hseEvent->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        if (!$user->isAdminLike() && $hseEvent->entered_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $validated = $request->validate([
            'event_date' => 'sometimes|date',
            'type' => 'sometimes|string|max:50',
            'description' => 'nullable|string',
            'severity' => 'nullable|string|max:30',
            'lost_time' => 'nullable|boolean',
            'lost_days' => 'nullable|integer|min:0',
            'location' => 'nullable|string|max:255',
        ]);

        $old = $hseEvent->toArray();

        if (array_key_exists('event_date', $validated)) {
            $date = Carbon::parse($validated['event_date']);
            $weekInfo = WeekHelper::getWeekFromDate($date);
            $validated['event_date'] = $date->toDateString();
            $validated['event_year'] = (int) $date->format('Y');
            $validated['event_month'] = (int) $date->format('m');
            $validated['week_number'] = (int) $weekInfo['week'];
            $validated['week_year'] = (int) $weekInfo['year'];
        }

        $hseEvent->update($validated);
        AuditLogService::record($request, $hseEvent, 'update', $old, $hseEvent->toArray());

        return $this->success($hseEvent->fresh()->load(['project:id,name,code,pole', 'submitter:id,name']), 'HSE event updated successfully');
    }

    public function destroy(Request $request, HseEvent $hseEvent)
    {
        $user = $request->user();
        $project = Project::findOrFail($hseEvent->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        if (!$user->isAdminLike() && $hseEvent->entered_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $old = $hseEvent->toArray();
        $hseEvent->delete();
        AuditLogService::record($request, $hseEvent, 'delete', $old, null);

        return $this->success(null, 'HSE event archived successfully');
    }
}
