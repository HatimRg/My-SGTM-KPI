<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\WeekHelper;
use App\Models\AwarenessSession;
use App\Models\DailyKpiSnapshot;
use App\Models\HseEvent;
use App\Models\KpiReport;
use App\Models\Inspection;
use App\Models\Machine;
use App\Models\MachineDocument;
use App\Models\PpeItem;
use App\Models\Project;
use App\Models\RegulatoryWatchSubmission;
use App\Models\SorReport;
use App\Models\SubcontractorOpening;
use App\Models\Training;
use App\Models\Worker;
use App\Models\WorkerMedicalAptitude;
use App\Models\WorkerPpeIssue;
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
            'month' => 'nullable|string',
            'project_id' => 'nullable|integer',
            'all_months' => 'nullable|boolean',
            'week_start' => 'nullable|string', // Format: YYYY-WXX (e.g., 2026-W05)
            'week_end' => 'nullable|string',   // Format: YYYY-WXX (e.g., 2026-W08)
        ]);

        // Determine date range: either by month or by week range
        $weekStart = $request->get('week_start');
        $weekEnd = $request->get('week_end');
        $useWeekRange = $weekStart && $weekEnd;

        if ($useWeekRange) {
            // Parse week range format YYYY-WXX
            if (!preg_match('/^(\d{4})-W(\d{1,2})$/', $weekStart, $startMatch) ||
                !preg_match('/^(\d{4})-W(\d{1,2})$/', $weekEnd, $endMatch)) {
                return $this->error('Invalid week format. Expected YYYY-WXX', 422);
            }
            $startYear = (int) $startMatch[1];
            $startWeek = (int) $startMatch[2];
            $endYear = (int) $endMatch[1];
            $endWeek = (int) $endMatch[2];

            $startDates = WeekHelper::getWeekDates($startWeek, $startYear);
            $endDates = WeekHelper::getWeekDates($endWeek, $endYear);
            $rangeStart = Carbon::parse($startDates['start'])->startOfDay();
            $rangeEnd = Carbon::parse($endDates['end'])->endOfDay();
            $monthKey = $weekStart . '_to_' . $weekEnd;
            $targetYear = $startYear;
        } else {
            $monthKey = (string) $request->get('month', now()->format('Y-m'));
            if (!preg_match('/^\d{4}-\d{2}$/', $monthKey)) {
                return $this->error('Invalid month format. Expected YYYY-MM', 422);
            }
            $rangeStart = Carbon::createFromFormat('Y-m', $monthKey)->startOfMonth()->startOfDay();
            $rangeEnd = Carbon::createFromFormat('Y-m', $monthKey)->endOfMonth()->endOfDay();
            $targetYear = (int) substr($monthKey, 0, 4);
        }

        $projectId = $request->get('project_id');
        $projectId = $projectId !== null && $projectId !== '' ? (int) $projectId : null;

        $cacheKey = 'monthly_report:summary:' . $monthKey . ':project:' . ($projectId ?: 'all');

        return Cache::remember($cacheKey, now()->addMinutes(15), function () use ($monthKey, $projectId, $rangeStart, $rangeEnd, $targetYear, $useWeekRange) {
            $monthStart = $rangeStart;
            $monthEnd = $rangeEnd;

            $projectsQuery = Project::query()->active();
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
            // For week range mode, we check if week falls within range; for month mode, we map to month key.
            // WeekHelper uses 52 weeks per year (Saturday to Friday), so we iterate 1-52.
            $weekMonthMap = [];
            foreach ([$targetYear - 1, $targetYear, $targetYear + 1] as $y) {
                for ($w = 1; $w <= 52; $w++) {
                    $dates = WeekHelper::getWeekDates($w, $y);
                    if ($useWeekRange) {
                        // For week range, store the week dates for range checking
                        $weekMonthMap[$y . '-' . $w] = [
                            'start' => Carbon::parse($dates['start'])->startOfDay(),
                            'end' => Carbon::parse($dates['end'])->endOfDay(),
                        ];
                    } else {
                        $weekMonthMap[$y . '-' . $w] = MonthlyReportWeekMonthMapper::weekToMonthKey($dates['start'], $dates['end']);
                    }
                }
            }

            // Helper to check if a week key is within the selected range
            $isWeekInRange = function ($wkKey) use ($useWeekRange, $weekMonthMap, $monthKey, $monthStart, $monthEnd) {
                if ($useWeekRange) {
                    $weekDates = $weekMonthMap[$wkKey] ?? null;
                    if (!$weekDates) return false;
                    // Week is in range if it overlaps with the selected range
                    return $weekDates['start']->lte($monthEnd) && $weekDates['end']->gte($monthStart);
                } else {
                    $mapped = $weekMonthMap[$wkKey] ?? null;
                    return $mapped === $monthKey;
                }
            };

            $projectPoleLabel = function ($projectId) use ($projectsById) {
                $p = $projectsById->get($projectId);
                return $p ? (string) ($p->pole ?? '') : '';
            };

            // SECTION A - Veille réglementaire (SST + Environnement)
            $hasVeilleCategory = Schema::hasColumn('regulatory_watch_submissions', 'category');

            $veilleSelect = ['project_id', 'week_year', 'week_number', 'overall_score'];
            if ($hasVeilleCategory) {
                $veilleSelect[] = 'category';
            }

            $veilleRows = RegulatoryWatchSubmission::query()
                ->whereIn('project_id', $projectsById->keys())
                ->whereBetween('submitted_at', [$monthStart->copy()->subDays(40), $monthEnd->copy()->addDays(40)])
                ->get($veilleSelect);

            $veilleByProjectSst = [];
            $veilleByProjectEnv = [];
            foreach ($veilleRows as $r) {
                $wkKey = ((int) $r->week_year) . '-' . ((int) $r->week_number);
                if (!$isWeekInRange($wkKey)) continue;
                $pid = (int) $r->project_id;

                $cat = $hasVeilleCategory ? (string) ($r->category ?? '') : 'sst';
                if ($cat === '') {
                    $cat = 'sst';
                }

                $cat = strtolower(trim($cat));

                if ($cat === 'sst') {
                    $veilleByProjectSst[$pid][] = (float) ($r->overall_score ?? 0);
                } elseif ($cat === 'environment' || $cat === 'environnement' || $cat === 'environmental') {
                    $veilleByProjectEnv[$pid][] = (float) ($r->overall_score ?? 0);
                }
            }

            $veilleProjectScoreSst = [];
            $veilleProjectScoreEnv = [];
            foreach ($projectsById as $pid => $p) {
                $valsSst = $veilleByProjectSst[$pid] ?? [];
                $valsEnv = $veilleByProjectEnv[$pid] ?? [];
                $veilleProjectScoreSst[$pid] = count($valsSst) ? round(array_sum($valsSst) / count($valsSst), 2) : 0.0;
                $veilleProjectScoreEnv[$pid] = count($valsEnv) ? round(array_sum($valsEnv) / count($valsEnv), 2) : 0.0;
            }

            $veillePoleAvgSst = [];
            $veillePoleAvgEnv = [];
            $veillePoleProjects = [];
            foreach ($projectsByPole as $pole => $poleProjects) {
                if ($pole === '') continue;

                $scoresSst = [];
                $scoresEnv = [];
                $breakdown = [];
                foreach ($poleProjects as $p) {
                    $scoreSst = (float) ($veilleProjectScoreSst[$p->id] ?? 0);
                    $scoreEnv = (float) ($veilleProjectScoreEnv[$p->id] ?? 0);

                    $scoresSst[] = $scoreSst;
                    $scoresEnv[] = $scoreEnv;

                    $breakdown[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        // Keep 'score' for backward compatibility (SST)
                        'score' => $scoreSst,
                        'score_sst' => $scoreSst,
                        'score_environment' => $scoreEnv,
                    ];
                }

                $veillePoleAvgSst[$pole] = count($scoresSst) ? round(array_sum($scoresSst) / count($scoresSst), 2) : 0.0;
                $veillePoleAvgEnv[$pole] = count($scoresEnv) ? round(array_sum($scoresEnv) / count($scoresEnv), 2) : 0.0;
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
            $durationProjectSum = [];
            $durationProjectCount = [];

            // Subcontractors-only SOR (exclude SGTM, ignore unknown)
            $sorSubPole = [];
            $sorSubPoleClosed = [];
            $sorSubProject = [];
            $durationSubPoleSum = [];
            $durationSubPoleCount = [];
            $durationSubProjectSum = [];
            $durationSubProjectCount = [];

            foreach ($sorRows as $r) {
                $obsDate = $r->observation_date ? Carbon::parse($r->observation_date) : null;
                if (!$obsDate) continue;
                $week = WeekHelper::getWeekFromDate($obsDate);
                $wkKey = ((int) $week['year']) . '-' . ((int) $week['week']);
                if (!$isWeekInRange($wkKey)) continue;

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

                            $durationProjectSum[$pid] = ($durationProjectSum[$pid] ?? 0) + $hours;
                            $durationProjectCount[$pid] = ($durationProjectCount[$pid] ?? 0) + 1;

                            if (!empty($isSub)) {
                                $durationSubPoleSum[$pole] = ($durationSubPoleSum[$pole] ?? 0) + $hours;
                                $durationSubPoleCount[$pole] = ($durationSubPoleCount[$pole] ?? 0) + 1;

                                $durationSubProjectSum[$pid] = ($durationSubProjectSum[$pid] ?? 0) + $hours;
                                $durationSubProjectCount[$pid] = ($durationSubProjectCount[$pid] ?? 0) + 1;
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

            $durationPoleProjects = [];
            foreach ($poles as $pole) {
                $items = [];
                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $pid = (int) $p->id;
                    $cnt = (int) ($durationProjectCount[$pid] ?? 0);
                    $sum = (float) ($durationProjectSum[$pid] ?? 0);
                    $items[] = [
                        'project_id' => $pid,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'avg_hours' => $cnt > 0 ? round($sum / $cnt, 2) : 0.0,
                        'records_used' => $cnt,
                    ];
                }
                $durationPoleProjects[$pole] = $items;
            }

            $durationSubPoleAvg = [];
            $durationSubPoleUsed = [];
            foreach ($poles as $pole) {
                $cnt = (int) ($durationSubPoleCount[$pole] ?? 0);
                $sum = (float) ($durationSubPoleSum[$pole] ?? 0);
                $durationSubPoleAvg[$pole] = $cnt > 0 ? round($sum / $cnt, 2) : 0.0;
                $durationSubPoleUsed[$pole] = $cnt;
            }

            $durationSubPoleProjects = [];
            foreach ($poles as $pole) {
                $items = [];
                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $pid = (int) $p->id;
                    $cnt = (int) ($durationSubProjectCount[$pid] ?? 0);
                    $sum = (float) ($durationSubProjectSum[$pid] ?? 0);
                    $items[] = [
                        'project_id' => $pid,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'avg_hours' => $cnt > 0 ? round($sum / $cnt, 2) : 0.0,
                        'records_used' => $cnt,
                    ];
                }
                $durationSubPoleProjects[$pole] = $items;
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
                if (!$isWeekInRange($wkKey)) continue;
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
                if (!$isWeekInRange($wkKey)) continue;
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

            $medicalProjectTotal = [];
            $medicalProjectConforming = [];
            foreach ($workers as $w) {
                $pid = (int) $w->project_id;
                if (!$projectsById->has($pid)) {
                    continue;
                }
                $pole = $projectPoleLabel($pid);
                if ($pole === '') {
                    continue;
                }
                $medicalProjectTotal[$pid] = ($medicalProjectTotal[$pid] ?? 0) + 1;
                if (!empty($medicalConforming[(int) $w->id])) {
                    $medicalProjectConforming[$pid] = ($medicalProjectConforming[$pid] ?? 0) + 1;
                }
            }

            $medicalPoleProjects = [];
            foreach ($poles as $pole) {
                $items = [];
                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $pid = (int) $p->id;
                    $total = (int) ($medicalProjectTotal[$pid] ?? 0);
                    $ok = (int) ($medicalProjectConforming[$pid] ?? 0);
                    $items[] = [
                        'project_id' => $pid,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'total_workers' => $total,
                        'conforming_workers' => $ok,
                        'pct' => $total > 0 ? round(($ok * 100.0) / $total, 2) : 0.0,
                    ];
                }
                $medicalPoleProjects[$pole] = $items;
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

            // SECTION H - TF/TG rates by pole (from KpiReport - same source as Vue Ensemble theme)
            $kpiReports = KpiReport::query()
                ->whereIn('project_id', $projectsById->keys())
                ->approved()
                ->get(['project_id', 'week_number', 'report_year', 'accidents', 'lost_workdays', 'hours_worked']);

            $tfTgByProject = [];
            foreach ($kpiReports as $report) {
                $wkKey = ((int) $report->report_year) . '-' . ((int) $report->week_number);
                if (!$isWeekInRange($wkKey)) continue;

                $pid = (int) $report->project_id;
                $tfTgByProject[$pid] = $tfTgByProject[$pid] ?? ['accidents' => 0, 'lost_days' => 0, 'hours' => 0];
                $tfTgByProject[$pid]['accidents'] += (int) ($report->accidents ?? 0);
                $tfTgByProject[$pid]['lost_days'] += (int) ($report->lost_workdays ?? 0);
                $tfTgByProject[$pid]['hours'] += (float) ($report->hours_worked ?? 0);
            }

            $tfTgPole = [];
            $tfTgPoleProjects = [];
            foreach ($poles as $pole) {
                $poleAccidents = 0;
                $poleLostDays = 0;
                $poleHours = 0;
                $breakdown = [];

                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $data = $tfTgByProject[$p->id] ?? ['accidents' => 0, 'lost_days' => 0, 'hours' => 0];
                    $poleAccidents += $data['accidents'];
                    $poleLostDays += $data['lost_days'];
                    $poleHours += $data['hours'];

                    $projTf = $data['hours'] > 0 ? round(($data['accidents'] * 1000000) / $data['hours'], 4) : 0;
                    $projTg = $data['hours'] > 0 ? round(($data['lost_days'] * 1000) / $data['hours'], 4) : 0;

                    $breakdown[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'accidents' => $data['accidents'],
                        'lost_days' => $data['lost_days'],
                        'hours_worked' => round($data['hours'], 2),
                        'tf' => $projTf,
                        'tg' => $projTg,
                    ];
                }

                $poleTf = $poleHours > 0 ? round(($poleAccidents * 1000000) / $poleHours, 4) : 0;
                $poleTg = $poleHours > 0 ? round(($poleLostDays * 1000) / $poleHours, 4) : 0;

                $tfTgPole[$pole] = ['tf' => $poleTf, 'tg' => $poleTg, 'accidents' => $poleAccidents, 'lost_days' => $poleLostDays, 'hours' => round($poleHours, 2)];
                $tfTgPoleProjects[$pole] = $breakdown;
            }

            // SECTION I - Accidents vs Incidents by pole (from KpiReport - same source as Vue Ensemble theme)
            // Reuse kpiReports already fetched for TF/TG section
            $accidentsByProject = [];
            $incidentsByProject = [];
            foreach ($kpiReports as $report) {
                $wkKey = ((int) $report->report_year) . '-' . ((int) $report->week_number);
                if (!$isWeekInRange($wkKey)) continue;

                $pid = (int) $report->project_id;
                $accidentsByProject[$pid] = ($accidentsByProject[$pid] ?? 0) + (int) ($report->accidents ?? 0);
                $incidentsByProject[$pid] = ($incidentsByProject[$pid] ?? 0) + (int) ($report->near_misses ?? 0);
            }

            $accidentsIncidentsPole = [];
            $accidentsIncidentsPoleProjects = [];
            foreach ($poles as $pole) {
                $poleAccidents = 0;
                $poleIncidents = 0;
                $breakdown = [];

                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $acc = (int) ($accidentsByProject[$p->id] ?? 0);
                    $inc = (int) ($incidentsByProject[$p->id] ?? 0);
                    $poleAccidents += $acc;
                    $poleIncidents += $inc;

                    $breakdown[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'accidents' => $acc,
                        'incidents' => $inc,
                    ];
                }

                $accidentsIncidentsPole[$pole] = ['accidents' => $poleAccidents, 'incidents' => $poleIncidents];
                $accidentsIncidentsPoleProjects[$pole] = $breakdown;
            }

            // SECTION J - PPE consumption by pole (stacked by article)
            $ppeIssues = WorkerPpeIssue::query()
                ->whereIn('project_id', $projectsById->keys())
                ->whereBetween('received_at', [$monthStart->toDateString(), $monthEnd->toDateString()])
                ->with('ppeItem:id,name')
                ->get(['project_id', 'ppe_item_id', 'quantity']);

            $ppeByProjectItem = [];
            $ppeItemNames = [];
            foreach ($ppeIssues as $issue) {
                $pid = (int) $issue->project_id;
                $itemId = (int) $issue->ppe_item_id;
                $qty = (int) ($issue->quantity ?? 1);

                $ppeByProjectItem[$pid] = $ppeByProjectItem[$pid] ?? [];
                $ppeByProjectItem[$pid][$itemId] = ($ppeByProjectItem[$pid][$itemId] ?? 0) + $qty;

                if (!isset($ppeItemNames[$itemId]) && $issue->ppeItem) {
                    $ppeItemNames[$itemId] = (string) ($issue->ppeItem->name ?: 'Item ' . $itemId);
                }
            }

            // Get all unique PPE items used
            $allPpeItemIds = array_keys($ppeItemNames);
            sort($allPpeItemIds);

            $ppePole = [];
            $ppePoleProjects = [];
            foreach ($poles as $pole) {
                $poleItems = [];
                $breakdown = [];

                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $projItems = $ppeByProjectItem[$p->id] ?? [];
                    $projBreakdown = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'items' => [],
                    ];

                    foreach ($allPpeItemIds as $itemId) {
                        $qty = (int) ($projItems[$itemId] ?? 0);
                        $poleItems[$itemId] = ($poleItems[$itemId] ?? 0) + $qty;
                        $projBreakdown['items'][$itemId] = $qty;
                    }

                    $breakdown[] = $projBreakdown;
                }

                $ppePole[$pole] = $poleItems;
                $ppePoleProjects[$pole] = $breakdown;
            }

            // SECTION K - Heavy machinery count and document completion by pole
            $machines = Machine::query()
                ->whereIn('project_id', $projectsById->keys())
                ->where('is_active', true)
                ->with(['documents', 'operators'])
                ->get(['id', 'project_id', 'serial_number', 'machine_type']);

            // Required document keys for completion calculation
            $requiredMachineDocKeys = ['rapport_reglementaire', 'assurance'];
            $requiredMachineDocCount = count($requiredMachineDocKeys);

            $machinesByProject = [];
            $machineCompletionByProject = [];
            foreach ($machines as $m) {
                $pid = (int) $m->project_id;
                $machinesByProject[$pid] = ($machinesByProject[$pid] ?? 0) + 1;

                // Calculate document completion for this machine
                $uploadedKeys = [];
                $today = now()->startOfDay();
                foreach ($m->documents as $doc) {
                    $key = strtolower(trim((string) ($doc->document_key ?? '')));
                    if (!in_array($key, $requiredMachineDocKeys)) continue;

                    $hasFile = !empty($doc->file_path);
                    $expiry = $doc->expiry_date ? Carbon::parse($doc->expiry_date)->startOfDay() : null;
                    $isExpired = $expiry !== null && $expiry->lt($today);

                    if ($hasFile && !$isExpired) {
                        $uploadedKeys[$key] = true;
                    }
                }

                // Check if operator is assigned
                $hasOperator = $m->operators->count() > 0;
                $operatorScore = $hasOperator ? 1 : 0;

                // Completion: (uploaded docs + operator) / (required docs + 1)
                $totalRequired = $requiredMachineDocCount + 1; // +1 for operator
                $totalComplete = count($uploadedKeys) + $operatorScore;
                $machineCompletion = $totalRequired > 0 ? round(($totalComplete * 100.0) / $totalRequired, 1) : 0;

                $machineCompletionByProject[$pid] = $machineCompletionByProject[$pid] ?? [];
                $machineCompletionByProject[$pid][] = $machineCompletion;
            }

            $machineryPole = [];
            $machineryPoleProjects = [];
            foreach ($poles as $pole) {
                $poleCount = 0;
                $poleCompletions = [];
                $breakdown = [];

                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $count = (int) ($machinesByProject[$p->id] ?? 0);
                    $completions = $machineCompletionByProject[$p->id] ?? [];
                    $avgCompletion = count($completions) > 0 ? round(array_sum($completions) / count($completions), 1) : 0;

                    $poleCount += $count;
                    $poleCompletions = array_merge($poleCompletions, $completions);

                    $breakdown[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'machine_count' => $count,
                        'avg_completion' => $avgCompletion,
                    ];
                }

                $poleAvgCompletion = count($poleCompletions) > 0 ? round(array_sum($poleCompletions) / count($poleCompletions), 1) : 0;

                $machineryPole[$pole] = ['count' => $poleCount, 'avg_completion' => $poleAvgCompletion];
                $machineryPoleProjects[$pole] = $breakdown;
            }

            // SECTION L - Inspections count by pole
            $inspections = Inspection::query()
                ->whereIn('project_id', $projectsById->keys())
                ->get(['id', 'project_id', 'week_number', 'week_year', 'nature', 'type']);

            $inspectionsByProject = [];
            foreach ($inspections as $insp) {
                $wkKey = $insp->week_year . '-' . $insp->week_number;
                if (!$isWeekInRange($wkKey)) continue;

                $pid = (int) $insp->project_id;
                $inspectionsByProject[$pid] = ($inspectionsByProject[$pid] ?? 0) + 1;
            }

            $inspectionsPole = [];
            $inspectionsPoleProjects = [];
            foreach ($poles as $pole) {
                $poleCount = 0;
                $breakdown = [];

                foreach ($projectsByPole->get($pole, collect()) as $p) {
                    $count = (int) ($inspectionsByProject[$p->id] ?? 0);
                    $poleCount += $count;

                    $breakdown[] = [
                        'project_id' => (int) $p->id,
                        'project_name' => (string) $p->name,
                        'project_code' => (string) $p->code,
                        'count' => $count,
                    ];
                }

                $inspectionsPole[$pole] = $poleCount;
                $inspectionsPoleProjects[$pole] = $breakdown;
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
                                'label' => 'Veille SST %',
                                'data' => array_map(fn ($pole) => $veillePoleAvgSst[$pole] ?? 0, $labels),
                            ],
                            [
                                'label' => 'Veille Environnement %',
                                'data' => array_map(fn ($pole) => $veillePoleAvgEnv[$pole] ?? 0, $labels),
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
                        'by_pole_projects' => $durationPoleProjects,
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
                        'by_pole_projects' => $durationSubPoleProjects,
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
                        'by_pole_projects' => $medicalPoleProjects,
                    ],
                    'tf_tg' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'TF',
                                'data' => array_map(fn ($pole) => $tfTgPole[$pole]['tf'] ?? 0, $labels),
                            ],
                            [
                                'label' => 'TG',
                                'data' => array_map(fn ($pole) => $tfTgPole[$pole]['tg'] ?? 0, $labels),
                            ],
                        ],
                        'by_pole' => $tfTgPole,
                        'by_pole_projects' => $tfTgPoleProjects,
                    ],
                    'accidents_incidents' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Accidents',
                                'data' => array_map(fn ($pole) => $accidentsIncidentsPole[$pole]['accidents'] ?? 0, $labels),
                            ],
                            [
                                'label' => 'Incidents',
                                'data' => array_map(fn ($pole) => $accidentsIncidentsPole[$pole]['incidents'] ?? 0, $labels),
                            ],
                        ],
                        'by_pole' => $accidentsIncidentsPole,
                        'by_pole_projects' => $accidentsIncidentsPoleProjects,
                    ],
                    'ppe_consumption' => [
                        'labels' => $labels,
                        'item_names' => $ppeItemNames,
                        'item_ids' => $allPpeItemIds,
                        'by_pole' => $ppePole,
                        'by_pole_projects' => $ppePoleProjects,
                    ],
                    'machinery' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'type' => 'bar',
                                'label' => 'Machine count',
                                'data' => array_map(fn ($pole) => $machineryPole[$pole]['count'] ?? 0, $labels),
                            ],
                            [
                                'type' => 'line',
                                'label' => 'Avg completion %',
                                'data' => array_map(fn ($pole) => $machineryPole[$pole]['avg_completion'] ?? 0, $labels),
                            ],
                        ],
                        'by_pole' => $machineryPole,
                        'by_pole_projects' => $machineryPoleProjects,
                    ],
                    'inspections' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Inspections',
                                'data' => array_map(fn ($pole) => $inspectionsPole[$pole] ?? 0, $labels),
                            ],
                        ],
                        'by_pole' => $inspectionsPole,
                        'by_pole_projects' => $inspectionsPoleProjects,
                    ],
                ],
            ]);
        });
    }
}
