<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KpiReport;
use App\Models\Project;
use App\Models\User;
use App\Exports\KpiReportsExport;
use App\Exports\AdminReportExport;
use App\Exports\HseWeeklyExport;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class ExportController extends Controller
{
    /**
     * Export KPI reports to Excel (Multi-sheet format)
     */
    public function exportToExcel(Request $request)
    {
        $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'year' => 'nullable|integer',
        ]);

        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        $year = $request->get('year', date('Y'));

        // Access control - only true admins/dev get multi-sheet export
        // (AdminReportExport includes wide-scope sheets and is not project-scoped).
        if (!$user->isAdmin()) {
            // For scoped users (including directors), use simple export scoped to visible projects
            $projectIds = $user->visibleProjectIds();
            $query = KpiReport::query()
                ->with(['project', 'submitter'])
                ->where('report_year', $year)
                ->approved()
                ->orderBy('week_number', 'desc');

            if ($projectIds !== null) {
                if (count($projectIds) === 0) {
                    $reports = collect();
                    $filename = 'kpi_reports_' . $year . '_' . date('Y-m-d_His') . '.xlsx';
                    return Excel::download(new KpiReportsExport($reports), $filename);
                }
                $query->whereIn('project_id', $projectIds);
            }

            if ($request->filled('project_id')) {
                $project = Project::findOrFail((int) $request->get('project_id'));
                if (!$user->canAccessProject($project)) {
                    return $this->error('Access denied', 403);
                }
                $query->where('project_id', $project->id);
            }

            $reports = $query->get();
            $filename = 'kpi_reports_' . $year . '_' . date('Y-m-d_His') . '.xlsx';
            return Excel::download(new KpiReportsExport($reports), $filename);
        }

        // Admin multi-sheet export
        $filters = [
            'project_id' => $request->get('project_id'),
        ];

        $filename = 'hse_kpi_report_' . $year . '_' . date('Y-m-d_His') . '.xlsx';

        return Excel::download(new AdminReportExport($year, $filters), $filename);
    }

    /**
     * Export KPI reports to PDF (Beautiful comprehensive report)
     */
    public function exportToPdf(Request $request)
    {
        $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'year' => 'nullable|integer',
        ]);

        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        $year = $request->get('year', date('Y'));
        $project = null;

        $query = KpiReport::query()->with(['project', 'submitter']);

        // Access control
        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            if (count($projectIds) === 0) {
                return $this->error('Access denied', 403);
            }
            $query->whereIn('project_id', $projectIds);
        }

        // Apply filters
        if ($projectId = $request->get('project_id')) {
            $project = Project::findOrFail((int) $projectId);
            if (!$user->canAccessProject($project)) {
                return $this->error('Access denied', 403);
            }
            $query->where('project_id', $project->id);
        }
        
        $query->where('report_year', $year);

        $reports = $query->approved()->orderBy('week_number')->get();

        // Calculate comprehensive summary
        $summary = [
            'total_reports' => $reports->count(),
            'weeks_reported' => $reports->pluck('week_number')->unique()->count(),
            // Safety
            'total_accidents' => $reports->sum('accidents'),
            'fatal_accidents' => $reports->sum('accidents_fatal'),
            'serious_accidents' => $reports->sum('accidents_serious'),
            'minor_accidents' => $reports->sum('accidents_minor'),
            'near_misses' => $reports->sum('near_misses'),
            'first_aid' => $reports->sum('first_aid_cases'),
            'lost_workdays' => $reports->sum('lost_workdays'),
            // Training
            'total_trainings' => $reports->sum('trainings_conducted'),
            'trainings_planned' => $reports->sum('trainings_planned'),
            'employees_trained' => $reports->sum('employees_trained'),
            'training_hours' => $reports->sum('training_hours'),
            'toolbox_talks' => $reports->sum('toolbox_talks'),
            // Inspections
            'total_inspections' => $reports->sum('inspections_completed'),
            'inspections_planned' => $reports->sum('inspections_planned'),
            'findings_open' => $reports->sum('findings_open'),
            'findings_closed' => $reports->sum('findings_closed'),
            'corrective_actions' => $reports->sum('corrective_actions'),
            // Rates
            'total_hours' => $reports->sum('hours_worked'),
            'avg_tf' => round($reports->avg('tf_value'), 4),
            'avg_tg' => round($reports->avg('tg_value'), 4),
            'avg_hse_compliance' => round($reports->avg('hse_compliance_rate'), 2),
            'avg_medical_compliance' => round($reports->avg('medical_compliance_rate'), 2),
            // Resources
            'water_consumption' => $reports->sum('water_consumption'),
            'electricity_consumption' => $reports->sum('electricity_consumption'),
            'work_permits' => $reports->sum('work_permits'),
        ];

        // Weekly trends for charts
        $weeklyTrends = $reports->groupBy('week_number')->map(function ($weekReports, $week) {
            return [
                'week' => $week,
                'accidents' => $weekReports->sum('accidents'),
                'trainings' => $weekReports->sum('trainings_conducted'),
                'inspections' => $weekReports->sum('inspections_completed'),
                'tf' => round($weekReports->avg('tf_value'), 4),
                'tg' => round($weekReports->avg('tg_value'), 4),
            ];
        })->values();

        // Project breakdown
        $projectBreakdown = $reports->groupBy('project_id')->map(function ($projReports) {
            $proj = $projReports->first()->project;
            return [
                'name' => $proj->name ?? 'Unknown',
                'code' => $proj->code ?? 'N/A',
                'reports' => $projReports->count(),
                'accidents' => $projReports->sum('accidents'),
                'trainings' => $projReports->sum('trainings_conducted'),
                'inspections' => $projReports->sum('inspections_completed'),
                'avg_tf' => round($projReports->avg('tf_value'), 4),
                'avg_tg' => round($projReports->avg('tg_value'), 4),
            ];
        })->values();

        // Statistics
        $stats = [
            'total_projects' => Project::active()->count(),
            'total_users' => User::active()->count(),
        ];

        $pdf = Pdf::loadView('exports.admin-report', [
            'reports' => $reports,
            'summary' => $summary,
            'weekly_trends' => $weeklyTrends,
            'project_breakdown' => $projectBreakdown,
            'stats' => $stats,
            'project' => $project,
            'year' => $year,
            'generated_at' => now()->format('Y-m-d H:i:s'),
            'generated_by' => $user->name,
        ]);

        $pdf->setPaper('a4', 'portrait');

        $filename = 'hse_kpi_report_' . $year . '_' . date('Y-m-d_His') . '.pdf';

        return $pdf->download($filename);
    }

    /**
     * Export single project report
     */
    public function exportProjectReport(Request $request, Project $project)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        // Access control
        if (!$user || !$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $year = $request->get('year', date('Y'));

        $reports = $project->kpiReports()
            ->where('report_year', $year)
            ->approved()
            ->orderBy('report_month')
            ->get();

        $summary = [
            'total_accidents' => $reports->sum('accidents'),
            'fatal_accidents' => $reports->sum('accidents_fatal'),
            'total_trainings' => $reports->sum('trainings_conducted'),
            'employees_trained' => $reports->sum('employees_trained'),
            'total_inspections' => $reports->sum('inspections_completed'),
            'total_hours' => $reports->sum('hours_worked'),
            'lost_workdays' => $reports->sum('lost_workdays'),
            'avg_tf' => round($reports->avg('tf_value'), 4),
            'avg_tg' => round($reports->avg('tg_value'), 4),
            'avg_hse_compliance' => round($reports->avg('hse_compliance_rate'), 2),
        ];

        $pdf = Pdf::loadView('exports.project-report', [
            'project' => $project,
            'reports' => $reports,
            'summary' => $summary,
            'year' => $year,
            'generated_at' => now()->format('Y-m-d H:i:s'),
            'generated_by' => $user->name,
        ]);

        $filename = 'project_' . $project->code . '_' . $year . '_report.pdf';

        return $pdf->download($filename);
    }

    /**
     * Export HSE Weekly Report to Excel (11 sheets as per SGTM specification)
     * Admin only
     */
    public function exportHseWeekly(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week' => 'required|integer|min:1|max:53',
            'year' => 'required|integer|min:2020|max:2100',
        ]);

        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $project = Project::findOrFail($request->project_id);
        if (!$user->isAdminLike() || !$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }
        $week = (int) $request->week;
        $year = (int) $request->year;

        // Generate filename
        $weekStart = Carbon::now()->setISODate($year, $week)->startOfWeek();
        $filename = 'HSE_Report_' . $project->code . '_S' . str_pad($week, 2, '0', STR_PAD_LEFT) . '_' . $year . '.xlsx';

        return Excel::download(new HseWeeklyExport($project, $week, $year), $filename);
    }
}
