<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectTeamController;
use App\Http\Controllers\Api\KpiReportController;
use App\Http\Controllers\Api\SorReportController;
use App\Http\Controllers\Api\TrainingController;
use App\Http\Controllers\Api\AwarenessSessionController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\SorAnalyticsController;
use App\Http\Controllers\Api\DailyKpiSnapshotController;
use App\Http\Controllers\Api\DailyEffectifController;
use App\Http\Controllers\Api\MonthlyReportController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\WorkPermitController;
use App\Http\Controllers\Api\InspectionController;
use App\Http\Controllers\Api\WorkerController;
use App\Http\Controllers\Api\WorkerTrainingController;
use App\Http\Controllers\Api\WorkerQualificationController;
use App\Http\Controllers\Api\WorkerMedicalAptitudeController;
use App\Http\Controllers\Api\WorkerSanctionController;
use App\Http\Controllers\Api\MassImportProgressController;
use App\Http\Controllers\Api\ImportFilesController;
use App\Http\Controllers\Api\PpeController;
use App\Http\Controllers\Api\RegulatoryWatchController;
use App\Http\Controllers\Api\SubcontractorOpeningController;
use App\Http\Controllers\Api\SecurityController;
use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\HeavyMachineryController;
use App\Http\Controllers\Api\HeavyMachineryMachineController;
use App\Http\Controllers\Api\HeavyMachineryReportController;
use App\Http\Controllers\Api\PpeAnalyticsController;
use App\Http\Controllers\Api\HseEventController;
use App\Http\Controllers\Api\MonthlyKpiMeasurementController;
use App\Http\Controllers\Api\LightingMeasurementController;
use App\Http\Controllers\Api\BugReportController;
use App\Http\Controllers\Api\WasteExportController;
use App\Http\Controllers\Api\BackupController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// Public stats for login page (no auth required)
Route::get('/public-stats', [DashboardController::class, 'publicStats']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    Route::pattern('project', '[0-9]+');
    Route::pattern('teamMember', '[0-9]+');
    Route::pattern('submission', '[0-9]+');
    
    // Auth routes
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });

    Route::get('/mass-import/progress/{progressId}', [MassImportProgressController::class, 'show']);

    Route::get('/imports/failed-rows/{filename}', [ImportFilesController::class, 'downloadFailedRows']);

    // Bug reports (all authenticated users can submit)
    Route::prefix('bug-reports')->group(function () {
        Route::post('/', [BugReportController::class, 'store']);
    });

    // Bug reports (admin only)
    Route::middleware('admin')->prefix('bug-reports')->group(function () {
        Route::get('/', [BugReportController::class, 'index']);
        Route::get('/{bugReport}', [BugReportController::class, 'show']);
        Route::get('/{bugReport}/attachment', [BugReportController::class, 'downloadAttachment']);
    });

    Route::prefix('bootstrap')->group(function () {
        Route::get('/template', [BootstrapController::class, 'template']);
        Route::get('/export', [BootstrapController::class, 'export']);
        Route::post('/import', [BootstrapController::class, 'import']);
    });

    // Dashboard routes
    Route::prefix('dashboard')->group(function () {
        Route::get('/admin', [DashboardController::class, 'adminDashboard'])->middleware(['cache.api:2']);
        Route::get('/user', [DashboardController::class, 'userDashboard']);
        Route::get('/safety-performance', [DashboardController::class, 'safetyPerformance'])->middleware(['cache.api:2']);
        Route::get('/environmental-monthly', [DashboardController::class, 'environmentalMonthly'])->middleware(['cache.api:2']);
        Route::get('/charts/accidents', [DashboardController::class, 'accidentCharts']);
        Route::get('/charts/trainings', [DashboardController::class, 'trainingCharts']);
        Route::get('/charts/inspections', [DashboardController::class, 'inspectionCharts']);
        Route::get('/charts/sor', [DashboardController::class, 'sorCharts']);
        Route::get('/charts/rates', [DashboardController::class, 'rateCharts']);

        // SOR Analytics (descriptive, per-graph endpoints)
        Route::prefix('sor-analytics')->middleware(['cache.api:2'])->group(function () {
            Route::get('/kpis', [SorAnalyticsController::class, 'kpis']);
            Route::get('/project-pole-stacked', [SorAnalyticsController::class, 'projectPoleStacked']);
            Route::get('/project-treemap', [SorAnalyticsController::class, 'projectTreemap']);
            Route::get('/project-pole-heatmap', [SorAnalyticsController::class, 'projectPoleHeatmap']);
            Route::get('/theme-avg-resolution', [SorAnalyticsController::class, 'themeAvgResolution']);
            Route::get('/theme-resolution-box', [SorAnalyticsController::class, 'themeResolutionBox']);
            Route::get('/theme-unresolved-count', [SorAnalyticsController::class, 'themeUnresolvedCount']);
            Route::get('/theme-resolved-unresolved', [SorAnalyticsController::class, 'themeResolvedUnresolved']);
            Route::get('/theme-bubble', [SorAnalyticsController::class, 'themeBubble']);
            Route::get('/user-theme-avg-resolution', [SorAnalyticsController::class, 'userThemeAvgResolution']);
            Route::get('/pole-theme-unresolved-rate', [SorAnalyticsController::class, 'poleThemeUnresolvedRate']);
        });

        // PPE Analytics
        Route::prefix('ppe-analytics')->middleware(['cache.api:2'])->group(function () {
            Route::get('/consumption', [PpeAnalyticsController::class, 'consumption']);
        });
    });

    // User management (Admin only)
    Route::middleware('admin')->prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index']);
        Route::post('/', [UserController::class, 'store']);
        Route::get('/statistics', [UserController::class, 'statistics']);
        Route::get('/template', [UserController::class, 'downloadTemplate']);
        Route::post('/import', [UserController::class, 'bulkImport']);
        Route::get('/{user}', [UserController::class, 'show']);
        Route::put('/{user}', [UserController::class, 'update']);
        Route::delete('/{user}', [UserController::class, 'destroy']);
        Route::post('/{user}/toggle-status', [UserController::class, 'toggleStatus']);
        Route::post('/{user}/assign-projects', [UserController::class, 'assignProjects']);
    });

    // Security monitoring (Admin only)
    Route::middleware('admin')->prefix('security')->group(function () {
        Route::get('/dashboard', [SecurityController::class, 'dashboard']);
        Route::get('/logs', [SecurityController::class, 'logs']);
        Route::post('/block-ip', [SecurityController::class, 'blockIp']);
        Route::post('/unblock-ip', [SecurityController::class, 'unblockIp']);
    });

    // Monthly Report (strict admin only)
    Route::middleware('strict_admin')->prefix('admin/reports/monthly')->group(function () {
        Route::get('/summary', [MonthlyReportController::class, 'summary']);
    });

    // Backup (strict admin only)
    Route::middleware('strict_admin')->prefix('admin/backup')->group(function () {
        Route::get('/settings', [BackupController::class, 'settings']);
        Route::put('/settings', [BackupController::class, 'updateSettings']);
        Route::get('/download', [BackupController::class, 'downloadLatest']);
    });

    // Project management
    Route::prefix('projects')->group(function () {
        Route::get('/', [ProjectController::class, 'index']);
        Route::get('/statistics', [ProjectController::class, 'statistics']);
        Route::get('/poles', [ProjectController::class, 'poles']);

        // Admin-only utility routes (must be before /{project} to avoid route conflicts)
        Route::middleware('admin')->group(function () {
            Route::get('/template', [ProjectController::class, 'downloadTemplate']);
            Route::post('/import', [ProjectController::class, 'bulkImport']);
            Route::get('/management-export', [ProjectController::class, 'managementExport']);
        });

        Route::get('/{project}', [ProjectController::class, 'show']);
        Route::get('/{project}/kpi-trends', [ProjectController::class, 'kpiTrends']);
        
        // Project zones management (Responsables and Admins)
        Route::get('/{project}/zones', [ProjectController::class, 'getZones']);
        Route::put('/{project}/zones', [ProjectController::class, 'updateZones']);
        Route::post('/{project}/zones/add', [ProjectController::class, 'addZone']);
        Route::post('/{project}/zones/remove', [ProjectController::class, 'removeZone']);
        
        // Project team management (HSE Managers and Admins)
        Route::get('/{project}/team', [ProjectTeamController::class, 'index']);
        Route::get('/{project}/team/available', [ProjectTeamController::class, 'available']);
        Route::post('/{project}/team', [ProjectTeamController::class, 'store']);
        Route::post('/{project}/team/bulk', [ProjectTeamController::class, 'bulkAdd']);
        Route::get('/{project}/team/template', [ProjectTeamController::class, 'downloadTemplate']);
        Route::post('/{project}/team/import', [ProjectTeamController::class, 'bulkImport']);
        Route::delete('/{project}/team/{teamMember}', [ProjectTeamController::class, 'destroy']);
        
        // Project user management (Responsable only)
        Route::get('/{project}/members', [ProjectTeamController::class, 'manageable']);
        Route::post('/{project}/members/create', [ProjectTeamController::class, 'createUser']);
        Route::put('/{project}/members/{member}', [ProjectTeamController::class, 'updateMember']);
        Route::delete('/{project}/members/{member}', [ProjectTeamController::class, 'removeFromProject']);
        
        // Admin only
        Route::middleware('admin')->group(function () {
            Route::post('/', [ProjectController::class, 'store']);
            Route::put('/{project}', [ProjectController::class, 'update']);
            Route::delete('/{project}', [ProjectController::class, 'destroy']);
        });
    });

    // KPI Reports
    Route::prefix('kpi-reports')->group(function () {
        Route::get('/', [KpiReportController::class, 'index']);
        Route::post('/', [KpiReportController::class, 'store']);
        Route::get('/statistics', [KpiReportController::class, 'statistics']);
        Route::get('/weeks', [KpiReportController::class, 'getWeeks']);
        Route::get('/week-dates', [KpiReportController::class, 'getWeekDates']);
        Route::get('/auto-populate', [KpiReportController::class, 'getAutoPopulatedData']);
        Route::get('/{kpiReport}', [KpiReportController::class, 'show']);
        Route::put('/{kpiReport}', [KpiReportController::class, 'update']);
        Route::delete('/{kpiReport}', [KpiReportController::class, 'destroy']);

        Route::post('/{kpiReport}/approve', [KpiReportController::class, 'approve']);
        Route::post('/{kpiReport}/reject', [KpiReportController::class, 'reject']);
    });

    // Daily KPI snapshots (per-project, per-day values)
    Route::prefix('daily-kpi')->group(function () {
        Route::get('/', [DailyKpiSnapshotController::class, 'index']);
        Route::post('/', [DailyKpiSnapshotController::class, 'store']);
        Route::get('/week-dates', [DailyKpiSnapshotController::class, 'getWeekDates']);
        Route::get('/week-aggregates', [DailyKpiSnapshotController::class, 'getWeekAggregates']);
        Route::get('/auto-fill', [DailyKpiSnapshotController::class, 'getAutoFillValues']);
        Route::get('/download-template', [DailyKpiSnapshotController::class, 'downloadTemplate']);
        Route::post('/parse-template', [DailyKpiSnapshotController::class, 'parseTemplate']);
        Route::post('/bulk-save', [DailyKpiSnapshotController::class, 'bulkSave']);
        Route::get('/{dailyKpiSnapshot}', [DailyKpiSnapshotController::class, 'show']);
        Route::put('/{dailyKpiSnapshot}', [DailyKpiSnapshotController::class, 'update']);
        Route::delete('/{dailyKpiSnapshot}', [DailyKpiSnapshotController::class, 'destroy']);
    });

    // Daily Effectif entries (per-project, per-day headcount)
    Route::prefix('daily-effectif')->group(function () {
        Route::post('/', [DailyEffectifController::class, 'upsert']);
        Route::get('/entry', [DailyEffectifController::class, 'entry']);
        Route::get('/list', [DailyEffectifController::class, 'list']);
        Route::get('/series', [DailyEffectifController::class, 'series']);
        Route::get('/history', [DailyEffectifController::class, 'history']);
        Route::get('/by-project', [DailyEffectifController::class, 'byProject']);
    });

    // Notifications
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::get('/urgent/unread', [NotificationController::class, 'urgentUnread']);
        Route::post('/mark-all-read', [NotificationController::class, 'markAllAsRead']);
        Route::post('/delete-read', [NotificationController::class, 'deleteRead']);
        Route::post('/send', [NotificationController::class, 'send'])->middleware('admin');
        Route::post('/urgent/send', [NotificationController::class, 'urgentSend'])->middleware('admin');
        Route::post('/{notification}/mark-read', [NotificationController::class, 'markAsRead']);
        Route::delete('/{notification}', [NotificationController::class, 'destroy']);
    });

    // Export routes - with compression for large files
    Route::prefix('export')->middleware('compress')->group(function () {
        Route::get('/excel', [ExportController::class, 'exportToExcel']);
        Route::get('/pdf', [ExportController::class, 'exportToPdf']);
        Route::get('/project/{project}', [ExportController::class, 'exportProjectReport']);
        Route::get('/hse-weekly', [ExportController::class, 'exportHseWeekly'])->middleware('admin');
    });

    // SOR Reports (Non-Conformity & Observation Tracking)
    Route::prefix('sor-reports')->group(function () {
        Route::get('/categories', [SorReportController::class, 'categories']);
        Route::get('/statistics', [SorReportController::class, 'statistics']);
        Route::get('/pinned', [SorReportController::class, 'pinned']);
        Route::get('/template', [SorReportController::class, 'template']);
        Route::get('/export', [SorReportController::class, 'export']);
        Route::post('/import', [SorReportController::class, 'import']);
        Route::get('/', [SorReportController::class, 'index']);
        Route::post('/', [SorReportController::class, 'store']);
        Route::get('/{sorReport}/photo', [SorReportController::class, 'viewPhoto']);
        Route::get('/{sorReport}/corrective-photo', [SorReportController::class, 'viewCorrectivePhoto']);
        Route::get('/{sorReport}', [SorReportController::class, 'show']);
        Route::put('/{sorReport}', [SorReportController::class, 'update']);
        Route::post('/{sorReport}/corrective-action', [SorReportController::class, 'submitCorrectiveAction']);
        Route::delete('/{sorReport}', [SorReportController::class, 'destroy']);
    });

    // Trainings
    Route::prefix('trainings')->group(function () {
        Route::get('/', [TrainingController::class, 'index']);
        Route::post('/', [TrainingController::class, 'store']);
        Route::get('/statistics', [TrainingController::class, 'statistics']);
        Route::get('/{training}/photo', [TrainingController::class, 'photo']);
        Route::get('/{training}', [TrainingController::class, 'show']);
        Route::put('/{training}', [TrainingController::class, 'update']);
        Route::delete('/{training}', [TrainingController::class, 'destroy']);
    });

    // HSE Events (Accidents/Incidents/Medical/Road)
    Route::prefix('hse-events')->group(function () {
        Route::get('/', [HseEventController::class, 'index']);
        Route::post('/', [HseEventController::class, 'store']);
        Route::get('/{hseEvent}', [HseEventController::class, 'show']);
        Route::get('/{hseEvent}/attachments', [HseEventController::class, 'attachments']);
        Route::post('/{hseEvent}/attachments', [HseEventController::class, 'uploadAttachment']);
        Route::get('/{hseEvent}/attachments/{attachmentId}', [HseEventController::class, 'viewAttachment']);
        Route::delete('/{hseEvent}/attachments/{attachmentId}', [HseEventController::class, 'deleteAttachment']);
        Route::put('/{hseEvent}', [HseEventController::class, 'update']);
        Route::delete('/{hseEvent}', [HseEventController::class, 'destroy']);
    });

    // Monthly KPI Measurements (noise/water/electricity)
    Route::prefix('monthly-kpi-measurements')->group(function () {
        Route::get('/', [MonthlyKpiMeasurementController::class, 'index']);
        Route::post('/', [MonthlyKpiMeasurementController::class, 'store']);
        Route::get('/{monthlyKpiMeasurement}', [MonthlyKpiMeasurementController::class, 'show']);
        Route::put('/{monthlyKpiMeasurement}', [MonthlyKpiMeasurementController::class, 'update']);
        Route::delete('/{monthlyKpiMeasurement}', [MonthlyKpiMeasurementController::class, 'destroy']);
    });

    // Lighting (Lux) Measurements
    Route::prefix('lighting-measurements')->group(function () {
        Route::get('/', [LightingMeasurementController::class, 'index']);
        Route::post('/', [LightingMeasurementController::class, 'store']);
        Route::get('/{lightingMeasurement}', [LightingMeasurementController::class, 'show']);
        Route::put('/{lightingMeasurement}', [LightingMeasurementController::class, 'update']);
        Route::delete('/{lightingMeasurement}', [LightingMeasurementController::class, 'destroy']);
    });

    // Waste Exports (Waste Management)
    Route::prefix('waste-exports')->group(function () {
        Route::get('/', [WasteExportController::class, 'index']);
        Route::post('/', [WasteExportController::class, 'store']);
        Route::put('/{wasteExport}', [WasteExportController::class, 'update']);
        Route::delete('/{wasteExport}', [WasteExportController::class, 'destroy']);
    });

    // Awareness Sessions (TBM/TBT)
    Route::prefix('awareness-sessions')->group(function () {
        Route::get('/', [AwarenessSessionController::class, 'index']);
        Route::get('/template', [AwarenessSessionController::class, 'template']);
        Route::get('/export', [AwarenessSessionController::class, 'export']);
        Route::post('/import', [AwarenessSessionController::class, 'import']);
        Route::post('/', [AwarenessSessionController::class, 'store']);
        Route::get('/statistics', [AwarenessSessionController::class, 'statistics']);
        Route::get('/{awarenessSession}', [AwarenessSessionController::class, 'show']);
        Route::put('/{awarenessSession}', [AwarenessSessionController::class, 'update']);
        Route::delete('/{awarenessSession}', [AwarenessSessionController::class, 'destroy']);
    });

    // Work Permits (Responsable and Supervisor only)
    Route::prefix('work-permits')->group(function () {
        Route::get('/', [WorkPermitController::class, 'index']);
        Route::get('/week-info', [WorkPermitController::class, 'getWeekInfo']);
        Route::get('/week-permits', [WorkPermitController::class, 'getWeekPermits']);
        Route::get('/export', [WorkPermitController::class, 'export']);
        Route::post('/', [WorkPermitController::class, 'store']);
        Route::post('/copy-from-previous', [WorkPermitController::class, 'copyFromPreviousWeek']);
        Route::post('/reinitialize-numbers', [WorkPermitController::class, 'reinitializeNumbers']);
        Route::post('/launch-week', [WorkPermitController::class, 'launchWeek']);
        Route::get('/{workPermit}', [WorkPermitController::class, 'show']);
        Route::put('/{workPermit}', [WorkPermitController::class, 'update']);
        Route::delete('/{workPermit}', [WorkPermitController::class, 'destroy']);
        Route::post('/{id}/restore', [WorkPermitController::class, 'restore']);
    });

    // Inspections (Responsable and Supervisor)
    Route::prefix('inspections')->group(function () {
        Route::get('/', [InspectionController::class, 'index']);
        Route::get('/export', [InspectionController::class, 'export']);
        Route::get('/statistics', [InspectionController::class, 'statistics']);
        Route::get('/week-count', [InspectionController::class, 'weekCount']);
        Route::post('/', [InspectionController::class, 'store']);
        Route::get('/{inspection}', [InspectionController::class, 'show']);
        Route::put('/{inspection}', [InspectionController::class, 'update']);
        Route::delete('/{inspection}', [InspectionController::class, 'destroy']);
    });

    // Workers Management (Admin, HR, Responsable, Supervisor)
    Route::prefix('workers')->group(function () {
        Route::get('/', [WorkerController::class, 'index']);
        Route::get('/statistics', [WorkerController::class, 'statistics']);
        Route::get('/entreprises', [WorkerController::class, 'entreprises']);
        Route::get('/fonctions', [WorkerController::class, 'fonctions']);
        Route::get('/template', [WorkerController::class, 'template']);
        Route::get('/export', [WorkerController::class, 'export']);
        Route::post('/import', [WorkerController::class, 'import']);
        Route::post('/bulk-deactivate', [WorkerController::class, 'bulkDeactivate']);
        Route::post('/bulk-activate', [WorkerController::class, 'bulkActivate']);
        Route::post('/', [WorkerController::class, 'store']);
        Route::get('/{worker}/image', [WorkerController::class, 'viewImage']);
        Route::post('/{worker}/image', [WorkerController::class, 'uploadImage']);
        Route::get('/{worker}', [WorkerController::class, 'show']);
        Route::put('/{worker}', [WorkerController::class, 'update']);
        Route::delete('/{worker}', [WorkerController::class, 'destroy']);
    });

    // Worker Trainings (Qualified Personnel)
    Route::prefix('worker-trainings')->group(function () {
        Route::get('/', [WorkerTrainingController::class, 'index']);
        Route::get('/other-labels', [WorkerTrainingController::class, 'otherLabels']);
        Route::get('/mass/template', [WorkerTrainingController::class, 'massTemplate']);
        Route::post('/mass/import', [WorkerTrainingController::class, 'massImport']);
        Route::post('/', [WorkerTrainingController::class, 'store']);
        Route::get('/{workerTraining}/certificate/view', [WorkerTrainingController::class, 'viewCertificate']);
        Route::get('/{workerTraining}/certificate/download', [WorkerTrainingController::class, 'downloadCertificate']);
        Route::get('/{workerTraining}', [WorkerTrainingController::class, 'show']);
        Route::put('/{workerTraining}', [WorkerTrainingController::class, 'update']);
        Route::delete('/{workerTraining}', [WorkerTrainingController::class, 'destroy']);
    });

    Route::prefix('worker-qualifications')->group(function () {
        Route::get('/', [WorkerQualificationController::class, 'index']);
        Route::get('/mass/template', [WorkerQualificationController::class, 'massTemplate']);
        Route::post('/mass/import', [WorkerQualificationController::class, 'massImport']);
        Route::post('/', [WorkerQualificationController::class, 'store']);
        Route::get('/{workerQualification}/certificate/view', [WorkerQualificationController::class, 'viewCertificate']);
        Route::get('/{workerQualification}/certificate/download', [WorkerQualificationController::class, 'downloadCertificate']);
        Route::get('/{workerQualification}', [WorkerQualificationController::class, 'show']);
        Route::put('/{workerQualification}', [WorkerQualificationController::class, 'update']);
        Route::delete('/{workerQualification}', [WorkerQualificationController::class, 'destroy']);
    });

    Route::prefix('worker-medical-aptitudes')->group(function () {
        Route::get('/', [WorkerMedicalAptitudeController::class, 'index']);
        Route::get('/mass/template', [WorkerMedicalAptitudeController::class, 'massTemplate']);
        Route::post('/mass/import', [WorkerMedicalAptitudeController::class, 'massImport']);
        Route::post('/', [WorkerMedicalAptitudeController::class, 'store']);
        Route::get('/{workerMedicalAptitude}/certificate/view', [WorkerMedicalAptitudeController::class, 'viewCertificate']);
        Route::get('/{workerMedicalAptitude}/certificate/download', [WorkerMedicalAptitudeController::class, 'downloadCertificate']);
        Route::get('/{workerMedicalAptitude}', [WorkerMedicalAptitudeController::class, 'show']);
        Route::put('/{workerMedicalAptitude}', [WorkerMedicalAptitudeController::class, 'update']);
        Route::delete('/{workerMedicalAptitude}', [WorkerMedicalAptitudeController::class, 'destroy']);
    });

    Route::prefix('worker-sanctions')->group(function () {
        Route::get('/', [WorkerSanctionController::class, 'index']);
        Route::get('/mass/template', [WorkerSanctionController::class, 'massTemplate']);
        Route::post('/mass/import', [WorkerSanctionController::class, 'massImport']);
        Route::post('/', [WorkerSanctionController::class, 'store']);
        Route::get('/{workerSanction}/document/view', [WorkerSanctionController::class, 'viewDocument']);
        Route::get('/{workerSanction}/document/download', [WorkerSanctionController::class, 'downloadDocument']);
        Route::get('/{workerSanction}', [WorkerSanctionController::class, 'show']);
        Route::delete('/{workerSanction}', [WorkerSanctionController::class, 'destroy']);
    });

    // PPE / EPI Management (same access rules as Workers)
    Route::prefix('ppe')->group(function () {
        Route::get('/mass/template', [PpeController::class, 'massTemplate']);
        Route::post('/mass/import', [PpeController::class, 'massImport']);

        Route::get('/items', [PpeController::class, 'items']);
        Route::post('/items', [PpeController::class, 'upsertItem']);
        Route::delete('/items/{item}', [PpeController::class, 'deleteItem']);

        Route::post('/issue', [PpeController::class, 'issueToWorker']);
        Route::get('/issues', [PpeController::class, 'issues']);
        Route::get('/workers/{worker}/issues', [PpeController::class, 'workerIssues']);

        Route::post('/restock', [PpeController::class, 'restock']);
    });

    // Veille réglementaire (Regulatory watch checklists)
    Route::prefix('regulatory-watch')->group(function () {
        Route::get('/', [RegulatoryWatchController::class, 'index']);
        Route::get('/latest', [RegulatoryWatchController::class, 'latest']);
        Route::get('/{submission}', [RegulatoryWatchController::class, 'show']);
        Route::post('/', [RegulatoryWatchController::class, 'store']);
        Route::delete('/{submission}', [RegulatoryWatchController::class, 'destroy']);
    });

    // Subcontractor Site Openings (Ouverture de chantier) (Responsable and Admin)
    Route::prefix('subcontractor-openings')->group(function () {
        Route::get('/', [SubcontractorOpeningController::class, 'index']);
        Route::post('/', [SubcontractorOpeningController::class, 'store']);
        Route::get('/{subcontractorOpening}', [SubcontractorOpeningController::class, 'show']);
        Route::put('/{subcontractorOpening}', [SubcontractorOpeningController::class, 'update']);
        Route::delete('/{subcontractorOpening}', [SubcontractorOpeningController::class, 'destroy']);
        Route::post('/{subcontractorOpening}/documents', [SubcontractorOpeningController::class, 'uploadDocument']);
        Route::get('/{subcontractorOpening}/documents/{document}/view', [SubcontractorOpeningController::class, 'viewDocument']);
        Route::get('/{subcontractorOpening}/documents/{document}/download', [SubcontractorOpeningController::class, 'downloadDocument']);
    });

    Route::middleware('heavy_machinery_access')->prefix('heavy-machinery')->group(function () {
        Route::get('/ping', [HeavyMachineryController::class, 'ping']);
        Route::get('/document-keys', [HeavyMachineryController::class, 'documentKeys']);
        Route::get('/machine-types', [HeavyMachineryController::class, 'machineTypes']);

        Route::get('/machines', [HeavyMachineryMachineController::class, 'index']);
        Route::get('/machines/template', [HeavyMachineryMachineController::class, 'downloadTemplate']);
        Route::post('/machines/import', [HeavyMachineryMachineController::class, 'bulkImport']);
        Route::post('/machines', [HeavyMachineryMachineController::class, 'store']);
        Route::get('/machines/{machine}', [HeavyMachineryMachineController::class, 'show']);
        Route::get('/machines/{machine}/image', [HeavyMachineryMachineController::class, 'viewImage']);
        Route::put('/machines/{machine}', [HeavyMachineryMachineController::class, 'update']);
        Route::delete('/machines/{machine}', [HeavyMachineryMachineController::class, 'destroy']);
        Route::post('/machines/{machine}/transfer', [HeavyMachineryMachineController::class, 'transfer']);
        Route::post('/machines/{machine}/image', [HeavyMachineryMachineController::class, 'uploadImage']);

        Route::post('/machines/{machine}/documents', [HeavyMachineryMachineController::class, 'upsertDocument']);
        Route::put('/machines/{machine}/documents/{machineDocument}', [HeavyMachineryMachineController::class, 'updateDocument']);
        Route::delete('/machines/{machine}/documents/{machineDocument}', [HeavyMachineryMachineController::class, 'deleteDocument']);
        Route::get('/machines/{machine}/documents/{machineDocument}/view', [HeavyMachineryMachineController::class, 'viewDocument']);
        Route::get('/machines/{machine}/documents/{machineDocument}/download', [HeavyMachineryMachineController::class, 'downloadDocument']);

        Route::post('/machines/{machine}/inspections', [HeavyMachineryMachineController::class, 'upsertInspection']);
        Route::delete('/machines/{machine}/inspections/{machineInspection}', [HeavyMachineryMachineController::class, 'deleteInspection']);
        Route::get('/machines/{machine}/inspections/{machineInspection}/view', [HeavyMachineryMachineController::class, 'viewInspection']);
        Route::get('/machines/{machine}/inspections/{machineInspection}/download', [HeavyMachineryMachineController::class, 'downloadInspection']);

        Route::get('/workers/search', [HeavyMachineryMachineController::class, 'searchWorkers']);
        Route::post('/machines/{machine}/operators', [HeavyMachineryMachineController::class, 'addOperator']);
        Route::delete('/machines/{machine}/operators/{worker}', [HeavyMachineryMachineController::class, 'removeOperator']);

        Route::get('/global-search', [HeavyMachineryMachineController::class, 'globalSearch']);
        Route::get('/global/machines/{machine}/documents/{machineDocument}/view', [HeavyMachineryMachineController::class, 'globalViewDocument']);
        Route::get('/global/machines/{machine}/documents/{machineDocument}/download', [HeavyMachineryMachineController::class, 'globalDownloadDocument']);

        Route::get('/reports/expired-documentation', [HeavyMachineryReportController::class, 'expiredDocumentation']);
    });
});
