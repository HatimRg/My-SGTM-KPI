<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AwarenessSession;
use App\Models\Inspection;
use App\Models\KpiReport;
use App\Models\Project;
use App\Models\Training;
use App\Models\User;
use App\Models\Worker;
use App\Models\WorkerTraining;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Support\ProjectCodeResolver;

class BootstrapController extends Controller
{
    private function ensureAllowed(Request $request): void
    {
        $user = $request->user();

        if (!$user || $user->email !== 'rsp@test.com') {
            abort(404);
        }

        $enabled = app()->environment('local') || filter_var(env('BOOTSTRAP_IMPORT_ENABLED', false), FILTER_VALIDATE_BOOLEAN);
        if (!$enabled) {
            abort(403, 'Bootstrap tools are disabled. Set BOOTSTRAP_IMPORT_ENABLED=true on the backend environment.');
        }
    }

    public function template(Request $request)
    {
        $this->ensureAllowed($request);

        $template = [
            'version' => 1,
            'generated_at' => now()->toIso8601String(),
            'projects' => [
                [
                    'code' => 'PRJ-001',
                    'name' => 'Example Project',
                    'description' => null,
                    'location' => null,
                    'start_date' => null,
                    'end_date' => null,
                    'status' => 'active',
                    'pole' => null,
                    'client_name' => null,
                    'zones' => null,
                    'created_by_email' => 'rsp@test.com',
                ],
            ],
            'users' => [
                [
                    'email' => 'user@example.com',
                    'name' => 'Example User',
                    'role' => 'user',
                    'phone' => null,
                    'cin' => null,
                    'password' => 'change-me',
                    'is_active' => true,
                    'created_by_email' => 'rsp@test.com',
                ],
            ],
            'project_user' => [
                [
                    'project_code' => 'PRJ-001',
                    'user_email' => 'rsp@test.com',
                    'assigned_at' => null,
                ],
            ],
            'kpi_reports' => [],
            'trainings' => [],
            'awareness_sessions' => [],
            'inspections' => [],
            'workers' => [],
            'worker_trainings' => [],
        ];

        return response()
            ->json($template)
            ->withHeaders([
                'Content-Disposition' => 'attachment; filename="bootstrap-template.json"',
            ]);
    }

