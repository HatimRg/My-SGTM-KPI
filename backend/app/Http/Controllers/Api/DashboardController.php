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
use App\Helpers\WeekHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Get public stats for login page (no auth required)
     */
    public function publicStats()
    {
        $year = date('Y');
        
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
        
        return $this->success([
            'hse_compliance' => round($hseCompliance, 1),
            'training_hours' => (int) $trainingHours,
            'fatal_accidents' => (int) $fatalAccidents,
            'year' => $year,
        ]);
    }

    /**
     * Get admin dashboard data
     */
    public function adminDashboard(Request $request)
    {
        $year = $request->get('year', date('Y'));

        // Overall statistics
        $stats = [
            'total_projects' => Project::count(),
            'active_projects' => Project::active()->count(),
            'total_users' => User::count(),
            'active_users' => User::active()->count(),
            'pending_reports' => KpiReport::submitted()->count(),
            'total_reports' => KpiReport::where('report_year', $year)->count(),
        ];

        // KPI Summary for the year (including environmental data)
        $kpiSummary = KpiReport::where('report_year', $year)
            ->approved()
            ->selectRaw('
                SUM(accidents) as total_accidents,
                SUM(accidents_fatal) as fatal_accidents,
                SUM(trainings_conducted) as total_trainings,
                SUM(employees_trained) as employees_trained,
                SUM(inspections_completed) as total_inspections,
                SUM(hours_worked) as total_hours,
                SUM(lost_workdays) as lost_workdays,
                SUM(training_hours) as total_training_hours,
                SUM(near_misses) as total_near_misses,
                SUM(work_permits) as total_work_permits,
                AVG(tf_value) as avg_tf,
                AVG(tg_value) as avg_tg,
                AVG(hse_compliance_rate) as avg_hse_compliance,
                AVG(medical_compliance_rate) as avg_medical_compliance,
                SUM(water_consumption) as total_water_consumption,
                SUM(electricity_consumption) as total_electricity_consumption,
                AVG(noise_monitoring) as avg_noise
            ')
            ->first();

        // Weekly trends (week-based data) - including environmental
        $weeklyTrends = KpiReport::where('report_year', $year)
            ->approved()
            ->whereNotNull('week_number')
            ->selectRaw('
                week_number,
                SUM(accidents) as accidents,
                SUM(trainings_conducted) as trainings,
                SUM(training_hours) as training_hours,
                SUM(inspections_completed) as inspections,
                SUM(near_misses) as near_misses,
                SUM(work_permits) as work_permits,
                AVG(tf_value) as tf,
                AVG(tg_value) as tg,
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
                    'trainings' => (int) $item->trainings,
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
        $projectPerformance = Project::active()
            ->withCount(['kpiReports' => function ($q) use ($year) {
                $q->where('report_year', $year)->approved();
            }])
            ->with(['kpiReports' => function ($q) use ($year) {
                $q->where('report_year', $year)->approved();
            }])
            ->get()
            ->map(function ($project) {
                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'code' => $project->code,
                    'reports_count' => $project->kpi_reports_count,
                    'total_accidents' => $project->kpiReports->sum('accidents'),
                    'total_trainings' => $project->kpiReports->sum('trainings_conducted'),
                    'avg_tf' => round($project->kpiReports->avg('tf_value'), 4),
                    'avg_tg' => round($project->kpiReports->avg('tg_value'), 4),
                ];
            });

        // Weekly submission status for all active projects
        $allProjectsForStatus = Project::active()->select('id', 'name', 'code', 'start_date')->get();
        $weeklyStatus = $this->buildWeeklySubmissionStatus($allProjectsForStatus, (int) $year);

        // Recent activity (exclude draft reports for admin view)
        $recentReports = KpiReport::with(['project', 'submitter'])
            ->where('status', '!=', KpiReport::STATUS_DRAFT)
            ->latest()
            ->limit(10)
            ->get();

        // ==========================================
        // REAL DATA FROM TRAININGS TABLE
        // ==========================================
        $trainingStats = Training::where('week_year', $year)->get();
        
        // Training by duration (using valid dropdown keys)
        $trainingByDuration = Training::where('week_year', $year)
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
        $trainingByTheme = Training::where('week_year', $year)
            ->select('theme', DB::raw('COUNT(*) as count'), DB::raw('SUM(participants) as participants'))
            ->groupBy('theme')
            ->orderByDesc('count')
            ->limit(10)
            ->get();
        
        // Training by week
        $trainingByWeek = Training::where('week_year', $year)
            ->select('week_number', DB::raw('COUNT(*) as count'), DB::raw('SUM(participants) as participants'), DB::raw('SUM(training_hours) as hours'))
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get();
        
        // Training by type (internal vs external)
        $trainingByType = Training::where('week_year', $year)
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
        $awarenessStats = AwarenessSession::where('week_year', $year)->get();
        
        // Awareness by theme
        $awarenessByTheme = AwarenessSession::where('week_year', $year)
            ->select('theme', DB::raw('COUNT(*) as count'), DB::raw('SUM(participants) as participants'))
            ->groupBy('theme')
            ->orderByDesc('count')
            ->limit(10)
            ->get();
        
        // Awareness by week
        $awarenessByWeek = AwarenessSession::where('week_year', $year)
            ->select('week_number', DB::raw('COUNT(*) as count'), DB::raw('SUM(participants) as participants'), DB::raw('SUM(session_hours) as hours'))
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get();
        
        // Awareness by duration
        $awarenessByDuration = AwarenessSession::where('week_year', $year)
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
        // REAL DATA FROM SOR REPORTS TABLE
        // ==========================================
        $sorStats = [
            'total' => SorReport::count(),
            'open' => SorReport::where('status', SorReport::STATUS_OPEN)->count(),
            'in_progress' => SorReport::where('status', SorReport::STATUS_IN_PROGRESS)->count(),
            'closed' => SorReport::where('status', SorReport::STATUS_CLOSED)->count(),
        ];
        
        // SOR by category
        $sorByCategory = SorReport::select('category', DB::raw('COUNT(*) as count'))
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
        
        // SOR by status
        $sorByStatus = SorReport::select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->get();
        
        // SOR by zone
        $sorByZone = SorReport::select('zone', DB::raw('COUNT(*) as count'))
            ->whereNotNull('zone')
            ->groupBy('zone')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        // ==========================================
        // REAL DATA FROM WORK PERMITS TABLE
        // ==========================================
        $permitStats = [
            'total' => WorkPermit::where('year', $year)->count(),
            'draft' => WorkPermit::where('year', $year)->where('status', WorkPermit::STATUS_DRAFT)->count(),
            'active' => WorkPermit::where('year', $year)->where('status', WorkPermit::STATUS_ACTIVE)->count(),
            'closed' => WorkPermit::where('year', $year)->where('status', WorkPermit::STATUS_CLOSED)->count(),
        ];
        
        // Permits by week
        $permitsByWeek = WorkPermit::where('year', $year)
            ->select('week_number', DB::raw('COUNT(*) as count'))
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get();
        
        // Permits by type
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
            $count = WorkPermit::where('year', $year)->where($field, true)->count();
            if ($count > 0) {
                $permitsByType[] = ['type' => $label, 'count' => $count];
            }
        }

        // ==========================================
        // REAL DATA FROM INSPECTIONS TABLE
        // ==========================================
        $inspectionStats = [
            'total' => Inspection::where('week_year', $year)->count(),
            'open' => Inspection::where('week_year', $year)->where('status', 'open')->count(),
            'closed' => Inspection::where('week_year', $year)->where('status', 'closed')->count(),
            'internal' => Inspection::where('week_year', $year)->where('type', 'internal')->count(),
            'external' => Inspection::where('week_year', $year)->where('type', 'external')->count(),
        ];
        
        // Inspections by nature
        $inspectionsByNature = Inspection::where('week_year', $year)
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
        
        // Inspections by week
        $inspectionsByWeek = Inspection::where('week_year', $year)
            ->select('week_number', DB::raw('COUNT(*) as count'))
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get();

        return $this->success([
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
        ]);
    }

    /**
     * Get user dashboard data
     */
    public function userDashboard(Request $request)
    {
        $user = $request->user();
        $year = $request->get('year', date('Y'));
        $projectIds = $user->projects->pluck('id');

        // User's projects
        $projects = $user->projects()->with(['kpiReports' => function ($q) use ($year) {
            $q->where('report_year', $year);
        }])->get();

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
        ];

        // KPI Summary for user's projects
        $kpiSummary = KpiReport::whereIn('project_id', $projectIds)
            ->where('report_year', $year)
            ->approved()
            ->selectRaw('
                SUM(accidents) as total_accidents,
                SUM(trainings_conducted) as total_trainings,
                SUM(inspections_completed) as total_inspections,
                AVG(tf_value) as avg_tf,
                AVG(tg_value) as avg_tg
            ')
            ->first();

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
            $weekReports = KpiReport::whereIn('project_id', $projectIds)
                ->where('week_number', $w)
                ->where('report_year', $year)
                ->get();

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

                $report = $weekReports->firstWhere('project_id', $project->id);
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
        
        if (!$user->isAdmin()) {
            $projectIds = $user->projects->pluck('id');
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
        
        if (!$user->isAdmin()) {
            $projectIds = $user->projects->pluck('id');
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
     * Get chart data for inspections
     */
    public function inspectionCharts(Request $request)
    {
        $user = $request->user();
        $year = $request->get('year', date('Y'));
        
        $query = KpiReport::where('report_year', $year)->approved();
        
        if (!$user->isAdmin()) {
            $projectIds = $user->projects->pluck('id');
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
        
        if (!$user->isAdmin()) {
            $projectIds = $user->projects->pluck('id');
            $query->whereIn('project_id', $projectIds);
        }

        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }

        // By month
        $byMonth = $query
            ->selectRaw('report_month, AVG(tf_value) as tf, AVG(tg_value) as tg, SUM(hours_worked) as hours, SUM(lost_workdays) as lost_days')
            ->groupBy('report_month')
            ->orderBy('report_month')
            ->get();

        return $this->success(['by_month' => $byMonth]);
    }
}
