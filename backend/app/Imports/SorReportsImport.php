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
    protected int $headingRow;

    protected int $importedCount = 0;
    protected int $updatedCount = 0;
    protected array $rowErrors = [];

    public function __construct(int $userId, $allowedProjectIds = null, int $headingRow = 3)
    {
        $this->userId = $userId;
        $this->headingRow = $headingRow > 0 ? $headingRow : 3;

        if ($allowedProjectIds instanceof \Illuminate\Support\Collection) {
            $allowedProjectIds = $allowedProjectIds->all();
        } elseif ($allowedProjectIds instanceof \Traversable) {
            $allowedProjectIds = iterator_to_array($allowedProjectIds);
        }

        $this->allowedProjectIds = is_array($allowedProjectIds) ? array_map('intval', $allowedProjectIds) : null;
    }

    public function headingRow(): int
    {
        return $this->headingRow;
    }

    public function model(array $row)
    {
        try {
            $row = $this->normalizeRow($row);

            // If the file doesn't match the expected template (missing headings), avoid a silent 0/0 import.
            // We only record this once.
            if (empty($this->rowErrors)) {
                $requiredKeys = ['project_code', 'observation_date', 'category', 'non_conformity'];
                $missing = array_values(array_filter($requiredKeys, fn ($k) => !array_key_exists($k, $row)));
                if (!empty($missing)) {
                    $this->rowErrors[] = [
                        'error' => 'Invalid template headers. Missing columns: ' . implode(', ', $missing) . '. Detected headers: ' . implode(', ', array_slice(array_keys($row), 0, 40)),
                    ];
                }
            }

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
                $this->rowErrors[] = [
                    'project_code' => $projectCode,
                    'observation_date' => $observationDateRaw,
                    'category' => $categoryRaw,
                    'non_conformity' => $nonConformity,
                    'status' => $row['status'] ?? null,
                    'error' => "Unknown project code: {$projectCode}",
                ];
                return null;
            }

            $projectId = (int) $project->id;
            if ($this->allowedProjectIds !== null && !in_array($projectId, $this->allowedProjectIds, true)) {
                $this->rowErrors[] = [
                    'project_code' => $projectCode,
                    'observation_date' => $observationDateRaw,
                    'category' => $categoryRaw,
                    'non_conformity' => $nonConformity,
                    'status' => $row['status'] ?? null,
                    'error' => 'Project not allowed for your access scope',
                ];
                return null;
            }

            $observationDate = $this->parseDateToYmd($observationDateRaw);
            if (!$observationDate) {
                $this->rowErrors[] = [
                    'project_code' => $projectCode,
                    'observation_date' => $observationDateRaw,
                    'category' => $categoryRaw,
                    'non_conformity' => $nonConformity,
                    'status' => $row['status'] ?? null,
                    'error' => 'Invalid OBSERVATION_DATE',
                ];
                return null;
            }

            $category = SorReport::normalizeCategory($categoryRaw);
            if (empty($category)) {
                $this->rowErrors[] = [
                    'project_code' => $projectCode,
                    'observation_date' => $observationDateRaw,
                    'category' => $categoryRaw,
                    'non_conformity' => $nonConformity,
                    'status' => $row['status'] ?? null,
                    'error' => 'Invalid CATEGORY',
                ];
                return null;
            }

            $status = $this->emptyToNull($row['status'] ?? null);
            if ($status !== null) {
                $status = strtolower(trim((string) $status));
                if (!in_array($status, [SorReport::STATUS_OPEN, SorReport::STATUS_IN_PROGRESS, SorReport::STATUS_CLOSED], true)) {
                    $this->rowErrors[] = [
                        'project_code' => $projectCode,
                        'observation_date' => $observationDateRaw,
                        'category' => $categoryRaw,
                        'non_conformity' => $nonConformity,
                        'status' => $row['status'] ?? null,
                        'error' => "Invalid STATUS: {$status}",
                    ];
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
            $asciiKey = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $key);
            if ($asciiKey !== false && $asciiKey !== null) {
                $key = $asciiKey;
            }
            $key = preg_replace('/[^a-z0-9_]/', '_', $key);
            $key = preg_replace('/_+/', '_', $key);
            $key = trim($key, '_');
            $out[$key] = $v;
        }

        $aliases = [
            'code_projet' => 'project_code',
            'projet' => 'project_code',
            'entreprise' => 'company',
            'societe' => 'company',
            'date_d_observation' => 'observation_date',
            'heure_d_observation' => 'observation_time',
            'superviseur' => 'supervisor',
            'categorie' => 'category',
            'non_conformite' => 'non_conformity',
            'responsable' => 'responsible_person',
            'echeance' => 'deadline',
            'action_corrective' => 'corrective_action',
            'date_action_corrective' => 'corrective_action_date',
            'heure_action_corrective' => 'corrective_action_time',
            'statut' => 'status',
        ];

        foreach ($aliases as $from => $to) {
            if (!array_key_exists($to, $out) && array_key_exists($from, $out)) {
                $out[$to] = $out[$from];
            }
        }

        // Flexible matching for French headers (templates can vary in punctuation/wording).
        // We only fill missing canonical keys.
        if (!array_key_exists('project_code', $out)) {
            $match = $this->matchKey($out, ['/code.*projet/', '/projet.*code/']);
            if ($match) $out['project_code'] = $out[$match];
        }
        if (!array_key_exists('company', $out)) {
            $match = $this->matchKey($out, ['/entreprise/', '/societe/']);
            if ($match) $out['company'] = $out[$match];
        }
        if (!array_key_exists('observation_date', $out)) {
            $match = $this->matchKey($out, ['/date.*observation/', '/date.*observ/']);
            if ($match) $out['observation_date'] = $out[$match];
        }
        if (!array_key_exists('observation_time', $out)) {
            $match = $this->matchKey($out, ['/heure.*observation/', '/heure.*observ/']);
            if ($match) $out['observation_time'] = $out[$match];
        }
        if (!array_key_exists('zone', $out)) {
            $match = $this->matchKey($out, ['/zone/']);
            if ($match) $out['zone'] = $out[$match];
        }
        if (!array_key_exists('supervisor', $out)) {
            $match = $this->matchKey($out, ['/superviseur/', '/supervisor/']);
            if ($match) $out['supervisor'] = $out[$match];
        }
        if (!array_key_exists('category', $out)) {
            $match = $this->matchKey($out, ['/categorie/', '/category/']);
            if ($match) $out['category'] = $out[$match];
        }
        if (!array_key_exists('non_conformity', $out)) {
            $match = $this->matchKey($out, ['/non.*conform/']);
            if ($match) $out['non_conformity'] = $out[$match];
        }
        if (!array_key_exists('responsible_person', $out)) {
            $match = $this->matchKey($out, ['/responsable/', '/responsible/']);
            if ($match) $out['responsible_person'] = $out[$match];
        }
        if (!array_key_exists('deadline', $out)) {
            $match = $this->matchKey($out, ['/echeance/', '/deadline/']);
            if ($match) $out['deadline'] = $out[$match];
        }
        if (!array_key_exists('corrective_action', $out)) {
            $match = $this->matchKey($out, ['/action.*correct/']);
            if ($match) $out['corrective_action'] = $out[$match];
        }
        if (!array_key_exists('corrective_action_date', $out)) {
            $match = $this->matchKey($out, ['/date.*action.*correct/', '/date.*correct/']);
            if ($match) $out['corrective_action_date'] = $out[$match];
        }
        if (!array_key_exists('corrective_action_time', $out)) {
            $match = $this->matchKey($out, ['/heure.*action.*correct/', '/heure.*correct/']);
            if ($match) $out['corrective_action_time'] = $out[$match];
        }
        if (!array_key_exists('status', $out)) {
            $match = $this->matchKey($out, ['/statut/', '/status/']);
            if ($match) $out['status'] = $out[$match];
        }
        if (!array_key_exists('notes', $out)) {
            $match = $this->matchKey($out, ['/notes?/']);
            if ($match) $out['notes'] = $out[$match];
        }

        return $out;
    }

    private function matchKey(array $out, array $patterns): ?string
    {
        foreach (array_keys($out) as $key) {
            $k = (string) $key;
            foreach ($patterns as $pattern) {
                if (@preg_match($pattern, $k)) {
                    if (preg_match($pattern, $k) === 1) {
                        return $k;
                    }
                }
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

            $raw = trim((string) $value);
            if ($raw === '') {
                return null;
            }

            // Prefer day-first parsing for slashed dates (common FR templates), even if time is present.
            // Examples: 16/02/2026, 16/02/2026 00:00, 16/02/2026 00:00:00
            if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/', $raw, $m)) {
                $d = (int) $m[1];
                $mo = (int) $m[2];
                $y = (int) $m[3];
                if ($y < 100) {
                    $y += 2000;
                }
                if ($y >= 1900 && $y <= 2100 && $mo >= 1 && $mo <= 12 && $d >= 1 && $d <= 31) {
                    return sprintf('%04d-%02d-%02d', $y, $mo, $d);
                }
            }

            $formats = [
                'd/m/Y',
                'd/m/Y H:i',
                'd/m/Y H:i:s',
                'd-m-Y',
                'd-m-Y H:i',
                'd-m-Y H:i:s',
                'd.m.Y',
                'd.m.Y H:i',
                'd.m.Y H:i:s',
                'Y-m-d',
                'Y-m-d H:i',
                'Y-m-d H:i:s',
                // US fallback (keep last)
                'm/d/Y',
                'm/d/Y H:i',
                'm/d/Y H:i:s',
            ];
            foreach ($formats as $format) {
                try {
                    return Carbon::createFromFormat($format, $raw)->format('Y-m-d');
                } catch (\Throwable $e) {
                }
            }

            return Carbon::parse($raw)->format('Y-m-d');
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
