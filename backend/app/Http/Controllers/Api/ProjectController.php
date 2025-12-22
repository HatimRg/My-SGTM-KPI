<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\ProjectsTemplateExport;
use App\Imports\ProjectsImport;

class ProjectController extends Controller
{
    /**
     * Get all projects with pagination and filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Project::query()->with(['users', 'creator']);

        // For non-admin users, only show assigned projects
        if (!$user->isAdmin()) {
            $query->forUser($user);
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
        if ($user && !$user->isAdmin()) {
            $query->forUser($user);
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
            $filename = 'SGTM-Projects-Template.xlsx';
            return Excel::download(new ProjectsTemplateExport(), $filename);
        } catch (\Throwable $e) {
            Log::error('Projects template generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to generate template: ' . $e->getMessage(), 422);
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

        return $this->success([
            'imported' => $import->getImportedCount(),
            'updated' => $import->getUpdatedCount(),
            'errors' => $import->getErrors(),
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

        // Check access for non-admin users
        if (!$user->isAdmin() && !$project->users->contains($user->id)) {
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
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'exists:users,id',
        ]);

        $project->update($request->only([
            'name', 'code', 'description', 'location',
            'start_date', 'end_date', 'status', 'pole', 'client_name'
        ]));

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

        if (!$user->isAdmin()) {
            $query->forUser($user);
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
        
        // Check if user is admin or responsable for this project
        if (!$user->isAdmin() && !$user->isResponsable()) {
            return $this->error('Unauthorized', 403);
        }

        // For responsables, check if they are assigned to this project
        if ($user->isResponsable() && !$project->users()->where('users.id', $user->id)->exists()) {
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
        
        if (!$user->isAdmin() && !$user->isResponsable()) {
            return $this->error('Unauthorized', 403);
        }

        if ($user->isResponsable() && !$project->users()->where('users.id', $user->id)->exists()) {
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
        
        if (!$user->isAdmin() && !$user->isResponsable()) {
            return $this->error('Unauthorized', 403);
        }

        if ($user->isResponsable() && !$project->users()->where('users.id', $user->id)->exists()) {
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
