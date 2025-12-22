<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class DbBackup extends Command
{
    protected $signature = 'db:backup {--connection= : Database connection name (default: config database.default)} {--keep= : Retention in days (default: env DB_BACKUP_RETENTION_DAYS or 14)}';

    protected $description = 'Create a database backup snapshot and store it locally.';

    public function handle(): int
    {
        $connection = $this->option('connection') ?: config('database.default');
        $cfg = config("database.connections.$connection");

        if (!$cfg || !isset($cfg['driver'])) {
            $this->error("Unknown database connection: $connection");
            return Command::FAILURE;
        }

        $driver = (string) $cfg['driver'];
        $backupDir = storage_path('app/backups/db');
        File::ensureDirectoryExists($backupDir);

        $timestamp = now()->format('Y-m-d_H-i-s');
        $keepDays = (int) ($this->option('keep') ?: env('DB_BACKUP_RETENTION_DAYS', 14));

        try {
            if ($driver === 'mysql') {
                $dbName = (string) ($cfg['database'] ?? 'database');
                $baseName = $timestamp . "_mysql_" . $dbName;

                $sqlPath = $backupDir . DIRECTORY_SEPARATOR . $baseName . '.sql';
                $gzPath = $sqlPath . '.gz';

                $this->dumpMysql($cfg, $sqlPath);
                $this->gzipFile($sqlPath, $gzPath);
                @unlink($sqlPath);

                $this->info("Backup created: " . $gzPath);
                $this->maybeQueueGoogleDriveUpload($gzPath);
            } elseif ($driver === 'sqlite') {
                $dbPath = (string) ($cfg['database'] ?? database_path('database.sqlite'));
                if (!File::exists($dbPath)) {
                    $this->error("SQLite database file not found: $dbPath");
                    return Command::FAILURE;
                }

                $baseName = $timestamp . '_sqlite';
                $copyPath = $backupDir . DIRECTORY_SEPARATOR . $baseName . '.sqlite';
                $gzPath = $copyPath . '.gz';

                File::copy($dbPath, $copyPath);
                $this->gzipFile($copyPath, $gzPath);
                @unlink($copyPath);

                $this->info("Backup created: " . $gzPath);
                $this->maybeQueueGoogleDriveUpload($gzPath);
            } else {
                $this->error("Unsupported driver for backup: $driver");
                return Command::FAILURE;
            }

            $this->applyRetention($backupDir, $keepDays);

            return Command::SUCCESS;
        } catch (\Throwable $e) {
            Log::error('DB backup failed', ['error' => $e->getMessage()]);
            $this->error('DB backup failed: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }

    private function dumpMysql(array $cfg, string $sqlPath): void
    {
        $mysqldump = (string) (env('MYSQLDUMP_PATH') ?: 'mysqldump');

        $host = (string) ($cfg['host'] ?? '127.0.0.1');
        $port = (string) ($cfg['port'] ?? '3306');
        $db = (string) ($cfg['database'] ?? '');
        $user = (string) ($cfg['username'] ?? '');
        $password = (string) ($cfg['password'] ?? '');

        if ($db === '' || $user === '') {
            throw new \RuntimeException('Database name or username is empty for MySQL backup.');
        }

        $args = [
            $mysqldump,
            '--host=' . $host,
            '--port=' . $port,
            '--user=' . $user,
            '--single-transaction',
            '--quick',
            '--lock-tables=false',
            '--routines',
            '--events',
            '--databases',
            $db,
        ];

        $cmd = implode(' ', array_map('escapeshellarg', $args));

        $env = null;
        if ($password !== '') {
            $env = array_merge($_ENV, ['MYSQL_PWD' => $password]);
        }

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['file', $sqlPath, 'w'],
            2 => ['pipe', 'w'],
        ];

        $proc = proc_open($cmd, $descriptors, $pipes, null, $env);
        if (!is_resource($proc)) {
            throw new \RuntimeException('Unable to start mysqldump process.');
        }

        fclose($pipes[0]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[2]);

        $exit = proc_close($proc);
        if ($exit !== 0) {
            throw new \RuntimeException('mysqldump failed: ' . trim((string) $stderr));
        }
    }

    private function gzipFile(string $sourcePath, string $gzPath): void
    {
        $in = fopen($sourcePath, 'rb');
        if ($in === false) {
            throw new \RuntimeException('Unable to read file for compression: ' . $sourcePath);
        }

        $out = gzopen($gzPath, 'wb9');
        if ($out === false) {
            fclose($in);
            throw new \RuntimeException('Unable to create gzip file: ' . $gzPath);
        }

        while (!feof($in)) {
            $chunk = fread($in, 1024 * 1024);
            if ($chunk === false) {
                break;
            }
            gzwrite($out, $chunk);
        }

        fclose($in);
        gzclose($out);
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

    private function maybeQueueGoogleDriveUpload(string $localPath): void
    {
        if (!env('DB_BACKUP_GOOGLE_DRIVE_ENABLED', false)) {
            return;
        }

        $this->warn('Google Drive upload is not implemented yet. Backup saved locally: ' . $localPath);
    }
}
