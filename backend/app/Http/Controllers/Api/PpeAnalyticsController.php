<?php

namespace App\Http\Controllers\Api;

use App\Helpers\WeekHelper;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\WorkerPpeIssue;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PpeAnalyticsController extends Controller
{
    private function ensureAdminLikeOrHseManager(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->isAdminLike() && !$user->isHseManager())) {
            abort(403, 'Access denied');
        }
        return $user;
    }

    private function normalizeWeekParam($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $w = (int) $value;
        return ($w >= 1 && $w <= 52) ? $w : null;
    }

    private function visibleProjectIds(Request $request, $user): ?array
    {
        $pole = (string) $request->get('pole', '');
        if ($pole !== '') {
            return Project::query()->visibleTo($user)->where('pole', $pole)->pluck('id')->map(fn ($x) => (int) $x)->all();
        }

        $ids = $user->visibleProjectIds();
        if ($ids === null) {
            return null;
        }

        if ($ids instanceof Collection) {
            $ids = $ids->all();
        }

        return array_map('intval', $ids);
    }

    private function resolveDateRange(Request $request, int $year): array
    {
        $duration = (string) $request->get('duration', 'year');

        if ($duration === 'month') {
            $month = (int) $request->get('month', 0);
            if ($month < 1 || $month > 12) {
                abort(422, 'Invalid month');
            }
            $start = Carbon::create($year, $month, 1)->startOfDay();
            $end = $start->copy()->endOfMonth()->endOfDay();
            return [$start, $end, 'month'];
        }

        if ($duration === 'week') {
            $week = $this->normalizeWeekParam($request->get('week'));
            if ($week === null) {
                abort(422, 'Invalid week');
            }
            $dates = WeekHelper::getWeekDates($week, $year);
            $start = $dates['start']->copy()->startOfDay();
            $end = $dates['end']->copy()->endOfDay();
            return [$start, $end, 'week'];
        }

        // year (default): use the KPI week-year boundaries
        $week1Start = WeekHelper::getWeek1Start($year)->startOfDay();
        $yearEnd = $week1Start->copy()->addDays(52 * 7 - 1)->endOfDay();
        return [$week1Start, $yearEnd, 'year'];
    }

    private function normalizeItemIds($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_string($value)) {
            $parts = array_filter(array_map('trim', explode(',', $value)), fn ($x) => $x !== '');
            return array_values(array_unique(array_map('intval', $parts)));
        }

        if (is_array($value)) {
            return array_values(array_unique(array_map('intval', $value)));
        }

        return [];
    }

    public function consumption(Request $request)
    {
        $user = $this->ensureAdminLikeOrHseManager($request);

        $year = (int) $request->get('year', date('Y'));
        [$start, $end, $duration] = $this->resolveDateRange($request, $year);

        $projectIds = $this->visibleProjectIds($request, $user);

        $projectId = $request->get('project_id');
        $projectId = $projectId !== null && $projectId !== '' ? (int) $projectId : null;

        $itemIds = $this->normalizeItemIds($request->get('item_ids'));

        $q = WorkerPpeIssue::query()
            ->join('projects', 'projects.id', '=', 'worker_ppe_issues.project_id')
            ->join('ppe_items', 'ppe_items.id', '=', 'worker_ppe_issues.ppe_item_id')
            ->whereBetween('worker_ppe_issues.received_at', [$start->toDateString(), $end->toDateString()]);

        if ($projectIds !== null) {
            if (count($projectIds) === 0) {
                $q->whereRaw('1 = 0');
            } else {
                $q->whereIn('worker_ppe_issues.project_id', $projectIds);
            }
        }

        if ($projectId) {
            $q->where('worker_ppe_issues.project_id', $projectId);
        }

        if (!empty($itemIds)) {
            $q->whereIn('worker_ppe_issues.ppe_item_id', $itemIds);
        }

        $rows = $q
            ->groupBy([
                'ppe_items.id',
                'ppe_items.name',
                'projects.pole',
                'projects.id',
                'projects.code',
                'projects.name',
            ])
            ->orderBy('ppe_items.name')
            ->orderBy('projects.pole')
            ->select([
                'ppe_items.id as item_id',
                'ppe_items.name as item_name',
                'projects.pole as pole',
                'projects.id as project_id',
                'projects.code as project_code',
                'projects.name as project_name',
                DB::raw('SUM(worker_ppe_issues.quantity) as quantity'),
            ])
            ->get();

        return $this->success([
            'year' => $year,
            'duration' => $duration,
            'range' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'rows' => $rows,
        ]);
    }
}
