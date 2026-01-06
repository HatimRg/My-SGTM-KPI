<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Worker;
use App\Models\WorkerQualification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class WorkerQualificationController extends Controller
{
    private const EXPIRING_DAYS = 30;

    private function checkAccess(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessWorkers()) {
            abort(403, 'You do not have access to worker qualifications');
        }
        return $user;
    }

    public function index(Request $request)
    {
        $user = $this->checkAccess($request);

        $query = WorkerQualification::with(['worker.project']);

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

        if ($request->filled('qualification_type')) {
            $qualificationType = $request->get('qualification_type');
            $query->where('qualification_type', $qualificationType);

            if ($qualificationType === 'other' && $request->filled('qualification_label')) {
                $query->where('qualification_label', $request->get('qualification_label'));
            }
        }

        if ($request->filled('aptitude_status')) {
            // no-op (kept for potential unified filter payloads)
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
            ->orderBy('start_date', 'desc')
            ->paginate($perPage);

        return $this->paginated($items);
    }

    public function store(Request $request)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'worker_id' => 'required|exists:workers,id',
            'qualification_type' => 'required|string|max:100',
            'qualification_level' => 'nullable|string|max:100',
            'qualification_label' => 'nullable|string|max:255',
            'start_date' => 'required|date',
            'expiry_date' => 'nullable|date|after_or_equal:start_date',
            'certificate' => 'nullable|file|mimes:pdf|max:20480',
        ]);

        if ($validated['qualification_type'] === 'other' && empty($validated['qualification_label'])) {
            return $this->error('Qualification label is required when type is other', 422);
        }

        if ($validated['qualification_type'] === 'habilitation_electrique' && empty($validated['qualification_level'])) {
            return $this->error('Qualification level is required when type is habilitation_electrique', 422);
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

        $qualification = WorkerQualification::create($data);
        $qualification->load(['worker.project']);

        return $this->success($qualification, 'Worker qualification created successfully', 201);
    }

    public function show(Request $request, WorkerQualification $workerQualification)
    {
        $user = $this->checkAccess($request);

        $workerQualification->load(['worker.project']);
        $worker = $workerQualification->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        return $this->success($workerQualification);
    }

    public function update(Request $request, WorkerQualification $workerQualification)
    {
        $user = $this->checkAccess($request);

        $workerQualification->load(['worker']);
        $worker = $workerQualification->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $validated = $request->validate([
            'qualification_type' => 'sometimes|string|max:100',
            'qualification_level' => 'nullable|string|max:100',
            'qualification_label' => 'nullable|string|max:255',
            'start_date' => 'sometimes|date',
            'expiry_date' => 'nullable|date',
            'certificate' => 'nullable|file|mimes:pdf|max:20480',
        ]);

        $effectiveType = $validated['qualification_type'] ?? $workerQualification->qualification_type;
        $effectiveLabel = array_key_exists('qualification_label', $validated) ? $validated['qualification_label'] : $workerQualification->qualification_label;
        $effectiveLevel = array_key_exists('qualification_level', $validated) ? $validated['qualification_level'] : $workerQualification->qualification_level;

        if ($effectiveType === 'other' && empty($effectiveLabel)) {
            return $this->error('Qualification label is required when type is other', 422);
        }

        if ($effectiveType === 'habilitation_electrique' && empty($effectiveLevel)) {
            return $this->error('Qualification level is required when type is habilitation_electrique', 422);
        }

        $data = $validated;

        if ($request->hasFile('certificate')) {
            if ($workerQualification->certificate_path) {
                Storage::disk('public')->delete($workerQualification->certificate_path);
            }
            $path = $request->file('certificate')->store('worker_certificates', 'public');
            $data['certificate_path'] = $path;
        }

        unset($data['certificate']);

        $workerQualification->update($data);
        $workerQualification->load(['worker.project']);

        return $this->success($workerQualification, 'Worker qualification updated successfully');
    }

    public function destroy(Request $request, WorkerQualification $workerQualification)
    {
        $user = $this->checkAccess($request);

        $workerQualification->load(['worker']);
        $worker = $workerQualification->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        if ($workerQualification->certificate_path) {
            Storage::disk('public')->delete($workerQualification->certificate_path);
        }

        $workerQualification->delete();

        return $this->success(null, 'Worker qualification deleted successfully');
    }

    public function viewCertificate(Request $request, WorkerQualification $workerQualification)
    {
        $user = $this->checkAccess($request);

        $workerQualification->load(['worker']);
        $worker = $workerQualification->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $path = $workerQualification->certificate_path;
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

    public function downloadCertificate(Request $request, WorkerQualification $workerQualification)
    {
        $user = $this->checkAccess($request);

        $workerQualification->load(['worker']);
        $worker = $workerQualification->worker;

        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $path = $workerQualification->certificate_path;
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
