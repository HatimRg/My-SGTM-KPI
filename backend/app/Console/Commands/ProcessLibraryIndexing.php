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

    private function handleLocked(): int
    {
        $python = trim((string) env('LIBRARY_INDEXER_PYTHON', 'python'));
        $script = trim((string) env('LIBRARY_INDEXER_SCRIPT', base_path('scripts/library_indexer.py')));
        $top = (int) env('LIBRARY_INDEXER_TOP_KEYWORDS', 12);

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
                $k = trim((string) $kw);
                if ($k === '') {
                    continue;
                }
                $key = mb_strtolower($k);
                if (isset($unique[$key])) {
                    continue;
                }
                $unique[$key] = true;

                LibraryDocumentKeyword::create([
                    'document_id' => $doc->id,
                    'keyword' => $k,
                ]);
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

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $proc = proc_open($cmd, $descriptors, $pipes);
        if (!is_resource($proc)) {
            throw new \RuntimeException('Unable to start indexer process.');
        }

        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[2]);

        $exit = proc_close($proc);

        $json = null;
        try {
            $json = json_decode((string) $stdout, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            $json = null;
        }

        if (!is_array($json)) {
            throw new \RuntimeException('Indexer returned non-JSON output. Exit=' . $exit . ' stderr=' . trim((string) $stderr));
        }

        return $json;
    }

    private function markFailed(LibraryDocument $doc, string $error): void
    {
        $doc->forceFill([
            'status' => LibraryDocument::STATUS_FAILED,
            'error_message' => mb_substr(trim((string) $error), 0, 1000),
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
