<?php

namespace App\Http\Controllers\Api;

use App\Helpers\WeekHelper;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\SorReport;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SorAnalyticsController extends Controller
{
    private function ensureAdminLikeOrHseManager(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->isAdminLike() && !$user->isHseManager())) {
            abort(403, 'Access denied');
        }
        return $user;
    }

    private function getSorDateRange(int $year): array
    {
        $week1Start = WeekHelper::getWeek1Start($year)->startOfDay();
        $yearEnd = $week1Start->copy()->addDays(52 * 7 - 1)->endOfDay();
        return [$week1Start, $yearEnd];
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

    private function baseQuery(Request $request)
    {
        $user = $this->ensureAdminLikeOrHseManager($request);

        $year = (int) $request->get('year', date('Y'));
        [$week1Start, $yearEnd] = $this->getSorDateRange($year);

        $projectIds = $this->visibleProjectIds($request, $user);

        $projectId = $request->get('project_id');
        $projectId = $projectId !== null && $projectId !== '' ? (int) $projectId : null;

        $week = $this->normalizeWeekParam($request->get('week'));

        $q = SorReport::query()
            ->join('projects', 'projects.id', '=', 'sor_reports.project_id')
            ->leftJoin('users as submitters', 'submitters.id', '=', 'sor_reports.submitted_by')
            ->whereBetween('sor_reports.observation_date', [$week1Start, $yearEnd]);

        if ($projectIds !== null) {
            if (count($projectIds) === 0) {
                $q->whereRaw('1 = 0');
            } else {
                $q->whereIn('sor_reports.project_id', $projectIds);
            }
        }

        if ($projectId) {
            $q->where('sor_reports.project_id', $projectId);
        }

        if ($week !== null) {
            $dates = WeekHelper::getWeekDates($week, $year);
            $start = $dates['start']->copy()->startOfDay();
            $end = $dates['end']->copy()->endOfDay();
            $q->whereBetween('sor_reports.observation_date', [$start, $end]);
        }

        return [$q, $year];
    }

    private function observationTimestampSql(): string
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            return "(sor_reports.observation_date + COALESCE(sor_reports.observation_time, '00:00:00'))";
        }

        if ($driver === 'sqlite') {
            return "datetime(sor_reports.observation_date || ' ' || COALESCE(sor_reports.observation_time, '00:00:00'))";
        }

        // mysql / mariadb
        return "CONCAT(sor_reports.observation_date, ' ', COALESCE(sor_reports.observation_time, '00:00:00'))";
    }

    private function resolutionHoursSql(): string
    {
        $driver = DB::getDriverName();
        $obs = $this->observationTimestampSql();

        if ($driver === 'pgsql') {
            return "GREATEST(0, EXTRACT(EPOCH FROM (sor_reports.closed_at - {$obs})) / 3600.0)";
        }

        if ($driver === 'sqlite') {
            return "MAX(0, (julianday(sor_reports.closed_at) - julianday({$obs})) * 24.0)";
        }

        // mysql / mariadb
        return "GREATEST(0, TIMESTAMPDIFF(HOUR, {$obs}, sor_reports.closed_at))";
    }

    private function percentile(array $sorted, float $p): ?float
    {
        $n = count($sorted);
        if ($n === 0) {
            return null;
        }

        $p = min(1.0, max(0.0, $p));
        if ($n === 1) {
            return (float) $sorted[0];
        }

        $pos = ($n - 1) * $p;
        $low = (int) floor($pos);
        $high = (int) ceil($pos);
        if ($low === $high) {
            return (float) $sorted[$low];
        }

        $weight = $pos - $low;
        return (float) ($sorted[$low] * (1 - $weight) + $sorted[$high] * $weight);
    }

    public function kpis(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $total = (clone $base)->count();
        $unresolved = (clone $base)->where('sor_reports.status', '!=', SorReport::STATUS_CLOSED)->count();
        $resolved = (clone $base)->where('sor_reports.status', SorReport::STATUS_CLOSED)->count();

        $avgResolutionHours = (clone $base)
            ->where('sor_reports.status', SorReport::STATUS_CLOSED)
            ->whereNotNull('sor_reports.closed_at')
            ->avg(DB::raw($this->resolutionHoursSql()));

        $worstTheme = (clone $base)
            ->select('sor_reports.category')
            ->selectRaw("SUM(CASE WHEN sor_reports.status != ? THEN 1 ELSE 0 END) as unresolved_count", [SorReport::STATUS_CLOSED])
            ->selectRaw("AVG(CASE WHEN sor_reports.status = ? AND sor_reports.closed_at IS NOT NULL THEN {$this->resolutionHoursSql()} ELSE NULL END) as avg_resolution_hours", [SorReport::STATUS_CLOSED])
            ->groupBy('sor_reports.category')
            ->orderByDesc('unresolved_count')
            ->orderByDesc('avg_resolution_hours')
            ->first();

        $worstProject = (clone $base)
            ->select('projects.id', 'projects.code', 'projects.name', 'projects.pole')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('projects.id', 'projects.code', 'projects.name', 'projects.pole')
            ->orderByDesc('total')
            ->first();

        $worstUser = (clone $base)
            ->select('submitters.id as user_id', 'submitters.name as user_name')
            ->selectRaw("AVG(CASE WHEN sor_reports.status = ? AND sor_reports.closed_at IS NOT NULL THEN {$this->resolutionHoursSql()} ELSE NULL END) as avg_resolution_hours", [SorReport::STATUS_CLOSED])
            ->selectRaw('COUNT(*) as total')
            ->groupBy('submitters.id', 'submitters.name')
            ->havingRaw('COUNT(*) > 0')
            ->orderByDesc('avg_resolution_hours')
            ->first();

        return $this->success([
            'total' => (int) $total,
            'unresolved' => (int) $unresolved,
            'unresolved_pct' => $total > 0 ? round(($unresolved / $total) * 100, 1) : 0,
            'avg_resolution_hours' => $avgResolutionHours !== null ? round((float) $avgResolutionHours, 2) : null,
            'worst_theme' => $worstTheme ? [
                'key' => $worstTheme->category,
                'label' => SorReport::CATEGORIES[$worstTheme->category] ?? $worstTheme->category,
                'unresolved' => (int) ($worstTheme->unresolved_count ?? 0),
                'avg_resolution_hours' => $worstTheme->avg_resolution_hours !== null ? round((float) $worstTheme->avg_resolution_hours, 2) : null,
            ] : null,
            'worst_project' => $worstProject ? [
                'id' => (int) $worstProject->id,
                'code' => $worstProject->code,
                'name' => $worstProject->name,
                'pole' => $worstProject->pole,
                'total' => (int) ($worstProject->total ?? 0),
            ] : null,
            'highest_avg_resolution_user' => $worstUser ? [
                'id' => (int) $worstUser->user_id,
                'name' => $worstUser->user_name,
                'avg_resolution_hours' => $worstUser->avg_resolution_hours !== null ? round((float) $worstUser->avg_resolution_hours, 2) : null,
            ] : null,
            'resolved' => (int) $resolved,
        ]);
    }

    public function projectPoleStacked(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $rows = (clone $base)
            ->select('projects.id as project_id', 'projects.code', 'projects.name', 'projects.pole')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('projects.id', 'projects.code', 'projects.name', 'projects.pole')
            ->orderByDesc('total')
            ->limit(25)
            ->get();

        $poles = (clone $base)
            ->select('projects.pole')
            ->whereNotNull('projects.pole')
            ->where('projects.pole', '!=', '')
            ->distinct()
            ->orderBy('projects.pole')
            ->pluck('pole')
            ->values()
            ->all();

        $counts = (clone $base)
            ->select('projects.id as project_id', 'projects.pole')
            ->selectRaw('COUNT(*) as count')
            ->groupBy('projects.id', 'projects.pole')
            ->get();

        $byProject = [];
        foreach ($rows as $r) {
            $byProject[(int) $r->project_id] = [
                'project_id' => (int) $r->project_id,
                'project_code' => $r->code,
                'project_name' => $r->name,
                'total' => (int) $r->total,
                'poles' => [],
            ];
        }

        foreach ($counts as $c) {
            $pid = (int) $c->project_id;
            if (!isset($byProject[$pid])) {
                continue;
            }
            $pole = $c->pole ?? '';
            if ($pole === '') {
                $pole = '—';
            }
            $byProject[$pid]['poles'][$pole] = (int) $c->count;
        }

        return $this->success([
            'poles' => $poles,
            'projects' => array_values($byProject),
        ]);
    }

    public function projectTreemap(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $rows = (clone $base)
            ->select('projects.id as project_id', 'projects.code', 'projects.name', 'projects.pole')
            ->selectRaw('COUNT(*) as count')
            ->groupBy('projects.id', 'projects.code', 'projects.name', 'projects.pole')
            ->orderByDesc('count')
            ->limit(40)
            ->get();

        $data = $rows->map(function ($r) {
            $label = ($r->code ?: '') !== '' ? ($r->code . ' - ' . $r->name) : $r->name;
            return [
                'project_id' => (int) $r->project_id,
                'name' => $label,
                'count' => (int) $r->count,
                'pole' => $r->pole,
            ];
        })->values();

        return $this->success([
            'items' => $data,
        ]);
    }

    public function projectPoleHeatmap(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $projects = (clone $base)
            ->select('projects.id as project_id', 'projects.code', 'projects.name')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('projects.id', 'projects.code', 'projects.name')
            ->orderByDesc('total')
            ->limit(15)
            ->get();

        $poles = (clone $base)
            ->select('projects.pole')
            ->whereNotNull('projects.pole')
            ->where('projects.pole', '!=', '')
            ->distinct()
            ->orderBy('projects.pole')
            ->pluck('pole')
            ->values()
            ->all();

        $projectIds = $projects->pluck('project_id')->map(fn ($x) => (int) $x)->all();

        $cells = (clone $base)
            ->select('projects.id as project_id', 'projects.pole')
            ->selectRaw('COUNT(*) as count')
            ->when(!empty($projectIds), function ($q) use ($projectIds) {
                $q->whereIn('projects.id', $projectIds);
            })
            ->groupBy('projects.id', 'projects.pole')
            ->get();

        $matrix = [];
        foreach ($projects as $p) {
            $pid = (int) $p->project_id;
            $label = ($p->code ?: '') !== '' ? ($p->code . ' - ' . $p->name) : $p->name;
            $matrix[$pid] = [
                'project_id' => $pid,
                'project' => $label,
                'values' => [],
            ];
            foreach ($poles as $pole) {
                $matrix[$pid]['values'][$pole] = 0;
            }
        }

        foreach ($cells as $c) {
            $pid = (int) $c->project_id;
            $pole = $c->pole ?? '';
            if ($pole === '' || !isset($matrix[$pid])) {
                continue;
            }
            $matrix[$pid]['values'][$pole] = (int) $c->count;
        }

        return $this->success([
            'poles' => $poles,
            'rows' => array_values($matrix),
        ]);
    }

    public function themeAvgResolution(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $rows = (clone $base)
            ->where('sor_reports.status', SorReport::STATUS_CLOSED)
            ->whereNotNull('sor_reports.closed_at')
            ->select('sor_reports.category')
            ->selectRaw("AVG({$this->resolutionHoursSql()}) as avg_hours")
            ->selectRaw('COUNT(*) as count')
            ->groupBy('sor_reports.category')
            ->orderByDesc('avg_hours')
            ->limit(15)
            ->get();

        $data = $rows->map(function ($r) {
            return [
                'theme_key' => $r->category,
                'theme' => SorReport::CATEGORIES[$r->category] ?? $r->category,
                'avg_hours' => $r->avg_hours !== null ? round((float) $r->avg_hours, 2) : null,
                'count' => (int) $r->count,
            ];
        })->values();

        return $this->success(['items' => $data]);
    }

    public function themeResolutionBox(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $topThemes = (clone $base)
            ->select('sor_reports.category')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('sor_reports.category')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        $themeKeys = $topThemes->pluck('category')->values()->all();

        $times = (clone $base)
            ->where('sor_reports.status', SorReport::STATUS_CLOSED)
            ->whereNotNull('sor_reports.closed_at')
            ->when(!empty($themeKeys), function ($q) use ($themeKeys) {
                $q->whereIn('sor_reports.category', $themeKeys);
            })
            ->select('sor_reports.category')
            ->selectRaw("{$this->resolutionHoursSql()} as hours")
            ->get();

        $byTheme = [];
        foreach ($themeKeys as $k) {
            $byTheme[$k] = [];
        }

        foreach ($times as $t) {
            $k = $t->category;
            if (!array_key_exists($k, $byTheme)) {
                continue;
            }
            $h = $t->hours;
            if ($h === null) {
                continue;
            }
            $byTheme[$k][] = (float) $h;
        }

        $out = [];
        foreach ($byTheme as $k => $values) {
            sort($values);
            $out[] = [
                'theme_key' => $k,
                'theme' => SorReport::CATEGORIES[$k] ?? $k,
                'count' => count($values),
                'min' => $this->percentile($values, 0.0),
                'q1' => $this->percentile($values, 0.25),
                'median' => $this->percentile($values, 0.5),
                'q3' => $this->percentile($values, 0.75),
                'max' => $this->percentile($values, 1.0),
            ];
        }

        usort($out, function ($a, $b) {
            return ($b['median'] ?? 0) <=> ($a['median'] ?? 0);
        });

        return $this->success(['items' => $out]);
    }

    public function themeUnresolvedCount(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $rows = (clone $base)
            ->where('sor_reports.status', '!=', SorReport::STATUS_CLOSED)
            ->select('sor_reports.category')
            ->selectRaw('COUNT(*) as count')
            ->groupBy('sor_reports.category')
            ->orderByDesc('count')
            ->limit(15)
            ->get();

        $data = $rows->map(function ($r) {
            return [
                'theme_key' => $r->category,
                'theme' => SorReport::CATEGORIES[$r->category] ?? $r->category,
                'count' => (int) $r->count,
            ];
        })->values();

        return $this->success(['items' => $data]);
    }

    public function themeResolvedUnresolved(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $rows = (clone $base)
            ->select('sor_reports.category')
            ->selectRaw("SUM(CASE WHEN sor_reports.status = ? THEN 1 ELSE 0 END) as resolved", [SorReport::STATUS_CLOSED])
            ->selectRaw("SUM(CASE WHEN sor_reports.status != ? THEN 1 ELSE 0 END) as unresolved", [SorReport::STATUS_CLOSED])
            ->selectRaw('COUNT(*) as total')
            ->groupBy('sor_reports.category')
            ->orderByDesc('unresolved')
            ->orderByDesc('total')
            ->limit(15)
            ->get();

        $data = $rows->map(function ($r) {
            return [
                'theme_key' => $r->category,
                'theme' => SorReport::CATEGORIES[$r->category] ?? $r->category,
                'resolved' => (int) ($r->resolved ?? 0),
                'unresolved' => (int) ($r->unresolved ?? 0),
                'total' => (int) ($r->total ?? 0),
            ];
        })->values();

        return $this->success(['items' => $data]);
    }

    public function themeBubble(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $themes = (clone $base)
            ->select('sor_reports.category')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('sor_reports.category')
            ->orderByDesc('total')
            ->limit(12)
            ->get();

        $keys = $themes->pluck('category')->values()->all();

        $avg = (clone $base)
            ->where('sor_reports.status', SorReport::STATUS_CLOSED)
            ->whereNotNull('sor_reports.closed_at')
            ->when(!empty($keys), function ($q) use ($keys) {
                $q->whereIn('sor_reports.category', $keys);
            })
            ->select('sor_reports.category')
            ->selectRaw("AVG({$this->resolutionHoursSql()}) as avg_hours")
            ->groupBy('sor_reports.category')
            ->get()
            ->keyBy('category');

        $dominantPoleRows = (clone $base)
            ->when(!empty($keys), function ($q) use ($keys) {
                $q->whereIn('sor_reports.category', $keys);
            })
            ->select('sor_reports.category', 'projects.pole')
            ->selectRaw('COUNT(*) as cnt')
            ->groupBy('sor_reports.category', 'projects.pole')
            ->orderByDesc('cnt')
            ->get();

        $dominantPole = [];
        foreach ($dominantPoleRows as $r) {
            $k = $r->category;
            if (!isset($dominantPole[$k])) {
                $dominantPole[$k] = $r->pole;
            }
        }

        $out = [];
        foreach ($themes as $t) {
            $k = $t->category;
            $avgHours = $avg->get($k)?->avg_hours;
            $out[] = [
                'theme_key' => $k,
                'theme' => SorReport::CATEGORIES[$k] ?? $k,
                'count' => (int) $t->total,
                'avg_hours' => $avgHours !== null ? round((float) $avgHours, 2) : null,
                'pole' => $dominantPole[$k] ?? null,
            ];
        }

        usort($out, function ($a, $b) {
            return (float) ($b['avg_hours'] ?? 0) <=> (float) ($a['avg_hours'] ?? 0);
        });

        return $this->success(['items' => $out]);
    }

    public function userThemeAvgResolution(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $topThemes = (clone $base)
            ->select('sor_reports.category')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('sor_reports.category')
            ->orderByDesc('total')
            ->limit(8)
            ->pluck('category')
            ->values()
            ->all();

        $topUsers = (clone $base)
            ->select('submitters.id as user_id', 'submitters.name as user_name')
            ->selectRaw('COUNT(*) as total')
            ->whereNotNull('submitters.id')
            ->groupBy('submitters.id', 'submitters.name')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        $userIds = $topUsers->pluck('user_id')->map(fn ($x) => (int) $x)->all();

        $cells = (clone $base)
            ->where('sor_reports.status', SorReport::STATUS_CLOSED)
            ->whereNotNull('sor_reports.closed_at')
            ->when(!empty($topThemes), function ($q) use ($topThemes) {
                $q->whereIn('sor_reports.category', $topThemes);
            })
            ->when(!empty($userIds), function ($q) use ($userIds) {
                $q->whereIn('submitters.id', $userIds);
            })
            ->select('submitters.id as user_id', 'sor_reports.category')
            ->selectRaw("AVG({$this->resolutionHoursSql()}) as avg_hours")
            ->groupBy('submitters.id', 'sor_reports.category')
            ->get();

        $rows = [];
        foreach ($topUsers as $u) {
            $uid = (int) $u->user_id;
            $rows[$uid] = [
                'user_id' => $uid,
                'user' => $u->user_name,
                'values' => array_fill_keys($topThemes, null),
            ];
        }

        foreach ($cells as $c) {
            $uid = (int) $c->user_id;
            $k = $c->category;
            if (!isset($rows[$uid]) || !array_key_exists($k, $rows[$uid]['values'])) {
                continue;
            }
            $rows[$uid]['values'][$k] = $c->avg_hours !== null ? round((float) $c->avg_hours, 2) : null;
        }

        $themes = array_map(function ($k) {
            return [
                'key' => $k,
                'label' => SorReport::CATEGORIES[$k] ?? $k,
            ];
        }, $topThemes);

        return $this->success([
            'themes' => $themes,
            'rows' => array_values($rows),
        ]);
    }

    public function poleThemeUnresolvedRate(Request $request)
    {
        [$base] = $this->baseQuery($request);

        $themes = (clone $base)
            ->select('sor_reports.category')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('sor_reports.category')
            ->orderByDesc('total')
            ->limit(10)
            ->pluck('category')
            ->values()
            ->all();

        $poles = (clone $base)
            ->select('projects.pole')
            ->whereNotNull('projects.pole')
            ->where('projects.pole', '!=', '')
            ->distinct()
            ->orderBy('projects.pole')
            ->pluck('pole')
            ->values()
            ->all();

        $cells = (clone $base)
            ->when(!empty($themes), function ($q) use ($themes) {
                $q->whereIn('sor_reports.category', $themes);
            })
            ->select('projects.pole', 'sor_reports.category')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN sor_reports.status != ? THEN 1 ELSE 0 END) as unresolved", [SorReport::STATUS_CLOSED])
            ->groupBy('projects.pole', 'sor_reports.category')
            ->get();

        $rows = [];
        foreach ($poles as $pole) {
            $rows[$pole] = [
                'pole' => $pole,
                'values' => array_fill_keys($themes, null),
            ];
        }

        foreach ($cells as $c) {
            $pole = $c->pole;
            $k = $c->category;
            if (!isset($rows[$pole]) || !array_key_exists($k, $rows[$pole]['values'])) {
                continue;
            }
            $total = (int) ($c->total ?? 0);
            $unresolved = (int) ($c->unresolved ?? 0);
            $rows[$pole]['values'][$k] = $total > 0 ? round(($unresolved / $total) * 100, 1) : null;
        }

        $themeLabels = array_map(function ($k) {
            return [
                'key' => $k,
                'label' => SorReport::CATEGORIES[$k] ?? $k,
            ];
        }, $themes);

        return $this->success([
            'themes' => $themeLabels,
            'poles' => $poles,
            'rows' => array_values($rows),
        ]);
    }
}
