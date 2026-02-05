<?php

namespace App\Console\Commands;

use App\Models\AppSetting;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use ZipArchive;

class FullBackup extends Command
{
    protected $signature = 'backup:full {--force : Run even if not due} {--keep= : Retention in days (default: env FULL_BACKUP_RETENTION_DAYS or 14)}';

    protected $description = 'Create a full backup bundle (DB + storage) and store it locally as a zip.';

    public function handle(): int
    {
        $lock = Cache::lock('backup:full', 3600);
        if (!$lock->get()) {
            $this->warn('Backup already running. Skipping.');
            return Command::SUCCESS;
        }

        try {
            return $this->handleLocked();
        } finally {
            try {
                $lock->release();
            } catch (\Throwable) {
                // ignore
            }
        }
    }

    private function handleLocked(): int
    {
        if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
            $this->error('Backup requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.');
            return Command::FAILURE;
        }

        $frequencyHours = (int) (AppSetting::getValue('backup.frequency_hours') ?: env('BACKUP_FREQUENCY_HOURS', 12));
        if ($frequencyHours < 1) {
            $frequencyHours = 12;
        }

        $force = (bool) $this->option('force');
        $lastRunRaw = (string) (AppSetting::getValue('backup.last_run_at') ?: '');
        $lastRunAt = null;
        if ($lastRunRaw !== '') {
            try {
                $lastRunAt = Carbon::parse($lastRunRaw);
            } catch (\Throwable) {
                $lastRunAt = null;
            }
        }

        if (!$force && $lastRunAt) {
            $hours = $lastRunAt->diffInHours(now());
            if ($hours < $frequencyHours) {
                $this->info('Backup not due yet.');
                return Command::SUCCESS;
            }
        }

        $keepDays = (int) ($this->option('keep') ?: env('FULL_BACKUP_RETENTION_DAYS', env('DB_BACKUP_RETENTION_DAYS', 14)));

        $fullDir = storage_path('app/backups/full');
        $dbDir = storage_path('app/backups/db');
        File::ensureDirectoryExists($fullDir);
        File::ensureDirectoryExists($dbDir);

        $timestamp = now()->format('Y-m-d_H-i-s');
        $tmpDir = $fullDir . DIRECTORY_SEPARATOR . ('tmp_' . $timestamp);
        File::ensureDirectoryExists($tmpDir);

        try {
            Artisan::call('db:backup');

            $dbBackupPath = $this->getLatestFilePath($dbDir);
            if (!$dbBackupPath) {
                throw new \RuntimeException('DB backup file not found after running db:backup.');
            }

            $storageZipPath = $tmpDir . DIRECTORY_SEPARATOR . ('storage_public_' . $timestamp . '.zip');
            $this->zipDirectory(storage_path('app/public'), $storageZipPath);

            $bundlePath = $fullDir . DIRECTORY_SEPARATOR . ('full_backup_' . $timestamp . '.zip');
            $bundle = new ZipArchive();
            if ($bundle->open($bundlePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new \RuntimeException('Unable to create backup bundle zip: ' . $bundlePath);
            }

            $bundle->addFile($dbBackupPath, 'db/' . basename($dbBackupPath));
            $bundle->addFile($storageZipPath, 'storage/' . basename($storageZipPath));
            $bundle->close();

            AppSetting::setValue('backup.last_run_at', now()->toISOString());

            $this->applyRetention($fullDir, $keepDays);

            $this->maybeUploadOffsiteViaRclone($bundlePath);

            $this->info('Full backup created: ' . $bundlePath);
            return Command::SUCCESS;
        } catch (\Throwable $e) {
            Log::error('Full backup failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            $this->error('Full backup failed: ' . $e->getMessage());
            return Command::FAILURE;
        } finally {
            try {
                if (is_dir($tmpDir)) {
                    File::deleteDirectory($tmpDir);
                }
            } catch (\Throwable) {
                // ignore
            }
        }
    }

    private function getLatestFilePath(string $dir): ?string
    {
        $files = File::files($dir);
        if (empty($files)) {
            return null;
        }

        usort($files, fn ($a, $b) => $b->getMTime() <=> $a->getMTime());
        return $files[0]->getPathname();
    }

    private function zipDirectory(string $sourceDir, string $zipPath): void
    {
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Unable to create zip file: ' . $zipPath);
        }

        $sourceDir = rtrim($sourceDir, DIRECTORY_SEPARATOR);
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($it as $file) {
            $filePath = (string) $file->getPathname();
            $localName = ltrim(str_replace($sourceDir, '', $filePath), DIRECTORY_SEPARATOR);

            if ($file->isDir()) {
                $zip->addEmptyDir($localName);
            } else {
                $zip->addFile($filePath, $localName);
            }
        }

        $zip->close();
    }

