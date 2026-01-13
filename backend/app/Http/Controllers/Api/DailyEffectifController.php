<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyEffectifEntry;
use App\Models\Project;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DailyEffectifController extends Controller
{
    private function ensureCanSubmit(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isHR()) {
            return $this->error('Access denied', 403);
        }
        return null;
    }

    private function ensureCanView(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array((string) $user->role, ['admin', 'dev', 'hr_director'], true)) {
            return $this->error('Access denied', 403);
        }
        return null;
    }

    public function upsert(Request $request)
    {
        if ($resp = $this->ensureCanSubmit($request)) {
            return $resp;
        }

        $validated = $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'entry_date' => 'required|date',
            'effectif' => 'required|integer|min:0|max:1000000',
        ]);

        $user = $request->user();
        $project = Project::findOrFail((int) $validated['project_id']);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $date = Carbon::parse($validated['entry_date'])->toDateString();

        $entry = DailyEffectifEntry::updateOrCreate(
            ['project_id' => $project->id, 'entry_date' => $date],
            ['effectif' => (int) $validated['effectif'], 'submitted_by' => $user->id]
        );

        return $this->success(['entry' => $entry->fresh()->load(['project', 'submitter'])], 'Saved');
    }

    public function entry(Request $request)
    {
        if ($resp = $this->ensureCanSubmit($request)) {
            return $resp;
        }

        $validated = $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'entry_date' => 'required|date',
        ]);

        $user = $request->user();
        $project = Project::findOrFail((int) $validated['project_id']);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $date = Carbon::parse($validated['entry_date'])->toDateString();
        $entry = DailyEffectifEntry::query()
            ->where('project_id', $project->id)
            ->where('entry_date', $date)
            ->first();

        return $this->success(['entry' => $entry]);
    }

    public function list(Request $request)
    {
        if ($resp = $this->ensureCanSubmit($request)) {
            return $resp;
        }

        $validated = $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
        ]);

        $user = $request->user();
        $project = Project::findOrFail((int) $validated['project_id']);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $query = DailyEffectifEntry::query()
            ->where('project_id', $project->id)
            ->orderBy('entry_date', 'desc');

        if (!empty($validated['from_date'])) {
            $query->where('entry_date', '>=', Carbon::parse($validated['from_date'])->toDateString());
        }
        if (!empty($validated['to_date'])) {
            $query->where('entry_date', '<=', Carbon::parse($validated['to_date'])->toDateString());
        }

        $rows = $query->get();
        return $this->success(['entries' => $rows]);
    }

    public function series(Request $request)
    {
        if ($resp = $this->ensureCanView($request)) {
            return $resp;
        }

        $validated = $request->validate([
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'project_id' => 'nullable|integer|exists:projects,id',
            'pole' => 'nullable|string|max:255',
        ]);

        $user = $request->user();

        $projectsQuery = Project::query()->visibleTo($user);
        if (!empty($validated['pole'])) {
            $projectsQuery->where('pole', $validated['pole']);
        }
        if (!empty($validated['project_id'])) {
            $projectsQuery->whereKey((int) $validated['project_id']);
        }
        $projectIds = $projectsQuery->pluck('id');

        if ($projectIds->isEmpty()) {
            return $this->success(['series' => []]);
        }

        $query = DailyEffectifEntry::query()
            ->whereIn('project_id', $projectIds)
            ->selectRaw('entry_date, SUM(effectif) as total_effectif')
            ->groupBy('entry_date')
            ->orderBy('entry_date');

        if (!empty($validated['from_date'])) {
            $query->where('entry_date', '>=', Carbon::parse($validated['from_date'])->toDateString());
        }
        if (!empty($validated['to_date'])) {
            $query->where('entry_date', '<=', Carbon::parse($validated['to_date'])->toDateString());
        }

        $rows = $query->get()->map(fn ($r) => [
            'entry_date' => (string) $r->entry_date,
            'total_effectif' => (int) ($r->total_effectif ?? 0),
        ]);

        return $this->success(['series' => $rows]);
    }

    public function history(Request $request)
    {
        if ($resp = $this->ensureCanView($request)) {
            return $resp;
        }

        $validated = $request->validate([
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'project_id' => 'nullable|integer|exists:projects,id',
            'pole' => 'nullable|string|max:255',
            'limit' => 'nullable|integer|min:1|max:500',
        ]);

        $user = $request->user();

        $projectsQuery = Project::query()->visibleTo($user);
        if (!empty($validated['pole'])) {
            $projectsQuery->where('pole', $validated['pole']);
        }
        if (!empty($validated['project_id'])) {
            $projectsQuery->whereKey((int) $validated['project_id']);
        }
        $projectIds = $projectsQuery->pluck('id');

        if ($projectIds->isEmpty()) {
            return $this->success(['entries' => []]);
        }

        $query = DailyEffectifEntry::query()
            ->whereIn('project_id', $projectIds)
            ->with(['project', 'submitter'])
            ->orderBy('entry_date', 'desc');

        if (!empty($validated['from_date'])) {
            $query->where('entry_date', '>=', Carbon::parse($validated['from_date'])->toDateString());
        }
        if (!empty($validated['to_date'])) {
            $query->where('entry_date', '<=', Carbon::parse($validated['to_date'])->toDateString());
        }

        $limit = (int) ($validated['limit'] ?? 200);
        $rows = $query->limit($limit)->get();

        return $this->success(['entries' => $rows]);
    }

    public function byProject(Request $request)
    {
        if ($resp = $this->ensureCanView($request)) {
            return $resp;
        }

        $validated = $request->validate([
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'project_id' => 'nullable|integer|exists:projects,id',
            'pole' => 'nullable|string|max:255',
        ]);

        $user = $request->user();

        $projectsQuery = Project::query()->visibleTo($user);
        if (!empty($validated['pole'])) {
            $projectsQuery->where('pole', $validated['pole']);
        }
        if (!empty($validated['project_id'])) {
            $projectsQuery->whereKey((int) $validated['project_id']);
        }
        $projectIds = $projectsQuery->pluck('id');

        if ($projectIds->isEmpty()) {
            return $this->success(['projects' => []]);
        }

        $query = DailyEffectifEntry::query()
            ->join('projects', 'daily_effectif_entries.project_id', '=', 'projects.id')
            ->whereIn('projects.id', $projectIds)
            ->selectRaw('projects.id as project_id, projects.name as project_name, projects.code as project_code, SUM(daily_effectif_entries.effectif) as total_effectif')
            ->groupBy('projects.id', 'projects.name', 'projects.code')
            ->orderByDesc('total_effectif');

        if (!empty($validated['from_date'])) {
            $query->where('daily_effectif_entries.entry_date', '>=', Carbon::parse($validated['from_date'])->toDateString());
        }
        if (!empty($validated['to_date'])) {
            $query->where('daily_effectif_entries.entry_date', '<=', Carbon::parse($validated['to_date'])->toDateString());
        }

        $rows = $query->get()->map(fn ($r) => [
            'project_id' => (int) $r->project_id,
            'project_name' => (string) ($r->project_name ?? ''),
            'project_code' => (string) ($r->project_code ?? ''),
            'total_effectif' => (int) ($r->total_effectif ?? 0),
        ]);

        return $this->success(['projects' => $rows]);
    }
}
