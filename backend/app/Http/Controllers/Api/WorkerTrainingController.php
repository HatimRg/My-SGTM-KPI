<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\WorkerTrainingsMassFailedRowsExport;
use App\Exports\WorkerTrainingsMassTemplateExport;
use App\Imports\WorkerTrainingsMassImport;
use App\Models\User;
use App\Models\WorkerTraining;
use App\Models\Project;
use App\Models\Worker;
use App\Services\WorkerTrainingMassImportService;
use App\Services\MassImportProgressService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use ZipArchive;

class WorkerTrainingController extends Controller
{
    private const EXPIRING_DAYS = 30;

    private function checkMassImportAccess(Request $request)
    {
        $user = $this->checkAccess($request);
        if ($user->role === User::ROLE_HR || $user->role === User::ROLE_HR_DIRECTOR) {
            abort(403, 'Access denied');
        }
        return $user;
    }

    private function checkAccess(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessWorkers()) {
            abort(403, 'You do not have access to worker trainings');
        }
        return $user;
    }

    private function normalizeCin($value): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            $value = trim($value);
            if ($value === '') {
                return null;
            }

            if (preg_match('/^[0-9]+\.0+$/', $value)) {
                $value = preg_replace('/\.0+$/', '', $value);
            }

            if (stripos($value, 'e') !== false && is_numeric($value)) {
                $value = sprintf('%.0f', (float) $value);
            }

            return trim($value);
        }

        if (is_int($value)) {
            return (string) $value;
        }

        if (is_float($value)) {
            return sprintf('%.0f', $value);
        }

        $v = trim((string) $value);
        return $v === '' ? null : $v;
    }

    private function parseDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if ($value instanceof \DateTime) {
                return $value->format('Y-m-d');
            }

            if (is_numeric($value)) {
                return Carbon::instance(ExcelDate::excelToDateTimeObject($value))->format('Y-m-d');
            }

            $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'd.m.Y', 'm/d/Y'];
            foreach ($formats as $format) {
                try {
                    return Carbon::createFromFormat($format, trim((string) $value))->format('Y-m-d');
                } catch (\Exception $e) {
                }
            }

            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }

    private function isRowEmpty(array $row): bool
    {
        foreach ($row as $v) {
            if ($v !== null && trim((string) $v) !== '') {
                return false;
            }
        }
        return true;
    }

    private function getColumnValue(array $row, array $possibleNames)
    {
        foreach ($possibleNames as $name) {
            if (isset($row[$name]) && $row[$name] !== null && $row[$name] !== '') {
                return $row[$name];
            }
            $spaceName = str_replace('_', ' ', $name);
            if (isset($row[$spaceName]) && $row[$spaceName] !== null && $row[$spaceName] !== '') {
                return $row[$spaceName];
            }
        }
        return null;
    }

    public function index(Request $request)
    {
        $user = $this->checkAccess($request);

        $query = WorkerTraining::with(['worker.project']);

        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null) {
            if (count($visibleProjectIds) === 0) {
                $empty = $query->whereRaw('1 = 0')->paginate($request->get('per_page', 25));
                return $this->paginated($empty);
            }

            $query->whereHas('worker', function ($q) use ($visibleProjectIds) {
                $q->whereIn('project_id', $visibleProjectIds);
            });
        }

        if ($request->filled('project_id')) {
            $projectId = $request->get('project_id');

            $project = Project::findOrFail($projectId);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }

            $query->whereHas('worker', function ($q) use ($projectId) {
                $q->where('project_id', $projectId);
            });
        }

        if ($request->filled('worker_id')) {
            $query->where('worker_id', $request->get('worker_id'));
        }

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->whereHas('worker', function ($q) use ($search) {
                $q->search($search);
            });
        }

        if ($request->filled('training_type')) {
            $trainingType = $request->get('training_type');
            $query->where('training_type', $trainingType);

            if ($trainingType === 'other' && $request->filled('training_label')) {
                $query->where('training_label', $request->get('training_label'));
            }
        }

        $status = $request->get('status');
        if ($status) {
            $today = now()->startOfDay();
            $expiringLimit = now()->addDays(self::EXPIRING_DAYS)->endOfDay();

            if ($status === 'expired') {
                $query->whereNotNull('expiry_date')
                    ->whereDate('expiry_date', '<', $today);
            } elseif ($status === 'expiring') {
                $query->whereNotNull('expiry_date')
                    ->whereDate('expiry_date', '>=', $today)
                    ->whereDate('expiry_date', '<=', $expiringLimit);
            } elseif ($status === 'expiring_or_expired') {
                $query->whereNotNull('expiry_date')
                    ->where(function ($q) use ($today, $expiringLimit) {
                        $q->whereDate('expiry_date', '<', $today)
                            ->orWhere(function ($q2) use ($today, $expiringLimit) {
                                $q2->whereDate('expiry_date', '>=', $today)
                                   ->whereDate('expiry_date', '<=', $expiringLimit);
                            });
                    });
            }
        }

        $perPage = $request->input('per_page', 25);
        $trainings = $query
            ->orderBy('expiry_date')
            ->orderBy('training_date', 'desc')
            ->paginate($perPage);

        return $this->paginated($trainings);
    }

    public function otherLabels(Request $request)
    {
        $user = $this->checkAccess($request);

        $query = WorkerTraining::query()
            ->where('training_type', 'other')
            ->whereNotNull('training_label')
            ->where('training_label', '!=', '');

        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null) {
            if (count($visibleProjectIds) === 0) {
                return $this->success([]);
            }

            $query->whereHas('worker', function ($q) use ($visibleProjectIds) {
                $q->whereIn('project_id', $visibleProjectIds);
            });
        }

        if ($request->filled('project_id')) {
            $projectId = $request->get('project_id');

            $project = Project::findOrFail($projectId);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }

            $query->whereHas('worker', function ($q) use ($projectId) {
                $q->where('project_id', $projectId);
            });
        }

        $labels = $query
            ->distinct()
            ->orderBy('training_label')
            ->limit(200)
            ->pluck('training_label')
            ->values()
            ->toArray();

        return $this->success($labels);
    }

    public function store(Request $request)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'worker_id' => 'required|exists:workers,id',
            'training_type' => 'required|string|max:100',
            'training_label' => 'nullable|string|max:255',
            'training_date' => 'required|date',
            'expiry_date' => 'nullable|date|after_or_equal:training_date',
            'certificate' => 'nullable|file|mimes:pdf|max:20480',
        ]);

        if ($validated['training_type'] === 'other' && empty($validated['training_label'])) {
            return $this->error('Training label is required when type is other', 422);
        }

        $worker = Worker::findOrFail($validated['worker_id']);
        if ($worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $data = $validated;

        if ($request->hasFile('certificate')) {
            $path = $request->file('certificate')->store('worker_certificates', 'public');
            $data['certificate_path'] = $path;
        }

        unset($data['certificate']);

        $data['created_by'] = $user->id;

        $training = WorkerTraining::create($data);
        $training->load(['worker.project']);

        return $this->success($training, 'Worker training created successfully', 201);
    }

    public function massTemplate(Request $request)
    {
        $user = $this->checkMassImportAccess($request);

        if (!class_exists(ZipArchive::class) || !extension_loaded('zip')) {
            return $this->error('ZipArchive extension is required to generate Excel templates', 500);
        }

        $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));

        $filename = 'worker_trainings_mass_template.xlsx';
        $contents = Excel::raw(new WorkerTrainingsMassTemplateExport(200, $lang), ExcelFormat::XLSX);

        return response($contents, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function massImport(Request $request)
    {
        $user = $this->checkMassImportAccess($request);

        $validated = $request->validate([
            'excel' => 'required|file',
            'zip' => 'nullable|file',
            'progress_id' => 'nullable|string|max:120',
        ]);

        $progressId = $validated['progress_id'] ?? null;
        $progress = $progressId ? new MassImportProgressService() : null;
        if ($progress && $progressId) {
            $progress->init($progressId);
        }

        try {
            $service = new WorkerTrainingMassImportService();
            $result = $service->handle($user, $validated['excel'], $validated['zip'] ?? null, $progressId);

            if ($progress && $progressId) {
                $progress->complete($progressId, [
                    'imported' => (int) ($result['imported'] ?? 0),
                    'failed' => (int) ($result['failed_count'] ?? 0),
                ]);
            }

            return $this->success($result, 'Import completed');
        } catch (\Throwable $e) {
            if ($progress && $progressId) {
                $progress->fail($progressId, $e->getMessage() ?: 'Import failed');
            }
            return $this->error($e->getMessage() ?: 'Import failed', 500);
        }
    }

    public function show(Request $request, WorkerTraining $workerTraining)
    {
        $user = $this->checkAccess($request);

        $workerTraining->load(['worker.project']);
        $worker = $workerTraining->worker;
        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        return $this->success($workerTraining);
    }

    public function update(Request $request, WorkerTraining $workerTraining)
    {
        $user = $this->checkAccess($request);

        $workerTraining->load(['worker']);
        $worker = $workerTraining->worker;
        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $validated = $request->validate([
            'training_type' => 'sometimes|string|max:100',
            'training_label' => 'nullable|string|max:255',
            'training_date' => 'sometimes|date',
            'expiry_date' => 'nullable|date',
            'certificate' => 'nullable|file|mimes:pdf|max:20480',
        ]);

        if (isset($validated['training_type']) && $validated['training_type'] === 'other' && empty($validated['training_label'] ?? $workerTraining->training_label)) {
            return $this->error('Training label is required when type is other', 422);
        }

        $data = $validated;

        if ($request->hasFile('certificate')) {
            if ($workerTraining->certificate_path) {
                Storage::disk('public')->delete($workerTraining->certificate_path);
            }
            $path = $request->file('certificate')->store('worker_certificates', 'public');
            $data['certificate_path'] = $path;
        }

        unset($data['certificate']);

        $workerTraining->update($data);
        $workerTraining->load(['worker.project']);

        return $this->success($workerTraining, 'Worker training updated successfully');
    }

    public function destroy(Request $request, WorkerTraining $workerTraining)
    {
        $user = $this->checkAccess($request);

        $workerTraining->load(['worker']);
        $worker = $workerTraining->worker;
        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        if ($workerTraining->certificate_path) {
            Storage::disk('public')->delete($workerTraining->certificate_path);
        }

        $workerTraining->delete();

        return $this->success(null, 'Worker training deleted successfully');
    }

    public function viewCertificate(Request $request, WorkerTraining $workerTraining)
    {
        $user = $this->checkAccess($request);
        $workerTraining->load(['worker']);
        $worker = $workerTraining->worker;
        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        if (!$workerTraining->certificate_path || !Storage::disk('public')->exists($workerTraining->certificate_path)) {
            abort(404, 'File not found');
        }

        $path = $workerTraining->certificate_path;
        $filename = basename($path);

        return response()->stream(function () use ($path) {
            $stream = Storage::disk('public')->readStream($path);
            if ($stream === false) {
                return;
            }
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    public function downloadCertificate(Request $request, WorkerTraining $workerTraining)
    {
        $user = $this->checkAccess($request);

        $workerTraining->load(['worker']);
        $worker = $workerTraining->worker;
        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        if (!$workerTraining->certificate_path || !Storage::disk('public')->exists($workerTraining->certificate_path)) {
            abort(404, 'File not found');
        }

        $path = $workerTraining->certificate_path;
        $filename = basename($path);

        return response()->streamDownload(function () use ($path) {
            $stream = Storage::disk('public')->readStream($path);
            if ($stream === false) {
                return;
            }
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, $filename, [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
