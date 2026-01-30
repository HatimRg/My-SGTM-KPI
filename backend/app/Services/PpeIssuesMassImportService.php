<?php

namespace App\Services;

use App\Exports\PpeIssuesMassFailedRowsExport;
use App\Imports\PpeIssuesMassImport;
use App\Models\PpeItem;
use App\Models\PpeProjectStock;
use App\Models\Project;
use App\Models\User;
use App\Models\Worker;
use App\Models\WorkerPpeIssue;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class PpeIssuesMassImportService
{
    public function handle(User $user, UploadedFile $excelFile): array
    {
        $failedRows = [];
        $importedCount = 0;

        $import = new PpeIssuesMassImport();
        Excel::import($import, $excelFile);
        $rows = $import->getRows();

        $firstRow = null;
        foreach ($rows as $r0) {
            $r0 = array_change_key_case((array) $r0, CASE_LOWER);
            if ($this->isRowEmpty($r0)) {
                continue;
            }
            $firstRow = $r0;
            break;
        }

        if ($firstRow === null) {
            $failedRows[] = $this->failRow(null, null, null, null, 'No data rows found in Excel');
        } else {
            $keys = array_keys($firstRow);
            $keys = array_map(fn ($k) => is_string($k) ? strtolower(trim($k)) : (string) $k, $keys);

            $hasCin = count(array_intersect($keys, ['cin', 'cni', 'numero_cin', 'id', 'col_0'])) > 0;
            $hasPpe = count(array_intersect($keys, ['epi', 'ppe', 'ppe_name', 'ppe_item', 'ppe_item_name', 'item', 'col_1'])) > 0;
            $hasQty = count(array_intersect($keys, ['quantite', 'quantité', 'quantity', 'qty', 'col_2'])) > 0;
            $hasDate = count(array_intersect($keys, ['date', 'received_at', 'date_reception', 'date_réception', 'received_date', 'col_3'])) > 0;

            if (!$hasCin || !$hasPpe || !$hasQty || !$hasDate) {
                $failedRows[] = $this->failRow(null, null, null, null, 'Invalid template headers: please use the provided template (PPE)');
            }
        }

        if (!empty($failedRows)) {
            $failedRowsUrl = $this->storeFailedRows($user, $failedRows);

            return [
                'imported' => 0,
                'failed_count' => count($failedRows),
                'failed_rows_url' => $failedRowsUrl,
                'errors' => $failedRows,
            ];
        }

        foreach ($rows as $row) {
            $row = array_change_key_case((array) $row, CASE_LOWER);
            if ($this->isRowEmpty($row)) {
                continue;
            }

            $cinRaw = $this->getColumnValue($row, ['cin', 'cni', 'numero_cin', 'id']);
            $ppeNameRaw = $this->getColumnValue($row, ['epi', 'ppe', 'ppe_name', 'ppe_item', 'ppe_item_name', 'item']);
            $qtyRaw = $this->getColumnValue($row, ['quantite', 'quantité', 'quantity', 'qty']);
            $receivedAtRaw = $this->getColumnValue($row, ['date', 'received_at', 'date_reception', 'date_réception', 'received_date']);

            $cin = $this->normalizeCin($cinRaw);
            $ppeName = $ppeNameRaw !== null ? trim((string) $ppeNameRaw) : null;
            $quantity = $qtyRaw !== null && $qtyRaw !== '' ? (int) $qtyRaw : null;
            $receivedAt = $this->parseDate($receivedAtRaw);

            if (!$cin) {
                $failedRows[] = $this->failRow(null, $ppeName, $quantity, $receivedAt, 'Missing CIN');
                continue;
            }

            if (!$ppeName || trim($ppeName) === '') {
                $failedRows[] = $this->failRow($cin, null, $quantity, $receivedAt, 'Missing ppe_name');
                continue;
            }

            if (!$quantity || $quantity < 1) {
                $failedRows[] = $this->failRow($cin, $ppeName, $quantity, $receivedAt, 'Invalid quantity');
                continue;
            }

            if (!$receivedAt) {
                $failedRows[] = $this->failRow($cin, $ppeName, $quantity, $receivedAt, 'Invalid or missing received_at');
                continue;
            }

            if (Carbon::parse($receivedAt)->gt(now()->startOfDay())) {
                $failedRows[] = $this->failRow($cin, $ppeName, $quantity, $receivedAt, 'Future date not allowed: received_at');
                continue;
            }

            $worker = Worker::query()->where('cin', $cin)->first();
            if (!$worker) {
                $failedRows[] = $this->failRow($cin, $ppeName, $quantity, $receivedAt, 'Worker not found');
                continue;
            }

            if (!$worker->project_id) {
                $failedRows[] = $this->failRow($cin, $ppeName, $quantity, $receivedAt, 'Worker project is required');
                continue;
            }

            $project = Project::find($worker->project_id);
            if ($project && !$user->canAccessProject($project)) {
                $failedRows[] = $this->failRow($cin, $ppeName, $quantity, $receivedAt, 'Access denied');
                continue;
            }

            try {
                DB::transaction(function () use ($user, $worker, $ppeName, $quantity, $receivedAt) {
                    $item = PpeItem::lockForUpdate()->whereRaw('LOWER(name) = ?', [Str::lower($ppeName)])->first();
                    if (!$item) {
                        $item = PpeItem::create([
                            'name' => $ppeName,
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

                    $projectId = (int) $worker->project_id;
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

                    if ((int) $stock->stock_quantity < (int) $quantity) {
                        throw new \RuntimeException('Not enough stock for this PPE item (project stock)');
                    }

                    $stock->update([
                        'stock_quantity' => (int) $stock->stock_quantity - (int) $quantity,
                    ]);

                    WorkerPpeIssue::create([
                        'worker_id' => $worker->id,
                        'project_id' => $projectId,
                        'ppe_item_id' => $item->id,
                        'quantity' => (int) $quantity,
                        'received_at' => $receivedAt,
                        'issued_by' => $user->id,
                    ]);
                });

                $importedCount++;
            } catch (\Throwable $e) {
                $failedRows[] = $this->failRow($cin, $ppeName, $quantity, $receivedAt, $e->getMessage() ?: 'Import failed');
            }
        }

        $failedRowsUrl = null;
        if (!empty($failedRows)) {
            $failedRowsUrl = $this->storeFailedRows($user, $failedRows);
        }

        return [
            'imported' => $importedCount,
            'failed_count' => count($failedRows),
            'failed_rows_url' => $failedRowsUrl,
            'errors' => $failedRows,
        ];
    }

    private function storeFailedRows(User $user, array $failedRows): string
    {
        $filename = 'ppe_issues_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
        $path = 'imports/failed_rows/' . $filename;
        $lang = (string) ($user->preferred_language ?? 'fr');
        $contents = Excel::raw(new PpeIssuesMassFailedRowsExport($failedRows, $lang), ExcelFormat::XLSX);
        Storage::disk('public')->put($path, $contents);
        return '/api/imports/failed-rows/' . $filename;
    }

    private function failRow(?string $cin, ?string $ppeName, $quantity, $receivedAt, string $error): array
    {
        return [
            'cin' => $cin,
            'ppe_name' => $ppeName,
            'quantity' => $quantity,
            'received_at' => $receivedAt,
            'error' => $error,
        ];
    }

    private function isRowEmpty(array $row): bool
    {
        foreach ($row as $v) {
            if ($v === null) {
                continue;
            }
            if (is_string($v) && trim($v) === '') {
                continue;
            }
            return false;
        }
        return true;
    }

    private function getColumnValue(array $row, array $keys)
    {
        foreach ($keys as $key) {
            $k = strtolower(trim((string) $key));
            if (array_key_exists($k, $row)) {
                return $row[$k];
            }
        }
        return null;
    }

    private function normalizeCin($cin): ?string
    {
        if ($cin === null) {
            return null;
        }
        $v = strtoupper(trim((string) $cin));
        $v = preg_replace('/\s+/', '', $v);
        return $v !== '' ? $v : null;
    }

    private function parseDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if (is_numeric($value)) {
                $dt = ExcelDate::excelToDateTimeObject((float) $value);
                return $dt->format('Y-m-d');
            }

            $v = trim((string) $value);
            if ($v === '') {
                return null;
            }

            return Carbon::parse($v)->format('Y-m-d');
        } catch (\Throwable $e) {
            return null;
        }
    }
}
