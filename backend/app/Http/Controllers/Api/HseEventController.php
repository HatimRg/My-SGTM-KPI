<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HseEvent;
use App\Models\Project;
use App\Services\AuditLogService;
use App\Helpers\WeekHelper;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class HseEventController extends Controller
{
    private const ACCIDENT_TYPES = ['work_accident', 'incident', 'near_miss', 'road_accident'];

    private function validateAccidentDetails(Request $request, ?string $severity = null, bool $requireDetails = false): void
    {
        $baseRule = $requireDetails ? 'required' : 'sometimes';

        $request->validate([
            'details' => $baseRule . '|array',
            'details.schema_version' => $baseRule . '|string|in:accident_v1',
            'details.category' => $baseRule . '|string|in:' . implode(',', self::ACCIDENT_TYPES),
            'details.exact_location' => $baseRule . '|string|max:255',
            'details.event_time' => 'nullable|string|max:20',
            'details.shift' => $baseRule . '|string|in:day,night',
            'details.day_of_week' => 'nullable|string|max:20',

            'details.victims_count' => $baseRule . '|integer|min:1|max:20',
            'details.victims' => $baseRule . '|array|min:1|max:20',
            'details.victims.*.full_name' => $baseRule . '|string|max:255',
            'details.victims.*.matricule' => 'nullable|string|max:50',
            'details.victims.*.company' => $baseRule . '|string|in:sgtm,subcontractor',
            'details.victims.*.subcontractor_name' => 'nullable|string|max:255',
            'details.victims.*.job_title' => 'nullable|string|max:255',
            'details.victims.*.age_range' => 'nullable|string|max:20',
            'details.victims.*.experience_range' => 'nullable|string|max:30',
            'details.victims.*.outcome' => $baseRule . '|string|in:no_injury,first_aid_only,medical_treatment_no_lost_time,lost_time_accident,serious_hospitalization,fatal',
            'details.victims.*.body_part' => 'nullable|string|max:50',
            'details.victims.*.injury_type' => 'nullable|string|max:50',
            'details.victims.*.injury_type_other' => 'nullable|string|max:255',
            'details.victims.*.death_timing' => 'nullable|string|in:same_day,later',
            'details.victims.*.death_date' => 'nullable|date',
            'details.victims.*.death_place' => 'nullable|string|in:on_site,during_evacuation,medical_facility',

            'details.activity' => $baseRule . '|string|max:50',
            'details.activity_other' => 'nullable|string|max:255',

            'details.ground_condition' => $baseRule . '|string|max:50',
            'details.lighting' => $baseRule . '|string|max:50',
            'details.weather' => $baseRule . '|string|max:50',
            'details.work_area' => $baseRule . '|string|max:50',

            'details.ppe_worn' => 'nullable|array',
            'details.ppe_worn.*' => 'string|max:50',
            'details.ppe_other' => 'nullable|string|max:255',
            'details.collective_protections' => 'nullable|string|max:50',

            'details.immediate_cause' => $baseRule . '|string|max:50',
            'details.immediate_cause_other' => 'nullable|string|max:255',

            'details.root_causes' => $baseRule . '|array|min:1',
            'details.root_causes.*' => $baseRule . '|string|max:50',
            'details.method_conformity' => 'nullable|string|max:50',

            'details.immediate_actions' => 'nullable|array',
            'details.immediate_actions.*' => 'string|max:50',

            'details.corrective_actions' => 'nullable|array',
            'details.corrective_actions.*.type' => 'nullable|string|max:50',
            'details.corrective_actions.*.description' => 'nullable|string|max:2000',
            'details.corrective_actions.*.responsible_role' => 'nullable|string|max:255',
            'details.corrective_actions.*.deadline' => 'nullable|date',
            'details.corrective_actions.*.status' => 'nullable|string|max:50',

            'details.investigation_completed' => 'nullable|boolean',
            'details.accident_closed' => 'nullable|boolean',
            'details.closure_date' => 'nullable|date',
            'details.closed_by_role' => 'nullable|string|max:255',
        ]);

        $details = $request->input('details');
        if (!is_array($details)) {
            return;
        }

        $errors = [];

        if (isset($details['victims_count'], $details['victims']) && is_array($details['victims'])) {
            if ((int) $details['victims_count'] !== count($details['victims'])) {
                $errors['details.victims'] = ['Victims count does not match victims list'];
            }
        }

        if (isset($details['victims']) && is_array($details['victims'])) {
            foreach ($details['victims'] as $i => $v) {
                if (!is_array($v)) {
                    $errors["details.victims.$i"] = ['Invalid victim object'];
                    continue;
                }

                if (($v['company'] ?? null) === 'subcontractor' && empty($v['subcontractor_name'])) {
                    $errors["details.victims.$i.subcontractor_name"] = ['Subcontractor name is required'];
                }

                $outcome = (string) ($v['outcome'] ?? '');
                if ($outcome && $outcome !== 'no_injury') {
                    if (empty($v['body_part'])) {
                        $errors["details.victims.$i.body_part"] = ['Body part is required'];
                    }
                    if (empty($v['injury_type'])) {
                        $errors["details.victims.$i.injury_type"] = ['Injury type is required'];
                    }
                    if (($v['injury_type'] ?? null) === 'other' && empty($v['injury_type_other'])) {
                        $errors["details.victims.$i.injury_type_other"] = ['Please specify the injury type'];
                    }
                }

                if ($outcome === 'fatal') {
                    if (empty($v['death_timing'])) {
                        $errors["details.victims.$i.death_timing"] = ['Death timing is required'];
                    }
                    if (empty($v['death_place'])) {
                        $errors["details.victims.$i.death_place"] = ['Place of death is required'];
                    }
                    if (($v['death_timing'] ?? null) === 'later' && empty($v['death_date'])) {
                        $errors["details.victims.$i.death_date"] = ['Death date is required'];
                    }
                }
            }
        }

        if (($details['activity'] ?? null) === 'other' && empty($details['activity_other'])) {
            $errors['details.activity_other'] = ['Please specify the activity'];
        }
        if (($details['immediate_cause'] ?? null) === 'other' && empty($details['immediate_cause_other'])) {
            $errors['details.immediate_cause_other'] = ['Please specify the immediate cause'];
        }

        if (($details['accident_closed'] ?? false) && (empty($details['closure_date']) || empty($details['closed_by_role']))) {
            if (empty($details['closure_date'])) {
                $errors['details.closure_date'] = ['Closure date is required when accident is closed'];
            }
            if (empty($details['closed_by_role'])) {
                $errors['details.closed_by_role'] = ['Closed by role is required when accident is closed'];
            }
        }

        if (in_array((string) $severity, ['major', 'critical', 'fatal'], true) && empty($details['method_conformity'])) {
            $errors['details.method_conformity'] = ['Method conformity is required for major/critical/fatal accidents'];
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function ensureWriteAccess($user, HseEvent $hseEvent): void
    {
        if (!$user->canManageProjectActions() && (int) $hseEvent->entered_by !== (int) $user->id) {
            abort(403, 'Access denied');
        }
    }

    private function getAttachments(HseEvent $hseEvent): array
    {
        $details = $hseEvent->details;
        if (!is_array($details)) {
            return [];
        }

        $attachments = $details['attachments'] ?? [];
        return is_array($attachments) ? array_values($attachments) : [];
    }

    private function saveAttachments(HseEvent $hseEvent, array $attachments): void
    {
        $details = $hseEvent->details;
        if (!is_array($details)) {
            $details = [];
        }

        $details['attachments'] = array_values($attachments);
        $hseEvent->details = $details;
        $hseEvent->save();
    }

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
            'details' => 'nullable|array',
        ]);

        if (in_array($validated['type'], self::ACCIDENT_TYPES, true)) {
            $this->validateAccidentDetails($request, $validated['severity'] ?? null, true);
        }

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
            'details' => $validated['details'] ?? null,
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
            'details' => 'nullable|array',
        ]);

        $type = $validated['type'] ?? $hseEvent->type;
        $severity = $validated['severity'] ?? $hseEvent->severity;
        if (in_array($type, self::ACCIDENT_TYPES, true)) {
            $requireDetails = array_key_exists('type', $validated) && in_array($type, self::ACCIDENT_TYPES, true) && empty($hseEvent->details);
            if ($request->has('details') || $requireDetails) {
                $this->validateAccidentDetails($request, $severity, $requireDetails);
            }
        }

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

    public function attachments(Request $request, HseEvent $hseEvent)
    {
        $user = $request->user();
        $project = Project::findOrFail($hseEvent->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $attachments = $this->getAttachments($hseEvent);
        $attachments = array_map(function ($a) use ($hseEvent) {
            if (!is_array($a)) {
                return null;
            }

            $id = (string) ($a['id'] ?? '');
            return array_merge($a, [
                'id' => $id,
                'url' => $id ? url("/api/hse-events/{$hseEvent->id}/attachments/{$id}") : null,
            ]);
        }, $attachments);

        $attachments = array_values(array_filter($attachments));

        return $this->success($attachments);
    }

    public function uploadAttachment(Request $request, HseEvent $hseEvent)
    {
        $user = $request->user();
        $project = Project::findOrFail($hseEvent->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $this->ensureWriteAccess($user, $hseEvent);

        $validated = $request->validate([
            'file' => 'required|file|max:20480|mimes:pdf,jpg,jpeg,png,webp,doc,docx,xls,xlsx',
            'label' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:50',
        ]);

        $file = $request->file('file');
        $baseDir = "hse_events/{$hseEvent->id}/attachments";
        $path = $file->store($baseDir, 'public');

        $attachmentId = (string) Str::uuid();
        $attachment = [
            'id' => $attachmentId,
            'label' => $validated['label'] ?? null,
            'category' => $validated['category'] ?? null,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'file_path' => $path,
            'uploaded_by' => $user ? (int) $user->id : null,
            'uploaded_at' => now()->toISOString(),
        ];

        $attachments = $this->getAttachments($hseEvent);
        $attachments[] = $attachment;
        $this->saveAttachments($hseEvent, $attachments);

        AuditLogService::record($request, $hseEvent, 'upload_attachment', null, $attachment);

        return $this->success([
            'attachment' => array_merge($attachment, [
                'url' => url("/api/hse-events/{$hseEvent->id}/attachments/{$attachmentId}"),
            ]),
            'attachments' => $this->getAttachments($hseEvent),
        ], 'Attachment uploaded successfully', 201);
    }

    public function viewAttachment(Request $request, HseEvent $hseEvent, string $attachmentId)
    {
        $user = $request->user();
        $project = Project::findOrFail($hseEvent->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $attachments = $this->getAttachments($hseEvent);
        $found = null;
        foreach ($attachments as $a) {
            if (is_array($a) && (string) ($a['id'] ?? '') === (string) $attachmentId) {
                $found = $a;
                break;
            }
        }

        if (!$found) {
            abort(404, 'Attachment not found');
        }

        $path = $found['file_path'] ?? null;
        if (!$path || !Storage::disk('public')->exists($path)) {
            abort(404, 'File not found');
        }

        $filename = $found['original_name'] ?? basename($path);
        $mime = $found['mime_type'] ?? 'application/octet-stream';

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

    public function deleteAttachment(Request $request, HseEvent $hseEvent, string $attachmentId)
    {
        $user = $request->user();
        $project = Project::findOrFail($hseEvent->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $this->ensureWriteAccess($user, $hseEvent);

        $attachments = $this->getAttachments($hseEvent);
        $kept = [];
        $deleted = null;

        foreach ($attachments as $a) {
            if (!is_array($a)) {
                continue;
            }

            if ((string) ($a['id'] ?? '') === (string) $attachmentId) {
                $deleted = $a;
                continue;
            }

            $kept[] = $a;
        }

        if (!$deleted) {
            abort(404, 'Attachment not found');
        }

        $path = $deleted['file_path'] ?? null;
        if ($path) {
            Storage::disk('public')->delete($path);
        }

        $this->saveAttachments($hseEvent, $kept);
        AuditLogService::record($request, $hseEvent, 'delete_attachment', $deleted, null);

        return $this->success([
            'attachments' => $this->getAttachments($hseEvent),
        ], 'Attachment deleted successfully');
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
