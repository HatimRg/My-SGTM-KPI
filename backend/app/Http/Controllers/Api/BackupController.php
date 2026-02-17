<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;

class BackupController extends Controller
{
    public function settings(Request $request)
    {
        try {
            $frequencyHours = (int) (AppSetting::getValue('backup.frequency_hours') ?: env('BACKUP_FREQUENCY_HOURS', 12));
            if ($frequencyHours < 1) {
                $frequencyHours = 12;
            }

            $retentionDays = (int) (AppSetting::getValue('backup.retention_days') ?: env('FULL_BACKUP_RETENTION_DAYS', env('DB_BACKUP_RETENTION_DAYS', 14)));
            if ($retentionDays < 1) {
                $retentionDays = 14;
            }

            $lastRunAt = AppSetting::getValue('backup.last_run_at');
        } catch (\Throwable $e) {
            Log::warning('Backup settings read failed', ['error' => $e->getMessage()]);
            return $this->error(
                'Backup settings are not available on this server yet. Please run backend migrations (php artisan migrate).',
                500
            );
        }

        $latestPath = $this->getLatestBackupPath();
        $latestFilename = $latestPath ? basename($latestPath) : null;

        return $this->success([
            'frequency_hours' => $frequencyHours,
            'retention_days' => $retentionDays,
            'last_run_at' => $lastRunAt,
            'latest_filename' => $latestFilename,
        ]);
    }

    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'frequency_hours' => 'required|integer|min:1|max:168',
            'retention_days' => 'nullable|integer|min:1|max:365',
        ]);

        try {
            AppSetting::setValue('backup.frequency_hours', (string) $validated['frequency_hours']);
            if (array_key_exists('retention_days', $validated) && $validated['retention_days'] !== null) {
                AppSetting::setValue('backup.retention_days', (string) $validated['retention_days']);
            }
        } catch (\Throwable $e) {
            Log::warning('Backup settings update failed', ['error' => $e->getMessage()]);
            return $this->error(
                'Unable to save backup settings. Please ensure migrations are applied and the database is reachable.',
                500
            );
        }

        return $this->settings($request);
    }

    public function downloadLatest(Request $request)
    {
        $latestPath = $this->getLatestBackupPath();
        if (!$latestPath) {
            return $this->error('No backup found. Generate one first (php artisan backup:full --force).', 404);
        }

        $filename = basename($latestPath);

        return response()->download($latestPath, $filename, [
            'Content-Type' => 'application/zip',
        ]);
    }

    private function getLatestBackupPath(): ?string
    {
        $dir = storage_path('app/backups/full');
        if (!is_dir($dir)) {
            return null;
        }

        $files = File::files($dir);
        if (empty($files)) {
            return null;
        }

        $zipFiles = array_values(array_filter($files, fn ($f) => str_ends_with(strtolower($f->getFilename()), '.zip')));
        if (empty($zipFiles)) {
            return null;
        }

        usort($zipFiles, fn ($a, $b) => $b->getMTime() <=> $a->getMTime());
        return $zipFiles[0]->getPathname();
    }
}
