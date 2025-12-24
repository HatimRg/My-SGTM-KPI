<?php

namespace App\Imports;

use App\Models\Worker;
use App\Models\Project;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\SkipsErrors;
use Maatwebsite\Excel\Concerns\WithBatchInserts;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class WorkersImport implements ToModel, WithHeadingRow, SkipsOnError, WithBatchInserts, WithChunkReading
{
    use SkipsErrors;

    protected $userId;
    protected $defaultProjectId;
    protected $rowCount = 0;
    protected $mergedCount = 0;
    protected $errors = [];
    protected $projectCache = [];
    protected $seenCins = [];
    protected $allowedProjectIds;
    protected $allowNoProject;

    public function __construct(int $userId, ?int $projectId = null, $allowedProjectIds = null, bool $allowNoProject = true)
    {
        $this->userId = $userId;
        $this->defaultProjectId = $projectId;

        if ($allowedProjectIds instanceof \Illuminate\Support\Collection) {
            $allowedProjectIds = $allowedProjectIds->all();
        } elseif ($allowedProjectIds instanceof \Traversable) {
            $allowedProjectIds = iterator_to_array($allowedProjectIds);
        }

        $this->allowedProjectIds = is_array($allowedProjectIds) ? $allowedProjectIds : null;
        $this->allowNoProject = $allowNoProject;
    }

    /**
     * The heading row is row 3 in the export template (rows 1-2 are title/instructions).
     */
    public function headingRow(): int
    {
        return 3;
    }

    public function model(array $row)
    {
        try {
            // Normalize keys to lowercase and handle various column name formats
            $row = array_change_key_case($row, CASE_LOWER);
        
            // Map various possible column names
            $cin = $this->getColumnValue($row, ['cin', 'cni', 'id', 'matricule', 'numero_cin']);
            $nom = $this->getColumnValue($row, ['nom', 'name', 'last_name', 'lastname', 'family_name']);
            $prenom = $this->getColumnValue($row, ['prenom', 'first_name', 'firstname', 'given_name']);
        
            // Skip empty rows
            if (empty($cin) || empty($nom) || empty($prenom)) {
                return null;
            }

            // Clean data
            $cin = trim((string) $cin);
            $nom = trim((string) $nom);
            $prenom = trim((string) $prenom);

            if (isset($this->seenCins[$cin])) {
                $this->errors[] = [
                    'cin' => $cin,
                    'error' => 'Duplicate CIN in import file',
                ];
                return null;
            }
            $this->seenCins[$cin] = true;

            // Parse dates with flexible column names
            $dateNaissance = $this->parseDate($this->getColumnValue($row, [
                'date_de_naissance', 'date_naissance', 'datenaissance', 'birth_date', 'birthdate', 'dob'
            ]));
            $dateEntree = $this->parseDate($this->getColumnValue($row, [
                'date_dentree', 'date_entree', 'dateentree', 'date_embauche', 'hire_date', 'start_date'
            ]));

            // Get other fields with flexible column names
            $fonction = $this->getColumnValue($row, ['fonction', 'function', 'poste', 'position', 'job', 'role']);
            $entreprise = $this->getColumnValue($row, ['entreprise', 'company', 'societe', 'société', 'employer']);
            $projet = $this->getColumnValue($row, ['projet', 'project', 'chantier', 'site']);
            $statut = $this->getColumnValue($row, ['statut', 'status', 'etat', 'état', 'active']);

            // Get project ID
            $projectId = $this->getProjectId($projet);

            if ($projectId === null && $this->defaultProjectId === null && !$this->allowNoProject) {
                $this->errors[] = [
                    'cin' => $cin,
                    'error' => 'Project is required for your access scope',
                ];
                return null;
            }

            // Check if worker exists by CIN
            $existingWorker = Worker::where('cin', $cin)->first();

            $data = [
                'nom' => $nom,
                'prenom' => $prenom,
                'fonction' => $fonction,
                'cin' => $cin,
                'date_naissance' => $dateNaissance,
                'entreprise' => $entreprise,
                'project_id' => $projectId ?? $this->defaultProjectId,
                'date_entree' => $dateEntree,
                'updated_by' => $this->userId,
                'is_active' => $this->parseStatus($statut ?? 'ACTIF'),
            ];

            if ($existingWorker) {
                // Merge: update existing worker with new data
                $existingWorker->update($data);
                $this->mergedCount++;
                $this->rowCount++;
                return null; // Return null since we updated manually
            }

            // Create new worker
            $this->rowCount++;
            return new Worker(array_merge($data, [
                'created_by' => $this->userId,
            ]));
        } catch (\Throwable $e) {
            Log::warning('Workers import row failed', ['error' => $e->getMessage()]);
            $this->errors[] = [
                'error' => $e->getMessage(),
            ];
            return null;
        }
    }

    /**
     * Get column value from row using multiple possible column names
     */
    protected function getColumnValue(array $row, array $possibleNames)
    {
        foreach ($possibleNames as $name) {
            // Try exact match
            if (isset($row[$name]) && !empty($row[$name])) {
                return $row[$name];
            }
            // Try with underscores replaced by spaces
            $spaceName = str_replace('_', ' ', $name);
            if (isset($row[$spaceName]) && !empty($row[$spaceName])) {
                return $row[$spaceName];
            }
            // Try without accents
            $noAccent = $this->removeAccents($name);
            if (isset($row[$noAccent]) && !empty($row[$noAccent])) {
                return $row[$noAccent];
            }
        }
        return null;
    }

    /**
     * Remove accents from string
     */
    protected function removeAccents(string $string): string
    {
        return iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $string) ?: $string;
    }

    /**
     * Parse date from various formats
     */
    protected function parseDate($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        try {
            // If it's already a Carbon/DateTime
            if ($value instanceof \DateTime) {
                return $value->format('Y-m-d');
            }

            // If it's an Excel serial date
            if (is_numeric($value)) {
                return Carbon::instance(\PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value))->format('Y-m-d');
            }

            // Try common date formats
            $formats = ['d/m/Y', 'd-m-Y', 'Y-m-d', 'd.m.Y', 'm/d/Y'];
            foreach ($formats as $format) {
                try {
                    return Carbon::createFromFormat($format, trim($value))->format('Y-m-d');
                } catch (\Exception $e) {
                    continue;
                }
            }

            // Last resort: let Carbon try to parse it
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
            Log::warning("Could not parse date: {$value}");
            return null;
        }
    }

    /**
     * Parse status from string
     */
    protected function parseStatus($value): bool
    {
        if (empty($value)) {
            return true; // Default to active
        }

        $value = strtoupper(trim($value));
        
        // Inactive values
        $inactiveValues = ['INACTIF', 'INACTIVE', 'NO', 'NON', '0', 'FALSE', 'N'];
        
        return !in_array($value, $inactiveValues);
    }

    /**
     * Get project ID from name or code
     */
    protected function getProjectId($projectName): ?int
    {
        if (empty($projectName)) {
            return null;
        }

        $projectName = trim($projectName);

        // Check cache first
        if (isset($this->projectCache[$projectName])) {
            return $this->projectCache[$projectName];
        }

        // Search by name or code (restricted to allowed projects when provided)
        $query = Project::query();
        if (is_array($this->allowedProjectIds)) {
            if (count($this->allowedProjectIds) === 0) {
                $this->projectCache[$projectName] = null;
                return null;
            }
            $query->whereIn('id', $this->allowedProjectIds);
        }

        $project = $query->where(function ($q) use ($projectName) {
            $q->where('name', 'like', "%{$projectName}%")
                ->orWhere('code', $projectName);
        })->first();

        $projectId = $project ? $project->id : null;
        $this->projectCache[$projectName] = $projectId;

        return $projectId;
    }

    public function batchSize(): int
    {
        return 100;
    }

    public function chunkSize(): int
    {
        return 500;
    }

    public function getRowCount(): int
    {
        return $this->rowCount;
    }

    public function getMergedCount(): int
    {
        return $this->mergedCount;
    }

    public function getErrors(): array
    {
        return $this->errors;
    }
}