    private function applyRetention(string $backupDir, int $keepDays): void
    {
        if ($keepDays <= 0) {
            return;
        }

        $cutoff = now()->subDays($keepDays)->timestamp;
        foreach (File::files($backupDir) as $file) {
            if ($file->getMTime() < $cutoff) {
                @unlink($file->getPathname());
            }
        }
    }

    private function maybeUploadOffsiteViaRclone(string $bundlePath): void
    {
        $enabledRaw = env('OFFSITE_RCLONE_ENABLED', false);
        $enabled = filter_var($enabledRaw, FILTER_VALIDATE_BOOLEAN);
        if (!$enabled) {
            return;
        }

        try {
            if (!is_file($bundlePath) || !is_readable($bundlePath)) {
                throw new \RuntimeException('Backup bundle not readable: ' . $bundlePath);
            }

            $rclone = (string) env('RCLONE_BINARY', 'rclone');
            $remote = trim((string) env('RCLONE_REMOTE', 'gdrive'));
            $folder = trim((string) env('RCLONE_REMOTE_FOLDER', 'SGTM-Backups/full'));
            $configPath = trim((string) env('RCLONE_CONFIG_PATH', ''));
            $flagsRaw = (string) env('RCLONE_FLAGS', '--stats=0 --retries=3 --low-level-retries=10');

            if ($remote === '') {
                throw new \RuntimeException('RCLONE_REMOTE is empty.');
            }

            $destBase = rtrim($remote . ':' . ltrim($folder, '/'), '/');
            $dest = $destBase . '/' . basename($bundlePath);

            $args = array_values(array_filter(preg_split('/\s+/', trim($flagsRaw)) ?: []));

            $cmd = array_merge(
                [$rclone, 'copyto', $bundlePath, $dest],
                ($configPath !== '' ? ['--config', $configPath] : []),
                $args
            );

            $this->info('Uploading backup offsite (rclone) to: ' . $destBase);
            $result = $this->runCommand($cmd);

            if ($result['exit_code'] !== 0) {
                Log::warning('Offsite backup upload failed (rclone)', [
                    'exit_code' => $result['exit_code'],
                    'stdout' => $result['stdout'],
                    'stderr' => $result['stderr'],
                ]);
                $this->warn('Offsite upload failed (rclone). See logs for details.');
                return;
            }

            Log::info('Offsite backup upload completed (rclone)', ['dest' => $dest]);
            $this->info('Offsite upload complete.');
        } catch (\Throwable $e) {
            Log::warning('Offsite backup upload step crashed (rclone)', ['error' => $e->getMessage()]);
            $this->warn('Offsite upload step error (rclone): ' . $e->getMessage());
        }
    }

    /**
     * @return array{exit_code:int, stdout:string, stderr:string}
     */
    private function runCommand(array $cmd): array
    {
        $descriptorspec = [
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = @proc_open($cmd, $descriptorspec, $pipes);
        if (!is_resource($process)) {
            return ['exit_code' => 1, 'stdout' => '', 'stderr' => 'Unable to start process'];
        }

        $stdout = '';
        $stderr = '';
        try {
            $stdout = stream_get_contents($pipes[1]) ?: '';
            $stderr = stream_get_contents($pipes[2]) ?: '';
        } finally {
            try {
                @fclose($pipes[1]);
                @fclose($pipes[2]);
            } catch (\Throwable) {
                // ignore
            }
        }

        $exitCode = (int) proc_close($process);
        return ['exit_code' => $exitCode, 'stdout' => $stdout, 'stderr' => $stderr];
    }
}
