<?php

namespace App\Imports;

use App\Models\Project;
use App\Models\SorReport;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\SkipsErrors;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class SorReportsImport implements ToModel, WithHeadingRow, SkipsOnError, WithChunkReading, SkipsEmptyRows
{
    use SkipsErrors;

    protected int $userId;
    protected ?array $allowedProjectIds;

    protected int $importedCount = 0;
    protected int $updatedCount = 0;
    protected array $rowErrors = [];

    public function __construct(int $userId, $allowedProjectIds = null)
    {
        $this->userId = $userId;

        if ($allowedProjectIds instanceof \Illuminate\Support\Collection) {
            $allowedProjectIds = $allowedProjectIds->all();
        } elseif ($allowedProjectIds instanceof \Traversable) {
            $allowedProjectIds = iterator_to_array($allowedProjectIds);
        }

        $this->allowedProjectIds = is_array($allowedProjectIds) ? array_map('intval', $allowedProjectIds) : null;
    }

    public function headingRow(): int
    {
        return 3;
    }

    public function model(array $row)
    {
        try {
            $row = $this->normalizeRow($row);

            $projectCode = $this->emptyToNull($row['project_code'] ?? null);
            $observationDateRaw = $row['observation_date'] ?? null;
            $categoryRaw = $this->emptyToNull($row['category'] ?? null);
            $nonConformity = $this->emptyToNull($row['non_conformity'] ?? null);

            if (!empty($projectCode)) {
                $codeUpper = strtoupper(trim((string) $projectCode));
                if (in_array($codeUpper, ['EXEMPLE', 'EXAMPLE'], true)) {
                    return null;
                }
            }

            if (empty($projectCode) || empty($observationDateRaw) || empty($categoryRaw) || empty($nonConformity)) {
                return null;
            }

            $projectCode = strtoupper(trim((string) $projectCode));
            $project = Project::where('code', $projectCode)->first();
            if (!$project) {
                $this->rowErrors[] = ['project_code' => $projectCode, 'error' => "Unknown project code: {$projectCode}"];
                return null;
            }

            $projectId = (int) $project->id;
            if ($this->allowedProjectIds !== null && !in_array($projectId, $this->allowedProjectIds, true)) {
                $this->rowErrors[] = ['project_code' => $projectCode, 'error' => 'Project not allowed for your access scope'];
                return null;
            }

            $observationDate = $this->parseDateToYmd($observationDateRaw);
            if (!$observationDate) {
                $this->rowErrors[] = ['project_code' => $projectCode, 'error' => 'Invalid OBSERVATION_DATE'];
                return null;
            }

            $category = SorReport::normalizeCategory($categoryRaw);
            if (empty($category)) {
                $this->rowErrors[] = ['project_code' => $projectCode, 'error' => 'Invalid CATEGORY'];
                return null;
            }

            $status = $this->emptyToNull($row['status'] ?? null);
            if ($status !== null) {
                $status = strtolower(trim((string) $status));
                if (!in_array($status, [SorReport::STATUS_OPEN, SorReport::STATUS_IN_PROGRESS, SorReport::STATUS_CLOSED], true)) {
                    $this->rowErrors[] = ['project_code' => $projectCode, 'error' => "Invalid STATUS: {$status}"];
                    $status = null;
                }
            }

            $data = [
                'project_id' => $projectId,
                'submitted_by' => $this->userId,
                'company' => $this->emptyToNull($row['company'] ?? null),
                'observation_date' => $observationDate,
                'observation_time' => $this->emptyToNull($row['observation_time'] ?? null),
                'zone' => $this->emptyToNull($row['zone'] ?? null),
                'supervisor' => $this->emptyToNull($row['supervisor'] ?? null),
                'category' => $category,
                'non_conformity' => trim((string) $nonConformity),
                'responsible_person' => $this->emptyToNull($row['responsible_person'] ?? null),
                'deadline' => $this->parseDateToYmd($row['deadline'] ?? null),
                'corrective_action' => $this->emptyToNull($row['corrective_action'] ?? null),
                'corrective_action_date' => $this->parseDateToYmd($row['corrective_action_date'] ?? null),
                'corrective_action_time' => $this->emptyToNull($row['corrective_action_time'] ?? null),
                'notes' => $this->emptyToNull($row['notes'] ?? null),
            ];

            if ($status !== null) {
                $data['status'] = $status;
            }

            if (($data['status'] ?? SorReport::STATUS_OPEN) === SorReport::STATUS_CLOSED) {
                $data['closed_at'] = now();
                $data['closed_by'] = $this->userId;
                $data['is_pinned'] = false;
            }

            $criteria = [
                'project_id' => $projectId,
                'submitted_by' => $this->userId,
                'observation_date' => $observationDate,
                'category' => $category,
                'non_conformity' => trim((string) $nonConformity),
            ];

            $existing = SorReport::where($criteria)->first();

            if ($existing) {
                $existing->update($data);
                $this->updatedCount++;
            } else {
                SorReport::create(array_merge($data, [
                    'status' => $data['status'] ?? SorReport::STATUS_OPEN,
                    'is_pinned' => false,
                ]));
                $this->importedCount++;
            }

            return null;
        } catch (\Throwable $e) {
            Log::warning('SOR bulk import row failed', ['error' => $e->getMessage()]);
            $this->rowErrors[] = ['error' => $e->getMessage()];
            return null;
        }
    }

    public function chunkSize(): int
    {
        return 500;
    }

    protected function normalizeRow(array $row): array
    {
        $out = [];
        foreach ($row as $k => $v) {
            $key = strtolower(trim((string) $k));
            $key = str_replace(['*', '#'], '', $key);
            $key = preg_replace('/\s+/', ' ', $key);
            $key = str_replace(' ', '_', $key);
            $out[$key] = $v;
        }
        return $out;
    }

    protected function emptyToNull($value)
    {
        if ($value === null) {
            return null;
        }
        $v = trim((string) $value);
        return $v === '' ? null : $v;
    }

    protected function parseDateToYmd($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if ($value instanceof \DateTimeInterface) {
                return Carbon::instance($value)->format('Y-m-d');
            }

            if (is_numeric($value)) {
                $dt = ExcelDate::excelToDateTimeObject((float) $value);
                return Carbon::instance($dt)->format('Y-m-d');
            }

            return Carbon::parse((string) $value)->format('Y-m-d');
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function getImportedCount(): int
    {
        return $this->importedCount;
    }

    public function getUpdatedCount(): int
    {
        return $this->updatedCount;
    }

    public function getErrors(): array
    {
        $errors = $this->rowErrors;
        foreach ($this->errors() as $e) {
            $errors[] = ['error' => $e->getMessage()];
        }
        return $errors;
    }
}
