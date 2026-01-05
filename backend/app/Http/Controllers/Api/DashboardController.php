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
use App\Models\RegulatoryWatchSubmission;
use App\Helpers\WeekHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * Get public stats for login page (no auth required)
     * Cached for 5 minutes to reduce database load
     */
    public function publicStats()
    {
        $year = date('Y');
        
        return $this->success(Cache::remember('public_stats_' . $year, 300, function () use ($year) {
            // HSE Compliance from KPI reports
            $hseCompliance = KpiReport::where('report_year', $year)
                ->approved()
                ->avg('hse_compliance_rate') ?? 0;
            
            // Total training hours from Training table
            $trainingHours = Training::where('week_year', $year)->sum('training_hours') ?? 0;
            
            // Fatal accidents this year from KPI reports
            $fatalAccidents = KpiReport::where('report_year', $year)
                ->approved()
                ->sum('accidents_fatal') ?? 0;
            
            return [
                'hse_compliance' => round($hseCompliance, 1),
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
                (SUM(hours_worked) * 10.0) as total_hours,
                SUM(lost_workdays) as lost_workdays,
                SUM(training_hours) as total_training_hours,
                SUM(near_misses) as total_near_misses,
                SUM(work_permits) as total_work_permits,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(accidents) * 1000000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as avg_tf,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(lost_workdays) * 1000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as avg_tg,
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
                (SUM(hours_worked) * 10.0) as hours_worked,
                SUM(lost_workdays) as lost_workdays,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(accidents) * 1000000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as tf,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(lost_workdays) * 1000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as tg,
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

        // Project performance
        // Compute TF/TG per project using weighted sums (Fedris formulas), respecting the optional week filter.
        $projectKpiMetricsQuery = KpiReport::selectRaw('
                project_id,
                COUNT(*) as reports_count,
                SUM(accidents) as total_accidents,
                (SUM(hours_worked) * 10.0) as total_hours,
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

        $regulatoryWatchAvg = null;
        if ($projectIdsForPole !== null && count($projectIdsForPole) === 0) {
            $regulatoryWatchAvg = null;
        } else {
            $regulatoryWatchQuery = RegulatoryWatchSubmission::query()->where('week_year', $year);
            if ($projectIdsForPole !== null) {
                $regulatoryWatchQuery->whereIn('project_id', $projectIdsForPole);
            }
            if ($projectId) {
                $regulatoryWatchQuery->where('project_id', $projectId);
            }
            if ($week && $week >= 1 && $week <= 53) {
                $regulatoryWatchQuery->where('week_number', $week);
            }
            $value = (clone $regulatoryWatchQuery)->whereNotNull('overall_score')->avg('overall_score');
            $regulatoryWatchAvg = $value !== null ? round((float) $value, 2) : null;
        }

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
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(accidents) * 1000000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as avg_tf,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(lost_workdays) * 1000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as avg_tg
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
            ->whereNotNull('closed_at')
            ->get(['observation_date', 'observation_time', 'closed_at']);

        $avgCloseDays = null;
        if ($closedTimes->count() > 0) {
            $values = $closedTimes->map(function ($r) {
                try {
                    if (empty($r->observation_date) || empty($r->closed_at)) {
                        return null;
                    }

                    $obsTime = $r->observation_time ?: '00:00:00';
                    $obsDate = $r->observation_date instanceof Carbon
                        ? $r->observation_date->toDateString()
                        : (string) $r->observation_date;

                    $obs = Carbon::parse($obsDate . ' ' . $obsTime);
                    $closed = Carbon::parse($r->closed_at);
                    $minutes = $obs->diffInMinutes($closed, false);
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
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(accidents) * 1000000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as tf,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(lost_workdays) * 1000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as tg,
                (SUM(hours_worked) * 10.0) as hours,
                SUM(lost_workdays) as lost_days
            ')
            ->groupBy('report_month')
            ->orderBy('report_month')
            ->get();

        return $this->success(['by_month' => $byMonth]);
    }
}
