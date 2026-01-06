<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Worker;
use App\Models\WorkerSanction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class WorkerSanctionController extends Controller
{
    private function checkAccess(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessWorkers()) {
            abort(403, 'You do not have access to worker sanctions');
        }
        return $user;
    }

    private function canCreate(Request $request): bool
    {
        $user = $request->user();
        return $user && ($user->isHseManager() || $user->isResponsable() || $user->isSupervisor() || $user->isUser());
    }

    public function index(Request $request)
    {
        $user = $this->checkAccess($request);

        $query = WorkerSanction::with([
            'worker.project',
            'project:id,name,code',
            'creator:id,name',
        ]);

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

        if ($request->filled('worker_id')) {
            $query->where('worker_id', (int) $request->get('worker_id'));
        }

        $perPage = (int) $request->input('per_page', 100);
        $items = $query
            ->orderByDesc('sanction_date')
            ->orderByDesc('id')
            ->paginate($perPage);

        return $this->paginated($items);
    }

    public function store(Request $request)
    {
        $user = $this->checkAccess($request);

        if (!$this->canCreate($request)) {
            abort(403, 'Access denied');
        }

        $validated = $request->validate([
            'worker_id' => 'required|exists:workers,id',
            'sanction_date' => 'required|date',
            'reason' => 'required|string',
            'sanction_type' => 'required|in:mise_a_pied,avertissement,rappel_a_lordre,blame',
            'mise_a_pied_days' => 'nullable|integer|min:1|max:365',
            'document' => 'required|file|mimes:pdf|max:20480',
        ]);

        if ($validated['sanction_type'] === 'mise_a_pied' && empty($validated['mise_a_pied_days'])) {
            return $this->error('Days are required for mise a pied', 422);
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

        if ($request->hasFile('document')) {
            $path = $request->file('document')->store('worker_sanctions', 'public');
            $data['document_path'] = $path;
        }

        unset($data['document']);

        $data['created_by'] = $user->id;
        $data['project_id'] = $worker->project_id ? (int) $worker->project_id : null;

        if ($data['sanction_type'] !== 'mise_a_pied') {
            $data['mise_a_pied_days'] = null;
        }

        $item = WorkerSanction::create($data);
        $item->load(['worker.project', 'project:id,name,code', 'creator:id,name']);

        return $this->success($item, 'Worker sanction created successfully', 201);
    }

    public function show(Request $request, WorkerSanction $workerSanction)
    {
        $user = $this->checkAccess($request);

        $workerSanction->load(['worker.project', 'project:id,name,code', 'creator:id,name']);
        $worker = $workerSanction->worker;
        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        return $this->success($workerSanction);
    }

    public function destroy(Request $request, WorkerSanction $workerSanction)
    {
        $user = $this->checkAccess($request);

        if (!$user->isHseManager()) {
            abort(403, 'Access denied');
        }

        $workerSanction->load(['worker']);
        $worker = $workerSanction->worker;
        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        if ($workerSanction->document_path) {
            Storage::disk('public')->delete($workerSanction->document_path);
        }

        $workerSanction->delete();

        return $this->success(null, 'Worker sanction deleted successfully');
    }

    public function viewDocument(Request $request, WorkerSanction $workerSanction)
    {
        $user = $this->checkAccess($request);

        $workerSanction->load(['worker']);
        $worker = $workerSanction->worker;
        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $path = $workerSanction->document_path;
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

    public function downloadDocument(Request $request, WorkerSanction $workerSanction)
    {
        $user = $this->checkAccess($request);

        $workerSanction->load(['worker']);
        $worker = $workerSanction->worker;
        if ($worker && $worker->project_id) {
            $project = Project::findOrFail($worker->project_id);
            if (!$user->canAccessProject($project)) {
                abort(403, 'Access denied');
            }
        } elseif (!$user->hasGlobalProjectScope()) {
            abort(403, 'Access denied');
        }

        $path = $workerSanction->document_path;
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
