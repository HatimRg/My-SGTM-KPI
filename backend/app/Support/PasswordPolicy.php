<?php

namespace App\Support;

class PasswordPolicy
{
    public static function isPrivilegedRole(?string $role): bool
    {
        $r = (string) $role;
        return in_array($r, [
            'admin',
            'consultation',
            'hse_manager',
            'regional_hse_manager',
            'dev',
            'pole_director',
            'works_director',
            'hse_director',
            'hr_director',
        ], true);
    }

    public static function rulesForRole(?string $role, bool $required, bool $confirmed): array
    {
        $base = [];

        if ($required) {
            $base[] = 'required';
        } else {
            $base[] = 'nullable';
        }

        $base[] = 'string';

        if (self::isPrivilegedRole($role)) {
            $base[] = 'min:12';
            $base[] = 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+$/';
        } else {
            $base[] = 'min:8';
            $base[] = 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$/';
        }

        if ($confirmed) {
            $base[] = 'confirmed';
        }

        return $base;
    }

    public static function isValidForRole(?string $password, ?string $role): bool
    {
        if ($password === null) return false;

        $pwd = (string) $password;
        if (self::isPrivilegedRole($role)) {
            if (mb_strlen($pwd) < 12) return false;
            return preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/', $pwd) === 1;
        }

        if (mb_strlen($pwd) < 8) return false;
        return preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/', $pwd) === 1;
    }
}