    public function export(Request $request)
    {
        $this->ensureAllowed($request);

        @ini_set('max_execution_time', '300');

        $request->validate([
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d',
            'project_code' => 'nullable|string',
        ]);

        $from = $request->get('from');
        $to = $request->get('to');
        $projectCode = $request->get('project_code');

        if ($from && $to && $from > $to) {
            return $this->error('Invalid date range: from must be <= to', 422);
        }

        $projectIdFilter = null;
        if ($projectCode) {
            $projectIdFilter = ProjectCodeResolver::resolveProjectId((string) $projectCode);
            if (!$projectIdFilter) {
                return $this->error('Unknown project_code', 422);
            }
        }

        $projects = Project::query()->with('creator')->get()->map(function (Project $p) {
            return [
                'code' => $p->code,
                'name' => $p->name,
                'description' => $p->description,
                'location' => $p->location,
                'start_date' => optional($p->start_date)->toDateString(),
                'end_date' => optional($p->end_date)->toDateString(),
                'status' => $p->status,
                'pole' => $p->pole,
                'budget' => $p->pole,
                'client_name' => $p->client_name,
                'zones' => $p->zones,
                'created_by_email' => optional($p->creator)->email,
            ];
        })->values();

        $users = User::query()->with('creator')->get()->map(function (User $u) {
            return [
                'email' => $u->email,
                'name' => $u->name,
                'role' => $u->role,
                'phone' => $u->phone,
                'cin' => $u->cin,
                'is_active' => (bool) $u->is_active,
                'created_by_email' => optional($u->creator)->email,
            ];
        })->values();

        $projectUser = DB::table('project_user as pu')
            ->join('projects as p', 'p.id', '=', 'pu.project_id')
            ->join('users as u', 'u.id', '=', 'pu.user_id')
            ->select([
                'p.code as project_code',
                'u.email as user_email',
                'pu.assigned_at as assigned_at',
            ])
            ->get()
            ->values();

        $kpiReportsQuery = KpiReport::query()->with(['project', 'submitter', 'approver']);
        if ($projectIdFilter) {
            $kpiReportsQuery->where('project_id', $projectIdFilter);
        }
        if ($from && $to) {
            $kpiReportsQuery->whereBetween('report_date', [$from, $to]);
        }
        $kpiReports = $kpiReportsQuery->get()->map(function (KpiReport $r) {
            return array_merge($r->only([
                'report_date',
                'report_month',
                'report_year',
                'accidents',
                'accidents_fatal',
                'accidents_serious',
                'accidents_minor',
                'near_misses',
                'first_aid_cases',
                'trainings_conducted',
                'trainings_planned',
                'employees_trained',
                'training_hours',
                'toolbox_talks',
                'inspections_completed',
                'inspections_planned',
                'findings_open',
                'findings_closed',
                'corrective_actions',
                'tg_value',
                'lost_workdays',
                'tf_value',
                'hours_worked',
                'unsafe_acts_reported',
                'unsafe_conditions_reported',
                'emergency_drills',
                'hse_compliance_rate',
                'medical_compliance_rate',
                'noise_monitoring',
                'water_consumption',
                'electricity_consumption',
                'work_permits',
                'notes',
                'status',
                'approved_at',
            ]), [
                'project_code' => optional($r->project)->code,
                'submitted_by_email' => optional($r->submitter)->email,
                'approved_by_email' => optional($r->approver)->email,
            ]);
        })->values();

        $trainingsQuery = Training::query()->with(['project', 'submitter']);
        if ($projectIdFilter) {
            $trainingsQuery->where('project_id', $projectIdFilter);
        }
        if ($from && $to) {
            $trainingsQuery->whereBetween('date', [$from, $to]);
        }
        $trainings = $trainingsQuery->get()->map(function (Training $t) {
            return array_merge($t->only([
                'date',
                'week_number',
                'week_year',
                'by_internal',
                'by_name',
                'external_company',
                'theme',
                'duration_label',
                'duration_hours',
                'participants',
                'training_hours',
            ]), [
                'project_code' => optional($t->project)->code,
                'submitted_by_email' => optional($t->submitter)->email,
            ]);
        })->values();

        $awarenessQuery = AwarenessSession::query()->with(['project', 'submitter']);
        if ($projectIdFilter) {
            $awarenessQuery->where('project_id', $projectIdFilter);
        }
        if ($from && $to) {
            $awarenessQuery->whereBetween('date', [$from, $to]);
        }
        $awarenessSessions = $awarenessQuery->get()->map(function (AwarenessSession $a) {
            return array_merge($a->only([
                'date',
                'week_number',
                'week_year',
                'by_name',
                'theme',
                'duration_minutes',
                'participants',
                'session_hours',
            ]), [
                'project_code' => optional($a->project)->code,
                'submitted_by_email' => optional($a->submitter)->email,
            ]);
        })->values();

        $inspectionsQuery = Inspection::query()->with(['project', 'creator']);
        if ($projectIdFilter) {
            $inspectionsQuery->where('project_id', $projectIdFilter);
        }
        if ($from && $to) {
            $inspectionsQuery->whereBetween('inspection_date', [$from, $to]);
        }
        $inspections = $inspectionsQuery->get()->map(function (Inspection $i) {
            return array_merge($i->only([
                'inspection_date',
                'nature',
                'nature_other',
                'type',
                'location',
                'start_date',
                'end_date',
                'zone',
                'inspector',
                'enterprise',
                'status',
                'week_number',
                'week_year',
                'notes',
            ]), [
                'project_code' => optional($i->project)->code,
                'created_by_email' => optional($i->creator)->email,
            ]);
        })->values();

        $workersQuery = Worker::query()->with(['project', 'creator', 'updater']);
        if ($projectIdFilter) {
            $workersQuery->where('project_id', $projectIdFilter);
        }
        $workers = $workersQuery->get()->map(function (Worker $w) {
            return array_merge($w->only([
                'nom',
                'prenom',
                'fonction',
                'cin',
                'date_naissance',
                'entreprise',
                'date_entree',
                'is_active',
            ]), [
                'project_code' => optional($w->project)->code,
                'created_by_email' => optional($w->creator)->email,
                'updated_by_email' => optional($w->updater)->email,
            ]);
        })->values();

        $workerTrainingsQuery = WorkerTraining::query()->with(['worker', 'creator']);
        if ($from && $to) {
            $workerTrainingsQuery->whereBetween('training_date', [$from, $to]);
        }
        $workerTrainings = $workerTrainingsQuery->get()->map(function (WorkerTraining $wt) {
            return array_merge($wt->only([
                'training_type',
                'training_label',
                'training_date',
                'expiry_date',
                'certificate_path',
            ]), [
                'worker_cin' => optional($wt->worker)->cin,
                'created_by_email' => optional($wt->creator)->email,
            ]);
        })->values();

        $payload = [
            'version' => 1,
            'generated_at' => now()->toIso8601String(),
            'projects' => $projects,
            'users' => $users,
            'project_user' => $projectUser,
            'kpi_reports' => $kpiReports,
            'trainings' => $trainings,
            'awareness_sessions' => $awarenessSessions,
            'inspections' => $inspections,
            'workers' => $workers,
            'worker_trainings' => $workerTrainings,
        ];

        return response()
            ->json($payload)
            ->withHeaders([
                'Content-Disposition' => 'attachment; filename="bootstrap-export.json"',
            ]);
    }

