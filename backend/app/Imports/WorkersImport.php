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
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class WorkersImport implements ToModel, WithHeadingRow, SkipsOnError, WithBatchInserts
{
    use SkipsErrors;

    protected $userId;
    protected $defaultProjectId;
    protected $rowCount = 0;
    protected $mergedCount = 0;
    protected $errors = [];
    protected $projectCache = [];

    public function __construct(int $userId, ?int $projectId = null)
    {
        $this->userId = $userId;
        $this->defaultProjectId = $projectId;
    }

    public function model(array $row)
    {
        // Skip empty rows
        if (empty($row['cin']) || empty($row['nom']) || empty($row['prenom'])) {
            return null;
        }

        // Clean and prepare data
        $cin = trim($row['cin']);
        $nom = trim($row['nom']);
        $prenom = trim($row['prenom']);

        // Parse dates
        $dateNaissance = $this->parseDate($row['date_de_naissance'] ?? $row['date_naissance'] ?? null);
        $dateEntree = $this->parseDate($row['date_dentree'] ?? $row['date_entree'] ?? null);

        // Get project ID
        $projectId = $this->getProjectId($row['projet'] ?? null);

        // Check if worker exists by CIN
        $existingWorker = Worker::where('cin', $cin)->first();

        $data = [
            'nom' => $nom,
            'prenom' => $prenom,
            'fonction' => $row['fonction'] ?? null,
            'cin' => $cin,
            'date_naissance' => $dateNaissance,
            'entreprise' => $row['entreprise'] ?? null,
            'project_id' => $projectId ?? $this->defaultProjectId,
            'date_entree' => $dateEntree,
            'updated_by' => $this->userId,
            'is_active' => $this->parseStatus($row['statut'] ?? 'ACTIF'),
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

        // Search by name or code
        $project = Project::where('name', 'like', "%{$projectName}%")
            ->orWhere('code', $projectName)
            ->first();

        $projectId = $project ? $project->id : null;
        $this->projectCache[$projectName] = $projectId;

        return $projectId;
    }

    public function batchSize(): int
    {
        return 100;
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
