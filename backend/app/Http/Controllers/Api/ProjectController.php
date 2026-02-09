<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectCodeAlias;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Excel as ExcelFormat;
use App\Exports\ProjectsTemplateExport;
use App\Exports\ProjectManagementExport;
use App\Exports\ProjectManagementRegionalExport;
use App\Exports\ProjectsFailedRowsExport;
use App\Exports\Sheets\NeverAccessedUsersSheet;
use App\Exports\Sheets\ProjectManagementProjectsSheet;
use App\Imports\ProjectsImport;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsm;

class ProjectController extends Controller
{
    /**
     * Get all projects with pagination and filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Project::query()->with(['users', 'creator']);

        $scope = $request->get('scope');
        if ($scope === 'assigned') {
            $query->assignedTo($user);
        } elseif (!$user->hasGlobalProjectScope()) {
            $query->visibleTo($user);
        }

        // Search filter
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('location', 'like', "%{$search}%");
            });
        }

        // Status filter
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        // Pole filter
        if (($pole = $request->get('pole')) !== null && $pole !== '') {
            $query->where('pole', $pole);
        }

        // Date range filter
        if ($startDate = $request->get('start_date')) {
            $query->where('start_date', '>=', $startDate);
        }
        if ($endDate = $request->get('end_date')) {
            $query->where('end_date', '<=', $endDate);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->get('per_page', 15);
        $projects = $query->paginate($perPage);

        return $this->paginated($projects);
    }

    public function poles(Request $request)
    {
        $user = $request->user();
        $query = Project::query();
        $scope = $request->get('scope');

        if ($scope === 'assigned') {
            $query->assignedTo($user);
        } elseif (!$user->hasGlobalProjectScope()) {
            $query->visibleTo($user);
        }

        $values = $query
            ->whereNotNull('pole')
            ->where('pole', '!=', '')
            ->distinct()
            ->orderBy('pole')
            ->pluck('pole')
            ->values();

        return $this->success(['poles' => $values]);
    }

    public function downloadTemplate(Request $request)
    {
        try {
            if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
                return $this->error('XLSX export requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
            }
            $user = $request->user();
            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));
            $filename = 'SGTM-Projects-Template.xlsx';
            return Excel::download(new ProjectsTemplateExport(200, $lang), $filename);
        } catch (\Throwable $e) {
            Log::error('Projects template generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to generate template: ' . $e->getMessage(), 422);
        }
    }

    /**
     * Regional HSE Manager Project Management Excel export.
     * Same format as the admin export but:
     *  - Only projects from the user's pole
     *  - Only the projects sheet (no "never accessed users" sheet)
     */
    public function regionalManagementExport(Request $request)
    {
        $request->validate([
            'year' => 'nullable|integer|min:2020|max:2100',
            'lang' => 'nullable|string|in:en,fr',
        ]);

        try {
            if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
                return $this->error('XLSX export requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
            }

            $user = $request->user();
            if (!$user || !$user->isRegionalHseManager()) {
                return $this->error('Access denied', 403);
            }

            $pole = is_string($user->pole) ? trim($user->pole) : '';
            if ($pole === '') {
                return $this->error('Pole is required for regional export', 422);
            }

            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));
            $year = (int) ($request->get('year') ?: date('Y'));

            $templatePath = storage_path('app/templates/SGTM-Project-Management-Export-Template.xlsm');
            if (is_file($templatePath)) {
                $projectsSheet = new ProjectManagementProjectsSheet($year, $lang, $pole);

                $reader = IOFactory::createReader('Xlsm');
                $reader->setReadDataOnly(false);
                $spreadsheet = $reader->load($templatePath);
                if (method_exists($spreadsheet, 'setHasMacros')) {
                    $spreadsheet->setHasMacros(true);
                }

                $ws1 = $spreadsheet->getSheetCount() >= 1 ? $spreadsheet->getSheet(0) : $spreadsheet->createSheet(0);
                $ws1->setTitle($projectsSheet->title());
                $ws1->fromArray($projectsSheet->headings(), null, 'A1', true);
                $ws1->fromArray($projectsSheet->array(), null, 'A2', true);

                $ws1Styles = $projectsSheet->styles($ws1);
                if (is_array($ws1Styles) && isset($ws1Styles[1]) && is_array($ws1Styles[1])) {
                    $ws1->getStyle('A1:' . $ws1->getHighestColumn() . '1')->applyFromArray($ws1Styles[1]);
                }

                // Ensure there is only one sheet for the regional export
                while ($spreadsheet->getSheetCount() > 1) {
                    $spreadsheet->removeSheetByIndex(1);
                }

                $filename = 'SGTM-Project-Management-Export_' . $pole . '_' . $year . '_' . date('Y-m-d_His') . '.xlsm';

                return response()->streamDownload(function () use ($spreadsheet) {
                    $writer = new Xlsm($spreadsheet);
                    $writer->save('php://output');
                    $spreadsheet->disconnectWorksheets();
                    unset($spreadsheet);
                }, $filename, [
                    'Content-Type' => 'application/vnd.ms-excel.sheet.macroEnabled.12',
                ]);
            }

