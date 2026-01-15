<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KpiReport;
use App\Models\Project;
use App\Models\DailyKpiSnapshot;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationService;
use App\Helpers\WeekHelper;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use Barryvdh\DomPDF\Facade\Pdf;

class KpiReportController extends Controller
{
    private function kpiReportColumns(): array
    {
        static $columns = null;
        if ($columns !== null) {
            return $columns;
        }

        try {
            $columns = Schema::getColumnListing('kpi_reports');
        } catch (\Throwable $e) {
            $columns = [];
        }

        return $columns;
    }

    private function missingKpiReportColumns(array $required): array
    {
        $existing = array_flip($this->kpiReportColumns());
        $missing = [];
        foreach ($required as $col) {
            if (!isset($existing[$col])) {
                $missing[] = $col;
            }
        }
        return $missing;
    }

    private function filterToKpiReportColumns(array $data): array
    {
        $columns = array_flip($this->kpiReportColumns());
        if (empty($columns)) {
            return $data;
        }
        return array_intersect_key($data, $columns);
    }

    /**
     * Get all KPI reports with pagination and filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = KpiReport::query()->with(['project', 'submitter', 'approver']);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        // For admin-like users, hide draft reports by default unless a specific status filter is applied
        if ($user->isAdminLike() && !$request->filled('status')) {
            $query->where('status', '!=', KpiReport::STATUS_DRAFT);
        }

        // Project filter
        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }

        // User filter
        if ($userId = $request->get('user_id')) {
            $query->where('submitted_by', $userId);
        }

        // Status filter
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if (($pole = $request->get('pole')) !== null && $pole !== '') {
            $query->whereHas('project', function ($q) use ($pole) {
                $q->where('pole', $pole);
            });
        }

        // Date range filter
        if ($startDate = $request->get('start_date')) {
            $query->where('report_date', '>=', $startDate);
        }
        if ($endDate = $request->get('end_date')) {
            $query->where('report_date', '<=', $endDate);
        }

        // Month/Year filter
        if ($month = $request->get('month')) {
            $query->where('report_month', $month);
        }
        if ($year = $request->get('year')) {
            $query->where('report_year', $year);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'report_date');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->get('per_page', 15);
        $reports = $query->paginate($perPage);

        return $this->paginated($reports);
    }

    /**
     * Create a new KPI report (Weekly)
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $missing = $this->missingKpiReportColumns([
            'project_id',
            'submitted_by',
            'report_date',
            'report_month',
            'report_year',
            'week_number',
            'start_date',
            'end_date',
            'status',
        ]);
        if (!empty($missing)) {
            return $this->error('Server misconfigured: missing database columns for KPI reports. Please run backend migrations.', 500, [
                'missing_columns' => $missing,
            ]);
        }

        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'report_date' => 'required|date',
            'report_month' => 'required|integer|min:1|max:12',
            'report_year' => 'required|integer|min:2000|max:2100',
            'week_number' => 'required|integer|min:1|max:52',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            
            // Accident metrics
            'accidents' => 'nullable|integer|min:0',
            'accidents_fatal' => 'nullable|integer|min:0',
            'accidents_serious' => 'nullable|integer|min:0',
            'accidents_minor' => 'nullable|integer|min:0',
            'near_misses' => 'nullable|integer|min:0',
            'first_aid_cases' => 'nullable|integer|min:0',
            
            // Training metrics
            'trainings_conducted' => 'nullable|integer|min:0',
            'trainings_planned' => 'nullable|integer|min:0',
            'employees_trained' => 'nullable|integer|min:0',
            'training_hours' => 'nullable|numeric|min:0',
            'toolbox_talks' => 'nullable|integer|min:0',
            
            // Inspection metrics
            'inspections_completed' => 'nullable|integer|min:0',
            'inspections_planned' => 'nullable|integer|min:0',
            'findings_open' => 'nullable|integer|min:0',
            'findings_closed' => 'nullable|integer|min:0',
            'corrective_actions' => 'nullable|integer|min:0',
            
            // Work hours and lost days
            'hours_worked' => 'nullable|numeric|min:0',
            'lost_workdays' => 'nullable|integer|min:0',
            
            // Additional metrics
            'unsafe_acts_reported' => 'nullable|integer|min:0',
            'unsafe_conditions_reported' => 'nullable|integer|min:0',
            'emergency_drills' => 'nullable|integer|min:0',
            'hse_compliance_rate' => 'nullable|numeric|min:0|max:100',
            
            'notes' => 'nullable|string',
            'status' => 'nullable|in:draft,submitted',
        ]);

        // Check if user has access to this project
        $project = Project::findOrFail($request->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('You do not have access to this project', 403);
        }

        try {
            // Check for existing report for same week/year
            $existingReport = KpiReport::where('project_id', $request->project_id)
                ->where('week_number', $request->week_number)
                ->where('report_year', $request->report_year)
                ->first();

            if ($existingReport) {
                return $this->error('A report already exists for this week and year', 422);
            }

            $reportData = $this->filterToKpiReportColumns($request->all());
            $reportData['submitted_by'] = $user->id;
            $reportData['status'] = $request->get('status', 'draft');

            if ($reportData['status'] === 'submitted' && $user->isHseManager()) {
                $reportData['status'] = 'approved';
                $reportData['approved_by'] = $user->id;
                $reportData['approved_at'] = now();
            }

            if (in_array('submission_count', $this->kpiReportColumns(), true)) {
                $reportData['submission_count'] = 1;
            }

            // Auto-fill metrics from daily KPI snapshots when available.
            // Responsable encodes daily data; here we aggregate it for the week.
            try {
                $aggregated = DailyKpiSnapshot::aggregateForWeek(
                    $request->project_id,
                    (int) $request->week_number,
                    (int) $request->report_year
                );

                if (!empty($aggregated)) {
                    $autoFields = [
                        'accidents',
                        'near_misses',
                        'first_aid_cases',
                        'lost_workdays',
                        'hours_worked',
                        'inspections_completed',
                        'training_hours',
                        'toolbox_talks',
                        'work_permits',
                        'hse_compliance_rate',
                        'medical_compliance_rate',
                        'noise_monitoring',
                        'water_consumption',
                        'electricity_consumption',
                    ];

                    foreach ($autoFields as $field) {
                        if ((!isset($reportData[$field]) || $reportData[$field] === null) && array_key_exists($field, $aggregated)) {
                            $reportData[$field] = $aggregated[$field];
                        }
                    }
                }
            } catch (\Throwable $e) {
                // ignore
            }

            if ($reportData['status'] === 'submitted' && in_array('last_submitted_at', $this->kpiReportColumns(), true)) {
                $reportData['last_submitted_at'] = now();
            }

            $report = KpiReport::create($reportData);

            // Notify admins if submitted
            if ($report->status === 'submitted') {
                try {
                    $this->notifyAdminsOfSubmission($report, $project);
                } catch (\Throwable $e) {
                    Log::warning('KPI report created but admin notification failed', [
                        'error' => $e->getMessage(),
                        'kpi_report_id' => $report->id,
                        'project_id' => $project->id,
                    ]);
                }
            }

            if ($report->status === 'approved' && $reportData['status'] === 'approved') {
                NotificationService::kpiApproved($report);
            }

            $report->load(['project', 'submitter']);

            return $this->success($report, 'KPI report created successfully', 201);
        } catch (QueryException $e) {
            $sqlState = $e->errorInfo[0] ?? null;
            $driverCode = $e->errorInfo[1] ?? null;

            // MySQL duplicate entry
            if ($sqlState === '23000' && (int) $driverCode === 1062) {
                return $this->error('A report already exists for this week and year', 422);
            }

            $errorId = (string) Str::uuid();
            Log::error('KPI report store failed (query exception)', [
                'error_id' => $errorId,
                'error' => $e->getMessage(),
                'sql_state' => $sqlState,
                'driver_code' => $driverCode,
                'project_id' => $request->project_id,
                'week_number' => $request->week_number,
                'report_year' => $request->report_year,
                'user_id' => $user?->id,
            ]);

            return $this->error('Server error while creating KPI report. Please contact administrator.', 500, [
                'error_id' => $errorId,
            ]);
        } catch (\Throwable $e) {
            $errorId = (string) Str::uuid();
            Log::error('KPI report store failed', [
                'error_id' => $errorId,
                'error' => $e->getMessage(),
                'project_id' => $request->project_id,
                'week_number' => $request->week_number,
                'report_year' => $request->report_year,
                'user_id' => $user?->id,
            ]);

            return $this->error('Server error while creating KPI report. Please contact administrator.', 500, [
                'error_id' => $errorId,
            ]);
        }
    }

    /**
     * Get a specific KPI report
     */
    public function show(Request $request, KpiReport $kpiReport)
    {
        $user = $request->user();

        // Check access
        $project = $kpiReport->project;
        if (!$project) {
            $project = Project::findOrFail($kpiReport->project_id);
        }
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $kpiReport->load(['project', 'submitter', 'approver']);

        // Include daily KPI snapshots for the same week
        $dailySnapshots = [];
        if ($kpiReport->week_number && $kpiReport->report_year) {
            $dailySnapshots = DailyKpiSnapshot::where('project_id', $kpiReport->project_id)
                ->where('week_number', $kpiReport->week_number)
                ->where('year', $kpiReport->report_year)
                ->orderBy('entry_date')
                ->get();
        }

        return $this->success([
            'report' => $kpiReport,
            'daily_snapshots' => $dailySnapshots,
        ]);
    }

