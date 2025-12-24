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
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
        $user = $this->checkAccess($request);

        $query = Worker::with(['project:id,name,code', 'creator:id,name'])
            ->orderBy('nom')
            ->orderBy('prenom');

        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null) {
            $query->whereIn('project_id', $visibleProjectIds);
        }

        // Apply filters
        if ($request->filled('search')) {
            $query->search($request->search);
        }

        if ($request->filled('project_id')) {
            $query->forProject($request->project_id);
        }

        if (($pole = $request->get('pole')) !== null && $pole !== '') {
            $query->whereHas('project', function ($q) use ($pole) {
                $q->where('pole', $pole);
            });
        }

        if ($request->filled('entreprise')) {
            $query->forEnterprise($request->entreprise);
        }

        if ($request->filled('fonction')) {
            $query->where('fonction', 'like', '%' . $request->fonction . '%');
        }

        if ($request->filled('training_type')) {
            $trainingType = $request->get('training_type');
            $trainingLabel = $request->get('training_label');
            $query->whereHas('trainings', function ($q) use ($trainingType, $trainingLabel) {
                $q->where('training_type', $trainingType);
                if ($trainingLabel !== null && $trainingLabel !== '') {
                    $q->where('training_label', $trainingLabel);
                }
            });
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
        $user = $this->checkAccess($request);

        if ($worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        }

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

        if (!empty($validated['project_id'])) {
            $project = Project::findOrFail($validated['project_id']);
            if (!$user->canAccessProject($project)) {
                abort(403, 'You do not have access to this project');
            }
        }

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

        if ($worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        }

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

        if (array_key_exists('project_id', $validated) && !empty($validated['project_id'])) {
            $project = Project::findOrFail($validated['project_id']);
            if (!$user->canAccessProject($project)) {
                abort(403, 'You do not have access to this project');
            }
        }

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

        if ($worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        }

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

        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null) {
            $outsideCount = Worker::whereIn('id', $validated['worker_ids'])
                ->whereNotNull('project_id')
                ->whereNotIn('project_id', $visibleProjectIds)
                ->count();
            if ($outsideCount > 0) {
                abort(403, 'Access denied');
            }
        }

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

        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null) {
            $outsideCount = Worker::whereIn('id', $validated['worker_ids'])
                ->whereNotNull('project_id')
                ->whereNotIn('project_id', $visibleProjectIds)
                ->count();
            if ($outsideCount > 0) {
                abort(403, 'Access denied');
            }
        }

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

        @ini_set('max_execution_time', '300');

        $file = $request->file('file');
        if ($file) {
            $ext = strtolower($file->getClientOriginalExtension() ?? '');
            // XLSX requires ZipArchive (php-zip). Without it, PhpSpreadsheet cannot open the file.
            if ($ext === 'xlsx' && !class_exists(\ZipArchive::class)) {
                return $this->error(
                    'XLSX import requires the PHP ZipArchive extension (php-zip). Enable php_zip and restart PHP, or export/upload as CSV instead.',
                    422
                );
            }
        }

        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv|max:10240',
            'project_id' => 'nullable|exists:projects,id',
        ]);

        if ($request->filled('project_id')) {
            $project = Project::findOrFail($request->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'You do not have access to this project');
            }
        }

        try {
            $allowedProjectIds = $user->visibleProjectIds();
            $allowNoProject = $user->hasGlobalProjectScope();

            $import = new WorkersImport(
                $user->id,
                $request->project_id,
                $allowedProjectIds,
                $allowNoProject
            );
            Excel::import($import, $request->file('file'));

            return $this->success([
                'imported_count' => $import->getRowCount(),
                'merged_count' => $import->getMergedCount(),
                'errors' => $import->getErrors(),
            ], 'Workers imported successfully');
        } catch (\Throwable $e) {
            return $this->error('Import failed: ' . $e->getMessage(), 422);
        }
    }

    /**
     * Export workers to Excel
     */
    public function export(Request $request)
    {
        $user = $this->checkAccess($request);

        $filters = $request->only(['project_id', 'entreprise', 'fonction', 'is_active', 'search']);

        if ($request->filled('is_active')) {
            $filters['is_active'] = $request->boolean('is_active');
        }

        $filterLabels = [];

        if (!empty($filters['project_id'])) {
            $project = Project::findOrFail($filters['project_id']);
            if (!$user->canAccessProject($project)) {
                abort(403, 'You do not have access to this project');
            }
            $projectName = Project::where('id', $filters['project_id'])->value('name');
            if (!empty($projectName)) {
                $filterLabels[] = $projectName;
            }
        }

        if (!empty($filters['entreprise'])) {
            $filterLabels[] = $filters['entreprise'];
        }

        if (!empty($filters['fonction'])) {
            $filterLabels[] = $filters['fonction'];
        }

        if (!empty($filters['search'])) {
            $filterLabels[] = $filters['search'];
        }

        if (empty($filterLabels) && (!isset($filters['is_active']) || $filters['is_active'] === true)) {
            $filterLabels[] = 'active';
        }

        $filterPart = implode(', ', $filterLabels);
        $datePart = date('d-m-Y');
        $isZipAvailable = class_exists(\ZipArchive::class);
        $filenameBase = 'Workers_export_(' . $filterPart . ')_date(' . $datePart . ')';

        $xlsxFilename = $filenameBase . '.xlsx';
        $csvFilename = $filenameBase . '.csv';

        $xlsxFilename = preg_replace('~[\\\\/:*?"<>|]~', '-', $xlsxFilename);
        $xlsxFilename = preg_replace('~\s+~', ' ', $xlsxFilename);
        $csvFilename = preg_replace('~[\\\\/:*?"<>|]~', '-', $csvFilename);
        $csvFilename = preg_replace('~\s+~', ' ', $csvFilename);

        // Prefer XLSX when ZipArchive is available, but ALWAYS fall back to CSV to avoid hard 500s.
        // Use Excel::raw() (in-memory) instead of Excel::download() to ensure any exception is catchable
        // and to avoid filesystem/temporary-file streaming issues during response sending.
        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null) {
            if ($visibleProjectIds instanceof \Illuminate\Support\Collection) {
                $visibleProjectIds = $visibleProjectIds->all();
            } elseif ($visibleProjectIds instanceof \Traversable) {
                $visibleProjectIds = iterator_to_array($visibleProjectIds);
            }
            $filters['visible_project_ids'] = $visibleProjectIds;
        }

        if ($isZipAvailable) {
            try {
                if (ob_get_length() > 0) {
                    ob_end_clean();
                }

                $contents = Excel::raw(new WorkersExport($filters), ExcelFormat::XLSX);

                return response($contents, 200, [
                    'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition' => 'attachment; filename="' . $xlsxFilename . '"',
                ]);
            } catch (\Throwable $e) {
                // Fall back to CSV streaming
            }
        }

        $response = new StreamedResponse(function () use ($filters) {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            try {
                // UTF-8 BOM for Excel compatibility
                fwrite($handle, "\xEF\xBB\xBF");

                fputcsv($handle, [
                    'NOM',
                    'PRENOM',
                    'FONCTION',
                    'CIN',
                    'DATE DE NAISSANCE',
                    'ENTREPRISE',
                    'PROJET',
                    "DATE D'ENTREE",
                    'STATUT',
                ]);

                $query = Worker::with('project:id,name,code')
                    ->orderBy('nom')
                    ->orderBy('prenom');

                if (array_key_exists('visible_project_ids', $filters) && is_array($filters['visible_project_ids'])) {
                    if (count($filters['visible_project_ids']) === 0) {
                        return;
                    }
                    $query->whereIn('project_id', $filters['visible_project_ids']);
                }

                if (!empty($filters['search'])) {
                    $query->search($filters['search']);
                }

                if (!empty($filters['project_id'])) {
                    $query->forProject($filters['project_id']);
                }

                if (!empty($filters['entreprise'])) {
                    $query->forEnterprise($filters['entreprise']);
                }

                if (!empty($filters['fonction'])) {
                    $query->where('fonction', 'like', '%' . $filters['fonction'] . '%');
                }

                if (isset($filters['is_active'])) {
                    $query->where('is_active', $filters['is_active']);
                }

                $query->chunk(1000, function ($workers) use ($handle) {
                    foreach ($workers as $worker) {
                        fputcsv($handle, [
                            $worker->nom,
                            $worker->prenom,
                            $worker->fonction,
                            $worker->cin,
                            $worker->date_naissance ? $worker->date_naissance->format('d/m/Y') : '',
                            $worker->entreprise,
                            $worker->project ? $worker->project->name : '',
                            $worker->date_entree ? $worker->date_entree->format('d/m/Y') : '',
                            $worker->is_active ? 'Actif' : 'Inactif',
                        ]);
                    }
                });
            } catch (\Throwable $e) {
                // Keep the response successful to avoid a 500, but make the failure visible.
                fputcsv($handle, ['EXPORT_ERROR', $e->getMessage()]);
            } finally {
                fclose($handle);
            }
        });

        $response->headers->set('Content-Type', 'text/csv; charset=UTF-8');
        $response->headers->set('Content-Disposition', 'attachment; filename="' . $csvFilename . '"');

        return $response;
    }

    /**
     * Download import template
     */
    public function template(Request $request)
    {
        $user = $this->checkAccess($request);

        // Get user's related projects for dropdown
        $projects = [];
        
        if ($user->hasGlobalProjectScope()) {
            // Global scope sees all projects
            $projects = \App\Models\Project::orderBy('name')->pluck('name')->toArray();
        } else {
            // Directors and scoped roles: only visible projects
            $projects = \App\Models\Project::query()->visibleTo($user)->orderBy('name')->pluck('name')->toArray();
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
        $user = $this->checkAccess($request);

        $visibleProjectIds = $user->visibleProjectIds();
        $base = Worker::query();
        if ($visibleProjectIds !== null) {
            $base->whereIn('project_id', $visibleProjectIds);
        }

        $stats = [
            'total' => (clone $base)->count(),
            'active' => (clone $base)->where('is_active', true)->count(),
            'inactive' => (clone $base)->where('is_active', false)->count(),
            'hse_team' => (clone $base)->where('is_active', true)
                ->whereRaw('LOWER(fonction) LIKE ?', ['%hse%'])
                ->count(),
            'induction_hse' => (clone $base)->where('is_active', true)
                ->whereHas('trainings', function ($q) {
                    $q->where('training_type', 'induction_hse');
                })
                ->count(),
            'travail_en_hauteur' => (clone $base)->where('is_active', true)
                ->whereHas('trainings', function ($q) {
                    $q->where('training_type', 'travail_en_hauteur');
                })
                ->count(),
            'aptitude_physique' => (clone $base)->where('is_active', true)
                ->whereHas('trainings', function ($q) {
                    $q->where('training_type', 'aptitude_physique');
                })
                ->count(),
            'by_project' => (clone $base)->where('is_active', true)
                ->select('project_id', DB::raw('count(*) as count'))
                ->groupBy('project_id')
                ->with('project:id,name,code')
                ->get(),
            'by_entreprise' => (clone $base)->where('is_active', true)
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
        $user = $this->checkAccess($request);

        $query = Worker::whereNotNull('entreprise')
            ->where('entreprise', '!=', '')
            ->when($user->visibleProjectIds() !== null, function ($q) use ($user) {
                $q->whereIn('project_id', $user->visibleProjectIds());
            })
            ->distinct()
            ->orderBy('entreprise')
            ->pluck('entreprise');

        return $this->success($query);
    }

    /**
     * Get unique fonctions (job titles) for autocomplete
     */
    public function fonctions(Request $request)
    {
        $user = $this->checkAccess($request);

        $query = Worker::whereNotNull('fonction')
            ->where('fonction', '!=', '')
            ->when($user->visibleProjectIds() !== null, function ($q) use ($user) {
                $q->whereIn('project_id', $user->visibleProjectIds());
            })
            ->distinct()
            ->orderBy('fonction')
            ->pluck('fonction');

        return $this->success($query);
    }
}
