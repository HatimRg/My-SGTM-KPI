<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkerTraining;
use App\Models\Project;
use App\Models\Worker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class WorkerTrainingController extends Controller
{
    private const EXPIRING_DAYS = 30;

    private function checkAccess(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessWorkers()) {
            abort(403, 'You do not have access to worker trainings');
        }
        return $user;
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