            $filename = 'SGTM-Project-Management-Export_' . $pole . '_' . $year . '_' . date('Y-m-d_His') . '.xlsx';
            return Excel::download(new ProjectManagementRegionalExport($year, $lang, $pole), $filename);
        } catch (\Throwable $e) {
            Log::error('Regional project management export failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to export: ' . $e->getMessage(), 422);
        }
    }

    /**
     * Admin-only Project Management Excel export.
     * Includes:
     *  - Sheet 1: Project summary + KPIs
     *  - Sheet 2: Users who never accessed app (must_change_password)
     */
    public function managementExport(Request $request)
    {
        $request->validate([
            'year' => 'nullable|integer|min:2020|max:2100',
            'lang' => 'nullable|string|in:en,fr',
        ]);

        try {
            if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
                return $this->error('XLSX export requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
            }

            $user = $request->user();
            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));
            $year = (int) ($request->get('year') ?: date('Y'));

            $templatePath = storage_path('app/templates/SGTM-Project-Management-Export-Template.xlsm');
            if (is_file($templatePath)) {
                $projectsSheet = new ProjectManagementProjectsSheet($year, $lang);
                $usersSheet = new NeverAccessedUsersSheet($lang);

                $reader = IOFactory::createReader('Xlsm');
                $reader->setReadDataOnly(false);
                $spreadsheet = $reader->load($templatePath);
                if (method_exists($spreadsheet, 'setHasMacros')) {
                    $spreadsheet->setHasMacros(true);
                }

                $ws1 = $spreadsheet->getSheetCount() >= 1 ? $spreadsheet->getSheet(0) : $spreadsheet->createSheet(0);
                $ws1->setTitle($projectsSheet->title());
                $ws1->fromArray($projectsSheet->headings(), null, 'A1', true);
                $ws1->fromArray($projectsSheet->array(), null, 'A2', true);

                $ws1Styles = $projectsSheet->styles($ws1);
                if (is_array($ws1Styles) && isset($ws1Styles[1]) && is_array($ws1Styles[1])) {
                    $ws1->getStyle('A1:' . $ws1->getHighestColumn() . '1')->applyFromArray($ws1Styles[1]);
                }

                $ws2 = $spreadsheet->getSheetCount() >= 2 ? $spreadsheet->getSheet(1) : $spreadsheet->createSheet(1);
                $ws2->setTitle($usersSheet->title());
                $ws2->fromArray($usersSheet->headings(), null, 'A1', true);

                $mappedUsers = [];
                foreach ($usersSheet->collection() as $u) {
                    $mappedUsers[] = $usersSheet->map($u);
                }
                if (!empty($mappedUsers)) {
                    $ws2->fromArray($mappedUsers, null, 'A2', true);
                }

                $ws2Styles = $usersSheet->styles($ws2);
                if (is_array($ws2Styles) && isset($ws2Styles[1]) && is_array($ws2Styles[1])) {
                    $ws2->getStyle('A1:' . $ws2->getHighestColumn() . '1')->applyFromArray($ws2Styles[1]);
                }

                $filename = 'SGTM-Project-Management-Export_' . $year . '_' . date('Y-m-d_His') . '.xlsm';

                return response()->streamDownload(function () use ($spreadsheet) {
                    $writer = new Xlsm($spreadsheet);
                    $writer->save('php://output');
                    $spreadsheet->disconnectWorksheets();
                    unset($spreadsheet);
                }, $filename, [
                    'Content-Type' => 'application/vnd.ms-excel.sheet.macroEnabled.12',
                ]);
            }

            $filename = 'SGTM-Project-Management-Export_' . $year . '_' . date('Y-m-d_His') . '.xlsx';
            return Excel::download(new ProjectManagementExport($year, $lang), $filename);
        } catch (\Throwable $e) {
            Log::error('Project management export failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to export: ' . $e->getMessage(), 422);
        }
    }

    public function bulkImport(Request $request)
    {
        @ini_set('max_execution_time', '300');
        @ini_set('memory_limit', '512M');

        if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
            return $this->error('XLSX import requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
        }

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $user = $request->user();

        try {
            $import = new ProjectsImport((int) $user->id);
            DB::beginTransaction();
            Excel::import($import, $request->file('file'));
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Projects bulk import failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to import projects: ' . $e->getMessage(), 422);
        }

        $errors = $import->getErrors();
        $failedRowsUrl = null;
        if (!empty($errors)) {
            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));
            $filename = 'projects_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
            $path = 'imports/failed_rows/' . $filename;
            $contents = Excel::raw(new ProjectsFailedRowsExport($errors, $lang), ExcelFormat::XLSX);
            Storage::disk('public')->put($path, $contents);
            $failedRowsUrl = '/api/imports/failed-rows/' . $filename;
        }

        return $this->success([
            'imported' => $import->getImportedCount(),
            'updated' => $import->getUpdatedCount(),
            'failed_count' => count($errors),
            'failed_rows_url' => $failedRowsUrl,
            'errors' => $errors,
        ], 'Projects imported');
    }

    /**
     * Create a new project
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:projects,code',
            'description' => 'nullable|string',
            'location' => 'nullable|string|max:255',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'status' => 'nullable|in:active,completed,on_hold,cancelled',
            'pole' => 'nullable|string|max:255',
            'client_name' => 'nullable|string|max:255',
            'is_grouping' => 'nullable|boolean',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'exists:users,id',
        ]);

        $project = Project::create([
            'name' => $request->name,
            'code' => $request->code,
            'description' => $request->description,
            'location' => $request->location,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'status' => $request->get('status', 'active'),
            'pole' => $request->pole,
            'client_name' => $request->client_name,
            'is_grouping' => (bool) $request->boolean('is_grouping', false),
            'created_by' => auth()->id(),
        ]);

        // Assign users if provided
        if ($request->has('user_ids')) {
            $project->users()->attach($request->user_ids, ['assigned_at' => now()]);
            
            // Notify assigned users
            foreach ($request->user_ids as $userId) {
                $user = User::find($userId);
                if ($user) {
                    NotificationService::projectAssigned($user, $project);
                }
            }
        }

        $project->load('users', 'creator');

        return $this->success($project, 'Project created successfully', 201);
    }

    /**
     * Get a specific project
     */
    public function show(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $project->load(['users', 'creator', 'kpiReports' => function ($q) {
            $q->latest()->limit(12);
        }]);

        // Add computed KPI summary
        $project->kpi_summary = [
            'total_accidents' => $project->kpiReports->sum('accidents'),
            'total_trainings' => $project->kpiReports->sum('trainings_conducted'),
            'total_inspections' => $project->kpiReports->sum('inspections_completed'),
            'avg_tf' => round($project->kpiReports->avg('tf_value'), 4),
            'avg_tg' => round($project->kpiReports->avg('tg_value'), 4),
            'total_hours_worked' => $project->kpiReports->sum('hours_worked'),
        ];

        return $this->success($project);
    }

    /**
     * Update a project
     */
    public function update(Request $request, Project $project)
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'sometimes|string|max:50|unique:projects,code,' . $project->id,
            'description' => 'nullable|string',
            'location' => 'nullable|string|max:255',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'status' => 'sometimes|in:active,completed,on_hold,cancelled',
            'pole' => 'nullable|string|max:255',
            'client_name' => 'nullable|string|max:255',
            'is_grouping' => 'nullable|boolean',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'exists:users,id',
        ]);

        $oldCode = (string) ($project->code ?? '');

        $payload = $request->only([
            'name', 'code', 'description', 'location',
            'start_date', 'end_date', 'status', 'pole', 'client_name', 'is_grouping'
        ]);
        if (array_key_exists('is_grouping', $payload)) {
            $payload['is_grouping'] = (bool) $request->boolean('is_grouping', false);
        }
        if (array_key_exists('code', $payload) && $payload['code'] !== null) {
            $payload['code'] = strtoupper(trim((string) $payload['code']));
        }

        DB::transaction(function () use ($request, $project, $payload, $oldCode) {
            $project->update($payload);

            $newCode = (string) ($project->code ?? '');
            if ($newCode !== '' && $oldCode !== '' && $newCode !== $oldCode) {
                try {
                    if (Schema::hasTable('project_code_aliases')) {
                        ProjectCodeAlias::firstOrCreate(
                            ['code' => $oldCode],
                            ['project_id' => $project->id, 'created_by' => auth()->id()]
                        );
                    }
                } catch (\Throwable $e) {
                    Log::warning('Failed to record project code alias', [
                        'project_id' => $project->id,
                        'old_code' => $oldCode,
                        'new_code' => $newCode,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Update user assignments if provided
            if ($request->has('user_ids')) {
                $currentUsers = $project->users->pluck('id')->toArray();
                $newUsers = array_diff($request->user_ids, $currentUsers);

                $project->users()->sync($request->user_ids);

                // Notify newly assigned users
                foreach ($newUsers as $userId) {
                    $user = User::find($userId);
                    if ($user) {
                        NotificationService::projectAssigned($user, $project);
                    }
                }
            }
        });

        $project->load('users', 'creator');

        return $this->success($project, 'Project updated successfully');
    }

    /**
     * Delete a project
     */
    public function destroy(Project $project)
    {
        $project->delete();

        return $this->success(null, 'Project deleted successfully');
    }

    /**
     * Get project statistics
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $query = Project::query();

        $scope = $request->get('scope');
        if ($scope === 'assigned') {
            $query->assignedTo($user);
        } elseif (!$user->hasGlobalProjectScope()) {
            $query->visibleTo($user);
        }

        $stats = [
            'total' => (clone $query)->count(),
            'active' => (clone $query)->where('status', 'active')->count(),
            'completed' => (clone $query)->where('status', 'completed')->count(),
            'on_hold' => (clone $query)->where('status', 'on_hold')->count(),
            'cancelled' => (clone $query)->where('status', 'cancelled')->count(),
        ];

        return $this->success($stats);
    }

    /**
     * Get project KPI trends
     */
    public function kpiTrends(Request $request, Project $project)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $months = $request->get('months', 12);
        
        $reports = $project->kpiReports()
            ->orderBy('report_year', 'desc')
            ->orderBy('report_month', 'desc')
            ->limit($months)
            ->get()
            ->reverse()
            ->values();

        return $this->success($reports);
    }

    /**
     * Get project zones
     */
    public function getZones(Project $project)
    {
        $user = request()->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        return $this->success([
            'zones' => $project->zones ?? []
        ]);
    }

    /**
     * Update project zones (for responsables)
     */
    public function updateZones(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        
        if (!$user->isAdminLike() && !$user->isResponsable() && !$user->isHseManager()) {
            return $this->error('Unauthorized', 403);
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        $request->validate([
            'zones' => 'required|array',
            'zones.*' => 'required|string|max:100',
        ]);

        // Remove duplicates and empty values
        $zones = array_values(array_unique(array_filter($request->zones)));

        $project->update(['zones' => $zones]);

        return $this->success([
            'message' => 'Zones updated successfully',
            'zones' => $project->zones
        ]);
    }

    /**
     * Add a zone to project
     */
    public function addZone(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        
        if (!$user->isAdminLike() && !$user->isResponsable() && !$user->isHseManager()) {
            return $this->error('Unauthorized', 403);
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        $request->validate([
            'zone' => 'required|string|max:100',
        ]);

        $zones = $project->zones ?? [];
        $newZone = trim($request->zone);

        if (!in_array($newZone, $zones)) {
            $zones[] = $newZone;
            $project->update(['zones' => $zones]);
        }

        return $this->success([
            'message' => 'Zone added successfully',
            'zones' => $project->zones
        ]);
    }

    /**
     * Remove a zone from project
     */
    public function removeZone(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        
        if (!$user->isAdminLike() && !$user->isResponsable() && !$user->isHseManager()) {
            return $this->error('Unauthorized', 403);
        }

        if (!$user->canAccessProject($project)) {
            return $this->error('You are not assigned to this project', 403);
        }

        $request->validate([
            'zone' => 'required|string',
        ]);

        $zones = $project->zones ?? [];
        $zones = array_values(array_filter($zones, fn($z) => $z !== $request->zone));
        
        $project->update(['zones' => $zones]);

        return $this->success([
            'message' => 'Zone removed successfully',
            'zones' => $project->zones
        ]);
    }
}
