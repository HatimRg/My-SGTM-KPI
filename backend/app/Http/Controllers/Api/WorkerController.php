<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Worker;
use App\Models\Project;
use App\Exports\WorkersExport;
use App\Exports\WorkersTemplateExport;
use App\Imports\WorkersImport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

class WorkerController extends Controller
{
    /**
     * Check if user can access workers management
     */
    private function checkAccess(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessWorkers()) {
            abort(403, 'You do not have access to workers management');
        }
        return $user;
    }

    /**
     * Get all workers with filters
     */
    public function index(Request $request)
    {
        $this->checkAccess($request);

        $query = Worker::with(['project:id,name,code', 'creator:id,name'])
            ->orderBy('nom')
            ->orderBy('prenom');

        // Apply filters
        if ($request->filled('search')) {
            $query->search($request->search);
        }

        if ($request->filled('project_id')) {
            $query->forProject($request->project_id);
        }

        if ($request->filled('entreprise')) {
            $query->forEnterprise($request->entreprise);
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Pagination
        $perPage = $request->input('per_page', 25);
        $workers = $query->paginate($perPage);

        return $this->success($workers);
    }

    /**
     * Get a single worker
     */
    public function show(Request $request, Worker $worker)
    {
        $this->checkAccess($request);

        $worker->load(['project:id,name,code', 'creator:id,name', 'updater:id,name']);

        return $this->success($worker);
    }

    /**
     * Create a new worker or merge if CIN exists
     */
    public function store(Request $request)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'prenom' => 'required|string|max:255',
            'fonction' => 'nullable|string|max:255',
            'cin' => 'required|string|max:50',
            'date_naissance' => 'nullable|date|before_or_equal:' . now()->subYears(18)->format('Y-m-d'),
            'entreprise' => 'nullable|string|max:255',
            'project_id' => 'nullable|exists:projects,id',
            'date_entree' => 'nullable|date',
            'is_active' => 'nullable|boolean',
        ], [
            'date_naissance.before_or_equal' => 'Le travailleur doit avoir au moins 18 ans / Worker must be at least 18 years old',
        ]);

        // Check if CIN exists and merge
        $existingWorker = Worker::where('cin', $validated['cin'])->first();
        $merged = false;

        if ($existingWorker) {
            // Reactivate worker if was inactive + update data
            $existingWorker->update(array_merge($validated, [
                'updated_by' => $user->id,
                'is_active' => $validated['is_active'] ?? true, // Reactivate by default
            ]));
            $worker = $existingWorker->fresh();
            $merged = true;
        } else {
            $worker = Worker::create(array_merge($validated, [
                'created_by' => $user->id,
                'updated_by' => $user->id,
                'is_active' => $validated['is_active'] ?? true,
            ]));
        }

        $worker->load(['project:id,name,code']);

        return $this->success([
            'worker' => $worker,
            'merged' => $merged,
        ], $merged ? 'Worker updated (CIN already existed)' : 'Worker created successfully', $merged ? 200 : 201);
    }

    /**
     * Update a worker
     */
    public function update(Request $request, Worker $worker)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'nom' => 'sometimes|string|max:255',
            'prenom' => 'sometimes|string|max:255',
            'fonction' => 'nullable|string|max:255',
            'cin' => 'sometimes|string|max:50|unique:workers,cin,' . $worker->id,
            'date_naissance' => 'nullable|date|before_or_equal:' . now()->subYears(18)->format('Y-m-d'),
            'entreprise' => 'nullable|string|max:255',
            'project_id' => 'nullable|exists:projects,id',
            'date_entree' => 'nullable|date',
            'is_active' => 'sometimes|boolean',
        ], [
            'date_naissance.before_or_equal' => 'Le travailleur doit avoir au moins 18 ans / Worker must be at least 18 years old',
        ]);

        $worker->update(array_merge($validated, ['updated_by' => $user->id]));
        $worker->load(['project:id,name,code']);

        return $this->success($worker, 'Worker updated successfully');
    }

    /**
     * Delete a worker (soft - just deactivate)
     */
    public function destroy(Request $request, Worker $worker)
    {
        $user = $this->checkAccess($request);

        // Don't actually delete, just deactivate
        $worker->update([
            'is_active' => false,
            'updated_by' => $user->id,
        ]);

        return $this->success(null, 'Worker deactivated successfully');
    }

    /**
     * Bulk deactivate workers
     */
    public function bulkDeactivate(Request $request)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'worker_ids' => 'required|array|min:1',
            'worker_ids.*' => 'exists:workers,id',
        ]);

        $count = Worker::whereIn('id', $validated['worker_ids'])
            ->update([
                'is_active' => false,
                'updated_by' => $user->id,
                'updated_at' => now(),
            ]);

        return $this->success([
            'deactivated_count' => $count,
        ], "{$count} workers deactivated successfully");
    }

    /**
     * Bulk activate workers
     */
    public function bulkActivate(Request $request)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'worker_ids' => 'required|array|min:1',
            'worker_ids.*' => 'exists:workers,id',
        ]);

        $count = Worker::whereIn('id', $validated['worker_ids'])
            ->update([
                'is_active' => true,
                'updated_by' => $user->id,
                'updated_at' => now(),
            ]);

        return $this->success([
            'activated_count' => $count,
        ], "{$count} workers activated successfully");
    }

    /**
     * Import workers from Excel
     */
    public function import(Request $request)
    {
        $user = $this->checkAccess($request);

        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv|max:10240',
            'project_id' => 'nullable|exists:projects,id',
        ]);

        try {
            $import = new WorkersImport($user->id, $request->project_id);
            Excel::import($import, $request->file('file'));

            return $this->success([
                'imported_count' => $import->getRowCount(),
                'merged_count' => $import->getMergedCount(),
                'errors' => $import->getErrors(),
            ], 'Workers imported successfully');
        } catch (\Exception $e) {
            return $this->error('Import failed: ' . $e->getMessage(), 422);
        }
    }

    /**
     * Export workers to Excel
     */
    public function export(Request $request)
    {
        $this->checkAccess($request);

        $filters = $request->only(['project_id', 'entreprise', 'is_active', 'search']);

        return Excel::download(
            new WorkersExport($filters),
            'workers_' . date('Y-m-d_His') . '.xlsx'
        );
    }

    /**
     * Download import template
     */
    public function template(Request $request)
    {
        $user = $this->checkAccess($request);

        // Get user's related projects for dropdown
        $projects = [];
        
        if ($user->isAdmin()) {
            // Admin sees all projects
            $projects = \App\Models\Project::orderBy('name')->pluck('name')->toArray();
        } else {
            // Get projects user is assigned to or manages
            $userProjects = $user->projects()->orderBy('name')->pluck('name')->toArray();
            $teamProjects = $user->teamProjects()->orderBy('name')->pluck('name')->toArray();
            $projects = array_unique(array_merge($userProjects, $teamProjects));
            sort($projects);
        }

        return Excel::download(
            new WorkersTemplateExport($projects),
            'modele_travailleurs_hse.xlsx'
        );
    }

    /**
     * Get statistics
     */
    public function statistics(Request $request)
    {
        $this->checkAccess($request);

        $stats = [
            'total' => Worker::count(),
            'active' => Worker::active()->count(),
            'inactive' => Worker::inactive()->count(),
            'hse_team' => Worker::active()
                ->whereRaw('LOWER(fonction) LIKE ?', ['%hse%'])
                ->count(),
            'by_project' => Worker::active()
                ->select('project_id', DB::raw('count(*) as count'))
                ->groupBy('project_id')
                ->with('project:id,name,code')
                ->get(),
            'by_entreprise' => Worker::active()
                ->select('entreprise', DB::raw('count(*) as count'))
                ->whereNotNull('entreprise')
                ->groupBy('entreprise')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
        ];

        return $this->success($stats);
    }

    /**
     * Get unique entreprises for filter dropdown
     */
    public function entreprises(Request $request)
    {
        $this->checkAccess($request);

        $entreprises = Worker::whereNotNull('entreprise')
            ->where('entreprise', '!=', '')
            ->distinct()
            ->orderBy('entreprise')
            ->pluck('entreprise');

        return $this->success($entreprises);
    }

    /**
     * Get unique fonctions (job titles) for autocomplete
     */
    public function fonctions(Request $request)
    {
        $this->checkAccess($request);

        $fonctions = Worker::whereNotNull('fonction')
            ->where('fonction', '!=', '')
            ->distinct()
            ->orderBy('fonction')
            ->pluck('fonction');

        return $this->success($fonctions);
    }
}
