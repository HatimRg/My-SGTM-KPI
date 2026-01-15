<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\WorkerMedicalAptitudesMassTemplateExport;
use App\Models\User;
use App\Models\Project;
use App\Models\Worker;
use App\Models\WorkerMedicalAptitude;
use App\Services\WorkerMedicalAptitudeMassImportService;
use App\Services\MassImportProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use ZipArchive;

class WorkerMedicalAptitudeController extends Controller
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
            abort(403, 'You do not have access to worker medical aptitude');
        }
        return $user;
    }

    public function index(Request $request)
    {
        $user = $this->checkAccess($request);

        $query = WorkerMedicalAptitude::with(['worker.project']);

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

        if ($request->filled('aptitude_status')) {
            $query->where('aptitude_status', $request->get('aptitude_status'));
        }

        if ($request->filled('exam_nature')) {
            $query->where('exam_nature', $request->get('exam_nature'));
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
        $items = $query
            ->orderBy('expiry_date')
            ->orderBy('exam_date', 'desc')
            ->paginate($perPage);

        return $this->paginated($items);
    }

    public function store(Request $request)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'worker_id' => 'required|exists:workers,id',
            'aptitude_status' => 'required|in:apte,inapte',
            'exam_nature' => 'required|string|max:100',
            'able_to' => 'nullable|array',
            'able_to.*' => 'string|max:100',
            'exam_date' => 'required|date',
            'expiry_date' => 'nullable|date|after_or_equal:exam_date',
            'certificate' => 'nullable|file|mimes:pdf|max:20480',
        ]);

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

        $aptitude = WorkerMedicalAptitude::create($data);
        $aptitude->load(['worker.project']);

        return $this->success($aptitude, 'Worker medical aptitude created successfully', 201);
    }

    public function massTemplate(Request $request)
    {
        $this->checkMassImportAccess($request);

        if (!class_exists(ZipArchive::class) || !extension_loaded('zip')) {
            return $this->error('ZipArchive extension is required to generate Excel templates', 500);
        }

        $filename = 'worker_medical_aptitudes_mass_template.xlsx';
        $contents = Excel::raw(new WorkerMedicalAptitudesMassTemplateExport(), ExcelFormat::XLSX);

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
            'zip' => 'required|file',
            'progress_id' => 'nullable|string|max:120',
        ]);

        $progressId = $validated['progress_id'] ?? null;
        $progress = $progressId ? new MassImportProgressService() : null;
        if ($progress && $progressId) {
            $progress->init($progressId);
        }

        try {
            $service = new WorkerMedicalAptitudeMassImportService();
            $result = $service->handle($user, $validated['excel'], $validated['zip'], $progressId);

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

    public function show(Request $request, WorkerMedicalAptitude $workerMedicalAptitude)
    {
        $user = $this->checkAccess($request);

        $workerMedicalAptitude->load(['worker.project']);
        $worker = $workerMedicalAptitude->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        return $this->success($workerMedicalAptitude);
    }

    public function update(Request $request, WorkerMedicalAptitude $workerMedicalAptitude)
    {
        $user = $this->checkAccess($request);

        $workerMedicalAptitude->load(['worker']);
        $worker = $workerMedicalAptitude->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $validated = $request->validate([
            'aptitude_status' => 'sometimes|in:apte,inapte',
            'exam_nature' => 'sometimes|string|max:100',
            'able_to' => 'nullable|array',
            'able_to.*' => 'string|max:100',
            'exam_date' => 'sometimes|date',
            'expiry_date' => 'nullable|date',
            'certificate' => 'nullable|file|mimes:pdf|max:20480',
        ]);

        $data = $validated;

        if ($request->hasFile('certificate')) {
            if ($workerMedicalAptitude->certificate_path) {
                Storage::disk('public')->delete($workerMedicalAptitude->certificate_path);
            }
            $path = $request->file('certificate')->store('worker_certificates', 'public');
            $data['certificate_path'] = $path;
        }

        unset($data['certificate']);

        $workerMedicalAptitude->update($data);
        $workerMedicalAptitude->load(['worker.project']);

        return $this->success($workerMedicalAptitude, 'Worker medical aptitude updated successfully');
    }

    public function destroy(Request $request, WorkerMedicalAptitude $workerMedicalAptitude)
    {
        $user = $this->checkAccess($request);

        $workerMedicalAptitude->load(['worker']);
        $worker = $workerMedicalAptitude->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        if ($workerMedicalAptitude->certificate_path) {
            Storage::disk('public')->delete($workerMedicalAptitude->certificate_path);
        }

        $workerMedicalAptitude->delete();

        return $this->success(null, 'Worker medical aptitude deleted successfully');
    }

    public function viewCertificate(Request $request, WorkerMedicalAptitude $workerMedicalAptitude)
    {
        $user = $this->checkAccess($request);

        $workerMedicalAptitude->load(['worker']);
        $worker = $workerMedicalAptitude->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $path = $workerMedicalAptitude->certificate_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            abort(404, 'File not found');
        }

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

    public function downloadCertificate(Request $request, WorkerMedicalAptitude $workerMedicalAptitude)
    {
        $user = $this->checkAccess($request);

        $workerMedicalAptitude->load(['worker']);
        $worker = $workerMedicalAptitude->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $path = $workerMedicalAptitude->certificate_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            abort(404, 'File not found');
        }

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