    public function import(Request $request)
    {
        $this->ensureAllowed($request);

        @ini_set('max_execution_time', '300');

        $request->validate([
            'file' => 'required|file|mimes:json,txt|max:51200',
            'dry_run' => 'nullable|boolean',
        ]);

        $dryRun = (bool) $request->boolean('dry_run');
        $data = json_decode(file_get_contents($request->file('file')->getRealPath()), true);

        if (!is_array($data)) {
            return $this->error('Invalid JSON payload', 422);
        }

        $summary = [
            'projects_upserted' => 0,
            'users_upserted' => 0,
            'project_user_attached' => 0,
            'kpi_reports_upserted' => 0,
            'trainings_upserted' => 0,
            'awareness_sessions_upserted' => 0,
            'inspections_upserted' => 0,
            'workers_upserted' => 0,
            'worker_trainings_upserted' => 0,
            'dry_run' => $dryRun,
        ];

        $run = function () use (&$summary, $data, $request) {
            $currentUser = $request->user();

            // Cache email -> id to avoid N+1 queries during import
            $emailToId = User::query()->pluck('id', 'email')->all();
            $resolveUserId = function (?string $email) use (&$emailToId): ?int {
                if (!$email) {
                    return null;
                }
                if (isset($emailToId[$email])) {
                    return (int) $emailToId[$email];
                }

                $id = User::where('email', $email)->value('id');
                if ($id) {
                    $emailToId[$email] = (int) $id;
                    return (int) $id;
                }

                return null;
            };

            $allowedProjectStatuses = [
                Project::STATUS_ACTIVE,
                Project::STATUS_COMPLETED,
                Project::STATUS_ON_HOLD,
                Project::STATUS_CANCELLED,
            ];

            $allowedUserRoles = [
                User::ROLE_ADMIN,
                User::ROLE_RESPONSABLE,
                User::ROLE_USER,
                User::ROLE_SUPERVISOR,
                User::ROLE_ANIMATEUR,
                User::ROLE_HR,
                'sor',
            ];

            $projectCodeToId = [];
            foreach (($data['projects'] ?? []) as $p) {
                if (!isset($p['code']) || !isset($p['name'])) {
                    continue;
                }

                $creatorId = null;
                if (!empty($p['created_by_email'])) {
                    $creatorId = $resolveUserId($p['created_by_email']);
                }

                $project = Project::updateOrCreate(
                    ['code' => $p['code']],
                    [
                        'name' => $p['name'],
                        'description' => $p['description'] ?? null,
                        'location' => $p['location'] ?? null,
                        'start_date' => $p['start_date'] ?? null,
                        'end_date' => $p['end_date'] ?? null,
                        'status' => (isset($p['status']) && in_array($p['status'], $allowedProjectStatuses, true))
                            ? $p['status']
                            : Project::STATUS_ACTIVE,
                        'pole' => $p['pole'] ?? ($p['budget'] ?? null),
                        'client_name' => $p['client_name'] ?? null,
                        'zones' => $p['zones'] ?? null,
                        'created_by' => $creatorId,
                    ]
                );

                $projectCodeToId[$project->code] = $project->id;
                $summary['projects_upserted']++;
            }

            $userEmailToId = [];
            foreach (($data['users'] ?? []) as $u) {
                if (!isset($u['email']) || !isset($u['name'])) {
                    continue;
                }

                $creatorId = null;
                if (!empty($u['created_by_email'])) {
                    $creatorId = $resolveUserId($u['created_by_email']);
                }

                $user = User::updateOrCreate(
                    ['email' => $u['email']],
                    [
                        'name' => $u['name'],
                        'role' => (isset($u['role']) && in_array($u['role'], $allowedUserRoles, true))
                            ? $u['role']
                            : User::ROLE_USER,
                        'phone' => $u['phone'] ?? null,
                        'cin' => $u['cin'] ?? null,
                        'is_active' => array_key_exists('is_active', $u) ? (bool) $u['is_active'] : true,
                        'created_by' => $creatorId,
                    ]
                );

                if (!empty($u['password'])) {
                    $user->password = $u['password'];
                    $user->save();
                }

                $userEmailToId[$user->email] = $user->id;
                $emailToId[$user->email] = (int) $user->id;
                $summary['users_upserted']++;
            }

            foreach (($data['project_user'] ?? []) as $pu) {
                $projectId = $projectCodeToId[$pu['project_code'] ?? ''] ?? null;
                $userId = $userEmailToId[$pu['user_email'] ?? ''] ?? null;

                if (!$projectId || !$userId) {
                    continue;
                }

                DB::table('project_user')->updateOrInsert(
                    ['project_id' => $projectId, 'user_id' => $userId],
                    [
                        'assigned_at' => $pu['assigned_at'] ?? null,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
                $summary['project_user_attached']++;
            }

            foreach (($data['kpi_reports'] ?? []) as $r) {
                $projectId = $projectCodeToId[$r['project_code'] ?? ''] ?? null;
                $submittedBy = $userEmailToId[$r['submitted_by_email'] ?? ''] ?? $currentUser->id;

                if (!$projectId || empty($r['report_date']) || empty($r['report_month']) || empty($r['report_year'])) {
                    continue;
                }

                $approvedBy = null;
                if (!empty($r['approved_by_email'])) {
                    $approvedBy = $userEmailToId[$r['approved_by_email']] ?? $resolveUserId($r['approved_by_email']);
                }

                $report = KpiReport::updateOrCreate(
                    [
                        'project_id' => $projectId,
                        'report_month' => (int) $r['report_month'],
                        'report_year' => (int) $r['report_year'],
                    ],
                    [
                        'submitted_by' => $submittedBy,
                        'report_date' => $r['report_date'],
                        'accidents' => $r['accidents'] ?? 0,
                        'accidents_fatal' => $r['accidents_fatal'] ?? 0,
                        'accidents_serious' => $r['accidents_serious'] ?? 0,
                        'accidents_minor' => $r['accidents_minor'] ?? 0,
                        'near_misses' => $r['near_misses'] ?? 0,
                        'first_aid_cases' => $r['first_aid_cases'] ?? 0,
                        'trainings_conducted' => $r['trainings_conducted'] ?? 0,
                        'trainings_planned' => $r['trainings_planned'] ?? 0,
                        'employees_trained' => $r['employees_trained'] ?? 0,
                        'training_hours' => $r['training_hours'] ?? 0,
                        'toolbox_talks' => $r['toolbox_talks'] ?? 0,
                        'inspections_completed' => $r['inspections_completed'] ?? 0,
                        'inspections_planned' => $r['inspections_planned'] ?? 0,
                        'findings_open' => $r['findings_open'] ?? 0,
                        'findings_closed' => $r['findings_closed'] ?? 0,
                        'corrective_actions' => $r['corrective_actions'] ?? 0,
                        'lost_workdays' => $r['lost_workdays'] ?? 0,
                        'hours_worked' => $r['hours_worked'] ?? 0,
                        'unsafe_acts_reported' => $r['unsafe_acts_reported'] ?? 0,
                        'unsafe_conditions_reported' => $r['unsafe_conditions_reported'] ?? 0,
                        'emergency_drills' => $r['emergency_drills'] ?? 0,
                        'hse_compliance_rate' => $r['hse_compliance_rate'] ?? 0,
                        'medical_compliance_rate' => $r['medical_compliance_rate'] ?? 0,
                        'noise_monitoring' => $r['noise_monitoring'] ?? 0,
                        'water_consumption' => $r['water_consumption'] ?? 0,
                        'electricity_consumption' => $r['electricity_consumption'] ?? 0,
                        'work_permits' => $r['work_permits'] ?? 0,
                        'notes' => $r['notes'] ?? null,
                        'status' => $r['status'] ?? KpiReport::STATUS_DRAFT,
                        'approved_by' => $approvedBy,
                        'approved_at' => $r['approved_at'] ?? null,
                    ]
                );

                $summary['kpi_reports_upserted']++;
            }

            foreach (($data['trainings'] ?? []) as $t) {
                $projectId = $projectCodeToId[$t['project_code'] ?? ''] ?? null;
                $submittedBy = $userEmailToId[$t['submitted_by_email'] ?? ''] ?? $currentUser->id;

                if (!$projectId || empty($t['date']) || empty($t['theme'])) {
                    continue;
                }

                Training::updateOrCreate(
                    [
                        'project_id' => $projectId,
                        'submitted_by' => $submittedBy,
                        'date' => $t['date'],
                        'theme' => $t['theme'],
                    ],
                    [
                        'week_number' => $t['week_number'] ?? (int) now()->isoWeek(),
                        'week_year' => $t['week_year'] ?? (int) now()->isoWeekYear(),
                        'by_internal' => array_key_exists('by_internal', $t) ? (bool) $t['by_internal'] : true,
                        'by_name' => $t['by_name'] ?? null,
                        'external_company' => $t['external_company'] ?? null,
                        'duration_label' => $t['duration_label'] ?? 'N/A',
                        'duration_hours' => $t['duration_hours'] ?? 0,
                        'participants' => $t['participants'] ?? 0,
                        'training_hours' => $t['training_hours'] ?? 0,
                        'photo_path' => $t['photo_path'] ?? null,
                    ]
                );

                $summary['trainings_upserted']++;
            }

            foreach (($data['awareness_sessions'] ?? []) as $a) {
                $projectId = $projectCodeToId[$a['project_code'] ?? ''] ?? null;
                $submittedBy = $userEmailToId[$a['submitted_by_email'] ?? ''] ?? $currentUser->id;

                if (!$projectId || empty($a['date']) || empty($a['theme']) || empty($a['by_name'])) {
                    continue;
                }

                AwarenessSession::updateOrCreate(
                    [
                        'project_id' => $projectId,
                        'submitted_by' => $submittedBy,
                        'date' => $a['date'],
                        'theme' => $a['theme'],
                        'by_name' => $a['by_name'],
                    ],
                    [
                        'week_number' => $a['week_number'] ?? (int) now()->isoWeek(),
                        'week_year' => $a['week_year'] ?? (int) now()->isoWeekYear(),
                        'duration_minutes' => $a['duration_minutes'] ?? 0,
                        'participants' => $a['participants'] ?? 0,
                        'session_hours' => $a['session_hours'] ?? 0,
                    ]
                );

                $summary['awareness_sessions_upserted']++;
            }

            foreach (($data['inspections'] ?? []) as $i) {
                $projectId = $projectCodeToId[$i['project_code'] ?? ''] ?? null;
                $createdBy = $userEmailToId[$i['created_by_email'] ?? ''] ?? $currentUser->id;

                if (!$projectId || empty($i['inspection_date']) || empty($i['inspector'])) {
                    continue;
                }

                Inspection::updateOrCreate(
                    [
                        'project_id' => $projectId,
                        'created_by' => $createdBy,
                        'inspection_date' => $i['inspection_date'],
                        'inspector' => $i['inspector'],
                    ],
                    [
                        'nature' => $i['nature'] ?? Inspection::NATURE_SST,
                        'nature_other' => $i['nature_other'] ?? null,
                        'type' => $i['type'] ?? Inspection::TYPE_INTERNAL,
                        'location' => $i['location'] ?? null,
                        'start_date' => $i['start_date'] ?? $i['inspection_date'],
                        'end_date' => $i['end_date'] ?? null,
                        'zone' => $i['zone'] ?? null,
                        'enterprise' => $i['enterprise'] ?? null,
                        'status' => $i['status'] ?? Inspection::STATUS_OPEN,
                        'week_number' => $i['week_number'] ?? (int) now()->isoWeek(),
                        'week_year' => $i['week_year'] ?? (int) now()->isoWeekYear(),
                        'notes' => $i['notes'] ?? null,
                    ]
                );

                $summary['inspections_upserted']++;
            }

            $workerCinToId = [];
            foreach (($data['workers'] ?? []) as $w) {
                if (empty($w['cin']) || empty($w['nom']) || empty($w['prenom'])) {
                    continue;
                }

                $projectId = $projectCodeToId[$w['project_code'] ?? ''] ?? null;
                $createdBy = $userEmailToId[$w['created_by_email'] ?? ''] ?? $currentUser->id;
                $updatedBy = $userEmailToId[$w['updated_by_email'] ?? ''] ?? $currentUser->id;

                $worker = Worker::updateOrCreate(
                    ['cin' => $w['cin']],
                    [
                        'nom' => $w['nom'],
                        'prenom' => $w['prenom'],
                        'fonction' => $w['fonction'] ?? null,
                        'date_naissance' => $w['date_naissance'] ?? null,
                        'entreprise' => $w['entreprise'] ?? null,
                        'project_id' => $projectId,
                        'date_entree' => $w['date_entree'] ?? null,
                        'is_active' => array_key_exists('is_active', $w) ? (bool) $w['is_active'] : true,
                        'created_by' => $createdBy,
                        'updated_by' => $updatedBy,
                    ]
                );

                $workerCinToId[$worker->cin] = $worker->id;
                $summary['workers_upserted']++;
            }

            foreach (($data['worker_trainings'] ?? []) as $wt) {
                $workerId = $workerCinToId[$wt['worker_cin'] ?? ''] ?? null;
                $createdBy = $userEmailToId[$wt['created_by_email'] ?? ''] ?? $currentUser->id;

                if (!$workerId || empty($wt['training_type']) || empty($wt['training_date'])) {
                    continue;
                }

                WorkerTraining::updateOrCreate(
                    [
                        'worker_id' => $workerId,
                        'training_type' => $wt['training_type'],
                        'training_date' => $wt['training_date'],
                    ],
                    [
                        'training_label' => $wt['training_label'] ?? null,
                        'expiry_date' => $wt['expiry_date'] ?? null,
                        'certificate_path' => $wt['certificate_path'] ?? null,
                        'created_by' => $createdBy,
                    ]
                );

                $summary['worker_trainings_upserted']++;
            }
        };

        if ($dryRun) {
            DB::beginTransaction();
            try {
                $run();
                DB::rollBack();
            } catch (\Throwable $e) {
                DB::rollBack();
                throw $e;
            }

            return $this->success($summary, 'Dry-run completed');
        }

        DB::transaction(function () use ($run) {
            $run();
        });

        return $this->success($summary, 'Import completed');
    }
}
