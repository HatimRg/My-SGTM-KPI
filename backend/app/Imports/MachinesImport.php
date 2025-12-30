<?php

namespace App\Imports;

use App\Models\Machine;
use App\Models\Project;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\SkipsErrors;
use Maatwebsite\Excel\Concerns\WithChunkReading;

class MachinesImport implements ToModel, WithHeadingRow, SkipsOnError, WithChunkReading
{
    use SkipsErrors;

    protected int $userId;
    protected ?array $allowedProjectIds;

    protected int $importedCount = 0;
    protected int $updatedCount = 0;
    protected array $rowErrors = [];
    protected array $seenSerials = [];

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
            $row = array_change_key_case($row, CASE_LOWER);

            $serial = $this->getColumnValue($row, ['serial_number', 'serial', 'sn']);
            $type = $this->getColumnValue($row, ['machine_type', 'type']);
            $brand = $this->getColumnValue($row, ['brand', 'marque']);

            if (empty($serial) || empty($type) || empty($brand)) {
                return null;
            }

            $serial = trim((string) $serial);
            $type = trim((string) $type);
            $brand = trim((string) $brand);

            if (isset($this->seenSerials[$serial])) {
                $this->rowErrors[] = ['serial_number' => $serial, 'error' => 'Duplicate SERIAL_NUMBER in import file'];
                return null;
            }
            $this->seenSerials[$serial] = true;

            $internal = $this->emptyToNull($this->getColumnValue($row, ['internal_code', 'code_interne', 'internal']));
            if ($internal !== null) {
                $internal = trim((string) $internal);
                if ($internal === '') {
                    $internal = null;
                }
            }

            $model = $this->emptyToNull($this->getColumnValue($row, ['model', 'modele', 'modèle']));
            if ($model !== null) {
                $model = trim((string) $model);
                if ($model === '') {
                    $model = null;
                }
            }

            $activeRaw = $this->getColumnValue($row, ['actif', 'is_active', 'active']);
            $isActive = $this->parseActive($activeRaw);

            $projectCode = $this->emptyToNull($this->getColumnValue($row, ['project_code', 'project', 'code_projet', 'projet']));
            $projectId = null;
            if ($projectCode !== null) {
                $projectCode = strtoupper(trim((string) $projectCode));
                if ($projectCode !== '') {
                    $project = Project::where('code', $projectCode)->first();
                    if (!$project) {
                        $this->rowErrors[] = ['serial_number' => $serial, 'error' => "Unknown project code: {$projectCode}"];
                    } else {
                        $projectId = (int) $project->id;

                        if ($this->allowedProjectIds !== null && !in_array($projectId, $this->allowedProjectIds, true)) {
                            $this->rowErrors[] = ['serial_number' => $serial, 'error' => 'Project not allowed for your access scope'];
                            $projectId = null;
                        }
                    }
                }
            }

            if ($internal !== null) {
                $existingInternal = Machine::where('internal_code', $internal)->first();
                if ($existingInternal && (string) $existingInternal->serial_number !== $serial) {
                    $this->rowErrors[] = ['serial_number' => $serial, 'error' => 'INTERNAL_CODE already used by another machine'];
                    $internal = null;
                }
            }

            $existing = Machine::where('serial_number', $serial)->first();

            $data = [
                'internal_code' => $internal,
                'machine_type' => $type,
                'brand' => $brand,
                'model' => $model,
                'project_id' => $projectId,
                'is_active' => $isActive,
                'updated_by' => $this->userId,
            ];

            if ($existing) {
                $existing->update($data);
                $this->updatedCount++;
            } else {
                Machine::create(array_merge($data, [
                    'serial_number' => $serial,
                    'created_by' => $this->userId,
                ]));
                $this->importedCount++;
            }

            return null;
        } catch (\Throwable $e) {
            Log::warning('Machines import row failed', ['error' => $e->getMessage()]);
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

    protected function emptyToNull($value)
    {
        if ($value === null) {
            return null;
        }
        $v = trim((string) $value);
        return $v === '' ? null : $v;
    }

    protected function normalizeString($value): string
    {
        $str = trim((string) $value);
        $str = preg_replace('/\s+/', ' ', $str);
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str);
        if (is_string($ascii) && $ascii !== '') {
            $str = $ascii;
        }
        return strtolower($str);
    }

    protected function parseActive($value): bool
    {
        if ($value === null || $value === '') {
            return true;
        }

        $key = $this->normalizeString($value);
        if (in_array($key, ['inactif', 'inactive', '0', 'false', 'non', 'no'], true)) {
            return false;
        }
        if (in_array($key, ['actif', 'active', '1', 'true', 'oui', 'yes'], true)) {
            return true;
        }

        return true;
    }

    public function chunkSize(): int
    {
        return 500;
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
