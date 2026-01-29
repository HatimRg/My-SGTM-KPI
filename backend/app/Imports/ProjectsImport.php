<?php

namespace App\Imports;

use App\Models\Project;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Throwable;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\WithChunkReading;

class ProjectsImport implements ToModel, WithHeadingRow, SkipsOnError, WithChunkReading
{
    protected int $userId;
    protected int $importedCount = 0;
    protected int $updatedCount = 0;
    protected array $rowErrors = [];
    protected array $skippedErrors = [];
    protected array $seenCodes = [];

    public function __construct(int $userId)
    {
        $this->userId = $userId;
    }

    public function headingRow(): int
    {
        return 3;
    }

    public function model(array $row)
    {
        try {
            $row = array_change_key_case($row, CASE_LOWER);

            $code = $this->getColumnValue($row, ['code', 'project_code']);
            $name = $this->getColumnValue($row, ['nom', 'name', 'project_name']);

            $hasAnyValue = false;
            foreach ([$code, $name] as $v) {
                if ($v !== null && trim((string) $v) !== '') {
                    $hasAnyValue = true;
                    break;
                }
            }

            if (!$hasAnyValue) {
                return null;
            }

            if (empty($code) || empty($name)) {
                $missing = [];
                if (empty($code)) {
                    $missing[] = 'CODE';
                }
                if (empty($name)) {
                    $missing[] = 'NAME';
                }
                $this->rowErrors[] = [
                    'code' => $code ? strtoupper(trim((string) $code)) : null,
                    'error' => 'Missing required fields' . (count($missing) ? ': ' . implode(',', $missing) : ''),
                ];
                return null;
            }

            $code = strtoupper(trim((string) $code));
            $name = trim((string) $name);

            if (isset($this->seenCodes[$code])) {
                $this->rowErrors[] = ['code' => $code, 'error' => 'Duplicate CODE in import file'];
                return null;
            }
            $this->seenCodes[$code] = true;

            $status = $this->getColumnValue($row, ['statut', 'status']);
            $status = $status ? trim((string) $status) : null;

            $allowedStatuses = [
                Project::STATUS_ACTIVE,
                Project::STATUS_COMPLETED,
                Project::STATUS_ON_HOLD,
                Project::STATUS_CANCELLED,
            ];
            if ($status && !in_array($status, $allowedStatuses, true)) {
                $this->rowErrors[] = ['code' => $code, 'error' => 'Invalid status'];
                $status = null;
            }

            $startDate = $this->parseDate($this->getColumnValue($row, ['date_debut', 'start_date']));
            $endDate = $this->parseDate($this->getColumnValue($row, ['date_fin', 'end_date']));

            $data = [
                'name' => $name,
                'description' => $this->getColumnValue($row, ['description', 'desc']),
                'location' => $this->getColumnValue($row, ['localisation', 'location']),
                'start_date' => $startDate,
                'end_date' => $endDate,
                'status' => $status ?: Project::STATUS_ACTIVE,
                'pole' => $this->emptyToNull($this->getColumnValue($row, ['pole'])),
                'client_name' => $this->emptyToNull($this->getColumnValue($row, ['client', 'client_name'])),
            ];

            $existing = Project::where('code', $code)->first();

            if ($existing) {
                $existing->update($data);
                $this->updatedCount++;
                $project = $existing;
            } else {
                $project = Project::create(array_merge($data, [
                    'code' => $code,
                    'created_by' => $this->userId,
                ]));
                $this->importedCount++;
            }

            $emailsRaw = $this->getColumnValue($row, ['responsables_emails', 'responsables', 'responsable_emails', 'responsible_emails']);
            if ($emailsRaw) {
                $emails = array_filter(array_map('trim', preg_split('/[,;]+/', (string) $emailsRaw)));
                if (!empty($emails)) {
                    $userIds = User::whereIn('email', $emails)->pluck('id')->toArray();
                    if (count($userIds) !== count($emails)) {
                        $this->rowErrors[] = ['code' => $code, 'error' => 'One or more responsable emails not found'];
                    }
                    if (!empty($userIds)) {
                        $project->users()->syncWithoutDetaching($userIds);
                    }
                }
            }

            return null;
        } catch (\Throwable $e) {
            Log::warning('Projects import row failed', ['error' => $e->getMessage()]);
            $this->rowErrors[] = ['error' => $e->getMessage()];
            return null;
        }
    }

    protected function getColumnValue(array $row, array $possibleNames)
    {
        foreach ($possibleNames as $name) {
            if (isset($row[$name]) && $row[$name] !== null && $row[$name] !== '') {
                return $row[$name];
            }
            $spaceName = str_replace('_', ' ', $name);
            if (isset($row[$spaceName]) && $row[$spaceName] !== null && $row[$spaceName] !== '') {
                return $row[$spaceName];
            }
        }
        return null;
    }

    protected function parseDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if ($value instanceof \DateTime) {
                return $value->format('Y-m-d');
            }

            if (is_numeric($value)) {
                return Carbon::instance(\PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value))->format('Y-m-d');
            }

            $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'd.m.Y', 'm/d/Y'];
            foreach ($formats as $format) {
                try {
                    return Carbon::createFromFormat($format, trim((string) $value))->format('Y-m-d');
                } catch (\Exception $e) {
                }
            }

            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }

    protected function emptyToNull($value)
    {
        if ($value === null) {
            return null;
        }
        $v = trim((string) $value);
        return $v === '' ? null : $v;
    }

    public function chunkSize(): int
    {
        return 500;
    }

    public function onError(Throwable $e)
    {
        $this->skippedErrors[] = $e;
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
        foreach ($this->skippedErrors as $e) {
            $errors[] = ['error' => $e->getMessage()];
        }
        return $errors;
    }
}
