<?php

namespace App\Imports;

use App\Models\Project;
use App\Models\User;
use App\Support\PasswordPolicy;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\SkipsErrors;
use Maatwebsite\Excel\Concerns\WithChunkReading;

class UsersImport implements ToModel, WithHeadingRow, SkipsOnError, WithChunkReading
{
    use SkipsErrors;

    protected int $importedCount = 0;
    protected int $updatedCount = 0;
    protected array $rowErrors = [];
    protected array $seenEmails = [];

    public function headingRow(): int
    {
        return 3;
    }

    public function model(array $row)
    {
        try {
            $row = array_change_key_case($row, CASE_LOWER);

            $email = $this->getColumnValue($row, ['email']);
            $name = $this->getColumnValue($row, ['nom', 'name']);
            $role = $this->getColumnValue($row, ['role']);
            $pole = $this->emptyToNull($this->getColumnValue($row, ['pole']));

            if (empty($email) || empty($name) || empty($role)) {
                return null;
            }

            $email = strtolower(trim((string) $email));
            $name = trim((string) $name);
            $role = $this->normalizeRole($role);

            if ($role === User::ROLE_POLE_DIRECTOR || $role === User::ROLE_REGIONAL_HSE_MANAGER) {
                $pole = $pole !== null ? trim((string) $pole) : null;
                if ($pole === null || $pole === '') {
                    $this->rowErrors[] = ['email' => $email, 'error' => 'POLE required for Directeur de pôle / Regional HSE Manager'];
                    return null;
                }
            } else {
                $pole = null;
            }

            if (isset($this->seenEmails[$email])) {
                $this->rowErrors[] = ['email' => $email, 'error' => 'Duplicate EMAIL in import file'];
                return null;
            }
            $this->seenEmails[$email] = true;

            $allowedRoles = ['admin', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor', 'hr', 'user', 'dev', 'pole_director', 'works_director', 'hse_director', 'hr_director'];
            if (!in_array($role, $allowedRoles, true)) {
                $this->rowErrors[] = ['email' => $email, 'error' => 'Invalid role'];
                return null;
            }

            $phone = $this->emptyToNull($this->getColumnValue($row, ['telephone', 'phone']));
            $isActiveRaw = $this->getColumnValue($row, ['actif', 'is_active', 'active']);
            $isActive = $this->parseActive($isActiveRaw);

            $password = $this->getColumnValue($row, ['mot_de_passe', 'password']);
            $password = $password !== null ? (string) $password : null;
            $password = $password !== null ? trim($password) : null;
            if ($password === '') {
                $password = null;
            }

            if ($password !== null && !PasswordPolicy::isValidForRole($password, $role)) {
                $this->rowErrors[] = ['email' => $email, 'error' => 'Password does not meet complexity requirements for role'];
                return null;
            }

            $projectCodesRaw = $this->getColumnValue($row, ['project_codes', 'projects', 'projets', 'project_codes ']);
            $projectIds = [];
            if ($projectCodesRaw && !in_array($role, [User::ROLE_POLE_DIRECTOR, User::ROLE_REGIONAL_HSE_MANAGER], true)) {
                $codes = array_filter(array_map('trim', preg_split('/[,;]+/', (string) $projectCodesRaw)));
                if (!empty($codes)) {
                    $projects = Project::whereIn('code', $codes)->pluck('id', 'code');
                    foreach ($codes as $c) {
                        if (!isset($projects[$c])) {
                            $this->rowErrors[] = ['email' => $email, 'error' => "Unknown project code: {$c}"];
                        } else {
                            $projectIds[] = (int) $projects[$c];
                        }
                    }
                }
            }

            $existing = User::where('email', $email)->first();

            if ($existing) {
                $data = [
                    'name' => $name,
                    'role' => $role,
                    'pole' => $pole,
                    'phone' => $phone,
                    'is_active' => $isActive,
                ];
                if ($password) {
                    $data['password'] = $password;
                    $data['must_change_password'] = true;
                }
                $existing->update($data);

                if (in_array($role, [User::ROLE_POLE_DIRECTOR, User::ROLE_REGIONAL_HSE_MANAGER], true)) {
                    $existing->projects()->detach();
                } elseif (!empty($projectIds)) {
                    $existing->projects()->syncWithoutDetaching($projectIds);
                }

                $this->updatedCount++;
            } else {
                if (!$password) {
                    $this->rowErrors[] = ['email' => $email, 'error' => 'Password required for new user'];
                    return null;
                }

                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'password' => $password,
                    'must_change_password' => true,
                    'role' => $role,
                    'pole' => $pole,
                    'phone' => $phone,
                    'is_active' => $isActive,
                ]);

                if (!empty($projectIds)) {
                    $user->projects()->sync($projectIds);
                }

                $this->importedCount++;
            }

            return null;
        } catch (\Throwable $e) {
            Log::warning('Users import row failed', ['error' => $e->getMessage()]);
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

    protected function normalizeRole($value): string
    {
        $raw = trim((string) $value);
        $rawLower = strtolower($raw);

        $allowedRoles = ['admin', 'hse_manager', 'regional_hse_manager', 'responsable', 'supervisor', 'hr', 'user', 'dev', 'pole_director', 'works_director', 'hse_director', 'hr_director'];
        if (in_array($rawLower, $allowedRoles, true)) {
            return $rawLower;
        }

        $key = $this->normalizeString($raw);
        $map = [
            'administrateur' => 'admin',
            'manager hse' => 'hse_manager',
            'regional hse manager' => 'regional_hse_manager',
            'responsable hse' => 'responsable',
            'superviseur hse' => 'supervisor',
            'animateur hse' => 'user',
            'responsable administratif' => 'hr',
            'developpeur' => 'dev',
            'directeur de pole' => 'pole_director',
            'directeur pole' => 'pole_director',
            'directeur pôle' => 'pole_director',
            'directeur travaux' => 'works_director',
            'directeur hse' => 'hse_director',
            'directeur rh' => 'hr_director',
        ];

        return $map[$key] ?? $rawLower;
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
