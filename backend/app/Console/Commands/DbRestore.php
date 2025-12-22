<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class DbRestore extends Command
{
    protected $signature = 'db:restore {file : Path to a backup file (.sql, .sql.gz, .sqlite.gz)} {--connection= : Database connection name (default: config database.default)} {--force : Required for destructive operations (overwrite / restore)}';

    protected $description = 'Restore the database from a backup file.';

    public function handle(): int
    {
        $file = (string) $this->argument('file');
        $connection = $this->option('connection') ?: config('database.default');
        $cfg = config("database.connections.$connection");

        if (!$cfg || !isset($cfg['driver'])) {
            $this->error("Unknown database connection: $connection");
            return Command::FAILURE;
        }

        if (!File::exists($file)) {
            $this->error('Backup file not found: ' . $file);
            return Command::FAILURE;
        }

        if (!$this->option('force')) {
            $this->error('Refusing to restore without --force (this is destructive).');
            return Command::FAILURE;
        }

        $driver = (string) $cfg['driver'];

        try {
            if ($driver === 'mysql') {
                $this->restoreMysql($cfg, $file);
            } elseif ($driver === 'sqlite') {
                $this->restoreSqlite($cfg, $file);
            } else {
                $this->error("Unsupported driver for restore: $driver");
                return Command::FAILURE;
            }

            $this->info('Database restore completed.');
            return Command::SUCCESS;
        } catch (\Throwable $e) {
            Log::error('DB restore failed', ['error' => $e->getMessage()]);
            $this->error('DB restore failed: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }

    private function restoreMysql(array $cfg, string $file): void
    {
        $mysql = (string) (env('MYSQL_PATH') ?: 'mysql');

        $host = (string) ($cfg['host'] ?? '127.0.0.1');
        $port = (string) ($cfg['port'] ?? '3306');
        $db = (string) ($cfg['database'] ?? '');
        $user = (string) ($cfg['username'] ?? '');
        $password = (string) ($cfg['password'] ?? '');

        if ($db === '' || $user === '') {
            throw new \RuntimeException('Database name or username is empty for MySQL restore.');
        }

        $args = [
            $mysql,
            '--host=' . $host,
            '--port=' . $port,
            '--user=' . $user,
            $db,
        ];

        $cmd = implode(' ', array_map('escapeshellarg', $args));

        $env = null;
        if ($password !== '') {
            $env = array_merge($_ENV, ['MYSQL_PWD' => $password]);
        }

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $proc = proc_open($cmd, $descriptors, $pipes, null, $env);
        if (!is_resource($proc)) {
            throw new \RuntimeException('Unable to start mysql process.');
        }

        $stdin = $pipes[0];
        $stdout = $pipes[1];
        $stderr = $pipes[2];

        $isGz = str_ends_with(strtolower($file), '.gz');

        if ($isGz) {
            $in = gzopen($file, 'rb');
            if ($in === false) {
                fclose($stdin);
                throw new \RuntimeException('Unable to open gzip backup: ' . $file);
            }

            while (!gzeof($in)) {
                $chunk = gzread($in, 1024 * 1024);
                if ($chunk === false) {
                    break;
                }
                fwrite($stdin, $chunk);
            }

            gzclose($in);
        } else {
            $in = fopen($file, 'rb');
            if ($in === false) {
                fclose($stdin);
                throw new \RuntimeException('Unable to open backup: ' . $file);
            }

            while (!feof($in)) {
                $chunk = fread($in, 1024 * 1024);
                if ($chunk === false) {
                    break;
                }
                fwrite($stdin, $chunk);
            }

            fclose($in);
        }

        fclose($stdin);

        $out = stream_get_contents($stdout);
        $err = stream_get_contents($stderr);
        fclose($stdout);
        fclose($stderr);

        $exit = proc_close($proc);
        if ($exit !== 0) {
            throw new \RuntimeException('mysql restore failed: ' . trim((string) $err) . ' ' . trim((string) $out));
        }
    }

    private function restoreSqlite(array $cfg, string $file): void
    {
        $dbPath = (string) ($cfg['database'] ?? database_path('database.sqlite'));

        $isGz = str_ends_with(strtolower($file), '.gz');
        if (!$isGz) {
            throw new \RuntimeException('SQLite restore expects a .gz backup file.');
        }

        $tmp = $dbPath . '.restore_tmp';

        $in = gzopen($file, 'rb');
        if ($in === false) {
            throw new \RuntimeException('Unable to open gzip backup: ' . $file);
        }

        $out = fopen($tmp, 'wb');
        if ($out === false) {
            gzclose($in);
            throw new \RuntimeException('Unable to write temp sqlite file: ' . $tmp);
        }

        while (!gzeof($in)) {
            $chunk = gzread($in, 1024 * 1024);
            if ($chunk === false) {
                break;
            }
            fwrite($out, $chunk);
        }

        gzclose($in);
        fclose($out);

        File::move($tmp, $dbPath);
    }
}