    /**
     * Update a KPI report
     */
    public function update(Request $request, KpiReport $kpiReport)
    {
        $user = $request->user();

        $missing = $this->missingKpiReportColumns([
            'project_id',
            'week_number',
            'report_year',
            'status',
        ]);
        if (!empty($missing)) {
            return $this->error('Server misconfigured: missing database columns for KPI reports. Please run backend migrations.', 500, [
                'missing_columns' => $missing,
            ]);
        }

        // Only allow editing of draft/rejected reports or if admin
        if (!$user->isAdminLike() && !in_array($kpiReport->status, ['draft', 'rejected'])) {
            return $this->error('Cannot edit an approved or submitted report', 403);
        }

        $project = $kpiReport->project;
        if (!$project) {
            $project = Project::findOrFail($kpiReport->project_id);
        }
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $request->validate([
            // Same validation as store, but all fields optional
            'accidents' => 'nullable|integer|min:0',
            'accidents_fatal' => 'nullable|integer|min:0',
            'accidents_serious' => 'nullable|integer|min:0',
            'accidents_minor' => 'nullable|integer|min:0',
            'near_misses' => 'nullable|integer|min:0',
            'first_aid_cases' => 'nullable|integer|min:0',
            'trainings_conducted' => 'nullable|integer|min:0',
            'trainings_planned' => 'nullable|integer|min:0',
            'employees_trained' => 'nullable|integer|min:0',
            'training_hours' => 'nullable|numeric|min:0',
            'toolbox_talks' => 'nullable|integer|min:0',
            'inspections_completed' => 'nullable|integer|min:0',
            'inspections_planned' => 'nullable|integer|min:0',
            'findings_open' => 'nullable|integer|min:0',
            'findings_closed' => 'nullable|integer|min:0',
            'corrective_actions' => 'nullable|integer|min:0',
            'hours_worked' => 'nullable|numeric|min:0',
            'lost_workdays' => 'nullable|integer|min:0',
            'unsafe_acts_reported' => 'nullable|integer|min:0',
            'unsafe_conditions_reported' => 'nullable|integer|min:0',
            'emergency_drills' => 'nullable|integer|min:0',
            'hse_compliance_rate' => 'nullable|numeric|min:0|max:100',
            'notes' => 'nullable|string',
            'status' => 'nullable|in:draft,submitted',
        ]);

        try {
            $updateData = $this->filterToKpiReportColumns($request->all());

            if (($updateData['status'] ?? null) === 'submitted') {
                if (in_array('last_submitted_at', $this->kpiReportColumns(), true)) {
                    $updateData['last_submitted_at'] = now();
                }
                if (in_array('submission_count', $this->kpiReportColumns(), true)) {
                    $updateData['submission_count'] = ((int) ($kpiReport->submission_count ?? 0)) + 1;
                }

                if ($user->isHseManager()) {
                    $updateData['status'] = 'approved';
                    $updateData['approved_by'] = $user->id;
                    $updateData['approved_at'] = now();
                }
            }

            $kpiReport->update($updateData);
        } catch (QueryException $e) {
            $sqlState = $e->errorInfo[0] ?? null;
            $driverCode = $e->errorInfo[1] ?? null;

            if ($sqlState === '23000' && (int) $driverCode === 1062) {
                return $this->error('A report already exists for this week and year', 422);
            }

            $errorId = (string) Str::uuid();
            Log::error('KPI report update failed (query exception)', [
                'error_id' => $errorId,
                'error' => $e->getMessage(),
                'sql_state' => $sqlState,
                'driver_code' => $driverCode,
                'kpi_report_id' => $kpiReport->id,
                'user_id' => $user?->id,
            ]);
            return $this->error('Server error while updating KPI report. Please contact administrator.', 500, [
                'error_id' => $errorId,
            ]);
        } catch (\Throwable $e) {
            $errorId = (string) Str::uuid();
            Log::error('KPI report update failed', [
                'error_id' => $errorId,
                'error' => $e->getMessage(),
                'kpi_report_id' => $kpiReport->id,
                'user_id' => $user?->id,
            ]);
            return $this->error('Server error while updating KPI report. Please contact administrator.', 500, [
                'error_id' => $errorId,
            ]);
        }

        if ($request->get('status') === 'submitted' && $kpiReport->wasChanged('status')) {
            if ($kpiReport->status === 'submitted') {
                $this->notifyAdminsOfSubmission($kpiReport, $kpiReport->project);
            } elseif ($kpiReport->status === 'approved') {
                NotificationService::kpiApproved($kpiReport);
            }
        }

        $kpiReport->load(['project', 'submitter', 'approver']);

        return $this->success($kpiReport, 'KPI report updated successfully');
    }

