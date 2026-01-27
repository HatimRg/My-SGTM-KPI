<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KpiReport;
use App\Models\Project;
use App\Models\User;
use App\Models\Training;
use App\Models\AwarenessSession;
use App\Models\SorReport;
use App\Models\WorkPermit;
use App\Models\Inspection;
use App\Models\Machine;
use App\Models\HseEvent;
use App\Models\RegulatoryWatchSubmission;
use App\Models\Worker;
use App\Models\WorkerMedicalAptitude;
use App\Models\MonthlyKpiMeasurement;
use App\Models\LightingMeasurement;
use App\Helpers\WeekHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class DashboardController extends Controller
{
    private const SAFETY_PERFORMANCE_SEVERITY_LABELS = [
        1 => 'near_miss',
        2 => 'first_aid',
        3 => 'medical',
        4 => 'lta',
        5 => 'serious',
        6 => 'fatal',
    ];

    private function safetySeverityFromDetails(?array $details, ?string $fallbackType = null, ?string $fallbackSeverity = null): array
    {
        // Default (unknown)
        $score = 0;

        if (is_array($details) && ($details['schema_version'] ?? null) === 'accident_v1') {
            $victims = $details['victims'] ?? [];
            if (is_array($victims)) {
                foreach ($victims as $v) {
                    if (!is_array($v)) {
                        continue;
                    }
                    $outcome = (string) ($v['outcome'] ?? '');
                    $rank = match ($outcome) {
                        'fatal' => 6,
                        'serious_hospitalization' => 5,
                        'lost_time_accident' => 4,
                        'medical_treatment_no_lost_time' => 3,
                        'first_aid_only' => 2,
                        'no_injury' => 1,
                        default => 0,
                    };
                    if ($rank > $score) {
                        $score = $rank;
                    }
                }
            }
        }

        // Legacy / fallback mapping.
        if ($score === 0) {
            $type = (string) ($fallbackType ?? '');
            if ($type === 'near_miss') {
                $score = 1;
            } elseif ($type === 'first_aid') {
                $score = 2;
            } elseif ($type === 'medical_consultation') {
                $score = 3;
            }
        }

        if ($score === 0) {
            $sev = (string) ($fallbackSeverity ?? '');
            $score = match ($sev) {
                'minor' => 2,
                'moderate' => 3,
                'major' => 4,
                'critical' => 5,
                'fatal' => 6,
                default => 0,
            };
        }

        if ($score === 0) {
            $score = 1; // default to "near miss" to avoid dropping events from charts
        }

        return [
            'score' => $score,
            'label' => self::SAFETY_PERFORMANCE_SEVERITY_LABELS[$score] ?? 'near_miss',
        ];
    }

    /**
     * Monthly environmental dashboard data sourced from measurement tables.
     */
    public function environmentalMonthly(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->isAdminLike() && !$user->isHseManager())) {
            return $this->error('Access denied', 403);
        }
        $year = (int) $request->get('year', (int) date('Y'));
        $month = $request->get('month');
        $month = $month !== null && $month !== '' && $month !== 'all' ? (int) $month : null;

        $projectId = $request->get('project_id');
        $pole = $request->get('pole');

        $projectIds = $user?->visibleProjectIds();
        if ($projectIds !== null && count($projectIds) === 0) {
            return $this->success([
                'year' => $year,
                'month' => $month,
                'series' => [],
                'stats' => [
                    'noise_avg' => 0,
                    'water_total' => 0,
                    'electricity_total' => 0,
                    'lux_avg' => 0,
                    'lux_compliance_rate' => 0,
                    'lux_count' => 0,
                ],
            ]);
        }

        $months = range(1, 12);
        $series = collect($months)->map(fn ($m) => [
            'month' => $m,
            'noise_avg' => 0,
            'water_total' => 0,
            'electricity_total' => 0,
            'lux_avg' => 0,
            'lux_compliance_rate' => 0,
            'lux_count' => 0,
        ])->keyBy('month');

        $monthlyQuery = MonthlyKpiMeasurement::query()->where('year', $year);
        if ($projectIds !== null) {
            $monthlyQuery->whereIn('project_id', $projectIds);
        }
        if ($projectId) {
            $monthlyQuery->where('project_id', (int) $projectId);
        }
        if ($pole !== null && $pole !== '') {
            $monthlyQuery->whereHas('project', function ($q) use ($pole) {
                $q->where('pole', $pole);
            });
        }
        if ($month !== null) {
            $monthlyQuery->where('month', $month);
        }

        $indicators = ['noise_monitoring', 'water_consumption', 'electricity_consumption'];
        $monthlyRows = (clone $monthlyQuery)
            ->whereIn('indicator', $indicators)
            ->selectRaw('month, indicator, SUM(value) as total_value, AVG(value) as avg_value')
            ->groupBy('month', 'indicator')
            ->get();

        foreach ($monthlyRows as $row) {
            $m = (int) $row->month;
            if (!$series->has($m)) {
                continue;
            }
            $entry = $series->get($m);
            $indicator = (string) $row->indicator;
            if ($indicator === 'noise_monitoring') {
                $entry['noise_avg'] = round((float) ($row->avg_value ?? 0), 1);
            } elseif ($indicator === 'water_consumption') {
                $entry['water_total'] = round((float) ($row->total_value ?? 0), 2);
            } elseif ($indicator === 'electricity_consumption') {
                $entry['electricity_total'] = round((float) ($row->total_value ?? 0), 2);
            }
            $series->put($m, $entry);
        }

        $lightingQuery = LightingMeasurement::query()->where('year', $year);
        if ($projectIds !== null) {
            $lightingQuery->whereIn('project_id', $projectIds);
        }
        if ($projectId) {
            $lightingQuery->where('project_id', (int) $projectId);
        }
        if ($pole !== null && $pole !== '') {
            $lightingQuery->whereHas('project', function ($q) use ($pole) {
                $q->where('pole', $pole);
            });
        }
        if ($month !== null) {
            $lightingQuery->where('month', $month);
        }

        $luxRows = (clone $lightingQuery)
            ->selectRaw('month, AVG(lux_value) as avg_lux, COUNT(*) as total_count, SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant_count, SUM(CASE WHEN is_compliant IS NOT NULL THEN 1 ELSE 0 END) as compliance_total')
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        foreach ($luxRows as $row) {
            $m = (int) $row->month;
            if (!$series->has($m)) {
                continue;
            }
            $entry = $series->get($m);
            $entry['lux_avg'] = round((float) ($row->avg_lux ?? 0), 1);
            $entry['lux_count'] = (int) ($row->total_count ?? 0);
            $den = (int) ($row->compliance_total ?? 0);
            $num = (int) ($row->compliant_count ?? 0);
            $entry['lux_compliance_rate'] = $den > 0 ? round(($num * 100.0) / $den, 1) : 0;
            $series->put($m, $entry);
        }

        $seriesList = $series->values()->all();

        // Stats: if a month is selected, use that month; otherwise use YTD values.
        $stats = [
            'noise_avg' => 0,
            'water_total' => 0,
            'electricity_total' => 0,
            'lux_avg' => 0,
            'lux_compliance_rate' => 0,
            'lux_count' => 0,
        ];

        if ($month !== null) {
            $stats = $series->get($month) ?? $stats;
        } else {
            $noiseValues = array_map(fn ($r) => (float) ($r['noise_avg'] ?? 0), $seriesList);
            $noiseNonZero = array_values(array_filter($noiseValues, fn ($v) => $v > 0));
            $stats['noise_avg'] = count($noiseNonZero) > 0 ? round(array_sum($noiseNonZero) / count($noiseNonZero), 1) : 0;
            $stats['water_total'] = round(array_sum(array_map(fn ($r) => (float) ($r['water_total'] ?? 0), $seriesList)), 2);
            $stats['electricity_total'] = round(array_sum(array_map(fn ($r) => (float) ($r['electricity_total'] ?? 0), $seriesList)), 2);

            $luxValues = array_map(fn ($r) => (float) ($r['lux_avg'] ?? 0), $seriesList);
            $luxNonZero = array_values(array_filter($luxValues, fn ($v) => $v > 0));
            $stats['lux_avg'] = count($luxNonZero) > 0 ? round(array_sum($luxNonZero) / count($luxNonZero), 1) : 0;
            $stats['lux_count'] = (int) array_sum(array_map(fn ($r) => (int) ($r['lux_count'] ?? 0), $seriesList));

            $compliancePairs = array_map(fn ($r) => [
                'rate' => (float) ($r['lux_compliance_rate'] ?? 0),
                'count' => (int) ($r['lux_count'] ?? 0),
            ], $seriesList);
            $weightedDen = array_sum(array_map(fn ($p) => $p['count'], $compliancePairs));
            $weightedNum = array_sum(array_map(fn ($p) => $p['rate'] * $p['count'], $compliancePairs));
            $stats['lux_compliance_rate'] = $weightedDen > 0 ? round($weightedNum / $weightedDen, 1) : 0;
        }

        return $this->success([
            'year' => $year,
            'month' => $month,
            'series' => $seriesList,
            'stats' => $stats,
        ]);
    }

    private function victimsCountFromDetails(?array $details): int
    {
        if (is_array($details) && ($details['schema_version'] ?? null) === 'accident_v1') {
            $count = (int) ($details['victims_count'] ?? 0);
            if ($count > 0) {
                return $count;
            }
            $victims = $details['victims'] ?? null;
            if (is_array($victims)) {
                return count($victims);
            }
        }
        return 1;
    }

    private function fatalitiesCountFromDetails(?array $details, int $severityScore): int
    {
        if (is_array($details) && ($details['schema_version'] ?? null) === 'accident_v1') {
            $victims = $details['victims'] ?? [];
            if (is_array($victims)) {
                $n = 0;
                foreach ($victims as $v) {
                    if (is_array($v) && ($v['outcome'] ?? null) === 'fatal') {
                        $n++;
                    }
                }
                if ($n > 0) {
                    return $n;
                }
            }
        }

        return $severityScore >= 6 ? 1 : 0;
    }

    public function safetyPerformance(Request $request)
    {
        $user = $request->user();
        $year = (int) $request->get('year', date('Y'));
        $projectId = $request->get('project_id');
        $pole = $request->get('pole');
        $week = $request->get('week');
        $week = $week !== null ? (int) $week : null;

        if (!$user || (!$user->isAdminLike() && !$user->isHseManager())) {
            return $this->error('Access denied', 403);
        }

        $projectIdsForPole = null;
        if ($pole !== null && $pole !== '') {
            $projectIdsForPole = Project::query()->visibleTo($user)->where('pole', $pole)->pluck('id');
        } else {
            $projectIdsForPole = $user->visibleProjectIds();
        }

        $eventsQuery = HseEvent::query()->with(['project:id,name,code,pole']);

        if ($projectIdsForPole !== null) {
            if (count($projectIdsForPole) === 0) {
                $eventsQuery->whereRaw('1 = 0');
            } else {
                $eventsQuery->whereIn('project_id', $projectIdsForPole);
            }
        }

        $eventsQuery->where('event_year', $year);

        if ($projectId && $projectId !== 'all') {
            $eventsQuery->where('project_id', (int) $projectId);
        }

        if ($pole !== null && $pole !== '') {
            $eventsQuery->where('pole', $pole);
        }

        if ($week && $week >= 1 && $week <= 52) {
            $eventsQuery->where('week_year', $year)->where('week_number', $week);
        }

        $events = $eventsQuery->get([
            'id',
            'project_id',
            'event_date',
            'event_year',
            'week_year',
            'week_number',
            'pole',
            'type',
            'severity',
            'location',
            'details',
        ]);

        $byProject = [];
        $byLocation = [];
        $byActivity = [];
        $conditionsMatrix = []; // [ground][lighting] => value
        $grounds = [];
        $lightings = [];
        $causeFlows = []; // [immediate][root] => count
        $bubble = []; // key => agg
        $actionsHealth = []; // [type][status] => count
        $rootCauseCounts = [];

        $totalEvents = 0;
        $weightedIndex = 0;
        $severeCount = 0;
        $totalVictims = 0;
        $totalFatalities = 0;
        $totalActions = 0;
        $overdueActions = 0;

        $now = now()->startOfDay();

        foreach ($events as $e) {
            $totalEvents++;
            $details = is_array($e->details) ? $e->details : null;

            $sev = $this->safetySeverityFromDetails($details, $e->type, $e->severity);
            $score = (int) $sev['score'];
            $label = (string) $sev['label'];

            $weightedIndex += $score;
            if ($score >= 4) {
                $severeCount++;
            }

            $victimsCount = $this->victimsCountFromDetails($details);
            $totalVictims += $victimsCount;
            $fatalities = $this->fatalitiesCountFromDetails($details, $score);
            $totalFatalities += $fatalities;

            // Project Hotspots
            $p = $e->project;
            $projectKey = $p ? (string) $p->id : (string) $e->project_id;
            if (!isset($byProject[$projectKey])) {
                $byProject[$projectKey] = [
                    'project_id' => (int) ($p?->id ?? $e->project_id),
                    'project_name' => (string) ($p?->name ?? 'unknown'),
                    'project_code' => $p?->code,
                    'near_miss' => 0,
                    'first_aid' => 0,
                    'medical' => 0,
                    'lta' => 0,
                    'serious' => 0,
                    'fatal' => 0,
                    'total' => 0,
                    'weighted' => 0,
                ];
            }
            $byProject[$projectKey][$label] = ($byProject[$projectKey][$label] ?? 0) + 1;
            $byProject[$projectKey]['total'] += 1;
            $byProject[$projectKey]['weighted'] += $score;

            // Worst location/zone
            $loc = (string) ($e->location ?? '');
            if ($loc === '' && is_array($details)) {
                $loc = (string) ($details['exact_location'] ?? '');
            }
            $loc = $loc !== '' ? $loc : 'unknown';
            $byLocation[$loc] = ($byLocation[$loc] ?? 0) + $score;

            // Activity driver
            $activity = null;
            if (is_array($details) && ($details['schema_version'] ?? null) === 'accident_v1') {
                $activity = $details['activity'] ?? null;
                if ($activity === 'other' && !empty($details['activity_other'])) {
                    $activity = $details['activity_other'];
                }
            }
            $activity = $activity ? (string) $activity : 'unknown';
            $byActivity[$activity] = ($byActivity[$activity] ?? 0) + 1;

            // Conditions Matrix
            $ground = null;
            $lighting = null;
            if (is_array($details) && ($details['schema_version'] ?? null) === 'accident_v1') {
                $ground = $details['ground_condition'] ?? null;
                $lighting = $details['lighting'] ?? null;
            }
            $ground = $ground ? (string) $ground : 'unknown';
            $lighting = $lighting ? (string) $lighting : 'unknown';
            $grounds[$ground] = true;
            $lightings[$lighting] = true;
            if (!isset($conditionsMatrix[$ground])) {
                $conditionsMatrix[$ground] = [];
            }
            $conditionsMatrix[$ground][$lighting] = (int) (($conditionsMatrix[$ground][$lighting] ?? 0) + $score);

            // Cause Path
            $immediate = null;
            $roots = [];
            if (is_array($details) && ($details['schema_version'] ?? null) === 'accident_v1') {
                $immediate = $details['immediate_cause'] ?? null;
                if ($immediate === 'other' && !empty($details['immediate_cause_other'])) {
                    $immediate = $details['immediate_cause_other'];
                }
                $rootsRaw = $details['root_causes'] ?? [];
                if (is_array($rootsRaw)) {
                    $roots = array_values(array_filter(array_map('strval', $rootsRaw)));
                }
            }
            $immediate = $immediate ? (string) $immediate : 'unknown';
            if (empty($roots)) {
                $roots = ['unknown'];
            }

            foreach ($roots as $r) {
                if (!isset($causeFlows[$immediate])) {
                    $causeFlows[$immediate] = [];
                }
                $causeFlows[$immediate][$r] = (int) (($causeFlows[$immediate][$r] ?? 0) + 1);
                $rootCauseCounts[$r] = (int) (($rootCauseCounts[$r] ?? 0) + 1);
            }

            // Bubble: Severity vs Victims
            $bubbleKey = $score . '|' . $victimsCount . '|' . $activity;
            if (!isset($bubble[$bubbleKey])) {
                $bubble[$bubbleKey] = [
                    'severity_score' => $score,
                    'victims' => $victimsCount,
                    'activity' => $activity,
                    'events' => 0,
                ];
            }
            $bubble[$bubbleKey]['events'] += 1;

            // Actions health
            $actions = [];
            if (is_array($details) && ($details['schema_version'] ?? null) === 'accident_v1') {
                $raw = $details['corrective_actions'] ?? [];
                if (is_array($raw)) {
                    $actions = $raw;
                }
            }

            foreach ($actions as $a) {
                if (!is_array($a)) {
                    continue;
                }
                $totalActions++;
                $type = (string) ($a['type'] ?? 'unknown');
                if ($type === '') {
                    $type = 'unknown';
                }

                $status = (string) ($a['status'] ?? 'open');
                if (!in_array($status, ['open', 'in_progress', 'closed'], true)) {
                    $status = 'open';
                }

                $deadline = $a['deadline'] ?? null;
                if ($status !== 'closed' && $deadline) {
                    try {
                        $d = Carbon::parse($deadline)->startOfDay();
                        if ($d->lt($now)) {
                            $status = 'overdue';
                            $overdueActions++;
                        }
                    } catch (\Throwable $ex) {
                        // ignore parse errors
                    }
                }

                if (!isset($actionsHealth[$type])) {
                    $actionsHealth[$type] = [
                        'open' => 0,
                        'in_progress' => 0,
                        'closed' => 0,
                        'overdue' => 0,
                    ];
                }
                $actionsHealth[$type][$status] = (int) (($actionsHealth[$type][$status] ?? 0) + 1);
            }
        }

        // KPI tiles
        $pctSevere = $totalEvents > 0 ? round(($severeCount * 100.0) / $totalEvents, 1) : 0;
        $pctActionsOverdue = $totalActions > 0 ? round(($overdueActions * 100.0) / $totalActions, 1) : 0;

        $worstProject = null;
        if (!empty($byProject)) {
            $sorted = array_values($byProject);
            usort($sorted, function ($a, $b) {
                return ($b['weighted'] <=> $a['weighted']);
            });
            $worstProject = [
                'project_id' => $sorted[0]['project_id'],
                'project_name' => $sorted[0]['project_name'],
                'weighted' => $sorted[0]['weighted'],
            ];
        }

        $worstLocation = null;
        if (!empty($byLocation)) {
            arsort($byLocation);
            $loc = array_key_first($byLocation);
            $worstLocation = [
                'location' => $loc,
                'weighted' => (int) ($byLocation[$loc] ?? 0),
            ];
        }

        $topActivity = null;
        if (!empty($byActivity)) {
            arsort($byActivity);
            $a = array_key_first($byActivity);
            $topActivity = [
                'activity' => $a,
                'count' => (int) ($byActivity[$a] ?? 0),
            ];
        }

        $topRootCause = null;
        if (!empty($rootCauseCounts)) {
            arsort($rootCauseCounts);
            $r = array_key_first($rootCauseCounts);
            $topRootCause = [
                'root_cause' => $r,
                'count' => (int) ($rootCauseCounts[$r] ?? 0),
            ];
        }

        // Graph 1: Project hotspots
        $hotspots = array_values($byProject);
        usort($hotspots, function ($a, $b) {
            return ($b['weighted'] <=> $a['weighted']);
        });

        // Graph 3: Activity driver Pareto
        $activityRows = [];
        $activityTotal = array_sum($byActivity);
        if ($activityTotal < 1) {
            $activityTotal = 1;
        }
        arsort($byActivity);
        $running = 0;
        foreach ($byActivity as $act => $cnt) {
            $running += (int) $cnt;
            $activityRows[] = [
                'activity' => (string) $act,
                'count' => (int) $cnt,
                'cumulative_pct' => round(($running * 100.0) / $activityTotal, 1),
            ];
        }

        // Graph 4: Conditions matrix
        $groundsList = array_keys($grounds);
        $lightingsList = array_keys($lightings);
        sort($groundsList);
        sort($lightingsList);
        $matrixData = [];
        foreach ($groundsList as $g) {
            foreach ($lightingsList as $l) {
                $matrixData[] = [
                    'ground_condition' => $g,
                    'lighting' => $l,
                    'value' => (int) (($conditionsMatrix[$g][$l] ?? 0)),
                ];
            }
        }

        // Graph 5: Cause path sankey (nodes+links)
        $nodeIndex = [];
        $nodes = [];
        $links = [];

        $ensureNode = function (string $name) use (&$nodeIndex, &$nodes) {
            if (!isset($nodeIndex[$name])) {
                $nodeIndex[$name] = count($nodes);
                $nodes[] = ['name' => $name];
            }
            return $nodeIndex[$name];
        };

        foreach ($causeFlows as $imm => $targets) {
            $s = $ensureNode((string) $imm);
            foreach ($targets as $root => $cnt) {
                $t = $ensureNode((string) $root);
                $links[] = [
                    'source' => $s,
                    'target' => $t,
                    'value' => (int) $cnt,
                ];
            }
        }

        // Graph 6: Bubble
        $bubbleRows = array_values($bubble);

        // Graph 7: Actions health
        $actionRows = [];
        foreach ($actionsHealth as $type => $counts) {
            $actionRows[] = array_merge(['type' => $type], $counts);
        }
        usort($actionRows, function ($a, $b) {
            $ta = (int) (($a['open'] ?? 0) + ($a['in_progress'] ?? 0) + ($a['closed'] ?? 0) + ($a['overdue'] ?? 0));
            $tb = (int) (($b['open'] ?? 0) + ($b['in_progress'] ?? 0) + ($b['closed'] ?? 0) + ($b['overdue'] ?? 0));
            return $tb <=> $ta;
        });

        return $this->success([
            'filters' => [
                'year' => $year,
                'project_id' => $projectId,
                'pole' => $pole,
                'week' => $week,
            ],
            'kpis' => [
                'total_events' => $totalEvents,
                'severity_weighted_index' => $weightedIndex,
                'pct_severe' => $pctSevere,
                'total_victims' => $totalVictims,
                'total_fatalities' => $totalFatalities,
                'worst_project' => $worstProject,
                'worst_location' => $worstLocation,
                'top_activity' => $topActivity,
                'top_root_cause' => $topRootCause,
                'pct_actions_overdue' => $pctActionsOverdue,
            ],
            'charts' => [
                'project_hotspots' => $hotspots,
                'activity_driver' => $activityRows,
                'conditions_matrix' => [
                    'rows' => $groundsList,
                    'cols' => $lightingsList,
                    'data' => $matrixData,
                ],
                'cause_path' => [
                    'nodes' => $nodes,
                    'links' => $links,
                ],
                'severity_vs_victims' => $bubbleRows,
                'actions_health' => $actionRows,
            ],
            'meta' => [
                'severity_labels' => self::SAFETY_PERFORMANCE_SEVERITY_LABELS,
            ],
        ]);
    }

    /**
     * Get public stats for login page (no auth required)
     * Cached for 5 minutes to reduce database load
     */
    public function publicStats()
    {
        $year = date('Y');
        
        return $this->success(Cache::remember('public_stats_' . $year, 300, function () use ($year) {
            // HSE Compliance from KPI reports
            $hseCompliance = RegulatoryWatchSubmission::where('week_year', $year)
                ->whereNotNull('overall_score')
                ->avg('overall_score') ?? 0;
            
            // Total training hours from Training table
            $trainingHours = Training::where('week_year', $year)->sum('training_hours') ?? 0;
            
            // Fatal accidents this year from KPI reports
            $fatalAccidents = KpiReport::where('report_year', $year)
                ->approved()
                ->sum('accidents_fatal') ?? 0;
            
            return [
                'hse_compliance' => round((float) $hseCompliance, 1),
                'training_hours' => (int) $trainingHours,
                'fatal_accidents' => (int) $fatalAccidents,
                'year' => $year,
            ];
        }));
    }

    /**
     * Get admin dashboard data
     */
    public function adminDashboard(Request $request)
    {
        $user = $request->user();
        $year = (int) $request->get('year', date('Y'));
        $projectId = $request->get('project_id');
        $pole = $request->get('pole');
        $week = $request->get('week');
        $week = $week !== null ? (int) $week : null;

        if (!$user || (!$user->isAdminLike() && !$user->isHseManager())) {
            return $this->error('Access denied', 403);
        }

        $projectIdsForPole = null;
        if ($pole !== null && $pole !== '') {
            $projectIdsForPole = Project::query()->visibleTo($user)->where('pole', $pole)->pluck('id');
        } else {
            $projectIdsForPole = $user->visibleProjectIds();
        }

        $projectsBase = Project::query()->visibleTo($user);
        if ($pole !== null && $pole !== '') {
            $projectsBase->where('pole', $pole);
        }

        $totalReportsQuery = KpiReport::query()->where('report_year', $year);
        if ($projectIdsForPole !== null) {
            $totalReportsQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $totalReportsQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $totalReportsQuery->where('week_number', $week);
        }

        $pendingReportsQuery = KpiReport::submitted();
        if ($projectIdsForPole !== null) {
            $pendingReportsQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $pendingReportsQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $pendingReportsQuery->where('week_number', $week);
        }

        // Overall statistics
        $activeMachinesQuery = Machine::query()
            ->whereNotNull('project_id')
            ->where('is_active', true);
        if ($projectIdsForPole !== null) {
            if (count($projectIdsForPole) === 0) {
                $activeMachinesQuery->whereRaw('1 = 0');
            } else {
                $activeMachinesQuery->whereIn('project_id', $projectIdsForPole);
            }
        }
        if ($projectId) {
            $activeMachinesQuery->where('project_id', $projectId);
        }

        $stats = [
            'total_projects' => (clone $projectsBase)->count(),
            'active_projects' => (clone $projectsBase)->where('status', Project::STATUS_ACTIVE)->count(),
            'total_users' => User::count(),
            'active_users' => User::active()->count(),
            'pending_reports' => (clone $pendingReportsQuery)->count(),
            'active_machines' => (clone $activeMachinesQuery)->count(),
            'total_reports' => (clone $totalReportsQuery)->count(),
        ];

        if ($user && $user->isHseManager() && !$user->isAdminLike()) {
            if ($projectIdsForPole !== null && count($projectIdsForPole) === 0) {
                $stats['total_users'] = 0;
                $stats['active_users'] = 0;
            } else {
                $userIdsSubquery = DB::table('project_user')
                    ->select('user_id')
                    ->when($projectIdsForPole !== null, function ($q) use ($projectIdsForPole) {
                        return $q->whereIn('project_id', $projectIdsForPole);
                    })
                    ->distinct();

                $stats['total_users'] = (int) User::query()->whereIn('id', $userIdsSubquery)->count();
                $stats['active_users'] = (int) User::query()->active()->whereIn('id', $userIdsSubquery)->count();
            }
        }

        $kpiQuery = KpiReport::where('report_year', $year)->approved();
        if ($projectIdsForPole !== null) {
            $kpiQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $kpiQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $kpiQuery->where('week_number', $week);
        }

        // KPI Summary (including environmental data)
        // TF = (Accidents with arrêt * 1,000,000) / Hours worked
        // TG = (Lost workdays * 1,000) / Hours worked
        // Use weighted calculations over total hours (not AVG of per-report rates).
        $kpiSummary = (clone $kpiQuery)
            ->selectRaw('
                SUM(accidents) as total_accidents,
                SUM(accidents_fatal) as fatal_accidents,
                SUM(accidents_serious) as serious_accidents,
                SUM(accidents_minor) as minor_accidents,
                SUM(trainings_conducted) as total_trainings,
                SUM(trainings_planned) as total_trainings_planned,
                SUM(employees_trained) as employees_trained,
                SUM(inspections_completed) as total_inspections,
                SUM(hours_worked) as total_hours,
                SUM(lost_workdays) as lost_workdays,
                SUM(training_hours) as total_training_hours,
                SUM(near_misses) as total_near_misses,
                SUM(work_permits) as total_work_permits,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(accidents) * 1000000.0) / SUM(hours_worked) ELSE 0 END as avg_tf,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(lost_workdays) * 1000.0) / SUM(hours_worked) ELSE 0 END as avg_tg,
                AVG(hse_compliance_rate) as avg_hse_compliance,
                AVG(medical_compliance_rate) as avg_medical_compliance,
                SUM(water_consumption) as total_water_consumption,
                SUM(electricity_consumption) as total_electricity_consumption,
                AVG(noise_monitoring) as avg_noise
            ')
            ->first();

        // Weekly trends (week-based data) - including environmental
        $weeklyTrendsQuery = KpiReport::where('report_year', $year)
            ->approved()
            ->whereNotNull('week_number')
            ;
        if ($projectIdsForPole !== null) {
            $weeklyTrendsQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $weeklyTrendsQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $weeklyTrendsQuery->where('week_number', $week);
        }

        $weeklyTrends = (clone $weeklyTrendsQuery)
            ->selectRaw('
                week_number,
                SUM(accidents) as accidents,
                SUM(accidents_fatal) as accidents_fatal,
                SUM(accidents_serious) as accidents_serious,
                SUM(accidents_minor) as accidents_minor,
                SUM(trainings_conducted) as trainings,
                SUM(employees_trained) as employees_trained,
                SUM(training_hours) as training_hours,
                SUM(inspections_completed) as inspections,
                SUM(near_misses) as near_misses,
                SUM(work_permits) as work_permits,
                SUM(hours_worked) as hours_worked,
                SUM(lost_workdays) as lost_workdays,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(accidents) * 1000000.0) / SUM(hours_worked) ELSE 0 END as tf,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(lost_workdays) * 1000.0) / SUM(hours_worked) ELSE 0 END as tg,
                AVG(hse_compliance_rate) as hse_compliance,
                AVG(medical_compliance_rate) as medical_compliance,
                SUM(water_consumption) as water,
                SUM(electricity_consumption) as electricity
            ')
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get()
            ->map(function ($item) {
                return [
                    'week' => $item->week_number,
                    'week_label' => 'S' . $item->week_number,
                    'accidents' => (int) $item->accidents,
                    'fatal_accidents' => (int) ($item->accidents_fatal ?? 0),
                    'serious_accidents' => (int) ($item->accidents_serious ?? 0),
                    'minor_accidents' => (int) ($item->accidents_minor ?? 0),
                    'trainings' => (int) $item->trainings,
                    'employees_trained' => (int) ($item->employees_trained ?? 0),
                    'training_hours' => round($item->training_hours ?? 0, 1),
                    'inspections' => (int) $item->inspections,
                    'near_misses' => (int) $item->near_misses,
                    'work_permits' => (int) $item->work_permits,
                    'tf' => round($item->tf ?? 0, 2),
                    'tg' => round($item->tg ?? 0, 4),
                    'hse_compliance' => round($item->hse_compliance ?? 0, 1),
                    'medical_compliance' => round($item->medical_compliance ?? 0, 1),
                    'water' => round($item->water ?? 0, 1),
                    'electricity' => round($item->electricity ?? 0, 1),
                ];
            });

        // Compliance (medical + HSE) should be computed from authoritative sources:
        // - Medical: workers + medical aptitudes (based on exam_date)
        // - HSE: regulatory watch submissions (based on overall_score)

        $workersQuery = Worker::query();
        if ($projectIdsForPole !== null) {
            if (count($projectIdsForPole) === 0) {
                $workersQuery->whereRaw('1 = 0');
            } else {
                $workersQuery->whereIn('project_id', $projectIdsForPole);
            }
        }
        if ($projectId) {
            $workersQuery->where('project_id', $projectId);
        }
        $totalWorkers = (int) (clone $workersQuery)->count();

        // Overall medical compliance rate should match Worker Management:
        // total workers vs workers having at least one "apte" medical aptitude (no exam_date filtering).
        $medicalAptWorkersCount = (int) WorkerMedicalAptitude::query()
            ->join('workers', 'workers.id', '=', 'worker_medical_aptitudes.worker_id')
            ->where(function ($q) {
                $q->where('worker_medical_aptitudes.aptitude_status', 'apte')
                    ->orWhereRaw('LOWER(worker_medical_aptitudes.aptitude_status) REGEXP ?', ['^apte$']);
            })
            ->when($projectIdsForPole !== null, function ($q) use ($projectIdsForPole) {
                if (count($projectIdsForPole) === 0) {
                    return $q->whereRaw('1 = 0');
                }
                return $q->whereIn('workers.project_id', $projectIdsForPole);
            })
            ->when($projectId, function ($q) use ($projectId) {
                return $q->where('workers.project_id', $projectId);
            })
            ->distinct()
            ->count('worker_medical_aptitudes.worker_id');

        $medicalComplianceRate = $totalWorkers > 0
            ? round(($medicalAptWorkersCount * 100.0) / $totalWorkers, 1)
            : 0.0;

        // Weekly medical trend must use the date of the medical visit (exam_date).
        $medicalYearStart = WeekHelper::getWeek1Start($year)->startOfDay();
        $medicalYearEnd = WeekHelper::getWeekDates(52, $year)['end']->endOfDay();
        if ($week && $week >= 1 && $week <= 52) {
            $dates = WeekHelper::getWeekDates((int) $week, $year);
            $medicalYearStart = $dates['start']->startOfDay();
            $medicalYearEnd = $dates['end']->endOfDay();
        }

        // Seed cumulative curve with all prior years' (and prior weeks') apte visits,
        // so Week 1 starts where the previous years left off.
        $medicalBaselineWorkerIds = WorkerMedicalAptitude::query()
            ->join('workers', 'workers.id', '=', 'worker_medical_aptitudes.worker_id')
            ->where('worker_medical_aptitudes.exam_date', '<', $medicalYearStart->toDateString())
            ->where(function ($q) {
                $q->where('worker_medical_aptitudes.aptitude_status', 'apte')
                    ->orWhereRaw('LOWER(worker_medical_aptitudes.aptitude_status) REGEXP ?', ['^apte$']);
            })
            ->when($projectIdsForPole !== null, function ($q) use ($projectIdsForPole) {
                if (count($projectIdsForPole) === 0) {
                    return $q->whereRaw('1 = 0');
                }
                return $q->whereIn('workers.project_id', $projectIdsForPole);
            })
            ->when($projectId, function ($q) use ($projectId) {
                return $q->where('workers.project_id', $projectId);
            })
            ->distinct()
            ->pluck('worker_medical_aptitudes.worker_id');

        $medicalAptitudesForTrend = WorkerMedicalAptitude::query()
            ->join('workers', 'workers.id', '=', 'worker_medical_aptitudes.worker_id')
            ->whereBetween('worker_medical_aptitudes.exam_date', [
                $medicalYearStart->toDateString(),
                $medicalYearEnd->toDateString(),
            ])
            ->where(function ($q) {
                $q->where('worker_medical_aptitudes.aptitude_status', 'apte')
                    ->orWhereRaw('LOWER(worker_medical_aptitudes.aptitude_status) REGEXP ?', ['^apte$']);
            })
            ->when($projectIdsForPole !== null, function ($q) use ($projectIdsForPole) {
                if (count($projectIdsForPole) === 0) {
                    return $q->whereRaw('1 = 0');
                }
                return $q->whereIn('workers.project_id', $projectIdsForPole);
            })
            ->when($projectId, function ($q) use ($projectId) {
                return $q->where('workers.project_id', $projectId);
            })
            ->get([
                'worker_medical_aptitudes.worker_id',
                'worker_medical_aptitudes.exam_date',
            ]);

        $medicalWorkersByWeek = array_fill(1, 52, []);
        foreach ($medicalAptitudesForTrend as $row) {
            $date = $row->exam_date instanceof Carbon
                ? $row->exam_date
                : Carbon::parse($row->exam_date);
            $info = WeekHelper::getWeekFromDate($date);
            if ((int) ($info['year'] ?? 0) !== (int) $year) {
                continue;
            }
            $w = (int) ($info['week'] ?? 0);
            if ($w < 1 || $w > 52) {
                continue;
            }
            $workerId = (int) $row->worker_id;
            $medicalWorkersByWeek[$w][$workerId] = true;
        }

        // Cumulative weekly compliance: cumulative % of workers with at least one "apte" visit
        // from week 1 up to week w (based on exam_date).
        $medicalComplianceByWeek = [];
        $cumulativeWorkers = [];
        foreach ($medicalBaselineWorkerIds as $workerId) {
            $cumulativeWorkers[(int) $workerId] = true;
        }
        for ($w = 1; $w <= 52; $w++) {
            foreach (($medicalWorkersByWeek[$w] ?? []) as $workerId => $_) {
                $cumulativeWorkers[$workerId] = true;
            }
            $count = count($cumulativeWorkers);
            $medicalComplianceByWeek[$w] = $totalWorkers > 0
                ? round(($count * 100.0) / $totalWorkers, 1)
                : 0.0;
        }

        $regulatoryWatchQuery = RegulatoryWatchSubmission::query()
            ->where('week_year', $year)
            ->whereNotNull('overall_score');
        if ($projectIdsForPole !== null) {
            if (count($projectIdsForPole) === 0) {
                $regulatoryWatchQuery->whereRaw('1 = 0');
            } else {
                $regulatoryWatchQuery->whereIn('project_id', $projectIdsForPole);
            }
        }
        if ($projectId) {
            $regulatoryWatchQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 53) {
            $regulatoryWatchQuery->where('week_number', $week);
        }

        $regulatoryWatchAvg = null;
        $rwValue = (clone $regulatoryWatchQuery)->avg('overall_score');
        $regulatoryWatchAvg = $rwValue !== null ? round((float) $rwValue, 2) : null;

        $regulatoryWatchByWeek = (clone $regulatoryWatchQuery)
            ->select('week_number', DB::raw('AVG(overall_score) as avg_overall_score'))
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get()
            ->map(function ($item) {
                return [
                    'week_number' => (int) $item->week_number,
                    'avg_overall_score' => round((float) $item->avg_overall_score, 1),
                ];
            });

        $regulatoryWatchScoreByWeek = [];
        foreach ($regulatoryWatchByWeek as $row) {
            $regulatoryWatchScoreByWeek[(int) $row['week_number']] = (float) $row['avg_overall_score'];
        }

        // Override the KPI-computed compliance fields with authoritative values.
        if ($kpiSummary) {
            $kpiSummary->avg_medical_compliance = $medicalComplianceRate;
            $kpiSummary->avg_hse_compliance = $regulatoryWatchAvg ?? 0;
            $kpiSummary->medical_total_workers = $totalWorkers;
            $kpiSummary->medical_apt_workers = $medicalAptWorkersCount;
        }

        $weeklyTrends = $weeklyTrends->map(function ($row) use ($medicalComplianceByWeek, $regulatoryWatchScoreByWeek) {
            $weekNumber = (int) ($row['week'] ?? 0);
            $row['medical_compliance'] = $medicalComplianceByWeek[$weekNumber] ?? 0;
            $row['hse_compliance'] = $regulatoryWatchScoreByWeek[$weekNumber] ?? 0;
            return $row;
        });

        // Project performance
        // Compute TF/TG per project using weighted sums (Fedris formulas), respecting the optional week filter.
        $projectKpiMetricsQuery = KpiReport::selectRaw('
                project_id,
                COUNT(*) as reports_count,
                SUM(accidents) as total_accidents,
                SUM(hours_worked) as total_hours,
                SUM(lost_workdays) as lost_workdays
            ')
            ->where('report_year', $year)
            ->approved();
        if ($projectIdsForPole !== null) {
            $projectKpiMetricsQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $projectKpiMetricsQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $projectKpiMetricsQuery->where('week_number', $week);
        }
        $projectKpiMetrics = $projectKpiMetricsQuery
            ->groupBy('project_id')
            ->get()
            ->keyBy('project_id');

        $projectTrainingCountsQuery = Training::query()->where('week_year', $year);
        if ($projectIdsForPole !== null) {
            $projectTrainingCountsQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $projectTrainingCountsQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $projectTrainingCountsQuery->where('week_number', $week);
        }
        $projectTrainingCounts = $projectTrainingCountsQuery
            ->select('project_id', DB::raw('COUNT(*) as total_trainings'))
            ->groupBy('project_id')
            ->get()
            ->keyBy('project_id');

        $projectPerformance = Project::active()
            ->visibleTo($user)
            ->when($pole !== null && $pole !== '', function ($q) use ($pole) {
                $q->where('pole', $pole);
            })
            ->when($projectId, function ($q) use ($projectId) {
                $q->where('id', $projectId);
            })
            ->get()
            ->map(function ($project) use ($projectKpiMetrics, $projectTrainingCounts) {
                $metrics = $projectKpiMetrics->get($project->id);
                $trainingCount = $projectTrainingCounts->get($project->id);
                $totalHours = $metrics ? (float) ($metrics->total_hours ?? 0) : 0;
                $totalAccidents = $metrics ? (int) ($metrics->total_accidents ?? 0) : 0;
                $lostWorkdays = $metrics ? (int) ($metrics->lost_workdays ?? 0) : 0;

                $tf = $totalHours > 0 ? ($totalAccidents * 1000000.0) / $totalHours : 0;
                $tg = $totalHours > 0 ? ($lostWorkdays * 1000.0) / $totalHours : 0;

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'code' => $project->code,
                    'reports_count' => $metrics ? (int) $metrics->reports_count : 0,
                    'total_accidents' => $totalAccidents,
                    'total_trainings' => $trainingCount ? (int) ($trainingCount->total_trainings ?? 0) : 0,
                    'avg_tf' => round($tf, 4),
                    'avg_tg' => round($tg, 4),
                ];
            });

        // Weekly submission status for all active projects
        $allProjectsForStatus = Project::active()
            ->visibleTo($user)
            ->when($pole !== null && $pole !== '', function ($q) use ($pole) {
                $q->where('pole', $pole);
            })
            ->select('id', 'name', 'code', 'pole', 'start_date')
            ->get();
        $weeklyStatus = $this->buildWeeklySubmissionStatus($allProjectsForStatus, (int) $year);

        // Recent activity (exclude draft reports for admin view)
        $recentReportsQuery = KpiReport::with(['project', 'submitter'])
            ->where('status', '!=', KpiReport::STATUS_DRAFT)
            ->latest();
        if ($projectIdsForPole !== null) {
            $recentReportsQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $recentReportsQuery->where('project_id', $projectId);
        }
        $recentReports = $recentReportsQuery->limit(10)->get();

        // ==========================================
        // REAL DATA FROM TRAININGS TABLE
        // ==========================================
        $trainingQuery = Training::where('week_year', $year);
        if ($projectIdsForPole !== null) {
            $trainingQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $trainingQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $trainingQuery->where('week_number', $week);
        }
        $trainingStats = (clone $trainingQuery)->get();
        
        // Training by duration (using valid dropdown keys)
        $trainingByDuration = (clone $trainingQuery)
            ->select('duration_label', DB::raw('COUNT(*) as count'), DB::raw('SUM(participants) as participants'))
            ->groupBy('duration_label')
            ->get()
            ->map(function ($item) {
                return [
                    'duration' => $item->duration_label,
                    'count' => $item->count,
                    'participants' => $item->participants ?? 0,
                ];
            });
        
        // Training by theme
        $trainingByTheme = (clone $trainingQuery)
            ->select('theme', DB::raw('COUNT(*) as count'), DB::raw('SUM(participants) as participants'))
            ->groupBy('theme')
            ->orderByDesc('count')
            ->limit(10)
            ->get();
        
        // Training by week
        $trainingByWeek = (clone $trainingQuery)
            ->select('week_number', DB::raw('COUNT(*) as count'), DB::raw('SUM(participants) as participants'), DB::raw('SUM(training_hours) as hours'))
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get();
        
        // Training by type (internal vs external)
        $trainingByType = (clone $trainingQuery)
            ->select('by_internal', DB::raw('COUNT(*) as count'))
            ->groupBy('by_internal')
            ->get()
            ->map(function ($item) {
                return [
                    'type' => $item->by_internal ? 'internal' : 'external',
                    'count' => $item->count,
                ];
            });

        // ==========================================
        // REAL DATA FROM AWARENESS SESSIONS TABLE
        // ==========================================
        $awarenessQuery = AwarenessSession::where('week_year', $year);
        if ($projectIdsForPole !== null) {
            $awarenessQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $awarenessQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $awarenessQuery->where('week_number', $week);
        }
        $awarenessStats = (clone $awarenessQuery)->get();
        
        // Awareness by theme
        $awarenessByTheme = (clone $awarenessQuery)
            ->select('theme', DB::raw('COUNT(*) as count'), DB::raw('SUM(participants) as participants'))
            ->groupBy('theme')
            ->orderByDesc('count')
            ->limit(10)
            ->get();
        
        // Awareness by week
        $awarenessByWeek = (clone $awarenessQuery)
            ->select('week_number', DB::raw('COUNT(*) as count'), DB::raw('SUM(participants) as participants'), DB::raw('SUM(session_hours) as hours'))
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get();
        
        // Awareness by duration
        $awarenessByDuration = (clone $awarenessQuery)
            ->select('duration_minutes', DB::raw('COUNT(*) as count'))
            ->groupBy('duration_minutes')
            ->get()
            ->map(function ($item) {
                $mins = $item->duration_minutes;
                $label = $mins >= 60 ? floor($mins / 60) . 'h' . ($mins % 60 > 0 ? ($mins % 60) . 'min' : '') : $mins . 'min';
                return [
                    'duration' => $label,
                    'minutes' => $mins,
                    'count' => $item->count,
                ];
            });

        // ==========================================
        // REAL DATA FROM SOR REPORTS TABLE (filtered)
        // ==========================================
        $week1Start = WeekHelper::getWeek1Start($year)->startOfDay();
        $yearEnd = $week1Start->copy()->addDays(52 * 7 - 1)->endOfDay();
        $sorQuery = SorReport::query()->whereBetween('observation_date', [$week1Start, $yearEnd]);
        if ($projectIdsForPole !== null) {
            $sorQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $sorQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $dates = WeekHelper::getWeekDates($week, $year);
            $start = $dates['start']->copy()->startOfDay();
            $end = $dates['end']->copy()->endOfDay();
            $sorQuery->whereBetween('observation_date', [$start, $end]);
        }

        $sorStats = [
            'total' => (clone $sorQuery)->count(),
            'open' => (clone $sorQuery)->where('status', SorReport::STATUS_OPEN)->count(),
            'in_progress' => (clone $sorQuery)->where('status', SorReport::STATUS_IN_PROGRESS)->count(),
            'closed' => (clone $sorQuery)->where('status', SorReport::STATUS_CLOSED)->count(),
        ];

        $sorByCategory = (clone $sorQuery)
            ->select('category', DB::raw('COUNT(*) as count'))
            ->groupBy('category')
            ->orderByDesc('count')
            ->get()
            ->map(function ($item) {
                return [
                    'category' => $item->category,
                    'label' => SorReport::CATEGORIES[$item->category] ?? $item->category,
                    'count' => $item->count,
                ];
            });

        $sorByStatus = (clone $sorQuery)
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->get();

        $sorByZone = (clone $sorQuery)
            ->select('zone', DB::raw('COUNT(*) as count'))
            ->whereNotNull('zone')
            ->groupBy('zone')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        // ==========================================
        // REAL DATA FROM WORK PERMITS TABLE (filtered)
        // ==========================================
        $permitQuery = WorkPermit::where('year', $year);
        if ($projectIdsForPole !== null) {
            $permitQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $permitQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $permitQuery->where('week_number', $week);
        }

        $permitStats = [
            'total' => (clone $permitQuery)->count(),
            'draft' => (clone $permitQuery)->where('status', WorkPermit::STATUS_DRAFT)->count(),
            'active' => (clone $permitQuery)->where('status', WorkPermit::STATUS_ACTIVE)->count(),
            'closed' => (clone $permitQuery)->where('status', WorkPermit::STATUS_CLOSED)->count(),
        ];

        $permitsByWeek = (clone $permitQuery)
            ->select('week_number', DB::raw('COUNT(*) as count'))
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get();

        $permitTypes = [
            'type_cold' => 'Cold Permit',
            'type_work_at_height' => 'Work at Height',
            'type_hot_work' => 'Hot Work',
            'type_confined_spaces' => 'Confined Spaces',
            'type_electrical_isolation' => 'Electrical Isolation',
            'type_energized_work' => 'Energized Work',
            'type_excavation' => 'Excavation',
            'type_mechanical_isolation' => 'Mechanical Isolation',
            'type_7inch_grinder' => '7 Inch Grinder',
        ];

        $permitsByType = [];
        foreach ($permitTypes as $field => $label) {
            $count = (clone $permitQuery)->where($field, true)->count();
            if ($count > 0) {
                $permitsByType[] = ['type' => $label, 'count' => $count];
            }
        }

        // ==========================================
        // REAL DATA FROM INSPECTIONS TABLE (filtered)
        // ==========================================
        $inspectionQuery = Inspection::where('week_year', $year);
        if ($projectIdsForPole !== null) {
            $inspectionQuery->whereIn('project_id', $projectIdsForPole);
        }
        if ($projectId) {
            $inspectionQuery->where('project_id', $projectId);
        }
        if ($week && $week >= 1 && $week <= 52) {
            $inspectionQuery->where('week_number', $week);
        }

        $inspectionStats = [
            'total' => (clone $inspectionQuery)->count(),
            'open' => (clone $inspectionQuery)->where('status', 'open')->count(),
            'closed' => (clone $inspectionQuery)->where('status', 'closed')->count(),
            'internal' => (clone $inspectionQuery)->where('type', 'internal')->count(),
            'external' => (clone $inspectionQuery)->where('type', 'external')->count(),
        ];

        $inspectionsByNature = (clone $inspectionQuery)
            ->select('nature', DB::raw('COUNT(*) as count'))
            ->groupBy('nature')
            ->get()
            ->map(function ($item) {
                $labels = [
                    'sst' => 'Inspection SST',
                    'environment' => 'Inspection Environnement',
                    'third_party' => 'Tierce Partie',
                    'equipment' => 'Matériel/Équipements',
                    'other' => 'Autres',
                ];
                return [
                    'nature' => $item->nature,
                    'label' => $labels[$item->nature] ?? $item->nature,
                    'count' => $item->count,
                ];
            });

        $inspectionsByWeek = (clone $inspectionQuery)
            ->select('week_number', DB::raw('COUNT(*) as count'))
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get();

        // (regulatory watch compliance is computed earlier from RegulatoryWatchSubmission)

        return $this->success([
            'projects' => $allProjectsForStatus,
            'stats' => $stats,
            'kpi_summary' => $kpiSummary,
            'weekly_trends' => $weeklyTrends,
            'project_performance' => $projectPerformance,
            'weekly_status' => $weeklyStatus,
            'recent_reports' => $recentReports,
            // Real training data
            'training_data' => [
                'total' => $trainingStats->count(),
                'total_participants' => $trainingStats->sum('participants'),
                'total_hours' => $trainingStats->sum('training_hours'),
                'by_duration' => $trainingByDuration,
                'by_theme' => $trainingByTheme,
                'by_week' => $trainingByWeek,
                'by_type' => $trainingByType,
            ],
            // Real awareness data
            'awareness_data' => [
                'total' => $awarenessStats->count(),
                'total_participants' => $awarenessStats->sum('participants'),
                'total_hours' => $awarenessStats->sum('session_hours'),
                'by_theme' => $awarenessByTheme,
                'by_week' => $awarenessByWeek,
                'by_duration' => $awarenessByDuration,
            ],
            // Real SOR data
            'sor_data' => [
                'stats' => $sorStats,
                'by_category' => $sorByCategory,
                'by_status' => $sorByStatus,
                'by_zone' => $sorByZone,
            ],
            // Real work permit data
            'permit_data' => [
                'stats' => $permitStats,
                'by_week' => $permitsByWeek,
                'by_type' => $permitsByType,
            ],
            // Real inspection data
            'inspection_data' => [
                'stats' => $inspectionStats,
                'by_nature' => $inspectionsByNature,
                'by_week' => $inspectionsByWeek,
            ],
            'regulatory_watch' => [
                'avg_overall_score' => $regulatoryWatchAvg,
                'by_week' => $regulatoryWatchByWeek,
            ],
        ]);
    }

    /**
     * Get user dashboard data
     */
    public function userDashboard(Request $request)
    {
        $user = $request->user();
        $year = (int) $request->get('year', date('Y'));
        $projectId = $request->get('project_id');
        $pole = $request->get('pole');
        $week = $request->get('week');
        $week = $week !== null ? (int) $week : null;

        $scope = $request->get('scope');
        $projectsQuery = ($user && $user->isDev() && $scope !== 'assigned')
            ? Project::query()->with(['kpiReports' => function ($q) use ($year) {
                $q->where('report_year', $year);
            }])
            : Project::query()->visibleTo($user)->with(['kpiReports' => function ($q) use ($year) {
                $q->where('report_year', $year);
            }]);

        if ($pole !== null && $pole !== '') {
            $projectsQuery->where('pole', $pole);
        }
        $projects = $projectsQuery->get();
        $projectIds = $projects->pluck('id');

        $effectiveProjectIds = $projectIds;
        if ($projectId) {
            $effectiveProjectIds = $projectIds->filter(function ($id) use ($projectId) {
                return (string) $id === (string) $projectId;
            })->values();
        }

        $activeMachinesQuery = Machine::query()
            ->whereNotNull('project_id')
            ->where('is_active', true);
        if ($effectiveProjectIds !== null) {
            if (count($effectiveProjectIds) === 0) {
                $activeMachinesQuery->whereRaw('1 = 0');
            } else {
                $activeMachinesQuery->whereIn('project_id', $effectiveProjectIds);
            }
        }

        // User statistics
        $stats = [
            'assigned_projects' => $projects->count(),
            'reports_submitted' => KpiReport::where('submitted_by', $user->id)
                ->where('report_year', $year)
                ->count(),
            'pending_approval' => KpiReport::whereIn('project_id', $projectIds)
                ->where('status', 'submitted')
                ->count(),
            'draft_reports' => KpiReport::where('submitted_by', $user->id)
                ->where('status', 'draft')
                ->count(),
            'active_machines' => (clone $activeMachinesQuery)->count(),
        ];

        $kpiSummaryQuery = KpiReport::whereIn('project_id', $effectiveProjectIds)
            ->where('report_year', $year)
            ->approved();
        if ($week && $week >= 1 && $week <= 52) {
            $kpiSummaryQuery->where('week_number', $week);
        }

        // KPI Summary for user's projects
        $kpiSummary = (clone $kpiSummaryQuery)
            ->selectRaw('
                SUM(accidents) as total_accidents,
                SUM(trainings_conducted) as total_trainings,
                SUM(inspections_completed) as total_inspections,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(accidents) * 1000000.0) / SUM(hours_worked) ELSE 0 END as avg_tf,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(lost_workdays) * 1000.0) / SUM(hours_worked) ELSE 0 END as avg_tg
            ')
            ->first();

        // Real training data for user's projects
        $trainingQuery = Training::where('week_year', $year)->whereIn('project_id', $effectiveProjectIds);
        if ($week && $week >= 1 && $week <= 52) {
            $trainingQuery->where('week_number', $week);
        }
        $trainingStats = (clone $trainingQuery)->get();

        // Real inspection data for user's projects
        $inspectionQuery = Inspection::where('week_year', $year)->whereIn('project_id', $effectiveProjectIds);
        if ($week && $week >= 1 && $week <= 52) {
            $inspectionQuery->where('week_number', $week);
        }
        $inspectionStats = [
            'total' => (clone $inspectionQuery)->count(),
            'open' => (clone $inspectionQuery)->where('status', 'open')->count(),
            'closed' => (clone $inspectionQuery)->where('status', 'closed')->count(),
            'internal' => (clone $inspectionQuery)->where('type', 'internal')->count(),
            'external' => (clone $inspectionQuery)->where('type', 'external')->count(),
        ];

        // Weekly submission status (52 weeks) with per-project details,
        // respecting each project's start week
        $weeklyStatus = $this->buildWeeklySubmissionStatus($projects, (int) $year);

        // Recent reports by user
        $recentReports = KpiReport::where('submitted_by', $user->id)
            ->with('project')
            ->latest()
            ->limit(10)
            ->get();

        return $this->success([
            'projects' => $projects,
            'stats' => $stats,
            'kpi_summary' => $kpiSummary,
            'weekly_status' => $weeklyStatus,
            'recent_reports' => $recentReports,
            'training_data' => [
                'total' => $trainingStats->count(),
                'total_participants' => $trainingStats->sum('participants'),
                'total_hours' => $trainingStats->sum('training_hours'),
            ],
            'inspection_data' => [
                'stats' => $inspectionStats,
            ],
        ]);
    }

    /**
     * Build weekly submission status for a set of projects, using project start dates
     * to hide weeks before a project actually started.
     */
    private function buildWeeklySubmissionStatus($projects, int $year)
    {
        if (!$projects || $projects->isEmpty()) {
            return [];
        }

        $projectIds = $projects->pluck('id');

        $reports = KpiReport::query()
            ->whereIn('project_id', $projectIds)
            ->where('report_year', $year)
            ->whereNotNull('week_number')
            ->whereBetween('week_number', [1, 52])
            ->get(['id', 'project_id', 'week_number', 'status']);

        $reportsByWeekAndProject = [];
        foreach ($reports as $report) {
            $w = (int) $report->week_number;
            $p = (int) $report->project_id;
            if (!isset($reportsByWeekAndProject[$w][$p]) || (int) $report->id > (int) $reportsByWeekAndProject[$w][$p]->id) {
                $reportsByWeekAndProject[$w][$p] = $report;
            }
        }

        // Pre-compute start week/year for each project
        $projectStartWeeks = [];
        foreach ($projects as $project) {
            if ($project->start_date) {
                $info = WeekHelper::getWeekFromDate($project->start_date);
                $projectStartWeeks[$project->id] = $info;
            }
        }

        $weeklyStatus = [];

        for ($w = 1; $w <= 52; $w++) {
            $projectDetails = [];

            foreach ($projects as $project) {
                $startInfo = $projectStartWeeks[$project->id] ?? null;
                if ($startInfo) {
                    $startYear = (int) ($startInfo['year'] ?? $year);
                    $startWeek = (int) ($startInfo['week'] ?? 1);

                    // Skip weeks before the project actually started
                    if ($year < $startYear || ($year === $startYear && $w < $startWeek)) {
                        continue;
                    }
                }

                $report = $reportsByWeekAndProject[$w][(int) $project->id] ?? null;
                $status = $report ? $report->status : 'not_submitted';

                $projectDetails[] = [
                    'project_id' => $project->id,
                    'project_name' => $project->name,
                    'project_code' => $project->code,
                    'status' => $status,
                    'report_id' => $report?->id,
                ];
            }

            $statuses = collect($projectDetails)->pluck('status');
            $approvedCount = $statuses->filter(fn ($s) => $s === KpiReport::STATUS_APPROVED)->count();
            $submittedCount = $statuses->filter(fn ($s) => $s === KpiReport::STATUS_SUBMITTED)->count();
            $draftCount = $statuses->filter(fn ($s) => $s === KpiReport::STATUS_DRAFT)->count();
            $totalProjects = count($projectDetails);

            // Combined status logic (priority: approved > partial > submitted > draft > not_submitted)
            $combinedStatus = 'not_submitted';
            if ($totalProjects > 0) {
                if ($approvedCount === $totalProjects) {
                    $combinedStatus = 'approved';
                } elseif ($approvedCount > 0 || $submittedCount > 0) {
                    $combinedStatus = 'partial';
                } elseif ($submittedCount > 0) {
                    $combinedStatus = 'submitted';
                } elseif ($draftCount > 0) {
                    $combinedStatus = 'draft';
                }
            }

            $weeklyStatus[] = [
                'week' => $w,
                'status' => $combinedStatus,
                'approved_count' => $approvedCount,
                'submitted_count' => $submittedCount,
                'draft_count' => $draftCount,
                'total_projects' => $totalProjects,
                'projects' => $projectDetails,
            ];
        }

        return $weeklyStatus;
    }

    /**
     * Get chart data for accidents
     */
    public function accidentCharts(Request $request)
    {
        $user = $request->user();
        $year = $request->get('year', date('Y'));
        
        $query = KpiReport::where('report_year', $year)->approved();
        
        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }

        // By month
        $byMonth = (clone $query)
            ->selectRaw('report_month, SUM(accidents) as total, SUM(accidents_fatal) as fatal, SUM(accidents_serious) as serious, SUM(accidents_minor) as minor')
            ->groupBy('report_month')
            ->orderBy('report_month')
            ->get();

        // By severity
        $bySeverity = (clone $query)
            ->selectRaw('SUM(accidents_fatal) as fatal, SUM(accidents_serious) as serious, SUM(accidents_minor) as minor, SUM(near_misses) as near_misses, SUM(first_aid_cases) as first_aid')
            ->first();

        return $this->success([
            'by_month' => $byMonth,
            'by_severity' => $bySeverity,
        ]);
    }

    /**
     * Get chart data for trainings
     */
    public function trainingCharts(Request $request)
    {
        $user = $request->user();
        $year = $request->get('year', date('Y'));
        
        $query = KpiReport::where('report_year', $year)->approved();
        
        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }

        // By month
        $byMonth = (clone $query)
            ->selectRaw('report_month, SUM(trainings_conducted) as conducted, SUM(trainings_planned) as planned, SUM(employees_trained) as employees, SUM(training_hours) as hours')
            ->groupBy('report_month')
            ->orderBy('report_month')
            ->get();

        return $this->success(['by_month' => $byMonth]);
    }

    /**
     * Get chart data for SOR (deviation tracking)
     */
    public function sorCharts(Request $request)
    {
        $user = $request->user();
        $year = (int) $request->get('year', date('Y'));

        $week1Start = WeekHelper::getWeek1Start($year)->startOfDay();
        $yearEnd = $week1Start->copy()->addDays(52 * 7 - 1)->endOfDay();

        $query = SorReport::query()->whereBetween('observation_date', [$week1Start, $yearEnd]);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }

        if ($week = $request->get('week')) {
            $week = (int) $week;
            if ($week >= 1 && $week <= 52) {
                $dates = WeekHelper::getWeekDates($week, $year);
                $start = $dates['start']->copy()->startOfDay();
                $end = $dates['end']->copy()->endOfDay();
                $query->whereBetween('observation_date', [$start, $end]);
            }
        }

        $now = now()->startOfDay();

        $stats = [
            'total' => (clone $query)->count(),
            'open' => (clone $query)->where('status', SorReport::STATUS_OPEN)->count(),
            'in_progress' => (clone $query)->where('status', SorReport::STATUS_IN_PROGRESS)->count(),
            'closed' => (clone $query)->where('status', SorReport::STATUS_CLOSED)->count(),
            'overdue' => (clone $query)
                ->where('status', '!=', SorReport::STATUS_CLOSED)
                ->whereNotNull('deadline')
                ->whereDate('deadline', '<', $now)
                ->count(),
        ];

        $byCategory = (clone $query)
            ->select('category', DB::raw('COUNT(*) as count'))
            ->groupBy('category')
            ->orderByDesc('count')
            ->get()
            ->map(function ($item) {
                return [
                    'category' => $item->category,
                    'label' => SorReport::CATEGORIES[$item->category] ?? $item->category,
                    'count' => (int) $item->count,
                ];
            });

        $byStatus = (clone $query)
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->get()
            ->map(function ($item) {
                return [
                    'status' => $item->status,
                    'count' => (int) $item->count,
                ];
            });

        $closedTimes = (clone $query)
            ->where('status', SorReport::STATUS_CLOSED)
            ->get(['observation_date', 'observation_time', 'closed_at', 'corrective_action_date', 'corrective_action_time']);

        $avgCloseDays = null;
        if ($closedTimes->count() > 0) {
            $values = $closedTimes->map(function ($r) {
                try {
                    if (empty($r->observation_date)) {
                        return null;
                    }

                    $obsTime = $r->observation_time ?: '00:00:00';
                    $obsTime = trim((string) $obsTime);
                    if ($obsTime !== '' && preg_match('/^\d{1,2}:\d{2}$/', $obsTime)) {
                        $obsTime .= ':00';
                    }
                    $obsDate = $r->observation_date instanceof Carbon
                        ? $r->observation_date->toDateString()
                        : (string) $r->observation_date;

                    $obs = Carbon::parse($obsDate . ' ' . $obsTime);

                    // Prefer the real closure moment from corrective_action_date/time when present.
                    // closed_at is often set to "now" when status is closed, including during bulk import.
                    $closure = null;
                    if (!empty($r->corrective_action_date)) {
                        $closeDate = $r->corrective_action_date instanceof Carbon
                            ? $r->corrective_action_date->toDateString()
                            : (string) $r->corrective_action_date;

                        $closeTime = $r->corrective_action_time ?: '00:00:00';
                        $closeTime = trim((string) $closeTime);
                        if ($closeTime !== '' && preg_match('/^\d{1,2}:\d{2}$/', $closeTime)) {
                            $closeTime .= ':00';
                        }

                        $closure = Carbon::parse($closeDate . ' ' . ($closeTime !== '' ? $closeTime : '00:00:00'));
                    } elseif (!empty($r->closed_at)) {
                        $closure = Carbon::parse($r->closed_at);
                    }

                    if (!$closure) {
                        return null;
                    }

                    $minutes = $obs->diffInMinutes($closure, false);
                    if ($minutes < 0) {
                        return null;
                    }
                    return $minutes / 1440;
                } catch (\Throwable $e) {
                    return null;
                }
            })->filter(function ($v) {
                return $v !== null;
            });

            if ($values->count() > 0) {
                $avgCloseDays = (float) $values->avg();
            }
        }

        $weeklyCounts = array_fill(1, 52, 0);
        $trendRows = (clone $query)->get(['observation_date']);
        foreach ($trendRows as $row) {
            if (!$row->observation_date) {
                continue;
            }
            try {
                $info = WeekHelper::getWeekFromDate(Carbon::parse($row->observation_date));
            } catch (\Throwable $e) {
                continue;
            }
            if ((int) ($info['year'] ?? 0) !== $year) {
                continue;
            }
            $w = (int) ($info['week'] ?? 0);
            if ($w >= 1 && $w <= 52) {
                $weeklyCounts[$w] = ($weeklyCounts[$w] ?? 0) + 1;
            }
        }

        $byWeek = [];
        for ($w = 1; $w <= 52; $w++) {
            $byWeek[] = [
                'week' => $w,
                'week_label' => 'S' . $w,
                'count' => (int) ($weeklyCounts[$w] ?? 0),
            ];
        }

        return $this->success([
            'stats' => $stats,
            'by_category' => $byCategory,
            'by_status' => $byStatus,
            'avg_close_days' => $avgCloseDays !== null ? round($avgCloseDays, 2) : null,
            'by_week' => $byWeek,
        ]);
    }

    /**
     * Get chart data for inspections
     */
    public function inspectionCharts(Request $request)
    {
        $user = $request->user();
        $year = $request->get('year', date('Y'));
        
        $query = KpiReport::where('report_year', $year)->approved();
        
        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }

        // By month
        $byMonth = (clone $query)
            ->selectRaw('report_month, SUM(inspections_completed) as completed, SUM(inspections_planned) as planned, SUM(findings_open) as open, SUM(findings_closed) as closed')
            ->groupBy('report_month')
            ->orderBy('report_month')
            ->get();

        return $this->success(['by_month' => $byMonth]);
    }

    /**
     * Get TF/TG rate trends
     */
    public function rateCharts(Request $request)
    {
        $user = $request->user();
        $year = $request->get('year', date('Y'));
        
        $query = KpiReport::where('report_year', $year)->approved();
        
        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }

        // By month
        $byMonth = $query
            ->selectRaw('
                report_month,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(accidents) * 1000000.0) / SUM(hours_worked) ELSE 0 END as tf,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(lost_workdays) * 1000.0) / SUM(hours_worked) ELSE 0 END as tg,
                SUM(hours_worked) as hours,
                SUM(lost_workdays) as lost_days
            ')
            ->groupBy('report_month')
            ->orderBy('report_month')
            ->get();

        return $this->success(['by_month' => $byMonth]);
    }
}
