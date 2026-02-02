<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\RegulatoryWatchSubmission;
use Illuminate\Http\Request;

class RegulatoryWatchController extends Controller
{
    private function normalizeCategory(?string $category): string
    {
        $raw = trim((string) ($category ?? ''));
        if ($raw === '') {
            return 'sst';
        }

        $c = strtolower($raw);
        if ($c === 'environnement') {
            $c = 'environment';
        }

        if (!in_array($c, ['sst', 'environment'], true)) {
            abort(422, 'Invalid category');
        }

        return $c;
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $category = $this->normalizeCategory($request->get('category'));

        $query = RegulatoryWatchSubmission::query()->with([
            'project:id,name,code',
            'submitter:id,name',
        ]);

        $query->where(function ($q) use ($category) {
            if ($category === 'sst') {
                $q->where('category', 'sst')->orWhereNull('category');
                return;
            }

            $q->where('category', $category);
        });

        if ($request->project_id) {
            $projectId = (int) $request->project_id;
            if (!$user->hasGlobalProjectScope()) {
                $allowed = Project::query()->visibleTo($user)->whereKey($projectId)->exists();
                if (!$allowed) {
                    return $this->error('Access denied', 403);
                }
            }
            $query->where('project_id', $projectId);
        } else if (!$user->hasGlobalProjectScope()) {
            $projectIds = $user->visibleProjectIds();
            if (is_iterable($projectIds) && count($projectIds) === 0) {
                return $this->success([
                    'avg_overall_score' => null,
                    'submissions' => $query->whereRaw('1 = 0')->paginate($request->per_page ?? 50),
                ]);
            }
            if ($projectIds !== null) {
                $query->whereIn('project_id', $projectIds);
            }
        }

        $avgOverall = (clone $query)->whereNotNull('overall_score')->avg('overall_score');
        $avgOverall = $avgOverall !== null ? round((float) $avgOverall, 2) : null;

        $submissions = $query
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->paginate($request->per_page ?? 50);

        return $this->success([
            'avg_overall_score' => $avgOverall,
            'submissions' => $submissions,
        ]);
    }

    public function show(Request $request, RegulatoryWatchSubmission $submission)
    {
        $user = $request->user();

        $role = (string) ($user ? $user->role : '');
        $allowedRoles = ['hse_director', 'hse_manager', 'responsable', 'supervisor'];
        if (!$user || (!$user->isAdminLike() && !in_array($role, $allowedRoles, true))) {
            return $this->error('Access denied', 403);
        }

        if (!$user->hasGlobalProjectScope()) {
            $allowed = Project::query()->visibleTo($user)->whereKey((int) $submission->project_id)->exists();
            if (!$allowed) {
                return $this->error('Access denied', 403);
            }
        }

        $submission->load([
            'project:id,name,code',
            'submitter:id,name',
        ]);

        return $this->success($submission);
    }

    public function latest(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'category' => 'nullable|string|max:32',
        ]);

        $user = $request->user();
        $projectId = (int) $validated['project_id'];
        $category = $this->normalizeCategory($validated['category'] ?? null);

        if (!$user->hasGlobalProjectScope()) {
            $allowed = Project::query()->visibleTo($user)->whereKey($projectId)->exists();
            if (!$allowed) {
                return $this->error('Access denied', 403);
            }
        }

        $submission = RegulatoryWatchSubmission::query()
            ->where('project_id', $projectId)
            ->where(function ($q) use ($category) {
                if ($category === 'sst') {
                    $q->where('category', 'sst')->orWhereNull('category');
                    return;
                }
                $q->where('category', $category);
            })
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->first();

        if (!$submission) {
            return $this->success(null);
        }

        return $this->success($submission);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_year' => 'required|integer|min:2000|max:2100',
            'week_number' => 'required|integer|min:1|max:53',
            'category' => 'nullable|string|max:32',
            'schema_version' => 'required|string|max:50',
            'answers' => 'required|array',
        ]);

        $user = $request->user();
        $projectId = (int) $validated['project_id'];

        if (!$user->hasGlobalProjectScope()) {
            $allowed = Project::query()->visibleTo($user)->whereKey($projectId)->exists();
            if (!$allowed) {
                return $this->error('Access denied', 403);
            }
        }

        [$sectionScores, $overallScore] = $this->computeScores($validated['answers']);

        $category = $this->normalizeCategory($validated['category'] ?? null);

        $submission = RegulatoryWatchSubmission::create([
            'project_id' => $projectId,
            'submitted_by' => $user ? $user->id : null,
            'submitted_at' => now(),
            'week_year' => (int) $validated['week_year'],
            'week_number' => (int) $validated['week_number'],
            'category' => $category,
            'schema_version' => $validated['schema_version'],
            'answers' => $validated['answers'],
            'section_scores' => $sectionScores,
            'overall_score' => $overallScore,
        ]);

        return $this->success($submission, 'Veille reglementaire submitted', 201);
    }

    public function destroy(Request $request, RegulatoryWatchSubmission $submission)
    {
        $user = $request->user();

        $role = (string) ($user ? $user->role : '');
        $allowedRoles = ['hse_director', 'hse_manager', 'responsable', 'supervisor'];
        if (!$user || (!$user->isAdminLike() && !in_array($role, $allowedRoles, true))) {
            return $this->error('Access denied', 403);
        }

        if (!$user->hasGlobalProjectScope()) {
            $allowed = Project::query()->visibleTo($user)->whereKey((int) $submission->project_id)->exists();
            if (!$allowed) {
                return $this->error('Access denied', 403);
            }
        }

        if (!$user->isAdminLike() && (int) $submission->submitted_by !== (int) $user->id) {
            return $this->error('Access denied', 403);
        }

        $submission->delete();

        return $this->success(null, 'Regulatory watch submission deleted');
    }

    private function computeScores(array $answers): array
    {
        $sections = $answers['sections'] ?? null;
        if (!is_array($sections)) {
            abort(422, 'Invalid answers payload');
        }

        $sectionScores = [];
        $percentages = [];

        foreach ($sections as $section) {
            $sectionId = $section['section_id'] ?? null;
            $articles = $section['articles'] ?? null;

            if (!is_string($sectionId) || $sectionId === '' || !is_array($articles)) {
                abort(422, 'Invalid answers payload');
            }

            $totalApplicable = 0;
            $totalConforme = 0;

            foreach ($articles as $article) {
                $applicable = (bool) ($article['applicable'] ?? false);
                if (!$applicable) {
                    continue;
                }

                $totalApplicable++;
                $compliant = $article['compliant'] ?? null;
                if ($compliant === true || $compliant === 1 || $compliant === '1') {
                    $totalConforme++;
                }
            }

            $percentage = $totalApplicable > 0
                ? round(($totalConforme / $totalApplicable) * 100, 2)
                : null;

            $sectionScores[] = [
                'section_id' => $sectionId,
                'total_applicable' => $totalApplicable,
                'total_conforme' => $totalConforme,
                'score' => $percentage,
            ];

            if ($percentage !== null) {
                $percentages[] = $percentage;
            }
        }

        $overall = count($percentages) > 0
            ? round(array_sum($percentages) / count($percentages), 2)
            : null;

        return [$sectionScores, $overall];
    }
}
