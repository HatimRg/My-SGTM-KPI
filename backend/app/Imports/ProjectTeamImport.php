<?php

namespace App\Imports;

use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\SkipsErrors;
use Maatwebsite\Excel\Concerns\WithChunkReading;

class ProjectTeamImport implements ToModel, WithHeadingRow, SkipsOnError, WithChunkReading
{
    use SkipsErrors;

    protected Project $project;
    protected int $addedBy;
    protected int $addedCount = 0;
    protected array $rowErrors = [];
    protected array $seenEmails = [];

    public function __construct(Project $project, int $addedBy)
    {
        $this->project = $project;
        $this->addedBy = $addedBy;
    }

    public function headingRow(): int
    {
        return 3;
    }

    public function model(array $row)
    {
        try {
            $row = array_change_key_case($row, CASE_LOWER);
            $email = $row['email'] ?? null;
            if (!$email) {
                return null;
            }

            $email = strtolower(trim((string) $email));
            if ($email === '') {
                return null;
            }

            if (isset($this->seenEmails[$email])) {
                $this->rowErrors[] = ['email' => $email, 'error' => 'Duplicate EMAIL in import file'];
                return null;
            }
            $this->seenEmails[$email] = true;

            $user = User::where('email', $email)->first();
            if (!$user) {
                $this->rowErrors[] = ['email' => $email, 'error' => 'User not found'];
                return null;
            }

            if (!$user->isUser()) {
                $this->rowErrors[] = ['email' => $email, 'error' => 'Only HSE Officers (role=user) can be added'];
                return null;
            }

            if ($this->project->teamMembers()->where('users.id', $user->id)->exists()) {
                return null;
            }

            $this->project->teamMembers()->attach($user->id, [
                'added_by' => $this->addedBy,
            ]);

            $this->addedCount++;
            return null;
        } catch (\Throwable $e) {
            Log::warning('Project team import row failed', ['error' => $e->getMessage()]);
            $this->rowErrors[] = ['error' => $e->getMessage()];
            return null;
        }
    }

    public function chunkSize(): int
    {
        return 500;
    }

    public function getAddedCount(): int
    {
        return $this->addedCount;
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
