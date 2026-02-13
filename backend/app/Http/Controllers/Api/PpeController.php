<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\PpeItem;
use App\Models\PpeProjectStock;
use App\Models\Project;
use App\Models\User;
use App\Models\Worker;
use App\Models\WorkerPpeIssue;
use App\Services\NotificationService;
use App\Services\PpeIssuesMassImportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;

class PpeController extends Controller
{
    private function checkAccess(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->canAccessWorkers()) {
            abort(403, 'You do not have access to PPE management');
        }
        return $user;
    }

    private function ensureStrictAdmin(Request $request)
    {
        $user = $request->user();
        if (!$user || ($user->role !== User::ROLE_ADMIN && $user->role !== User::ROLE_DEV)) {
            abort(403, 'Access denied');
        }
        return $user;
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

    private function ensureWorkerAccess(Request $request, Worker $worker): void
    {
        $user = $this->checkAccess($request);
        $visibleProjectIds = $this->normalizeProjectIds($user->visibleProjectIds());
        if ($visibleProjectIds !== null && !in_array((int) $worker->project_id, array_map('intval', $visibleProjectIds), true)) {
            abort(403, 'Access denied');
        }
    }

    public function massTemplate(Request $request)
    {
        $user = $this->checkAccess($request);

        $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));

        $filename = 'ppe_issues_mass_template.xlsx';
        $contents = Excel::raw(new \App\Exports\PpeIssuesMassTemplateExport(200, $lang), ExcelFormat::XLSX);

        return response($contents, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function massImport(Request $request)
    {
        $user = $this->checkAccess($request);

        $validated = $request->validate([
            'excel' => 'required|file',
        ]);

        try {
            $service = new PpeIssuesMassImportService();
            $result = $service->handle($user, $validated['excel']);
            return $this->success($result, 'Import completed');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage() ?: 'Import failed', 500);
        }
    }

    public function items(Request $request)
    {
        $user = $this->checkAccess($request);

        $projectId = $request->get('project_id');
        $projectId = $projectId !== null && $projectId !== '' ? (int) $projectId : null;

        if ($projectId) {
            $project = Project::findOrFail($projectId);
            if (!$user->canAccessProject($project)) {
                return $this->error('Access denied', 403);
            }

            $query = PpeItem::query()
                ->leftJoin('ppe_project_stocks as pps', function ($join) use ($projectId) {
                    $join->on('pps.ppe_item_id', '=', 'ppe_items.id')
                        ->where('pps.project_id', '=', $projectId);
                })
                ->select([
                    'ppe_items.*',
                    DB::raw('COALESCE(pps.stock_quantity, 0) as stock_quantity'),
                    DB::raw('COALESCE(pps.low_stock_threshold, 0) as low_stock_threshold'),
                ])
                ->orderBy('ppe_items.name');
        } else {
            // Global view across all projects the user can see
            $visibleProjectIds = $this->normalizeProjectIds($user->visibleProjectIds());
            if ($visibleProjectIds !== null && empty($visibleProjectIds)) {
                return $this->success([]);
            }

            $query = PpeItem::query()
                ->leftJoin('ppe_project_stocks as pps', function ($join) use ($visibleProjectIds) {
                    $join->on('pps.ppe_item_id', '=', 'ppe_items.id');
                    if ($visibleProjectIds !== null) {
                        $join->whereIn('pps.project_id', array_map('intval', $visibleProjectIds));
                    }
                })
                ->groupBy([
                    'ppe_items.id',
                    'ppe_items.name',
                    'ppe_items.is_system',
                    'ppe_items.created_by',
                ])
                ->select([
                    'ppe_items.id',
                    'ppe_items.name',
                    'ppe_items.is_system',
                    'ppe_items.created_by',
                    DB::raw('COALESCE(SUM(pps.stock_quantity), 0) as stock_quantity'),
                    DB::raw('COALESCE(SUM(pps.low_stock_threshold), 0) as low_stock_threshold'),
                ])
                ->orderBy('ppe_items.name');
        }

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where('ppe_items.name', 'like', "%{$search}%");
        }

        return $this->success($query->get());
    }

    public function upsertItem(Request $request)
    {
        $user = $this->checkAccess($request);

        $itemId = $request->input('id');

        $data = $request->validate([
            'id' => 'nullable|integer|exists:ppe_items,id',
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('ppe_items', 'name')->ignore($itemId),
            ],
        ]);

        $name = trim((string) $data['name']);

        if (!empty($data['id'])) {
            $item = PpeItem::findOrFail($data['id']);
            $item->update([
                'name' => $name,
            ]);
        } else {
            $item = PpeItem::create([
                'name' => $name,
                'is_system' => false,
                'created_by' => $user->id,
            ]);

            $projectIds = Project::query()->pluck('id');
            foreach ($projectIds as $projectId) {
                PpeProjectStock::query()->updateOrCreate(
                    ['project_id' => (int) $projectId, 'ppe_item_id' => $item->id],
                    ['stock_quantity' => 0, 'low_stock_threshold' => 0]
                );
            }
        }

        return $this->success($item);
    }

    public function deleteItem(Request $request, PpeItem $item)
    {
        $this->checkAccess($request);

        $hasIssues = WorkerPpeIssue::where('ppe_item_id', $item->id)->exists();
        if ($hasIssues) {
            return $this->error('Cannot delete PPE item that has already been issued', 422);
        }

        $item->delete();
        return $this->success(null);
    }

    public function issueToWorker(Request $request)
    {
        $user = $this->checkAccess($request);

        $data = $request->validate([
            'worker_id' => 'required|integer|exists:workers,id',
            'ppe_item_id' => 'nullable|integer|exists:ppe_items,id',
            'ppe_name' => 'nullable|string|max:255',
            'quantity' => 'required|integer|min:1',
            'received_at' => 'required|date',
        ]);

        $worker = Worker::findOrFail($data['worker_id']);
        $this->ensureWorkerAccess($request, $worker);

        $projectId = (int) $worker->project_id;
        if (!$projectId) {
            return $this->error('Worker project is required', 422);
        }

        $quantity = (int) $data['quantity'];

        return DB::transaction(function () use ($data, $user, $worker, $quantity, $projectId) {
            $item = null;

            if (!empty($data['ppe_item_id'])) {
                $item = PpeItem::lockForUpdate()->findOrFail($data['ppe_item_id']);
            } else {
                $name = trim((string) ($data['ppe_name'] ?? ''));
                if ($name === '') {
                    return $this->error('ppe_item_id or ppe_name is required', 422);
                }

                $item = PpeItem::lockForUpdate()->whereRaw('LOWER(name) = ?', [Str::lower($name)])->first();
                if (!$item) {
                    $item = PpeItem::create([
                        'name' => $name,
                        'is_system' => false,
                        'created_by' => $user->id,
                    ]);
                    $item = PpeItem::lockForUpdate()->findOrFail($item->id);

                    $projectIds = Project::query()->pluck('id');
                    foreach ($projectIds as $pid) {
                        PpeProjectStock::query()->updateOrCreate(
                            ['project_id' => (int) $pid, 'ppe_item_id' => $item->id],
                            ['stock_quantity' => 0, 'low_stock_threshold' => 0]
                        );
                    }
                }
            }

            $stock = PpeProjectStock::query()
                ->where('project_id', $projectId)
                ->where('ppe_item_id', $item->id)
                ->lockForUpdate()
                ->first();

            if (!$stock) {
                $stock = PpeProjectStock::query()->create([
                    'project_id' => $projectId,
                    'ppe_item_id' => $item->id,
                    'stock_quantity' => 0,
                    'low_stock_threshold' => 0,
                ]);
                $stock = PpeProjectStock::query()->whereKey($stock->id)->lockForUpdate()->first();
            }

            if ((int) $stock->stock_quantity < $quantity) {
                return $this->error('Not enough stock for this PPE item (project stock)', 422);
            }

            $stock->update([
                'stock_quantity' => (int) $stock->stock_quantity - $quantity,
            ]);

            $issue = WorkerPpeIssue::create([
                'worker_id' => $worker->id,
                'project_id' => $projectId,
                'ppe_item_id' => $item->id,
                'quantity' => $quantity,
                'received_at' => $data['received_at'],
                'issued_by' => $user->id,
            ]);

            $issue->load('ppeItem');

            $this->notifyLowStockIfNeeded($projectId, $stock, $item, $user->id);
            return $this->success($issue, 'PPE issued successfully');
        });
    }

    public function restock(Request $request)
    {
        $user = $this->checkAccess($request);

        $data = $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'ppe_item_id' => 'nullable|integer|exists:ppe_items,id',
            'ppe_name' => 'nullable|string|max:255',
            'quantity' => 'required|integer|min:1',
            'low_stock_threshold' => 'nullable|integer|min:0',
        ]);

        $project = Project::findOrFail((int) $data['project_id']);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $quantity = (int) $data['quantity'];

        return DB::transaction(function () use ($data, $user, $project, $quantity) {
            $item = null;
            if (!empty($data['ppe_item_id'])) {
                $item = PpeItem::lockForUpdate()->findOrFail($data['ppe_item_id']);
            } else {
                $name = trim((string) ($data['ppe_name'] ?? ''));
                if ($name === '') {
                    return $this->error('ppe_item_id or ppe_name is required', 422);
                }

                $item = PpeItem::lockForUpdate()->whereRaw('LOWER(name) = ?', [Str::lower($name)])->first();
                if (!$item) {
                    $item = PpeItem::create([
                        'name' => $name,
                        'is_system' => false,
                        'created_by' => $user->id,
                    ]);
                    $item = PpeItem::lockForUpdate()->findOrFail($item->id);

                    $projectIds = Project::query()->pluck('id');
                    foreach ($projectIds as $pid) {
                        PpeProjectStock::query()->updateOrCreate(
                            ['project_id' => (int) $pid, 'ppe_item_id' => $item->id],
                            ['stock_quantity' => 0, 'low_stock_threshold' => 0]
                        );
                    }
                }
            }

            $stock = PpeProjectStock::query()
                ->where('project_id', $project->id)
                ->where('ppe_item_id', $item->id)
                ->lockForUpdate()
                ->first();

            if (!$stock) {
                $stock = PpeProjectStock::query()->create([
                    'project_id' => $project->id,
                    'ppe_item_id' => $item->id,
                    'stock_quantity' => 0,
                    'low_stock_threshold' => 0,
                ]);
                $stock = PpeProjectStock::query()->whereKey($stock->id)->lockForUpdate()->first();
            }

            $updates = [
                'stock_quantity' => (int) $stock->stock_quantity + $quantity,
                'low_stock_notified_at' => null,
            ];

            if (array_key_exists('low_stock_threshold', $data) && $data['low_stock_threshold'] !== null) {
                $updates['low_stock_threshold'] = (int) $data['low_stock_threshold'];
            }

            $stock->update($updates);

            return $this->success([
                'project_id' => $project->id,
                'ppe_item_id' => $item->id,
                'stock_quantity' => (int) $stock->stock_quantity,
                'low_stock_threshold' => (int) $stock->low_stock_threshold,
            ], 'PPE stock updated');
        });
    }

    private function notifyLowStockIfNeeded(int $projectId, PpeProjectStock $stock, PpeItem $item, ?int $excludeUserId = null): void
    {
        $threshold = (int) $stock->low_stock_threshold;
        if ($threshold <= 0) {
            return;
        }

        if ((int) $stock->stock_quantity > $threshold) {
            return;
        }

        if ($stock->low_stock_notified_at && $stock->low_stock_notified_at->gt(now()->subHours(12))) {
            return;
        }

        $project = Project::find($projectId);
        if (!$project) {
            return;
        }

        $projectUserIds = $project->users()->pluck('users.id')->toArray();
        $adminIds = User::query()->where('role', 'admin')->where('is_active', true)->pluck('id')->toArray();
        $userIds = array_values(array_unique(array_merge($projectUserIds, $adminIds)));

        if ($excludeUserId) {
            $userIds = array_values(array_filter($userIds, fn ($id) => (int) $id !== (int) $excludeUserId));
        }

        NotificationService::sendToUsers(
            $userIds,
            Notification::TYPE_PPE_LOW_STOCK,
            'Stock EPI faible',
            "Stock faible pour {$item->name} : {$stock->stock_quantity} (seuil {$threshold})",
            [
                'project_id' => $projectId,
                'icon' => 'alert-triangle',
                'action_url' => '/admin/ppe',
                'data' => [
                    'project_id' => $projectId,
                    'ppe_item_id' => $item->id,
                    'stock_quantity' => (int) $stock->stock_quantity,
                    'low_stock_threshold' => $threshold,
                ],
            ]
        );

        $stock->update(['low_stock_notified_at' => now()]);
    }

    public function workerIssues(Request $request, Worker $worker)
    {
        $this->ensureWorkerAccess($request, $worker);

        $issues = WorkerPpeIssue::with('ppeItem')
            ->where('worker_id', $worker->id)
            ->orderBy('received_at', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        return $this->success($issues);
    }

    public function issues(Request $request)
    {
        $user = $this->checkAccess($request);

        $query = WorkerPpeIssue::with(['ppeItem', 'worker.project']);

        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null) {
            if (count($visibleProjectIds) === 0) {
                return $this->success([]);
            }
            $query->whereHas('worker', function ($q) use ($visibleProjectIds) {
                $q->whereIn('project_id', $visibleProjectIds);
            });
        }

        if ($request->filled('worker_id')) {
            $query->where('worker_id', $request->get('worker_id'));
        }

        if ($request->filled('ppe_item_id')) {
            $query->where('ppe_item_id', $request->get('ppe_item_id'));
        }

        if ($request->filled('project_id')) {
            $query->whereHas('worker', function ($q) use ($request) {
                $q->where('project_id', $request->get('project_id'));
            });
        }

        return $this->success($query->orderBy('received_at', 'desc')->orderBy('id', 'desc')->get());
    }

    public function pendingValidationReport(Request $request)
    {
        $this->ensureStrictAdmin($request);

        $validated = $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'item_ids' => 'required',
        ]);

        $project = Project::findOrFail((int) $validated['project_id']);
        $itemIds = $this->normalizeItemIds($validated['item_ids']);
        if (count($itemIds) === 0) {
            return $this->error('No PPE items selected', 422);
        }

        $end = Carbon::today();
        $startWeek = $end->copy()->subDays(6);
        $startMonth = $end->copy()->subMonth()->addDay();

        $stocks = PpeProjectStock::query()
            ->where('project_id', $project->id)
            ->whereIn('ppe_item_id', $itemIds)
            ->pluck('stock_quantity', 'ppe_item_id');

        $weekAgg = WorkerPpeIssue::query()
            ->where('project_id', $project->id)
            ->whereIn('ppe_item_id', $itemIds)
            ->whereBetween('received_at', [$startWeek->toDateString(), $end->toDateString()])
            ->groupBy('ppe_item_id')
            ->select(['ppe_item_id', DB::raw('SUM(quantity) as qty')])
            ->pluck('qty', 'ppe_item_id');

        $monthAgg = WorkerPpeIssue::query()
            ->where('project_id', $project->id)
            ->whereIn('ppe_item_id', $itemIds)
            ->whereBetween('received_at', [$startMonth->toDateString(), $end->toDateString()])
            ->groupBy('ppe_item_id')
            ->select(['ppe_item_id', DB::raw('SUM(quantity) as qty')])
            ->pluck('qty', 'ppe_item_id');

        $items = PpeItem::query()->whereIn('id', $itemIds)->orderBy('name')->get(['id', 'name']);

        $hseManager = $project->hseManagers()->orderBy('project_user.assigned_at', 'desc')->first();
        $currentWorkers = Worker::query()->where('project_id', $project->id)->where('is_active', true)->count();

        $rows = [];
        foreach ($items as $it) {
            $id = (int) $it->id;
            $rows[] = [
                'item_id' => $id,
                'item_name' => $it->name,
                'article' => $it->name,
                'current_stock' => (int) ($stocks[$id] ?? 0),
                'distributed_last_week' => (int) ($weekAgg[$id] ?? 0),
                'distributed_last_month' => (int) ($monthAgg[$id] ?? 0),
            ];
        }

        return $this->success([
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'pole' => $project->pole,
                'hse_manager_name' => $hseManager?->name,
                'hse_manager_email' => $hseManager?->email,
                'current_total_workers' => $currentWorkers,
            ],
            'report_date' => $end->toDateString(),
            'rows' => $rows,
        ]);
    }

    public function pendingValidationDetails(Request $request)
    {
        $this->ensureStrictAdmin($request);

        $validated = $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'item_id' => 'required|integer|exists:ppe_items,id',
        ]);

        $projectId = (int) $validated['project_id'];
        $itemId = (int) $validated['item_id'];

        $end = Carbon::today();
        $start = $end->copy()->subMonth()->addDay();

        $rows = WorkerPpeIssue::query()
            ->join('workers', 'workers.id', '=', 'worker_ppe_issues.worker_id')
            ->where('worker_ppe_issues.project_id', $projectId)
            ->where('worker_ppe_issues.ppe_item_id', $itemId)
            ->whereBetween('worker_ppe_issues.received_at', [$start->toDateString(), $end->toDateString()])
            ->orderBy('worker_ppe_issues.received_at', 'desc')
            ->orderBy('worker_ppe_issues.id', 'desc')
            ->select([
                'workers.cin as cin',
                DB::raw("CONCAT(COALESCE(workers.prenom,''), ' ', COALESCE(workers.nom,'')) as name"),
                'worker_ppe_issues.quantity as quantity',
                'worker_ppe_issues.received_at as date',
            ])
            ->get();

        return $this->success([
            'range' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'rows' => $rows,
        ]);
    }

    public function pendingValidationDownload(Request $request)
    {
        $this->ensureStrictAdmin($request);

        $validated = $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'item_ids' => 'required',
        ]);

        // Reuse report computation
        $project = Project::findOrFail((int) $validated['project_id']);
        $itemIds = $this->normalizeItemIds($validated['item_ids']);
        if (count($itemIds) === 0) {
            return $this->error('No PPE items selected', 422);
        }

        $end = Carbon::today();
        $startWeek = $end->copy()->subDays(6);
        $startMonth = $end->copy()->subMonth()->addDay();

        $stocks = PpeProjectStock::query()
            ->where('project_id', $project->id)
            ->whereIn('ppe_item_id', $itemIds)
            ->pluck('stock_quantity', 'ppe_item_id');

        $weekAgg = WorkerPpeIssue::query()
            ->where('project_id', $project->id)
            ->whereIn('ppe_item_id', $itemIds)
            ->whereBetween('received_at', [$startWeek->toDateString(), $end->toDateString()])
            ->groupBy('ppe_item_id')
            ->select(['ppe_item_id', DB::raw('SUM(quantity) as qty')])
            ->pluck('qty', 'ppe_item_id');

        $monthAgg = WorkerPpeIssue::query()
            ->where('project_id', $project->id)
            ->whereIn('ppe_item_id', $itemIds)
            ->whereBetween('received_at', [$startMonth->toDateString(), $end->toDateString()])
            ->groupBy('ppe_item_id')
            ->select(['ppe_item_id', DB::raw('SUM(quantity) as qty')])
            ->pluck('qty', 'ppe_item_id');

        $items = PpeItem::query()->whereIn('id', $itemIds)->orderBy('name')->get(['id', 'name']);

        $rows = [];
        foreach ($items as $it) {
            $id = (int) $it->id;
            $rows[] = [
                'item_id' => $id,
                'item_name' => $it->name,
                'article' => $it->name,
                'current_stock' => (int) ($stocks[$id] ?? 0),
                'distributed_last_week' => (int) ($weekAgg[$id] ?? 0),
                'distributed_last_month' => (int) ($monthAgg[$id] ?? 0),
            ];
        }

        $hseManager = $project->hseManagers()->orderBy('project_user.assigned_at', 'desc')->first();
        $currentWorkers = Worker::query()->where('project_id', $project->id)->where('is_active', true)->count();

        $meta = [
            'project_name' => $project->name,
            'project_pole' => $project->pole,
            'hse_manager_name' => $hseManager?->name,
            'hse_manager_email' => $hseManager?->email,
            'current_total_workers' => $currentWorkers,
            'report_date' => $end->toDateString(),
        ];

        $filename = 'ppe_pending_validation_' . ($project->code ?: $project->id) . '_' . date('Y-m-d_His') . '.xlsx';
        return Excel::download(new \App\Exports\PpePendingValidationReportExport($meta, $rows), $filename);
    }
}
