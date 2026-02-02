<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\WeekHelper;
use App\Models\AwarenessSession;
use App\Models\Project;
use App\Models\RegulatoryWatchSubmission;
use App\Models\SorReport;
use App\Models\SubcontractorOpening;
use App\Models\Training;
use App\Models\Worker;
use App\Models\WorkerMedicalAptitude;
use App\Services\MonthlyReportWeekMonthMapper;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class MonthlyReportController extends Controller
{
    public function summary(Request $request)
    {
        $request->validate([
            'month' => 'required|string',
            'project_id' => 'nullable|integer',
            'all_months' => 'nullable|boolean',
        ]);

        $monthKey = (string) $request->get('month'); // YYYY-MM
        if (!preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
            return $this->error('Invalid month format. Expected YYYY-MM', 422);
        }

        $projectId = $request->get('project_id');
        $projectId = $projectId !== null && $projectId !== '' ? (int) $projectId : null;

        $cacheKey = 'monthly_report:summary:' . $monthKey . ':project:' . ($projectId ?: 'all');

        return Cache::remember($cacheKey, now()->addMinutes(15), function () use ($monthKey, $projectId) {
            $monthStart = Carbon::createFromFormat('Y-m', $monthKey)->startOfMonth()->startOfDay();
            $monthEnd = Carbon::createFromFormat('Y-m', $monthKey)->endOfMonth()->endOfDay();

            $projectsQuery = Project::query()->whereNull('deleted_at');
            if ($projectId) {
                $projectsQuery->where('id', $projectId);
            }
            $projects = $projectsQuery->get(['id', 'name', 'code', 'pole']);

            $projectsById = $projects->keyBy('id');
            $projectsByPole = $projects->groupBy(function ($p) {
                return (string) ($p->pole ?? '');
            });

            $poles = $projectsByPole->keys()->filter(fn ($p) => $p !== '')->values()->all();
            sort($poles);

            // Build week map for surrounding years to handle boundary weeks.
            $weekMonthMap = [];
            $targetYear = (int) substr($monthKey, 0, 4);
            foreach ([$targetYear - 1, $targetYear, $targetYear + 1] as $y) {
                for ($w = 1; $w <= 52; $w++) {
                    $dates = WeekHelper::getWeekDates($w, $y);
                    $weekMonthMap[$y . '-' . $w] = MonthlyReportWeekMonthMapper::weekToMonthKey($dates['start'], $dates['end']);
                }
            }

            $projectPoleLabel = function ($projectId) use ($projectsById) {
                $p = $projectsById->get($projectId);
                return $p ? (string) ($p->pole ?? '') : '';
            };

            // SECTION A - Veille réglementaire
            $veilleQuery = RegulatoryWatchSubmission::query()
                ->whereIn('project_id', $projectsById->keys());

            if (Schema::hasColumn('regulatory_watch_submissions', 'category')) {
                $veilleQuery->where(function ($q) {
                    $q->where('category', 'sst')->orWhereNull('category');
                });
            }

            $veilleRows = $veilleQuery
                ->whereBetween('submitted_at', [$monthStart->copy()->subDays(40), $monthEnd->copy()->addDays(40)])
                ->get(['project_id', 'week_year', 'week_number', 'overall_score']);

            $veilleByProject = [];
            foreach ($veilleRows as $r) {
                $wkKey = ((int) $r->week_year) . '-' . ((int) $r->week_number);
                $mapped = $weekMonthMap[$wkKey] ?? null;
                if ($mapped !== $monthKey) continue;
                $pid = (int) $r->project_id;
                $veilleByProject[$pid][] = (float) ($r->overall_score ?? 0);
            }

            $veilleProjectScore = [];
            foreach ($projectsById as $pid => $p) {
                $vals = $veilleByProject[$pid] ?? [];
                $veilleProjectScore[$pid] = count($vals) ? round(array_sum($vals) / count($vals), 2) : 0.0;
            }

            $veillePoleAvg = [];
            $veillePoleProjects = [];
            foreach ($projectsByPole as $pole => $poleProjects) {
                if ($pole === '') continue;
                $scores = [];
                $breakdown = [];
                foreach ($poleProjects as $p) {
                    $score = (float) ($veilleProjectScore[$p->id] ?? 0);
                    $scores[] = $score;
                    $breakdown[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'score' => $score,
                    ];
                }
                $veillePoleAvg[$pole] = count($scores) ? round(array_sum($scores) / count($scores), 2) : 0.0;
                $veillePoleProjects[$pole] = $breakdown;
            }

            // SECTION B/C - SOR volume + closure % + avg closure duration
            $sorRows = SorReport::query()
                ->whereIn('project_id', $projectsById->keys())
                ->whereBetween('observation_date', [$monthStart->copy()->subDays(40)->toDateString(), $monthEnd->copy()->addDays(40)->toDateString()])
                ->get([
                    'id',
                    'project_id',
                    'company',
                    'observation_date',
                    'observation_time',
                    'corrective_action_date',
                    'corrective_action_time',
                    'status',
                ]);

            $isSubcontractorCompany = function (?string $company): bool {
                $raw = trim((string) ($company ?? ''));
                if ($raw === '') {
                    return false;
                }

                $c = mb_strtolower($raw);
                if ($c === 'unknown' || $c === 'inconnu' || $c === 'n/a' || $c === 'na') {
                    return false;
                }

                // Exclude SGTM (any variation containing sgtm)
                if (strpos($c, 'sgtm') !== false) {
                    return false;
                }

                return true;
            };

            $sorPole = [];
            $sorPoleClosed = [];
            $sorProject = [];
            $durationPoleSum = [];
            $durationPoleCount = [];

            // Subcontractors-only SOR (exclude SGTM, ignore unknown)
            $sorSubPole = [];
            $sorSubPoleClosed = [];
            $sorSubProject = [];
            $durationSubPoleSum = [];
            $durationSubPoleCount = [];

            foreach ($sorRows as $r) {
                $obsDate = $r->observation_date ? Carbon::parse($r->observation_date) : null;
                if (!$obsDate) continue;
                $week = WeekHelper::getWeekFromDate($obsDate);
                $dates = WeekHelper::getWeekDates((int) $week['week'], (int) $week['year']);
                $mapped = MonthlyReportWeekMonthMapper::weekToMonthKey($dates['start'], $dates['end']);
                if ($mapped !== $monthKey) continue;

                $pid = (int) $r->project_id;
                $pole = $projectPoleLabel($pid);
                if ($pole === '') continue;

                $sorPole[$pole] = ($sorPole[$pole] ?? 0) + 1;
                $sorProject[$pole] = $sorProject[$pole] ?? [];
                $sorProject[$pole][$pid] = ($sorProject[$pole][$pid] ?? 0) + 1;

                $isClosed = (string) ($r->status ?? '') === SorReport::STATUS_CLOSED;
                if ($isClosed) {
                    $sorPoleClosed[$pole] = ($sorPoleClosed[$pole] ?? 0) + 1;
                }

                $isSub = $isSubcontractorCompany($r->company ?? null);
                if ($isSub) {
                    $sorSubPole[$pole] = ($sorSubPole[$pole] ?? 0) + 1;
                    $sorSubProject[$pole] = $sorSubProject[$pole] ?? [];
                    $sorSubProject[$pole][$pid] = ($sorSubProject[$pole][$pid] ?? 0) + 1;
                    if ($isClosed) {
                        $sorSubPoleClosed[$pole] = ($sorSubPoleClosed[$pole] ?? 0) + 1;
                    }
                }

                // Duration (exclude missing timestamps)
                $obsTime = $r->observation_time ? trim((string) $r->observation_time) : '';
                $corrDate = $r->corrective_action_date ? Carbon::parse($r->corrective_action_date) : null;
                $corrTime = $r->corrective_action_time ? trim((string) $r->corrective_action_time) : '';

                if ($obsTime !== '' && $corrDate && $corrTime !== '') {
                    try {
                        $anomaly = Carbon::parse($obsDate->toDateString() . ' ' . $obsTime);
                        $correction = Carbon::parse($corrDate->toDateString() . ' ' . $corrTime);
                        if ($correction->gte($anomaly)) {
                            $hours = $correction->floatDiffInHours($anomaly);
                            $durationPoleSum[$pole] = ($durationPoleSum[$pole] ?? 0) + $hours;
                            $durationPoleCount[$pole] = ($durationPoleCount[$pole] ?? 0) + 1;

                            if (!empty($isSub)) {
                                $durationSubPoleSum[$pole] = ($durationSubPoleSum[$pole] ?? 0) + $hours;
                                $durationSubPoleCount[$pole] = ($durationSubPoleCount[$pole] ?? 0) + 1;
                            }
                        }
                    } catch (\Throwable $e) {
                        // ignore bad timestamps
                    }
                }
            }

            $sorPoleClosureRate = [];
            foreach ($poles as $pole) {
                $total = (int) ($sorPole[$pole] ?? 0);
                $closed = (int) ($sorPoleClosed[$pole] ?? 0);
                $sorPoleClosureRate[$pole] = $total > 0 ? round(($closed * 100.0) / $total, 2) : 0.0;
            }

            $sorSubPoleClosureRate = [];
            foreach ($poles as $pole) {
                $total = (int) ($sorSubPole[$pole] ?? 0);
                $closed = (int) ($sorSubPoleClosed[$pole] ?? 0);
                $sorSubPoleClosureRate[$pole] = $total > 0 ? round(($closed * 100.0) / $total, 2) : 0.0;
            }

            $sorPoleProjectBreakdown = [];
            foreach ($poles as $pole) {
                $items = [];
                $byPid = $sorProject[$pole] ?? [];
                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $items[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'total' => (int) ($byPid[$p->id] ?? 0),
                    ];
                }
                $sorPoleProjectBreakdown[$pole] = $items;
            }

            $sorSubPoleProjectBreakdown = [];
            foreach ($poles as $pole) {
                $items = [];
                $byPid = $sorSubProject[$pole] ?? [];
                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $items[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'total' => (int) ($byPid[$p->id] ?? 0),
                    ];
                }
                $sorSubPoleProjectBreakdown[$pole] = $items;
            }

            $durationPoleAvg = [];
            $durationPoleUsed = [];
            foreach ($poles as $pole) {
                $cnt = (int) ($durationPoleCount[$pole] ?? 0);
                $sum = (float) ($durationPoleSum[$pole] ?? 0);
                $durationPoleAvg[$pole] = $cnt > 0 ? round($sum / $cnt, 2) : 0.0;
                $durationPoleUsed[$pole] = $cnt;
            }

            $durationSubPoleAvg = [];
            $durationSubPoleUsed = [];
            foreach ($poles as $pole) {
                $cnt = (int) ($durationSubPoleCount[$pole] ?? 0);
                $sum = (float) ($durationSubPoleSum[$pole] ?? 0);
                $durationSubPoleAvg[$pole] = $cnt > 0 ? round($sum / $cnt, 2) : 0.0;
                $durationSubPoleUsed[$pole] = $cnt;
            }

            // SECTION D - Trainings
            $trainingRows = Training::query()
                ->whereIn('project_id', $projectsById->keys())
                ->whereIn('week_year', [$targetYear - 1, $targetYear, $targetYear + 1])
                ->get(['project_id', 'week_year', 'week_number', 'training_hours', 'duration_hours']);

            $trainingPoleCount = [];
            $trainingPoleHours = [];
            $trainingPoleProjects = [];
            foreach ($trainingRows as $r) {
                $wkKey = ((int) $r->week_year) . '-' . ((int) $r->week_number);
                $mapped = $weekMonthMap[$wkKey] ?? null;
                if ($mapped !== $monthKey) continue;
                $pid = (int) $r->project_id;
                $pole = $projectPoleLabel($pid);
                if ($pole === '') continue;

                $trainingPoleCount[$pole] = ($trainingPoleCount[$pole] ?? 0) + 1;
                $hours = $r->training_hours !== null ? (float) $r->training_hours : (float) ($r->duration_hours ?? 0);
                $trainingPoleHours[$pole] = ($trainingPoleHours[$pole] ?? 0) + $hours;

                $trainingPoleProjects[$pole] = $trainingPoleProjects[$pole] ?? [];
                $trainingPoleProjects[$pole][$pid] = $trainingPoleProjects[$pole][$pid] ?? ['count' => 0, 'hours' => 0.0];
                $trainingPoleProjects[$pole][$pid]['count'] += 1;
                $trainingPoleProjects[$pole][$pid]['hours'] += $hours;
            }

            // SECTION E - Awareness
            $awRows = AwarenessSession::query()
                ->whereIn('project_id', $projectsById->keys())
                ->whereIn('week_year', [$targetYear - 1, $targetYear, $targetYear + 1])
                ->get(['project_id', 'week_year', 'week_number', 'session_hours']);

            $awPoleCount = [];
            $awPoleHours = [];
            $awPoleProjects = [];
            foreach ($awRows as $r) {
                $wkKey = ((int) $r->week_year) . '-' . ((int) $r->week_number);
                $mapped = $weekMonthMap[$wkKey] ?? null;
                if ($mapped !== $monthKey) continue;
                $pid = (int) $r->project_id;
                $pole = $projectPoleLabel($pid);
                if ($pole === '') continue;

                $awPoleCount[$pole] = ($awPoleCount[$pole] ?? 0) + 1;
                $hours = (float) ($r->session_hours ?? 0);
                $awPoleHours[$pole] = ($awPoleHours[$pole] ?? 0) + $hours;

                $awPoleProjects[$pole] = $awPoleProjects[$pole] ?? [];
                $awPoleProjects[$pole][$pid] = $awPoleProjects[$pole][$pid] ?? ['count' => 0, 'hours' => 0.0];
                $awPoleProjects[$pole][$pid]['count'] += 1;
                $awPoleProjects[$pole][$pid]['hours'] += $hours;
            }

            // SECTION F - Subcontractor documents completion (snapshot)
            $openings = SubcontractorOpening::query()
                ->whereIn('project_id', $projectsById->keys())
                ->with(['documents', 'project'])
                ->get();

            $requiredKeys = array_values(array_filter(array_map(
                fn ($d) => is_array($d) ? ($d['key'] ?? null) : null,
                SubcontractorOpening::REQUIRED_DOCUMENTS
            )));
            $requiredSet = array_fill_keys($requiredKeys, true);
            $requiredCount = count($requiredKeys);
            $subByPole = [];
            foreach ($openings as $o) {
                $pole = (string) ($o->project?->pole ?? '');
                if ($pole === '') continue;

                $docKeys = [];
                $today = now()->startOfDay();
                foreach ($o->documents as $d) {
                    $key = trim((string) ($d->document_key ?? ''));
                    if ($key === '' || empty($requiredSet[$key])) {
                        continue;
                    }

                    // Count as uploaded only if there's a real file AND the doc is not expired.
                    $hasFile = !empty($d->file_path);
                    $expiry = $d->expiry_date ? Carbon::parse($d->expiry_date)->startOfDay() : null;
                    $isExpired = $expiry !== null && $expiry->lt($today);
                    if ($hasFile && !$isExpired) {
                        $docKeys[$key] = true;
                    }
                }
                $uploaded = count($docKeys);
                $pct = $requiredCount > 0 ? round(($uploaded * 100.0) / $requiredCount, 1) : 0.0;

                $subByPole[$pole] = $subByPole[$pole] ?? [];
                $subByPole[$pole][] = [
                    'subcontractor_opening_id' => (int) $o->id,
                    'contractor_name' => (string) ($o->contractor_name ?? ''),
                    'project_id' => (int) $o->project_id,
                    'project_name' => (string) ($o->project?->name ?? ''),
                    'required_docs_count' => $requiredCount,
                    'uploaded_docs_count' => $uploaded,
                    'missing_docs_count' => max(0, $requiredCount - $uploaded),
                    'completion_pct' => $pct,
                ];
            }

            $subPoleSummary = [];
            foreach ($poles as $pole) {
                $rows = $subByPole[$pole] ?? [];
                $avg = 0.0;
                $lowest = null;
                if (count($rows)) {
                    $avg = round(array_sum(array_map(fn ($r) => (float) $r['completion_pct'], $rows)) / count($rows), 1);
                    $lowest = $rows[0];
                    foreach ($rows as $r) {
                        if ((float) $r['completion_pct'] < (float) $lowest['completion_pct']) {
                            $lowest = $r;
                        }
                    }
                }
                $subPoleSummary[$pole] = [
                    'average_completion_pct' => $avg,
                    'lowest_completion' => $lowest,
                    'count' => count($rows),
                ];
            }

            // SECTION G - Medical conformity
            $workers = Worker::query()
                ->whereIn('project_id', $projectsById->keys())
                ->get(['id', 'project_id']);

            $workerPole = [];
            foreach ($workers as $w) {
                $pid = (int) $w->project_id;
                $pole = $projectPoleLabel($pid);
                if ($pole === '') continue;
                $workerPole[(int) $w->id] = $pole;
            }

            $workerIds = array_keys($workerPole);
            $medicalConforming = [];

            if (!empty($workerIds)) {
                $aptitudes = WorkerMedicalAptitude::query()
                    ->whereIn('worker_id', $workerIds)
                    ->where('aptitude_status', 'apte')
                    ->get(['worker_id', 'exam_date', 'expiry_date']);

                foreach ($aptitudes as $a) {
                    $wid = (int) $a->worker_id;
                    $exam = $a->exam_date ? Carbon::parse($a->exam_date)->endOfDay() : null;
                    $expiry = $a->expiry_date ? Carbon::parse($a->expiry_date)->endOfDay() : null;

                    if ($exam && $exam->gt($monthEnd)) {
                        continue;
                    }
                    if ($expiry && $expiry->lt($monthStart)) {
                        continue;
                    }

                    // Consider conforming if not expired during the month (expiry >= monthEnd OR no expiry)
                    if ($expiry === null || $expiry->gte($monthEnd)) {
                        $medicalConforming[$wid] = true;
                    }
                }
            }

            $medicalPoleTotal = [];
            $medicalPoleConforming = [];
            foreach ($workerPole as $wid => $pole) {
                $medicalPoleTotal[$pole] = ($medicalPoleTotal[$pole] ?? 0) + 1;
                if (!empty($medicalConforming[$wid])) {
                    $medicalPoleConforming[$pole] = ($medicalPoleConforming[$pole] ?? 0) + 1;
                }
            }

            $medicalPolePct = [];
            foreach ($poles as $pole) {
                $total = (int) ($medicalPoleTotal[$pole] ?? 0);
                $ok = (int) ($medicalPoleConforming[$pole] ?? 0);
                $medicalPolePct[$pole] = $total > 0 ? round(($ok * 100.0) / $total, 2) : 0.0;
            }

            // Prepare chart-friendly payload (labels = poles)
            $labels = $poles;

            $projectsList = $projects->map(function ($p) {
                return [
                    'id' => (int) $p->id,
                    'name' => (string) $p->name,
                    'code' => (string) $p->code,
                    'pole' => (string) ($p->pole ?? ''),
                ];
            })->values()->all();

            $trainingPoleProjectBreakdown = [];
            foreach ($poles as $pole) {
                $items = [];
                $byPid = $trainingPoleProjects[$pole] ?? [];
                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $items[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'count' => (int) ($byPid[$p->id]['count'] ?? 0),
                        'hours' => round((float) ($byPid[$p->id]['hours'] ?? 0), 2),
                    ];
                }
                $trainingPoleProjectBreakdown[$pole] = $items;
            }

            $awPoleProjectBreakdown = [];
            foreach ($poles as $pole) {
                $items = [];
                $byPid = $awPoleProjects[$pole] ?? [];
                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $items[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'count' => (int) ($byPid[$p->id]['count'] ?? 0),
                        'hours' => round((float) ($byPid[$p->id]['hours'] ?? 0), 2),
                    ];
                }
                $awPoleProjectBreakdown[$pole] = $items;
            }

            return $this->success([
                'month' => $monthKey,
                'project_id' => $projectId,
                'projects' => $projectsList,
                'labels' => $labels,
                'sections' => [
                    'veille' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Veille %',
                                'data' => array_map(fn ($pole) => $veillePoleAvg[$pole] ?? 0, $labels),
                            ],
                        ],
                        'by_pole_projects' => $veillePoleProjects,
                    ],
                    'sor' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'type' => 'bar',
                                'label' => 'Total deviations',
                                'data' => array_map(fn ($pole) => (int) ($sorPole[$pole] ?? 0), $labels),
                            ],
                            [
                                'type' => 'line',
                                'label' => 'Closure %',
                                'data' => array_map(fn ($pole) => $sorPoleClosureRate[$pole] ?? 0, $labels),
                            ],
                        ],
                        'by_pole_projects' => $sorPoleProjectBreakdown,
                    ],
                    'sor_subcontractors' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'type' => 'bar',
                                'label' => 'Total deviations (subcontractors)',
                                'data' => array_map(fn ($pole) => (int) ($sorSubPole[$pole] ?? 0), $labels),
                            ],
                            [
                                'type' => 'line',
                                'label' => 'Closure % (subcontractors)',
                                'data' => array_map(fn ($pole) => $sorSubPoleClosureRate[$pole] ?? 0, $labels),
                            ],
                        ],
                        'by_pole_projects' => $sorSubPoleProjectBreakdown,
                    ],
                    'closure_duration' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Avg closure (hours)',
                                'data' => array_map(fn ($pole) => $durationPoleAvg[$pole] ?? 0, $labels),
                            ],
                        ],
                        'records_used' => $durationPoleUsed,
                    ],
                    'closure_duration_subcontractors' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Avg closure (hours) (subcontractors)',
                                'data' => array_map(fn ($pole) => $durationSubPoleAvg[$pole] ?? 0, $labels),
                            ],
                        ],
                        'records_used' => $durationSubPoleUsed,
                    ],
                    'trainings' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Trainings',
                                'data' => array_map(fn ($pole) => (int) ($trainingPoleCount[$pole] ?? 0), $labels),
                            ],
                            [
                                'label' => 'Hours',
                                'data' => array_map(fn ($pole) => round((float) ($trainingPoleHours[$pole] ?? 0), 2), $labels),
                            ],
                        ],
                        'by_pole_projects' => $trainingPoleProjectBreakdown,
                    ],
                    'awareness' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Sessions',
                                'data' => array_map(fn ($pole) => (int) ($awPoleCount[$pole] ?? 0), $labels),
                            ],
                            [
                                'label' => 'Hours',
                                'data' => array_map(fn ($pole) => round((float) ($awPoleHours[$pole] ?? 0), 2), $labels),
                            ],
                        ],
                        'by_pole_projects' => $awPoleProjectBreakdown,
                    ],
                    'subcontractors' => [
                        'required_docs_count' => $requiredCount,
                        'by_pole' => $subByPole,
                        'pole_summary' => $subPoleSummary,
                    ],
                    'medical' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Medical conformity %',
                                'data' => array_map(fn ($pole) => $medicalPolePct[$pole] ?? 0, $labels),
                            ],
                        ],
                        'totals' => [
                            'total_workers' => $medicalPoleTotal,
                            'conforming_workers' => $medicalPoleConforming,
                        ],
                    ],
                ],
            ]);
        });
    }
}
