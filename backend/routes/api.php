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
use App\Http\Controllers\Api\DailyKpiSnapshotController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\WorkPermitController;
use App\Http\Controllers\Api\InspectionController;
use App\Http\Controllers\Api\WorkerController;
use App\Http\Controllers\Api\WorkerTrainingController;
use App\Http\Controllers\Api\SubcontractorOpeningController;
use App\Http\Controllers\Api\SecurityController;
use App\Http\Controllers\Api\BootstrapController;
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
    
    // Auth routes
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });

    Route::prefix('bootstrap')->group(function () {
        Route::get('/template', [BootstrapController::class, 'template']);
        Route::get('/export', [BootstrapController::class, 'export']);
        Route::post('/import', [BootstrapController::class, 'import']);
    });

    // Dashboard routes
    Route::prefix('dashboard')->group(function () {
        Route::get('/admin', [DashboardController::class, 'adminDashboard'])->middleware('admin');
        Route::get('/user', [DashboardController::class, 'userDashboard']);
        Route::get('/charts/accidents', [DashboardController::class, 'accidentCharts']);
        Route::get('/charts/trainings', [DashboardController::class, 'trainingCharts']);
        Route::get('/charts/inspections', [DashboardController::class, 'inspectionCharts']);
        Route::get('/charts/sor', [DashboardController::class, 'sorCharts']);
        Route::get('/charts/rates', [DashboardController::class, 'rateCharts']);
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

    // Project management
    Route::prefix('projects')->group(function () {
        Route::get('/', [ProjectController::class, 'index']);
        Route::get('/statistics', [ProjectController::class, 'statistics']);
        Route::get('/poles', [ProjectController::class, 'poles']);

        // Admin-only utility routes (must be before /{project} to avoid route conflicts)
        Route::middleware('admin')->group(function () {
            Route::get('/template', [ProjectController::class, 'downloadTemplate']);
            Route::post('/import', [ProjectController::class, 'bulkImport']);
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
        
        // Admin only
        Route::middleware('admin')->group(function () {
            Route::post('/{kpiReport}/approve', [KpiReportController::class, 'approve']);
            Route::post('/{kpiReport}/reject', [KpiReportController::class, 'reject']);
        });
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

    // Notifications
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/mark-all-read', [NotificationController::class, 'markAllAsRead']);
        Route::post('/delete-read', [NotificationController::class, 'deleteRead']);
        Route::post('/send', [NotificationController::class, 'send'])->middleware('admin');
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
        Route::get('/export', [SorReportController::class, 'export']);
        Route::get('/', [SorReportController::class, 'index']);
        Route::post('/', [SorReportController::class, 'store']);
        Route::get('/{sorReport}/photo', [SorReportController::class, 'viewPhoto']);
        Route::get('/{sorReport}/corrective-photo', [SorReportController::class, 'viewCorrectivePhoto']);
        Route::get('/{sorReport}', [SorReportController::class, 'show']);
        Route::put('/{sorReport}', [SorReportController::class, 'update']);
        Route::post('/{sorReport}/corrective-action', [SorReportController::class, 'submitCorrectiveAction']);
        Route::delete('/{sorReport}', [SorReportController::class, 'destroy'])->middleware('admin');
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

    // Awareness Sessions (TBM/TBT)
    Route::prefix('awareness-sessions')->group(function () {
        Route::get('/', [AwarenessSessionController::class, 'index']);
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
        Route::get('/{worker}', [WorkerController::class, 'show']);
        Route::put('/{worker}', [WorkerController::class, 'update']);
        Route::delete('/{worker}', [WorkerController::class, 'destroy']);
    });

    // Worker Trainings (Qualified Personnel)
    Route::prefix('worker-trainings')->group(function () {
        Route::get('/', [WorkerTrainingController::class, 'index']);
        Route::get('/other-labels', [WorkerTrainingController::class, 'otherLabels']);
        Route::post('/', [WorkerTrainingController::class, 'store']);
        Route::get('/{workerTraining}', [WorkerTrainingController::class, 'show']);
        Route::put('/{workerTraining}', [WorkerTrainingController::class, 'update']);
        Route::delete('/{workerTraining}', [WorkerTrainingController::class, 'destroy']);
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
});