    /**
     * Delete a KPI report
     */
    public function destroy(Request $request, KpiReport $kpiReport)
    {
        $user = $request->user();

        // Only allow deletion of draft reports or if admin
        if (!$user->isAdminLike() && $kpiReport->status !== 'draft') {
            return $this->error('Cannot delete a submitted or approved report', 403);
        }

        $project = $kpiReport->project;
        if (!$project) {
            $project = Project::findOrFail($kpiReport->project_id);
        }
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        if ($kpiReport->status === 'draft') {
            $kpiReport->forceDelete();
        } else {
            $kpiReport->delete();
        }

        return $this->success(null, 'KPI report deleted successfully');
    }

    /**
     * Approve a KPI report (Admin only)
     */
    public function approve(Request $request, KpiReport $kpiReport)
    {
        $user = $request->user();
        if ($kpiReport->status !== 'submitted') {
            return $this->error('Only submitted reports can be approved', 422);
        }

        $project = $kpiReport->project;
        if (!$project) {
            $project = Project::findOrFail($kpiReport->project_id);
        }
        if (!$user || !$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $submitter = $kpiReport->submitter;
        if (!$submitter) {
            $submitter = User::find($kpiReport->submitted_by);
        }

        $canApprove = false;
        if ($user->isAdminLike()) {
            $canApprove = true;
        } elseif ($user->isHseManager() && $submitter && $submitter->isResponsable()) {
            $canApprove = true;
        }

        if (!$canApprove) {
            return $this->error('Access denied', 403);
        }

        $kpiReport->update([
            'status' => 'approved',
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        // Notify submitter using NotificationService
        NotificationService::kpiApproved($kpiReport);

        return $this->success($kpiReport, 'KPI report approved successfully');
    }

    /**
     * Reject a KPI report (Admin only)
     * Sets status back to 'draft' so user can edit and resubmit
     * Sends notification to all project personnel
     */
    public function reject(Request $request, KpiReport $kpiReport)
    {
        $user = $request->user();
        $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        if ($kpiReport->status !== 'submitted') {
            return $this->error('Only submitted reports can be rejected', 422);
        }

        $project = $kpiReport->project;
        if (!$project) {
            $project = Project::findOrFail($kpiReport->project_id);
        }
        if (!$user || !$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $submitter = $kpiReport->submitter;
        if (!$submitter) {
            $submitter = User::find($kpiReport->submitted_by);
        }

        $canReject = false;
        if ($user->isAdminLike()) {
            $canReject = true;
        } elseif ($user->isHseManager() && $submitter && $submitter->isResponsable()) {
            $canReject = true;
        }

        if (!$canReject) {
            return $this->error('Access denied', 403);
        }

        $project = $kpiReport->project;
        $weekInfo = $kpiReport->week_number 
            ? "Semaine {$kpiReport->week_number}" 
            : "{$kpiReport->report_month}/{$kpiReport->report_year}";

        // Update report: set to draft for re-editing
        $kpiReport->update([
            'status' => 'draft',  // Back to draft for editing
            'rejection_reason' => $request->reason,
            'rejected_at' => now(),
            'rejected_by' => $user->id,
        ]);

        // Notify using NotificationService
        NotificationService::kpiRejected($kpiReport, $request->reason);

        $kpiReport->load(['project', 'submitter', 'rejector']);

        return $this->success($kpiReport, 'Rapport KPI refusé et remis en brouillon');
    }

    /**
     * Get aggregated KPI statistics
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $query = KpiReport::query()->approved();

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        // Apply filters
        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }
        if ($year = $request->get('year')) {
            $query->where('report_year', $year);
        }
        if ($startDate = $request->get('start_date')) {
            $query->where('report_date', '>=', $startDate);
        }
        if ($endDate = $request->get('end_date')) {
            $query->where('report_date', '<=', $endDate);
        }

        $stats = [
            'total_accidents' => $query->sum('accidents'),
            'total_fatal' => $query->sum('accidents_fatal'),
            'total_serious' => $query->sum('accidents_serious'),
            'total_minor' => $query->sum('accidents_minor'),
            'total_near_misses' => $query->sum('near_misses'),
            'total_trainings' => $query->sum('trainings_conducted'),
            'total_employees_trained' => $query->sum('employees_trained'),
            'total_training_hours' => $query->sum('training_hours'),
            'total_inspections' => $query->sum('inspections_completed'),
            'total_findings_open' => $query->sum('findings_open'),
            'total_findings_closed' => $query->sum('findings_closed'),
            'total_hours_worked' => $query->sum('hours_worked'),
            'total_lost_workdays' => $query->sum('lost_workdays'),
            'avg_tf' => round($query->avg('tf_value'), 4),
            'avg_tg' => round($query->avg('tg_value'), 4),
            'avg_ppe_compliance' => round($query->avg('hse_compliance_rate'), 2),
        ];

        return $this->success($stats);
    }

    /**
     * Get all weeks for a given year (Saturday-Friday, 52 weeks)
     */
    public function getWeeks(Request $request)
    {
        $year = $request->get('year', date('Y'));
        $weeks = WeekHelper::getAllWeeksForYear((int) $year);
        $currentWeek = WeekHelper::getCurrentWeek();

        return $this->success([
            'weeks' => $weeks,
            'current_week' => $currentWeek['week'],
            'current_year' => $currentWeek['year'],
        ]);
    }

    /**
     * Get week dates for a specific week number and year
     */
    public function getWeekDates(Request $request)
    {
        $request->validate([
            'week' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2000|max:2100',
        ]);

        $dates = WeekHelper::getWeekDates($request->week, $request->year);
        
        return $this->success([
            'week' => $request->week,
            'year' => $request->year,
            'start_date' => $dates['start']->format('Y-m-d'),
            'end_date' => $dates['end']->format('Y-m-d'),
            'label' => WeekHelper::formatWeek($request->week, $request->year),
        ]);
    }

    /**
     * Get auto-populated data for KPI report from related sources
     * Fetches data from SOR reports, trainings, awareness sessions, work permits, etc.
     */
    public function getAutoPopulatedData(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020|max:2100',
        ]);

        $user = $request->user();
        $projectId = $request->project_id;
        $week = $request->week;
        $year = $request->year;

        $project = Project::findOrFail($projectId);
        if (!$user->canAccessProject($project)) {
            return $this->error('You do not have access to this project', 403);
        }

        try {
            $dates = WeekHelper::getWeekDates($week, $year);
            $startDate = $dates['start']->format('Y-m-d');
            $endDate = $dates['end']->format('Y-m-d');

            // Get SOR reports (deviations) for the week
            $sorReports = \App\Models\SorReport::where('project_id', $projectId)
                ->whereBetween('observation_date', [$startDate, $endDate])
                ->get();

            $deviationsCount = $sorReports->count();
            $closedDeviations = $sorReports->where('status', 'closed')->count();

            // Get trainings for the week
            $trainings = \App\Models\Training::where('project_id', $projectId)
                ->whereBetween('date', [$startDate, $endDate])
                ->get();

            $trainingHours = $trainings->sum('training_hours');
            $employeesTrained = $trainings->sum('participants');
            $trainingsCount = $trainings->count();

            // Get awareness sessions (sensibilisation) for the week
            $awarenessSessions = \App\Models\AwarenessSession::where('project_id', $projectId)
                ->whereBetween('date', [$startDate, $endDate])
                ->get();

            $sensibilisationCount = $awarenessSessions->count();

            // Get work permits for the week
            $workPermits = \App\Models\WorkPermit::where('project_id', $projectId)
                ->where('week_number', $week)
                ->where('year', $year)
                ->count();

            // Get inspections for the week
            $inspections = \App\Models\Inspection::where('project_id', $projectId)
                ->whereBetween('inspection_date', [$startDate, $endDate])
                ->get();

            $inspectionsCount = $inspections->count();

            // Get workers count (effectif)
            $workersCount = \App\Models\Worker::where('project_id', $projectId)
                ->where('is_active', true)
                ->count();

            // Get daily snapshots if they exist
            $dailySnapshots = DailyKpiSnapshot::where('project_id', $projectId)
                ->whereBetween('entry_date', [$startDate, $endDate])
                ->get();

            // Sum up daily data if available
            $dailyTotals = [
                'effectif' => $dailySnapshots->sum('effectif') ?: $workersCount,
                'induction' => $dailySnapshots->sum('induction') ?: 0,
                'releve_ecarts' => $dailySnapshots->sum('releve_ecarts') ?: $deviationsCount,
                'sensibilisation' => $dailySnapshots->sum('sensibilisation') ?: $sensibilisationCount,
                'presquaccident' => $dailySnapshots->sum('presquaccident') ?: 0,
                'premiers_soins' => $dailySnapshots->sum('premiers_soins') ?: 0,
                'accidents' => $dailySnapshots->sum('accidents') ?: 0,
                'jours_arret' => $dailySnapshots->sum('jours_arret') ?: 0,
                'inspections' => $dailySnapshots->sum('inspections') ?: $inspectionsCount,
                'heures_formation' => $dailySnapshots->sum('heures_formation') ?: $trainingHours,
                'permis_travail' => $dailySnapshots->sum('permis_travail') ?: $workPermits,
                'mesures_disciplinaires' => $dailySnapshots->sum('mesures_disciplinaires') ?: 0,
                'conformite_hse' => $dailySnapshots->avg('conformite_hse') ?: 0,
                'conformite_medicale' => $dailySnapshots->avg('conformite_medicale') ?: 0,
                'consommation_eau' => $dailySnapshots->sum('consommation_eau') ?: 0,
                'consommation_electricite' => $dailySnapshots->sum('consommation_electricite') ?: 0,
            ];

            return $this->success([
                'auto_populated' => true,
                'week' => $week,
                'year' => $year,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'data' => [
                    'hours_worked' => $dailyTotals['effectif'],
                    'employees_trained' => $employeesTrained ?: $dailyTotals['induction'],
                    'unsafe_conditions_reported' => $dailyTotals['releve_ecarts'],
                    'toolbox_talks' => $dailyTotals['sensibilisation'],
                    'near_misses' => $dailyTotals['presquaccident'],
                    'first_aid_cases' => $dailyTotals['premiers_soins'],
                    'accidents' => $dailyTotals['accidents'],
                    'lost_workdays' => $dailyTotals['jours_arret'],
                    'inspections_completed' => $dailyTotals['inspections'],
                    'training_hours' => $dailyTotals['heures_formation'],
                    'work_permits' => $dailyTotals['permis_travail'],
                    'corrective_actions' => $dailyTotals['mesures_disciplinaires'],
                    'hse_compliance_rate' => round($dailyTotals['conformite_hse'], 2),
                    'medical_compliance_rate' => round($dailyTotals['conformite_medicale'], 2),
                    'water_consumption' => $dailyTotals['consommation_eau'],
                    'electricity_consumption' => $dailyTotals['consommation_electricite'],
                    'findings_open' => $deviationsCount - $closedDeviations,
                    'findings_closed' => $closedDeviations,
                    'trainings_conducted' => $trainingsCount,
                ],
                'sources' => [
                    'sor_reports' => $deviationsCount,
                    'trainings' => $trainingsCount,
                    'awareness_sessions' => $sensibilisationCount,
                    'work_permits' => $workPermits,
                    'inspections' => $inspectionsCount,
                    'workers' => $workersCount,
                    'daily_snapshots' => $dailySnapshots->count(),
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->error('Failed to auto-populate data', 422);
        }
    }

    /**
     * Notify admins of report submission
     */
    private function notifyAdminsOfSubmission(KpiReport $report, Project $project)
    {
        NotificationService::kpiSubmitted($report);
    }
}
