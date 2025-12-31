<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Worker;
use App\Models\Project;
use App\Exports\WorkersExport;
use App\Exports\WorkersTemplateExport;
use App\Imports\WorkersImport;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorkerController extends Controller
{
    /**
     * Shared access guard for Workers Management.
     *
     * This matches the access pattern used in WorkerTraining/Qualification/Medical controllers.
     */
    private function checkAccess(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->canAccessWorkers()) {
            abort(403, 'You do not have access to workers management');
        }
        return $user;
    }

    private function normalizeProjectIds($ids): ?array
    {
        if ($ids === null) {
            return null;
        }
        if ($ids instanceof \Illuminate\Support\Collection) {
            return $ids->all();
        }
        if ($ids instanceof \Traversable) {
            return iterator_to_array($ids);
        }
        return is_array($ids) ? $ids : null;
    }

    /**
     * Ensure the authenticated user can access the worker based on project visibility.
     */
    private function ensureWorkerAccess(Request $request, Worker $worker): void
    {
        $user = $this->checkAccess($request);
        $visibleProjectIds = $this->normalizeProjectIds($user->visibleProjectIds());
        if ($visibleProjectIds !== null && !in_array((int) $worker->project_id, array_map('intval', $visibleProjectIds), true)) {
            abort(403, 'Access denied');
        }
    }

    /**
     * Get all workers with filters
     */
    public function index(Request $request)
    {
        $user = $this->checkAccess($request);

        $query = Worker::with('project:id,name,code,pole')
            ->orderBy('nom')
            ->orderBy('prenom')
            ->orderBy('id');

        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null) {
            $query->whereIn('project_id', $visibleProjectIds);
        }

        // Keep worker list/export/statistics perfectly aligned by applying the same filter scope.
        $query->applyFilters([
            'visible_project_ids' => $visibleProjectIds,
            'search' => $request->get('search'),
            'project_id' => $request->get('project_id'),
            'pole' => $request->get('pole'),
            'entreprise' => $request->get('entreprise'),
            'fonction' => $request->get('fonction'),
            'is_active' => $request->has('is_active') && $request->get('is_active') !== ''
                ? filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN)
                : null,
            // New advanced filters
            'training_type' => $request->get('training_type'),
            'training_label' => $request->get('training_label'),
            'training_presence' => $request->get('training_presence'),
            'training_expiry' => $request->get('training_expiry'),
            'qualification_type' => $request->get('qualification_type'),
            'qualification_presence' => $request->get('qualification_presence'),
            'qualification_expiry' => $request->get('qualification_expiry'),
            'medical_presence' => $request->get('medical_presence'),
            'medical_status' => $request->get('medical_status'),
            'medical_expiry' => $request->get('medical_expiry'),
            'expired_filter' => $request->get('expired_filter'),
        ]);

        // Pagination
        $perPage = $request->input('per_page', 25);
        $workers = $query->paginate($perPage);

        return $this->success($workers);
    }

    /**
     * Get a single worker.
     */
    public function show(Request $request, Worker $worker)
    {
        $this->ensureWorkerAccess($request, $worker);
        $worker->load('project:id,name,code,pole');
        return $this->success($worker);
    }

    /**
     * Create a worker (or merge by CIN when CIN already exists).
     */
    public function store(Request $request)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'nom' => 'required|string|max:255',
            'prenom' => 'required|string|max:255',
            'fonction' => 'nullable|string|max:255',
            'cin' => 'required|string|max:50',
            'date_naissance' => 'nullable|date',
            'entreprise' => 'nullable|string|max:255',
            'project_id' => 'nullable|exists:projects,id',
            'date_entree' => 'nullable|date',
            'is_active' => 'boolean',
        ]);

        if (!empty($validated['project_id'])) {
            $project = Project::findOrFail($validated['project_id']);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        }

        $validated['cin'] = strtoupper(trim((string) $validated['cin']));
        $worker = Worker::findOrMergeByCin($validated, (int) $user->id);
        $worker->load('project:id,name,code,pole');

        return $this->success($worker, 'Worker saved successfully', 201);
    }

    /**
     * Update a worker.
     */
    public function update(Request $request, Worker $worker)
    {
        $user = $this->checkAccess($request);
        $this->ensureWorkerAccess($request, $worker);

        $validated = $request->validate([
            'nom' => 'sometimes|required|string|max:255',
            'prenom' => 'sometimes|required|string|max:255',
            'fonction' => 'nullable|string|max:255',
            'cin' => [
                'sometimes',
                'required',
                'string',
                'max:50',
                Rule::unique('workers', 'cin')->ignore($worker->id),
            ],
            'date_naissance' => 'nullable|date',
            'entreprise' => 'nullable|string|max:255',
            'project_id' => 'nullable|exists:projects,id',
            'date_entree' => 'nullable|date',
            'is_active' => 'boolean',
        ]);

        if (array_key_exists('project_id', $validated) && !empty($validated['project_id'])) {
            $project = Project::findOrFail($validated['project_id']);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        }

        if (array_key_exists('cin', $validated)) {
            $validated['cin'] = strtoupper(trim((string) $validated['cin']));
        }
        $validated['updated_by'] = (int) $user->id;

        $worker->update($validated);
        $worker->load('project:id,name,code,pole');

        return $this->success($worker, 'Worker updated successfully');
    }

    /**
     * Delete a worker.
     */
    public function destroy(Request $request, Worker $worker)
    {
        $this->ensureWorkerAccess($request, $worker);
        $worker->delete();
        return $this->success(null, 'Worker deleted successfully');
    }

    /**
     * Bulk deactivate workers.
     */
    public function bulkDeactivate(Request $request)
    {
        $user = $this->checkAccess($request);
        $validated = $request->validate([
            'worker_ids' => 'required|array|min:1',
            'worker_ids.*' => 'integer|exists:workers,id',
        ]);

        $visibleProjectIds = $user->visibleProjectIds();
        $query = Worker::query()->whereIn('id', $validated['worker_ids']);
        if ($visibleProjectIds !== null) {
            $query->whereIn('project_id', $visibleProjectIds);
        }

        $count = (clone $query)->count();
        $query->update(['is_active' => false, 'updated_by' => (int) $user->id]);

        return $this->success(['deactivated_count' => $count], 'Workers deactivated successfully');
    }

    /**
     * Bulk activate workers.
     */
    public function bulkActivate(Request $request)
    {
        $user = $this->checkAccess($request);
        $validated = $request->validate([
            'worker_ids' => 'required|array|min:1',
            'worker_ids.*' => 'integer|exists:workers,id',
        ]);

        $visibleProjectIds = $user->visibleProjectIds();
        $query = Worker::query()->whereIn('id', $validated['worker_ids']);
        if ($visibleProjectIds !== null) {
            $query->whereIn('project_id', $visibleProjectIds);
        }

        $count = (clone $query)->count();
        $query->update(['is_active' => true, 'updated_by' => (int) $user->id]);

        return $this->success(['activated_count' => $count], 'Workers activated successfully');
    }

    /**
     * Download the Excel import template.
     */
    public function template(Request $request)
    {
        $user = $this->checkAccess($request);

        if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
            return $this->error('ZipArchive extension is required to generate Excel templates', 500);
        }

        $projects = Project::query()
            ->visibleTo($user)
            ->active()
            ->orderBy('code')
            ->pluck('name')
            ->all();

        $filename = 'workers_template.xlsx';
        $contents = Excel::raw(new WorkersTemplateExport($projects), ExcelFormat::XLSX);

        return response($contents, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Import workers from an Excel file.
     */
    public function import(Request $request)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'file' => 'required|file',
            'project_id' => 'nullable|exists:projects,id',
        ]);

        $projectId = !empty($validated['project_id']) ? (int) $validated['project_id'] : null;
        if ($projectId) {
            $project = Project::findOrFail($projectId);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        }

        $visibleProjectIds = $user->visibleProjectIds();
        $allowNoProject = $visibleProjectIds === null;

        $import = new WorkersImport((int) $user->id, $projectId, $visibleProjectIds, $allowNoProject);
        Excel::import($import, $validated['file']);

        return $this->success([
            'imported' => $import->getRowCount(),
            'merged' => $import->getMergedCount(),
            'errors' => $import->getErrors(),
        ], 'Import completed');
    }

    /**
     * View worker image.
     *
     * 404 is returned when the worker has no image or the file was removed.
     */
    public function viewImage(Request $request, Worker $worker)
    {
        $this->ensureWorkerAccess($request, $worker);

        try {
            if (!$worker->image_path || !Storage::disk('public')->exists($worker->image_path)) {
                abort(404, 'Worker image not found');
            }

            $path = Storage::disk('public')->path($worker->image_path);
            $mime = Storage::disk('public')->mimeType($worker->image_path) ?? 'image/jpeg';

            return response()->file($path, [
                'Content-Type' => $mime,
                'Cache-Control' => 'public, max-age=86400',
            ]);
        } catch (\Throwable $e) {
            abort(404, 'Worker image not found');
        }
    }

    /**
     * Upload/replace worker image.
     */
    public function uploadImage(Request $request, Worker $worker)
    {
        $user = $this->checkAccess($request);
        $this->ensureWorkerAccess($request, $worker);

        $validated = $request->validate([
            'image' => 'required|file|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        /** @var UploadedFile $file */
        $file = $validated['image'];

        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $filename = 'workers/' . $worker->id . '/image_' . Str::random(8) . '.' . $ext;

        // Remove previous image when present.
        if ($worker->image_path) {
            Storage::disk('public')->delete($worker->image_path);
        }

        Storage::disk('public')->putFileAs('', $file, $filename);
        $worker->update([
            'image_path' => $filename,
            'updated_by' => (int) $user->id,
        ]);

        return $this->success(['image_path' => $filename], 'Image uploaded successfully');
    }

    /**
     * Export workers to Excel
     */
    public function export(Request $request)
    {
        $user = $this->checkAccess($request);

        $filters = [
            'visible_project_ids' => $user->visibleProjectIds(),
            'search' => $request->get('search'),
            'project_id' => $request->get('project_id'),
            'pole' => $request->get('pole'),
            'entreprise' => $request->get('entreprise'),
            'fonction' => $request->get('fonction'),
            'is_active' => ($request->has('is_active') && $request->get('is_active') !== '')
                ? filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN)
                : null,
            // New advanced filters
            'training_type' => $request->get('training_type'),
            'training_label' => $request->get('training_label'),
            'training_presence' => $request->get('training_presence'),
            'training_expiry' => $request->get('training_expiry'),
            'qualification_type' => $request->get('qualification_type'),
            'qualification_presence' => $request->get('qualification_presence'),
            'qualification_expiry' => $request->get('qualification_expiry'),
            'medical_presence' => $request->get('medical_presence'),
            'medical_status' => $request->get('medical_status'),
            'medical_expiry' => $request->get('medical_expiry'),
            'expired_filter' => $request->get('expired_filter'),
        ];

        // Export uses the same filter payload as the list so "Export" always matches what the user is seeing.
        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null) {
            if ($visibleProjectIds instanceof \Illuminate\Support\Collection) {
                $visibleProjectIds = $visibleProjectIds->all();
            } elseif ($visibleProjectIds instanceof \Traversable) {
                $visibleProjectIds = iterator_to_array($visibleProjectIds);
            }
            $filters['visible_project_ids'] = $visibleProjectIds;
        }

        $isZipAvailable = class_exists(\ZipArchive::class);

        // Build a stable filename without triggering warnings (some filters are arrays / booleans).
        $filenameParts = [];
        foreach ([
            'pole',
            'project_id',
            'entreprise',
            'fonction',
            'search',
            'training_type',
            'training_presence',
            'qualification_type',
            'qualification_presence',
            'medical_presence',
            'medical_status',
            'expired_filter',
            'is_active',
        ] as $key) {
            if (!array_key_exists($key, $filters)) {
                continue;
            }
            $value = $filters[$key];
            if ($value === null || $value === '') {
                continue;
            }
            if (is_bool($value)) {
                $filenameParts[] = $key . ':' . ($value ? '1' : '0');
                continue;
            }
            if (is_scalar($value)) {
                $filenameParts[] = $key . ':' . (string) $value;
            }
        }
        $filenameBase = 'Workers_export_(' . (count($filenameParts) ? implode(', ', $filenameParts) : 'all') . ')_date(' . date('d-m-Y') . ')';

        $xlsxFilename = $filenameBase . '.xlsx';
        $csvFilename = $filenameBase . '.csv';

        $xlsxFilename = preg_replace('~[\\\\/:*?"<>|]~', '-', $xlsxFilename);
        $xlsxFilename = preg_replace('~\s+~', ' ', $xlsxFilename);
        $csvFilename = preg_replace('~[\\\\/:*?"<>|]~', '-', $csvFilename);
        $csvFilename = preg_replace('~\s+~', ' ', $csvFilename);

        // Prefer XLSX when ZipArchive is available, but ALWAYS fall back to CSV to avoid hard 500s.
        // Use Excel::raw() (in-memory) instead of Excel::download() to ensure any exception is catchable
        // and to avoid filesystem/temporary-file streaming issues during response sending.
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

                $query->applyFilters($filters);

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

        // Apply the same list filters to stats so the cards always reflect the current view.
        $base->applyFilters([
            'visible_project_ids' => $visibleProjectIds,
            'search' => $request->get('search'),
            'project_id' => $request->get('project_id'),
            'pole' => $request->get('pole'),
            'entreprise' => $request->get('entreprise'),
            'fonction' => $request->get('fonction'),
            'is_active' => $request->has('is_active') && $request->get('is_active') !== ''
                ? filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN)
                : null,
            'training_type' => $request->get('training_type'),
            'training_label' => $request->get('training_label'),
            'training_presence' => $request->get('training_presence'),
            'training_expiry' => $request->get('training_expiry'),
            'qualification_type' => $request->get('qualification_type'),
            'qualification_presence' => $request->get('qualification_presence'),
            'qualification_expiry' => $request->get('qualification_expiry'),
            'medical_presence' => $request->get('medical_presence'),
            'medical_status' => $request->get('medical_status'),
            'medical_expiry' => $request->get('medical_expiry'),
            'expired_filter' => $request->get('expired_filter'),
        ]);

        $today = now()->startOfDay();

        $stats = [
            'total' => (clone $base)->count(),
            'active' => (clone $base)->where('is_active', true)->count(),
            'inactive' => (clone $base)->where('is_active', false)->count(),
            'hse_team' => (clone $base)->where('is_active', true)
                ->whereRaw('LOWER(fonction) LIKE ?', ['%hse%'])
                ->count(),
            'induction_hse' => (clone $base)->where('is_active', true)
                ->whereHas('trainings', function ($q) use ($today) {
                    $q->where('training_type', 'induction_hse')
                        ->where(function ($d) use ($today) {
                            $d->whereNull('expiry_date')
                                ->orWhere('expiry_date', '>=', $today);
                        });
                })
                ->count(),
            'travail_en_hauteur' => (clone $base)->where('is_active', true)
                ->whereHas('trainings', function ($q) use ($today) {
                    $q->where('training_type', 'travail_en_hauteur')
                        ->where(function ($d) use ($today) {
                            $d->whereNull('expiry_date')
                                ->orWhere('expiry_date', '>=', $today);
                        });
                })
                ->count(),
            'medical_aptitude' => (clone $base)->where('is_active', true)
                ->whereHas('medicalAptitudes', function ($q) use ($today) {
                    $q->where('aptitude_status', 'apte')
                        ->where(function ($d) use ($today) {
                            $d->whereNull('expiry_date')
                                ->orWhere('expiry_date', '>=', $today);
                        });
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
