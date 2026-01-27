<?php

namespace App\Imports;

use App\Models\AwarenessSession;
use App\Models\Project;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\SkipsErrors;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class AwarenessSessionsImport implements ToModel, WithHeadingRow, SkipsOnError, WithChunkReading, SkipsEmptyRows
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
            $dateRaw = $row['date'] ?? null;
            $byName = $this->emptyToNull($row['by_name'] ?? null);
            $theme = $this->emptyToNull($row['theme'] ?? null);
            $durationMinutes = $this->emptyToNull($row['duration_minutes'] ?? null);
            $participants = $this->emptyToNull($row['participants'] ?? null);

            if (!empty($projectCode)) {
                $codeUpper = strtoupper(trim((string) $projectCode));
                if (in_array($codeUpper, ['EXEMPLE', 'EXAMPLE'], true)) {
                    return null;
                }
            }

            if (empty($projectCode) || empty($dateRaw) || empty($byName) || empty($theme) || empty($durationMinutes) || empty($participants)) {
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

            $date = $this->parseDateToYmd($dateRaw);
            if (!$date) {
                $this->rowErrors[] = ['project_code' => $projectCode, 'error' => 'Invalid DATE'];
                return null;
            }

            $durationMinutes = (int) $durationMinutes;
            $participants = (int) $participants;

            if ($durationMinutes <= 0 || $participants <= 0) {
                $this->rowErrors[] = ['project_code' => $projectCode, 'error' => 'Invalid DURATION_MINUTES or PARTICIPANTS'];
                return null;
            }

            $carbon = Carbon::createFromFormat('Y-m-d', $date);
            $weekNumber = $this->emptyToNull($row['week_number'] ?? null);
            $weekYear = $this->emptyToNull($row['week_year'] ?? null);

            $weekNumber = $weekNumber !== null ? (int) $weekNumber : (int) $carbon->isoWeek();
            $weekYear = $weekYear !== null ? (int) $weekYear : (int) $carbon->isoWeekYear();

            $sessionHoursRaw = $this->emptyToNull($row['session_hours'] ?? null);
            $sessionHours = $sessionHoursRaw !== null
                ? (float) $sessionHoursRaw
                : (($durationMinutes / 60) * $participants);

            $criteria = [
                'project_id' => $projectId,
                'submitted_by' => $this->userId,
                'date' => $date,
                'theme' => trim((string) $theme),
                'by_name' => trim((string) $byName),
            ];

            $data = [
                'project_id' => $projectId,
                'submitted_by' => $this->userId,
                'date' => $date,
                'week_number' => $weekNumber,
                'week_year' => $weekYear,
                'by_name' => trim((string) $byName),
                'theme' => trim((string) $theme),
                'duration_minutes' => $durationMinutes,
                'participants' => $participants,
                'session_hours' => $sessionHours,
            ];

            $existing = AwarenessSession::where($criteria)->first();

            if ($existing) {
                $existing->update($data);
                $this->updatedCount++;
            } else {
                AwarenessSession::create($data);
                $this->importedCount++;
            }

            return null;
        } catch (\Throwable $e) {
            Log::warning('Awareness bulk import row failed', ['error' => $e->getMessage()]);
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
            'anime_par' => 'by_name',
            'animateur' => 'by_name',
            'theme' => 'theme',
            'duree_minutes' => 'duration_minutes',
            'duree_en_minutes' => 'duration_minutes',
            'participants' => 'participants',
            'nb_participants' => 'participants',
            'n_semaine' => 'week_number',
            'numero_semaine' => 'week_number',
            'annee_semaine' => 'week_year',
            'heures_session' => 'session_hours',
        ];

        foreach ($aliases as $from => $to) {
            if (!array_key_exists($to, $out) && array_key_exists($from, $out)) {
                $out[$to] = $out[$from];
            }
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

            $raw = trim((string) $value);
            if ($raw === '') {
                return null;
            }

            $formats = ['d/m/Y', 'd-m-Y', 'd.m.Y', 'Y-m-d', 'm/d/Y'];
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
