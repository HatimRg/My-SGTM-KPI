<?php

namespace App\Console\Commands;

use App\Models\LibraryDocument;
use App\Models\LibraryDocumentKeyword;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessLibraryIndexing extends Command
{
    protected $signature = 'library:index {--limit= : Max number of documents to process in this run}';

    protected $description = 'Process library document indexing (extract language + keywords via local Python script).';

    public function handle(): int
    {
        $lock = Cache::lock('library:indexing', 300);
        if (!$lock->get()) {
            $this->warn('Indexing already running. Skipping.');
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

    private function normalizeKeyword(string $keyword): string
    {
        $s = trim($keyword);
        if ($s === '') {
            return '';
        }

        if (class_exists(\Transliterator::class)) {
            try {
                $t = \Transliterator::create('NFD; [:Nonspacing Mark:] Remove; NFC');
                if ($t) {
                    $s = $t->transliterate($s);
                }
            } catch (\Throwable) {
            }
        }

        $s = mb_strtolower($s);
        $s = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $s) ?? $s;
        $s = preg_replace('/\s+/u', ' ', $s) ?? $s;
        return trim($s);
    }

    private function handleLocked(): int
    {
        $python = trim((string) env('LIBRARY_INDEXER_PYTHON', 'python'));
        $script = trim((string) env('LIBRARY_INDEXER_SCRIPT', base_path('scripts/library_indexer.py')));
        $top = (int) env('LIBRARY_INDEXER_TOP_KEYWORDS', 30);

        if ($script === '' || !is_file($script)) {
            $this->error('Library indexer script not found: ' . $script);
            Log::warning('Library indexer script not found', ['script' => $script]);
            return Command::FAILURE;
        }

        $limitOpt = $this->option('limit');
        $limit = $limitOpt !== null && $limitOpt !== '' ? (int) $limitOpt : (int) env('LIBRARY_INDEXER_BATCH', 5);
        if ($limit < 1) {
            $limit = 5;
        }

        $docs = LibraryDocument::query()
            ->where('status', LibraryDocument::STATUS_PROCESSING)
            ->orderBy('created_at')
            ->limit($limit)
            ->get();

        if ($docs->isEmpty()) {
            return Command::SUCCESS;
        }

        foreach ($docs as $doc) {
            $this->processOne($doc, $python, $script, $top);
        }

        return Command::SUCCESS;
    }

    private function processOne(LibraryDocument $doc, string $python, string $script, int $top): void
    {
        $freshStart = LibraryDocument::query()->where('id', $doc->id)->value('status');
        if ((string) $freshStart !== LibraryDocument::STATUS_PROCESSING) {
            return;
        }

        $ext = strtolower((string) $doc->file_type);
        if (in_array($ext, ['png', 'jpg', 'jpeg'], true)) {
            $doc->forceFill([
                'status' => LibraryDocument::STATUS_INDEXED,
            ])->save();
            return;
        }

        $path = (string) $doc->file_path;
        if ($path === '' || !Storage::disk('public')->exists($path)) {
            $this->markFailed($doc, 'File not found on storage disk');
            return;
        }

        $local = Storage::disk('public')->path($path);

        try {
            $result = $this->runIndexer($python, $script, $local, $ext, $top);

            $freshMid = LibraryDocument::query()->where('id', $doc->id)->value('status');
            if ((string) $freshMid !== LibraryDocument::STATUS_PROCESSING) {
                return;
            }

            if (!($result['ok'] ?? false)) {
                $this->markFailed($doc, (string) ($result['error'] ?? 'Indexing failed'));
                return;
            }

            $language = (string) ($result['language'] ?? 'unknown');
            $keywords = $result['keywords'] ?? [];
            if (!is_array($keywords)) {
                $keywords = [];
            }

            LibraryDocumentKeyword::query()->where('document_id', $doc->id)->delete();

            $unique = [];
            foreach ($keywords as $kw) {
                $payload = is_array($kw) ? $kw : ['keyword' => $kw];
                $human = trim((string) ($payload['keyword'] ?? ''));
                if ($human === '') {
                    continue;
                }
                $normalized = trim((string) ($payload['keyword_normalized'] ?? ''));
                if ($normalized === '') {
                    $normalized = $this->normalizeKeyword($human);
                }
                $normalizedKey = mb_strtolower($normalized);

                if (isset($unique[$normalizedKey])) {
                    continue;
                }
                $unique[$normalizedKey] = true;

                $weight = (int) ($payload['weight'] ?? 0);
                if ($weight < 0) {
                    $weight = 0;
                }
                if ($weight > 999) {
                    $weight = 999;
                }

                LibraryDocumentKeyword::create([
                    'document_id' => $doc->id,
                    'keyword' => $human,
                    'keyword_normalized' => $normalized,
                    'weight' => $weight,
                ]);
            }

            $freshEnd = LibraryDocument::query()->where('id', $doc->id)->value('status');
            if ((string) $freshEnd !== LibraryDocument::STATUS_PROCESSING) {
                return;
            }

            $doc->forceFill([
                'status' => LibraryDocument::STATUS_INDEXED,
                'language' => $language,
                'error_message' => null,
            ])->save();
        } catch (\Throwable $e) {
            Log::warning('Library indexing failed', [
                'document_id' => $doc->id,
                'error' => $e->getMessage(),
            ]);
            $this->markFailed($doc, $e->getMessage());
        }
    }

    private function runIndexer(string $python, string $script, string $filePath, string $ext, int $top): array
    {
        $args = [
            $python,
            $script,
            '--file',
            $filePath,
            '--ext',
            $ext,
            '--top',
            (string) $top,
        ];

        $cmd = implode(' ', array_map('escapeshellarg', $args));

        Log::info('Library indexer command', [
            'cmd' => $cmd,
        ]);

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $env = [];
        foreach (array_merge($_SERVER ?? [], $_ENV ?? []) as $k => $v) {
            if (!is_string($k) || $k === '') {
                continue;
            }
            if (is_string($v) || is_numeric($v)) {
                $env[$k] = (string) $v;
            }
        }
        $env['PYTHONIOENCODING'] = 'utf-8';
        $env['TOKENIZERS_PARALLELISM'] = $env['TOKENIZERS_PARALLELISM'] ?? 'false';
        $env['HF_HUB_DISABLE_PROGRESS_BARS'] = $env['HF_HUB_DISABLE_PROGRESS_BARS'] ?? '1';
        $env['TRANSFORMERS_VERBOSITY'] = $env['TRANSFORMERS_VERBOSITY'] ?? 'error';

        $timeoutSeconds = (int) env('LIBRARY_INDEXER_TIMEOUT', 180);
        if ($timeoutSeconds < 10) {
            $timeoutSeconds = 10;
        }

        $proc = proc_open($cmd, $descriptors, $pipes, null, $env);
        if (!is_resource($proc)) {
            throw new \RuntimeException('Unable to start indexer process.');
        }

        fclose($pipes[0]);

        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $stdoutStr = '';
        $stderrStr = '';
        $start = microtime(true);
        $timedOut = false;

        while (true) {
            $stdoutStr .= (string) stream_get_contents($pipes[1]);
            $stderrStr .= (string) stream_get_contents($pipes[2]);

            $status = proc_get_status($proc);
            if (!is_array($status) || !($status['running'] ?? false)) {
                break;
            }

            if ((microtime(true) - $start) > $timeoutSeconds) {
                $timedOut = true;
                @proc_terminate($proc);
                usleep(200000);
                $status2 = proc_get_status($proc);
                if (is_array($status2) && ($status2['running'] ?? false)) {
                    @proc_terminate($proc, 9);
                }
                break;
            }

            usleep(100000);
        }

        $stdoutStr .= (string) stream_get_contents($pipes[1]);
        $stderrStr .= (string) stream_get_contents($pipes[2]);

        fclose($pipes[1]);
        fclose($pipes[2]);

        $exit = proc_close($proc);

        if ($timedOut) {
            throw new \RuntimeException(
                'Indexer timed out after ' . $timeoutSeconds . 's. Exit=' . $exit .
                ' stderr=' . mb_substr(trim($stderrStr), 0, 800)
            );
        }

        $json = null;
        try {
            $json = json_decode($stdoutStr, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            $json = null;
        }

        if (!is_array($json)) {
            // Some python libs can print logs/progress; try to extract the last JSON object from stdout.
            $matches = [];
            if (preg_match_all('/\{.*\}/s', $stdoutStr, $matches) && !empty($matches[0])) {
                $candidate = (string) end($matches[0]);
                try {
                    $json = json_decode($candidate, true, 512, JSON_THROW_ON_ERROR);
                } catch (\Throwable) {
                    $json = null;
                }
            }
        }

        if (!is_array($json)) {
            throw new \RuntimeException(
                'Indexer returned non-JSON output. Exit=' . $exit .
                ' stderr=' . mb_substr(trim($stderrStr), 0, 800) .
                ' stdout=' . mb_substr(trim($stdoutStr), 0, 800)
            );
        }

        if (($json['ok'] ?? null) !== true) {
            $json['exit_code'] = $exit;
            $json['stderr'] = mb_substr(trim($stderrStr), 0, 800);
        }

        return $json;
    }

    private function markFailed(LibraryDocument $doc, string $error): void
    {
        $msg = trim((string) $error);
        // Avoid DB errors when message contains invalid UTF-8 bytes.
        try {
            $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $msg);
            if (is_string($converted) && $converted !== '') {
                $msg = $converted;
            }
        } catch (\Throwable) {
            // ignore
        }

        $doc->forceFill([
            'status' => LibraryDocument::STATUS_FAILED,
            'error_message' => mb_substr($msg, 0, 1000),
        ])->save();

        $uploaderId = (int) ($doc->uploaded_by ?? 0);
        if ($uploaderId > 0) {
            $uploader = User::query()->find($uploaderId);
            if ($uploader) {
                NotificationService::sendToUser(
                    $uploader,
                    Notification::TYPE_ERROR,
                    'Library indexing failed',
                    'Indexing failed for "' . ($doc->title ?: $doc->original_name ?: ('Document #' . $doc->id)) . '". ' . $doc->error_message,
                    [
                        'icon' => 'file-warning',
                        'action_url' => '/admin/library',
                        'data' => [
                            'document_id' => $doc->id,
                        ],
                    ]
                );
            }
        }
    }
}
