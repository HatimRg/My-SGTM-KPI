<?php

namespace App\Imports;

use App\Models\Machine;
use App\Models\Project;
use App\Support\MachineTypeCatalog;
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

            $normalized = [];
            foreach ($row as $k => $v) {
                $kNorm = trim((string) $k);
                $kNorm = rtrim($kNorm, " \t\n\r\0\x0B*");
                if ($kNorm === '') {
                    continue;
                }

                if (!array_key_exists($kNorm, $row) && !array_key_exists($kNorm, $normalized)) {
                    $normalized[$kNorm] = $v;
                }
            }
            if (!empty($normalized)) {
                $row = $row + $normalized;
            }

            $serial = $this->getColumnValue($row, ['serial_number', 'serial', 'sn', 'numero_de_serie', 'numero_de_serie', 'numero_de_série']);
            $type = $this->getColumnValue($row, ['machine_type', 'type', 'type_engin', 'type_d_engin', 'type_dengin']);
            $brand = $this->getColumnValue($row, ['brand', 'marque']);

            if (empty($serial) || empty($type) || empty($brand)) {
                if (!$this->isRowEmpty($row)) {
                    $missing = [];
                    if (empty($serial)) {
                        $missing[] = 'SERIAL_NUMBER';
                    }
                    if (empty($type)) {
                        $missing[] = 'MACHINE_TYPE';
                    }
                    if (empty($brand)) {
                        $missing[] = 'BRAND';
                    }
                    $this->rowErrors[] = [
                        'serial_number' => $serial ? trim((string) $serial) : null,
                        'error' => 'Missing required fields: ' . implode(', ', $missing),
                    ];
                }
                return null;
            }

            $serial = trim((string) $serial);
            $type = trim((string) $type);
            $brand = trim((string) $brand);

            $typeKey = MachineTypeCatalog::keyFromInput($type);
            if (!$typeKey) {
                $this->rowErrors[] = ['serial_number' => $serial, 'error' => "Invalid MACHINE_TYPE: {$type}"];
                return null;
            }

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

            $projectInput = $this->emptyToNull($this->getColumnValue($row, [
                'project_name',
                'project_code',
                'project',
                'nom_du_projet',
                'nom_projet',
                'code_projet',
                'projet',
            ]));
            $projectId = $this->resolveProjectId($projectInput, $serial);

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
                'machine_type' => $typeKey,
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

    protected function isRowEmpty(array $row): bool
    {
        foreach ($row as $v) {
            if ($v === null) {
                continue;
            }
            if (trim((string) $v) !== '') {
                return false;
            }
        }
        return true;
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

    protected function resolveProjectId($input, string $serial): ?int
    {
        if ($input === null) {
            return null;
        }

        $raw = trim((string) $input);
        if ($raw === '') {
            return null;
        }

        $raw = preg_replace('/\s+/', ' ', $raw);

        $candidateCode = null;
        if (preg_match('/\(([^)]+)\)\s*$/', $raw, $m)) {
            $candidateCode = strtoupper(trim((string) $m[1]));
        }

        if ($candidateCode !== null && $candidateCode !== '') {
            $project = Project::query()->where('code', $candidateCode);
            if ($this->allowedProjectIds !== null) {
                $project->whereIn('id', $this->allowedProjectIds);
            }
            $project = $project->first();
            if (!$project) {
                $this->rowErrors[] = ['serial_number' => $serial, 'error' => "Unknown project code: {$candidateCode}"];
                return null;
            }
            return (int) $project->id;
        }

        $projectName = $raw;
        $query = Project::query()->where('name', $projectName);
        if ($this->allowedProjectIds !== null) {
            $query->whereIn('id', $this->allowedProjectIds);
        }
        $matches = $query->select(['id', 'code', 'name'])->get();

        if ($matches->count() === 1) {
            return (int) $matches->first()->id;
        }
        if ($matches->count() > 1) {
            $this->rowErrors[] = ['serial_number' => $serial, 'error' => "Ambiguous project name: {$projectName}"];
            return null;
        }

        $code = strtoupper($projectName);
        $query = Project::query()->where('code', $code);
        if ($this->allowedProjectIds !== null) {
            $query->whereIn('id', $this->allowedProjectIds);
        }
        $project = $query->first();
        if ($project) {
            return (int) $project->id;
        }

        $this->rowErrors[] = ['serial_number' => $serial, 'error' => "Unknown project: {$projectName}"];
        return null;
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
