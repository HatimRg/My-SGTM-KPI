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
            'month_start' => 'nullable|string', // Format: YYYY-MM
            'month_end' => 'nullable|string',   // Format: YYYY-MM
            'project_id' => 'nullable|integer',
            'all_months' => 'nullable|boolean',
            'week_start' => 'nullable|string', // Format: YYYY-WXX (e.g., 2026-W05)
            'week_end' => 'nullable|string',   // Format: YYYY-WXX (e.g., 2026-W08)
            'no_cache' => 'nullable|boolean',
            'refresh' => 'nullable|boolean',
        ]);

        // Determine date range: by month range, single month, or week range
        $monthStart = $request->get('month_start');
        $monthEnd = $request->get('month_end');
        $useMonthRange = $monthStart && $monthEnd;

        $weekStart = $request->get('week_start');
        $weekEnd = $request->get('week_end');
        $useWeekRange = $weekStart && $weekEnd;

        if ($useMonthRange) {
            // Parse month range format YYYY-MM
            if (!preg_match('/^\d{4}-\d{2}$/', $monthStart) || !preg_match('/^\d{4}-\d{2}$/', $monthEnd)) {
                return $this->error('Invalid month format. Expected YYYY-MM', 422);
            }
            $rangeStart = Carbon::createFromFormat('Y-m', $monthStart)->startOfMonth()->startOfDay();
            $rangeEnd = Carbon::createFromFormat('Y-m', $monthEnd)->endOfMonth()->endOfDay();
            $monthKey = $monthStart . '_to_' . $monthEnd;
            $targetYear = (int) substr($monthStart, 0, 4);
        } elseif ($useWeekRange) {
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

        $cacheKey = 'monthly_report:summary:' . $monthKey . ':project:' . ($projectId ?: 'all') . ':type:' . ($useMonthRange ? 'monthrange' : ($useWeekRange ? 'weekrange' : 'month'));

        if ($request->boolean('no_cache', false) || $request->boolean('refresh', false)) {
            Cache::forget($cacheKey);
        }

        $shouldBypassCache = (bool) $request->boolean('no_cache', false);
        if (false && $shouldBypassCache) {
            return (function () use ($monthKey, $projectId, $rangeStart, $rangeEnd, $targetYear, $useWeekRange, $useMonthRange) {
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

                // Fall back to the same cached code path below for the remaining sections.
                // By bypassing cache we only ensure this request recomputes live.
                // The remainder of the method continues below in the original implementation.
            })();
        }

        return Cache::remember($cacheKey, now()->addMinutes(15), function () use ($monthKey, $projectId, $rangeStart, $rangeEnd, $targetYear, $useWeekRange, $useMonthRange) {
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

            // For month range, generate time-series labels grouped by pole (not by month)
            // Order: AM (Jan), AM (Fév), BH (Jan), BH (Fév)... instead of AM (Jan), BH (Jan)... AM (Fév), BH (Fév)
            $monthRangeLabels = [];
            $monthRangeData = [];
            $monthRangeYear = $targetYear;
            if ($useMonthRange) {
                // First collect all months
                $monthsList = [];
                $currentMonth = Carbon::createFromFormat('Y-m', $monthStart->format('Y-m'));
                $endMonth = Carbon::createFromFormat('Y-m', $monthEnd->format('Y-m'));
                $monthRangeYear = $currentMonth->format('Y');
                
                $monthNames = [
                    '01' => 'Jan', '02' => 'Fév', '03' => 'Mar', '04' => 'Avr',
                    '05' => 'Mai', '06' => 'Juin', '07' => 'Juil', '08' => 'Août',
                    '09' => 'Sep', '10' => 'Oct', '11' => 'Nov', '12' => 'Déc'
                ];
                
                while ($currentMonth->lte($endMonth)) {
                    $monthsList[] = [
                        'key' => $currentMonth->format('Y-m'),
                        'short' => $monthNames[$currentMonth->format('m')] ?? $currentMonth->format('m'),
                    ];
                    $currentMonth->addMonth();
                }
                
                // Now generate labels grouped by pole (all months for pole 1, then all months for pole 2...)
                foreach ($poles as $pole) {
                    foreach ($monthsList as $monthInfo) {
                        $label = $pole . ' (' . $monthInfo['short'] . ')';
                        $monthRangeLabels[] = $label;
                        $monthRangeData[$monthInfo['key']][$pole] = [
                            'label' => $label,
                            'month' => $monthInfo['key'],
                            'pole' => $pole,
                        ];
                    }
                }
            }

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
            $isWeekInRange = function ($wkKey) use ($useWeekRange, $useMonthRange, $weekMonthMap, $monthKey, $monthStart, $monthEnd) {
                if ($useWeekRange) {
                    $weekDates = $weekMonthMap[$wkKey] ?? null;
                    if (!$weekDates) return false;
                    // Week is in range if it overlaps with the selected range
                    return $weekDates['start']->lte($monthEnd) && $weekDates['end']->gte($monthStart);
                } elseif ($useMonthRange) {
                    // For month range, check if week maps to any month in the range
                    // weekMonthMap stores month key strings (e.g., "2026-01") for month ranges
                    $mappedMonth = $weekMonthMap[$wkKey] ?? null;
                    if (!$mappedMonth) return false;
                    // Check if the mapped month is within our range
                    $mappedMonthStart = Carbon::createFromFormat('Y-m', $mappedMonth)->startOfMonth();
                    return $mappedMonthStart->gte($monthStart) && $mappedMonthStart->lte($monthEnd);
                } else {
                    $mapped = $weekMonthMap[$wkKey] ?? null;
                    return $mapped === $monthKey;
                }
            };

            // Helper to get month key from a date (for month range processing)
            $getMonthKeyFromDate = function ($date) {
                return Carbon::parse($date)->format('Y-m');
            };

            $projectPoleLabel = function ($projectId) use ($projectsById) {
                $p = $projectsById->get($projectId);
                return $p ? (string) ($p->pole ?? '') : '';
            };

            // SECTION A - Veille réglementaire (SST + Environnement)
            $hasVeilleCategory = Schema::hasColumn('regulatory_watch_submissions', 'category');

            $veilleSelect = ['project_id', 'week_year', 'week_number', 'overall_score', 'submitted_at'];
            if ($hasVeilleCategory) {
                $veilleSelect[] = 'category';
            }

            $veilleRows = RegulatoryWatchSubmission::query()
                ->whereIn('project_id', $projectsById->keys())
                ->whereBetween('submitted_at', [$monthStart->copy()->subDays(40), $monthEnd->copy()->addDays(40)])
                ->get($veilleSelect);

            // Initialize month-pole data structures for time-series
            $veilleByMonthPoleSst = [];
            $veilleByMonthPoleEnv = [];
            
            foreach ($veilleRows as $r) {
                $wkKey = ((int) $r->week_year) . '-' . ((int) $r->week_number);
                if (!$isWeekInRange($wkKey)) {
                    continue;
                }
                
                // Determine which month this record belongs to
                $submittedDate = Carbon::parse($r->submitted_at);
                $recordMonth = $submittedDate->format('Y-m');
                
                // Only include if within the selected month range
                if ($useMonthRange) {
                    $recordMonthStart = Carbon::createFromFormat('Y-m', $recordMonth)->startOfMonth();
                    if ($recordMonthStart->lt($monthStart) || $recordMonthStart->gt($monthEnd)) {
                        continue;
                    }
                }
                
                $pid = (int) $r->project_id;
                $pole = $projectPoleLabel($pid);
                if ($pole === '') continue;

                $cat = $hasVeilleCategory ? (string) ($r->category ?? '') : 'sst';
                if ($cat === '') {
                    $cat = 'sst';
                }
                $cat = strtolower(trim($cat));
                
                $score = (float) ($r->overall_score ?? 0);

                if ($cat === 'sst') {
                    $veilleByMonthPoleSst[$recordMonth][$pole][$pid][] = $score;
                } elseif ($cat === 'environment' || $cat === 'environnement' || $cat === 'environmental') {
                    $veilleByMonthPoleEnv[$recordMonth][$pole][$pid][] = $score;
                }
            }
            
            // Calculate averages by month-pole (for time-series) and overall by pole (for backward compatibility)
            $veillePoleAvgSst = [];
            $veillePoleAvgEnv = [];
            $veillePoleProjects = [];
            
            // For month range, we need time-series data
            if ($useMonthRange) {
                $currentMonth = Carbon::createFromFormat('Y-m', $monthStart->format('Y-m'));
                $endMonth = Carbon::createFromFormat('Y-m', $monthEnd->format('Y-m'));
                
                while ($currentMonth->lte($endMonth)) {
                    $monthKeyIter = $currentMonth->format('Y-m');
                    
                    foreach ($poles as $pole) {
                        // SST scores for this month-pole
                        $sstScores = [];
                        $envScores = [];
                        $breakdown = [];
                        
                        foreach ($projectsByPole->get($pole, collect()) as $p) {
                            $pid = $p->id;
                            $projectSstScores = $veilleByMonthPoleSst[$monthKeyIter][$pole][$pid] ?? [];
                            $projectEnvScores = $veilleByMonthPoleEnv[$monthKeyIter][$pole][$pid] ?? [];
                            
                            $avgSst = count($projectSstScores) ? round(array_sum($projectSstScores) / count($projectSstScores), 2) : 0.0;
                            $avgEnv = count($projectEnvScores) ? round(array_sum($projectEnvScores) / count($projectEnvScores), 2) : 0.0;
                            
                            if ($avgSst > 0 || $avgEnv > 0) {
                                $sstScores[] = $avgSst;
                                $envScores[] = $avgEnv;
                            }
                            
                            $breakdown[] = [
                                'project_id' => (int) $pid,
                                'project_name' => (string) $p->name,
                                'project_code' => (string) $p->code,
                                'score' => $avgSst,
                                'score_sst' => $avgSst,
                                'score_environment' => $avgEnv,
                            ];
                        }
                        
                        // Store time-series value for this month-pole
                        $veillePoleAvgSst[$monthKeyIter][$pole] = count($sstScores) ? round(array_sum($sstScores) / count($sstScores), 2) : 0.0;
                        $veillePoleAvgEnv[$monthKeyIter][$pole] = count($envScores) ? round(array_sum($envScores) / count($envScores), 2) : 0.0;
                        $veillePoleProjects[$monthKeyIter][$pole] = $breakdown;
                    }
                    
                    $currentMonth->addMonth();
                }
            } else {
                // Original logic for single month/week
                $veilleByProjectSst = [];
                $veilleByProjectEnv = [];
                
                foreach ($veilleRows as $r) {
                    $wkKey = ((int) $r->week_year) . '-' . ((int) $r->week_number);
                    if (!$isWeekInRange($wkKey)) continue;
                    $pid = (int) $r->project_id;
                    
                    $cat = $hasVeilleCategory ? (string) ($r->category ?? '') : 'sst';
                    if ($cat === '') $cat = 'sst';
                    $cat = strtolower(trim($cat));
                    
                    if ($cat === 'sst') {
                        $veilleByProjectSst[$pid][] = (float) ($r->overall_score ?? 0);
                    } elseif ($cat === 'environment' || $cat === 'environnement' || $cat === 'environmental') {
                        $veilleByProjectEnv[$pid][] = (float) ($r->overall_score ?? 0);
                    }
                }
                
                foreach ($projectsByPole as $pole => $poleProjects) {
                    if ($pole === '') continue;
                    $scoresSst = [];
                    $scoresEnv = [];
                    $breakdown = [];
                    
                    foreach ($poleProjects as $p) {
                        $valsSst = $veilleByProjectSst[$p->id] ?? [];
                        $valsEnv = $veilleByProjectEnv[$p->id] ?? [];
                        $scoreSst = count($valsSst) ? round(array_sum($valsSst) / count($valsSst), 2) : 0.0;
                        $scoreEnv = count($valsEnv) ? round(array_sum($valsEnv) / count($valsEnv), 2) : 0.0;
                        
                        $scoresSst[] = $scoreSst;
                        $scoresEnv[] = $scoreEnv;
                        
                        $breakdown[] = [
                            'project_id' => (int) $p->id,
                            'project_name' => (string) $p->name,
                            'project_code' => (string) $p->code,
                            'score' => $scoreSst,
                            'score_sst' => $scoreSst,
                            'score_environment' => $scoreEnv,
                        ];
                    }
                    
                    $veillePoleAvgSst[$pole] = count($scoresSst) ? round(array_sum($scoresSst) / count($scoresSst), 2) : 0.0;
                    $veillePoleAvgEnv[$pole] = count($scoresEnv) ? round(array_sum($scoresEnv) / count($scoresEnv), 2) : 0.0;
                    $veillePoleProjects[$pole] = $breakdown;
                }
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

            // Month-pole data structures for time-series
            $sorByMonthPole = [];
            $sorClosedByMonthPole = [];
            $sorSubByMonthPole = [];
            $sorSubClosedByMonthPole = [];
            $durationSumByMonthPole = [];
            $durationCountByMonthPole = [];
            $durationSubSumByMonthPole = [];
            $durationSubCountByMonthPole = [];

            foreach ($sorRows as $r) {
                $obsDate = $r->observation_date ? Carbon::parse($r->observation_date) : null;
                if (!$obsDate) continue;
                
                // Determine which month this record belongs to
                $recordMonth = $obsDate->format('Y-m');
                
                // Only include if within the selected month range
                if ($useMonthRange) {
                    $recordMonthStart = Carbon::createFromFormat('Y-m', $recordMonth)->startOfMonth();
                    if ($recordMonthStart->lt($monthStart) || $recordMonthStart->gt($monthEnd)) {
                        continue;
                    }
                }
                
                $week = WeekHelper::getWeekFromDate($obsDate);
                $wkKey = ((int) $week['year']) . '-' . ((int) $week['week']);
                if (!$isWeekInRange($wkKey)) continue;

                $pid = (int) $r->project_id;
                $pole = $projectPoleLabel($pid);
                if ($pole === '') continue;

                $sorByMonthPole[$recordMonth][$pole] = ($sorByMonthPole[$recordMonth][$pole] ?? 0) + 1;

                $isClosed = (string) ($r->status ?? '') === SorReport::STATUS_CLOSED;
                if ($isClosed) {
                    $sorClosedByMonthPole[$recordMonth][$pole] = ($sorClosedByMonthPole[$recordMonth][$pole] ?? 0) + 1;
                }

                $isSub = $isSubcontractorCompany($r->company ?? null);
                if ($isSub) {
                    $sorSubByMonthPole[$recordMonth][$pole] = ($sorSubByMonthPole[$recordMonth][$pole] ?? 0) + 1;
                    if ($isClosed) {
                        $sorSubClosedByMonthPole[$recordMonth][$pole] = ($sorSubClosedByMonthPole[$recordMonth][$pole] ?? 0) + 1;
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
                            $durationSumByMonthPole[$recordMonth][$pole] = ($durationSumByMonthPole[$recordMonth][$pole] ?? 0) + $hours;
                            $durationCountByMonthPole[$recordMonth][$pole] = ($durationCountByMonthPole[$recordMonth][$pole] ?? 0) + 1;

                            if (!empty($isSub)) {
                                $durationSubSumByMonthPole[$recordMonth][$pole] = ($durationSubSumByMonthPole[$recordMonth][$pole] ?? 0) + $hours;
                                $durationSubCountByMonthPole[$recordMonth][$pole] = ($durationSubCountByMonthPole[$recordMonth][$pole] ?? 0) + 1;
                            }
                        }
                    } catch (\Throwable $e) {
                        // ignore bad timestamps
                    }
                }
            }

            // Calculate final metrics by month-pole
            $sorPole = [];
            $sorPoleClosed = [];
            $sorSubPole = [];
            $sorSubPoleClosed = [];
            $durationPoleSum = [];
            $durationPoleCount = [];
            $durationSubPoleSum = [];
            $durationSubPoleCount = [];
            
            if ($useMonthRange) {
                $currentMonth = Carbon::createFromFormat('Y-m', $monthStart->format('Y-m'));
                $endMonth = Carbon::createFromFormat('Y-m', $monthEnd->format('Y-m'));
                
                while ($currentMonth->lte($endMonth)) {
                    $monthKeyIter = $currentMonth->format('Y-m');
                    
                    foreach ($poles as $pole) {
                        $sorPole[$monthKeyIter][$pole] = $sorByMonthPole[$monthKeyIter][$pole] ?? 0;
                        $sorPoleClosed[$monthKeyIter][$pole] = $sorClosedByMonthPole[$monthKeyIter][$pole] ?? 0;
                        $sorSubPole[$monthKeyIter][$pole] = $sorSubByMonthPole[$monthKeyIter][$pole] ?? 0;
                        $sorSubPoleClosed[$monthKeyIter][$pole] = $sorSubClosedByMonthPole[$monthKeyIter][$pole] ?? 0;
                        $durationPoleSum[$monthKeyIter][$pole] = $durationSumByMonthPole[$monthKeyIter][$pole] ?? 0;
                        $durationPoleCount[$monthKeyIter][$pole] = $durationCountByMonthPole[$monthKeyIter][$pole] ?? 0;
                        $durationSubPoleSum[$monthKeyIter][$pole] = $durationSubSumByMonthPole[$monthKeyIter][$pole] ?? 0;
                        $durationSubPoleCount[$monthKeyIter][$pole] = $durationSubCountByMonthPole[$monthKeyIter][$pole] ?? 0;
                    }
                    
                    $currentMonth->addMonth();
                }
            } else {
                // Original single-month logic
                foreach ($sorByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $count) {
                        $sorPole[$pole] = ($sorPole[$pole] ?? 0) + $count;
                    }
                }
                foreach ($sorClosedByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $count) {
                        $sorPoleClosed[$pole] = ($sorPoleClosed[$pole] ?? 0) + $count;
                    }
                }
                foreach ($sorSubByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $count) {
                        $sorSubPole[$pole] = ($sorSubPole[$pole] ?? 0) + $count;
                    }
                }
                foreach ($sorSubClosedByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $count) {
                        $sorSubPoleClosed[$pole] = ($sorSubPoleClosed[$pole] ?? 0) + $count;
                    }
                }
                foreach ($durationSumByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $sum) {
                        $durationPoleSum[$pole] = ($durationPoleSum[$pole] ?? 0) + $sum;
                    }
                }
                foreach ($durationCountByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $count) {
                        $durationPoleCount[$pole] = ($durationPoleCount[$pole] ?? 0) + $count;
                    }
                }
                foreach ($durationSubSumByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $sum) {
                        $durationSubPoleSum[$pole] = ($durationSubPoleSum[$pole] ?? 0) + $sum;
                    }
                }
                foreach ($durationSubCountByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $count) {
                        $durationSubPoleCount[$pole] = ($durationSubPoleCount[$pole] ?? 0) + $count;
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

            // Month-pole data structures for time-series
            $trainingByMonthPole = [];
            $trainingHoursByMonthPole = [];
            
            foreach ($trainingRows as $r) {
                $wkKey = ((int) $r->week_year) . '-' . ((int) $r->week_number);
                if (!$isWeekInRange($wkKey)) continue;
                
                // Determine month from week dates
                $weekDates = WeekHelper::getWeekDates($r->week_number, $r->week_year);
                $trainingDate = Carbon::parse($weekDates['start']);
                $recordMonth = $trainingDate->format('Y-m');
                
                // Only include if within the selected month range
                if ($useMonthRange) {
                    $recordMonthStart = Carbon::createFromFormat('Y-m', $recordMonth)->startOfMonth();
                    if ($recordMonthStart->lt($monthStart) || $recordMonthStart->gt($monthEnd)) {
                        continue;
                    }
                }
                
                $pid = (int) $r->project_id;
                $pole = $projectPoleLabel($pid);
                if ($pole === '') continue;

                $hours = $r->training_hours !== null ? (float) $r->training_hours : (float) ($r->duration_hours ?? 0);
                
                $trainingByMonthPole[$recordMonth][$pole] = ($trainingByMonthPole[$recordMonth][$pole] ?? 0) + 1;
                $trainingHoursByMonthPole[$recordMonth][$pole] = ($trainingHoursByMonthPole[$recordMonth][$pole] ?? 0) + $hours;
            }
            
            // Calculate final metrics by month-pole
            $trainingPoleCount = [];
            $trainingPoleHours = [];
            
            if ($useMonthRange) {
                $currentMonth = Carbon::createFromFormat('Y-m', $monthStart->format('Y-m'));
                $endMonth = Carbon::createFromFormat('Y-m', $monthEnd->format('Y-m'));
                
                while ($currentMonth->lte($endMonth)) {
                    $monthKeyIter = $currentMonth->format('Y-m');
                    
                    foreach ($poles as $pole) {
                        $trainingPoleCount[$monthKeyIter][$pole] = $trainingByMonthPole[$monthKeyIter][$pole] ?? 0;
                        $trainingPoleHours[$monthKeyIter][$pole] = $trainingHoursByMonthPole[$monthKeyIter][$pole] ?? 0;
                    }
                    
                    $currentMonth->addMonth();
                }
            } else {
                // Original single-month logic
                foreach ($trainingByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $count) {
                        $trainingPoleCount[$pole] = ($trainingPoleCount[$pole] ?? 0) + $count;
                    }
                }
                foreach ($trainingHoursByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $hours) {
                        $trainingPoleHours[$pole] = ($trainingPoleHours[$pole] ?? 0) + $hours;
                    }
                }
            }

            // SECTION E - Awareness
            $awRows = AwarenessSession::query()
                ->whereIn('project_id', $projectsById->keys())
                ->whereIn('week_year', [$targetYear - 1, $targetYear, $targetYear + 1])
                ->get(['project_id', 'week_year', 'week_number', 'session_hours']);

            // Month-pole data structures for time-series
            $awByMonthPole = [];
            $awHoursByMonthPole = [];
            
            foreach ($awRows as $r) {
                $wkKey = ((int) $r->week_year) . '-' . ((int) $r->week_number);
                if (!$isWeekInRange($wkKey)) continue;
                
                // Determine month from week dates
                $weekDates = WeekHelper::getWeekDates($r->week_number, $r->week_year);
                $sessionDate = Carbon::parse($weekDates['start']);
                $recordMonth = $sessionDate->format('Y-m');
                
                // Only include if within the selected month range
                if ($useMonthRange) {
                    $recordMonthStart = Carbon::createFromFormat('Y-m', $recordMonth)->startOfMonth();
                    if ($recordMonthStart->lt($monthStart) || $recordMonthStart->gt($monthEnd)) {
                        continue;
                    }
                }
                
                $pid = (int) $r->project_id;
                $pole = $projectPoleLabel($pid);
                if ($pole === '') continue;

                $hours = (float) ($r->session_hours ?? 0);
                
                $awByMonthPole[$recordMonth][$pole] = ($awByMonthPole[$recordMonth][$pole] ?? 0) + 1;
                $awHoursByMonthPole[$recordMonth][$pole] = ($awHoursByMonthPole[$recordMonth][$pole] ?? 0) + $hours;
            }
            
            // Calculate final metrics by month-pole
            $awPoleCount = [];
            $awPoleHours = [];
            
            if ($useMonthRange) {
                $currentMonth = Carbon::createFromFormat('Y-m', $monthStart->format('Y-m'));
                $endMonth = Carbon::createFromFormat('Y-m', $monthEnd->format('Y-m'));
                
                while ($currentMonth->lte($endMonth)) {
                    $monthKeyIter = $currentMonth->format('Y-m');
                    
                    foreach ($poles as $pole) {
                        $awPoleCount[$monthKeyIter][$pole] = $awByMonthPole[$monthKeyIter][$pole] ?? 0;
                        $awPoleHours[$monthKeyIter][$pole] = $awHoursByMonthPole[$monthKeyIter][$pole] ?? 0;
                    }
                    
                    $currentMonth->addMonth();
                }
            } else {
                // Original single-month logic
                foreach ($awByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $count) {
                        $awPoleCount[$pole] = ($awPoleCount[$pole] ?? 0) + $count;
                    }
                }
                foreach ($awHoursByMonthPole as $month => $poleData) {
                    foreach ($poleData as $pole => $hours) {
                        $awPoleHours[$pole] = ($awPoleHours[$pole] ?? 0) + $hours;
                    }
                }
            }

            // SECTION F - Subcontractor documents completion (filtered by date range)
            $openings = SubcontractorOpening::query()
                ->whereIn('project_id', $projectsById->keys())
                ->whereBetween('contractor_start_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
                ->with(['documents', 'project'])
                ->get();

            // DEBUG: Track subcontractor data
            $debugInfo = [
                'range_start' => $monthStart->toDateString(),
                'range_end' => $monthEnd->toDateString(),
                'project_ids' => $projectsById->keys()->toArray(),
                'opening_count_before_pole_filter' => $openings->count(),
                'poles_available' => $poles,
            ];
            $openingsWithoutPole = $openings->filter(fn($o) => empty($o->project?->pole));
            $debugInfo['openings_without_pole'] = $openingsWithoutPole->count();
            $debugInfo['openings_without_pole_ids'] = $openingsWithoutPole->pluck('id')->toArray();

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

            // DEBUG: Final summary
            $debugInfo['sub_by_pole_keys'] = array_keys($subByPole);
            $debugInfo['sub_by_pole_counts'] = array_map(fn($rows) => count($rows), $subByPole);
            $debugInfo['sub_pole_summary_counts'] = array_map(fn($s) => $s['count'], $subPoleSummary);

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

            // Prepare chart-friendly payload (labels = poles for single month/week, time-series for month range)
            $labels = $useMonthRange ? $monthRangeLabels : $poles;

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
            $vehicleMachineTypes = array_fill_keys([
                'ambulance',
                'bus',
                'camion ampiroll',
                'camion atelier (entretien)',
                'camion citerne (eau)',
                'camion citerne (gasoil)',
                'camion de servitude',
                'camion malaxeur béton',
                'camion pompe à béton',
                'camion semi-remorque',
                'camion à benne',
                'malaxeur à béton',
                'minibus',
                'pick-up',
                'remorque',
                'véhicule de service',
                'vehicule de service',
            ], true);

            $noOperatorMachineTypes = array_fill_keys([
                'ascenseur',
                'compresseur d’air',
                'compresseur d\'air',
                'concasseur',
                'concasseur mobile',
                'crible',
                'dame sauteuse',
                'fabrique de glace',
                'fraiseuse routière',
                'groupe de refroidissement',
                'groupe électrogène',
                'installation de lavage de sable',
                'plaque vibrante',
                'pompe d’injection',
                'pompe d\'injection',
                'pompe à béton projeté',
                'pompe à béton stationnaire',
                'pompe à eau',
                'poste électrique / transformateur',
                'scie à câble',
                'sondeuse',
                'tour d’éclairage',
                'trancheuse',
                'élévateur de charges (monte-charge)',
                'elevateur de charges (monte-charge)',
            ], true);
            $requiredMachineDocCount = 2;

            $machinesByProject = [];
            $machineCompletionByProject = [];
            foreach ($machines as $m) {
                $pid = (int) $m->project_id;
                $machinesByProject[$pid] = ($machinesByProject[$pid] ?? 0) + 1;

                $machineType = strtolower(trim((string) ($m->machine_type ?? '')));
                $regulatoryDocKey = isset($vehicleMachineTypes[$machineType]) ? 'visite_technique' : 'rapport_reglementaire';
                $requiredMachineDocKeys = [$regulatoryDocKey, 'assurance'];
                $skipOperator = isset($noOperatorMachineTypes[$machineType]);

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

                // Check if operator is assigned (not required for some equipment types)
                $hasOperator = $m->operators->count() > 0;
                $operatorScore = (!$skipOperator && $hasOperator) ? 1 : 0;

                // Completion: (uploaded docs + operator) / (required docs + operator?)
                $totalRequired = $requiredMachineDocCount + ($skipOperator ? 0 : 1);
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

            // Prepare response
            return response()->json([
                'year' => $targetYear,
                'month' => $monthStart->format('Y-m'),
                'month_end' => $monthEnd->format('Y-m'),
                'project_id' => $projectId,
                'projects' => $projectsList,
                'labels' => $labels,
                'debug' => $debugInfo,
                'sections' => [
                    'veille' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Veille SST %',
                                'data' => array_map(function ($label) use ($veillePoleAvgSst, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        // Extract month key and pole from "AM (Jan)"
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        // Map French month abbreviations back to month key
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        return $veillePoleAvgSst[$monthKey][$pole] ?? 0;
                                    }
                                    return $veillePoleAvgSst[$label] ?? 0;
                                }, $labels),
                            ],
                            [
                                'label' => 'Veille Environnement %',
                                'data' => array_map(function ($label) use ($veillePoleAvgEnv, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        return $veillePoleAvgEnv[$monthKey][$pole] ?? 0;
                                    }
                                    return $veillePoleAvgEnv[$label] ?? 0;
                                }, $labels),
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
                                'data' => array_map(function ($label) use ($sorPole, $sorPoleClosureRate, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        return (int) ($sorPole[$monthKey][$pole] ?? 0);
                                    }
                                    return (int) ($sorPole[$label] ?? 0);
                                }, $labels),
                            ],
                            [
                                'type' => 'line',
                                'label' => 'Closure %',
                                'data' => array_map(function ($label) use ($sorPole, $sorPoleClosed, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        $total = (int) ($sorPole[$monthKey][$pole] ?? 0);
                                        $closed = (int) ($sorPoleClosed[$monthKey][$pole] ?? 0);
                                        return $total > 0 ? round(($closed * 100.0) / $total, 2) : 0.0;
                                    }
                                    $total = (int) ($sorPole[$label] ?? 0);
                                    $closed = (int) ($sorPoleClosed[$label] ?? 0);
                                    return $total > 0 ? round(($closed * 100.0) / $total, 2) : 0.0;
                                }, $labels),
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
                                'data' => array_map(function ($label) use ($sorSubPole, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        return (int) ($sorSubPole[$monthKey][$pole] ?? 0);
                                    }
                                    return (int) ($sorSubPole[$label] ?? 0);
                                }, $labels),
                            ],
                            [
                                'type' => 'line',
                                'label' => 'Closure % (subcontractors)',
                                'data' => array_map(function ($label) use ($sorSubPole, $sorSubPoleClosed, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        $total = (int) ($sorSubPole[$monthKey][$pole] ?? 0);
                                        $closed = (int) ($sorSubPoleClosed[$monthKey][$pole] ?? 0);
                                        return $total > 0 ? round(($closed * 100.0) / $total, 2) : 0.0;
                                    }
                                    $total = (int) ($sorSubPole[$label] ?? 0);
                                    $closed = (int) ($sorSubPoleClosed[$label] ?? 0);
                                    return $total > 0 ? round(($closed * 100.0) / $total, 2) : 0.0;
                                }, $labels),
                            ],
                        ],
                        'by_pole_projects' => $sorSubPoleProjectBreakdown,
                    ],
                    'closure_duration' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Avg closure (hours)',
                                'data' => array_map(function ($label) use ($durationPoleSum, $durationPoleCount, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        $cnt = (int) ($durationPoleCount[$monthKey][$pole] ?? 0);
                                        $sum = (float) ($durationPoleSum[$monthKey][$pole] ?? 0);
                                        return $cnt > 0 ? round($sum / $cnt, 2) : 0.0;
                                    }
                                    $cnt = (int) ($durationPoleCount[$label] ?? 0);
                                    $sum = (float) ($durationPoleSum[$label] ?? 0);
                                    return $cnt > 0 ? round($sum / $cnt, 2) : 0.0;
                                }, $labels),
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
                                'data' => array_map(function ($label) use ($durationSubPoleSum, $durationSubPoleCount, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        $cnt = (int) ($durationSubPoleCount[$monthKey][$pole] ?? 0);
                                        $sum = (float) ($durationSubPoleSum[$monthKey][$pole] ?? 0);
                                        return $cnt > 0 ? round($sum / $cnt, 2) : 0.0;
                                    }
                                    $cnt = (int) ($durationSubPoleCount[$label] ?? 0);
                                    $sum = (float) ($durationSubPoleSum[$label] ?? 0);
                                    return $cnt > 0 ? round($sum / $cnt, 2) : 0.0;
                                }, $labels),
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
                                'data' => array_map(function ($label) use ($trainingPoleCount, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        return (int) ($trainingPoleCount[$monthKey][$pole] ?? 0);
                                    }
                                    return (int) ($trainingPoleCount[$label] ?? 0);
                                }, $labels),
                            ],
                            [
                                'label' => 'Hours',
                                'data' => array_map(function ($label) use ($trainingPoleHours, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        return round((float) ($trainingPoleHours[$monthKey][$pole] ?? 0), 2);
                                    }
                                    return round((float) ($trainingPoleHours[$label] ?? 0), 2);
                                }, $labels),
                            ],
                        ],
                        'by_pole_projects' => $trainingPoleProjectBreakdown,
                    ],
                    'awareness' => [
                        'labels' => $labels,
                        'datasets' => [
                            [
                                'label' => 'Sessions',
                                'data' => array_map(function ($label) use ($awPoleCount, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        return (int) ($awPoleCount[$monthKey][$pole] ?? 0);
                                    }
                                    return (int) ($awPoleCount[$label] ?? 0);
                                }, $labels),
                            ],
                            [
                                'label' => 'Hours',
                                'data' => array_map(function ($label) use ($awPoleHours, $useMonthRange, $monthRangeYear) {
                                    if ($useMonthRange) {
                                        preg_match('/^(.*?) \(([A-Za-zéû]+)\)$/', $label, $matches);
                                        $pole = $matches[1] ?? $label;
                                        $monthShort = $matches[2] ?? '';
                                        $monthMap = ['Jan' => '01', 'Fév' => '02', 'Mar' => '03', 'Avr' => '04', 'Mai' => '05', 'Juin' => '06', 'Juil' => '07', 'Août' => '08', 'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Déc' => '12'];
                                        $monthNum = $monthMap[$monthShort] ?? '01';
                                        $monthKey = $monthRangeYear . '-' . $monthNum;
                                        return round((float) ($awPoleHours[$monthKey][$pole] ?? 0), 2);
                                    }
                                    return round((float) ($awPoleHours[$label] ?? 0), 2);
                                }, $labels),
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
                                'data' => array_map(function ($label) use ($medicalPolePct, $useMonthRange) {
                                    $pole = $useMonthRange ? explode(' (', $label)[0] : $label;
                                    return $medicalPolePct[$pole] ?? 0;
                                }, $labels),
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
                                'data' => array_map(function ($label) use ($tfTgPole, $useMonthRange) {
                                    $pole = $useMonthRange ? explode(' (', $label)[0] : $label;
                                    return $tfTgPole[$pole]['tf'] ?? 0;
                                }, $labels),
                            ],
                            [
                                'label' => 'TG',
                                'data' => array_map(function ($label) use ($tfTgPole, $useMonthRange) {
                                    $pole = $useMonthRange ? explode(' (', $label)[0] : $label;
                                    return $tfTgPole[$pole]['tg'] ?? 0;
                                }, $labels),
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
                                'data' => array_map(function ($label) use ($accidentsIncidentsPole, $useMonthRange) {
                                    $pole = $useMonthRange ? explode(' (', $label)[0] : $label;
                                    return $accidentsIncidentsPole[$pole]['accidents'] ?? 0;
                                }, $labels),
                            ],
                            [
                                'label' => 'Incidents',
                                'data' => array_map(function ($label) use ($accidentsIncidentsPole, $useMonthRange) {
                                    $pole = $useMonthRange ? explode(' (', $label)[0] : $label;
                                    return $accidentsIncidentsPole[$pole]['incidents'] ?? 0;
                                }, $labels),
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
                                'data' => array_map(function ($label) use ($machineryPole, $useMonthRange) {
                                    $pole = $useMonthRange ? explode(' (', $label)[0] : $label;
                                    return $machineryPole[$pole]['count'] ?? 0;
                                }, $labels),
                            ],
                            [
                                'type' => 'line',
                                'label' => 'Avg completion %',
                                'data' => array_map(function ($label) use ($machineryPole, $useMonthRange) {
                                    $pole = $useMonthRange ? explode(' (', $label)[0] : $label;
                                    return $machineryPole[$pole]['avg_completion'] ?? 0;
                                }, $labels),
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
                                'data' => array_map(function ($label) use ($inspectionsPole, $useMonthRange) {
                                    $pole = $useMonthRange ? explode(' (', $label)[0] : $label;
                                    return $inspectionsPole[$pole] ?? 0;
                                }, $labels),
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
