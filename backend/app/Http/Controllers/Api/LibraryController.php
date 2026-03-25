<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LibraryDocument;
use App\Models\LibraryDocumentKeyword;
use App\Models\LibraryFolder;
use App\Models\User;
use App\Support\RangeFileResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use ZipArchive;

class LibraryController extends Controller
{
    private const UPLOAD_MIMES = 'pdf,png,jpg,jpeg,xlsx,pptx,docx,txt';
    private const IMAGE_EXTS = ['png', 'jpg', 'jpeg'];
    private const SDS_FOLDER_NAME = 'FDS des produits chimique';
    private const SDS_QR_TEMPLATE = 'Templates/QR template.pptx';
    private const SDS_TAG_TEMPLATE = 'Templates/Tags template.pptx';
    private const SDS_PICTO_DIR = 'Templates/Pictograms';

    public function index(Request $request)
    {
        $folderId = $request->filled('folder_id') ? (int) $request->query('folder_id') : null;
        $search = trim((string) $request->query('search', ''));
        $searchNorm = $search !== '' ? mb_strtolower($this->normalizeKeyword($search)) : '';

        $currentFolder = null;

        if ($folderId !== null) {
            $currentFolder = LibraryFolder::query()->where('id', $folderId)->first();
            if (!$currentFolder) {
                return $this->error('Folder not found', 404);
            }
        }

        $foldersQ = LibraryFolder::query()->where('parent_id', $folderId);
        $docsQ = LibraryDocument::query()->where('folder_id', $folderId);

        if ($search !== '') {
            $foldersQ->where('name', 'like', "%{$search}%");
        }

        if ($search !== '' || $searchNorm !== '') {
            $docsQ->where(function ($q) use ($search, $searchNorm) {
                if ($search !== '') {
                    $q->where('title', 'like', "%{$search}%")
                        ->orWhereHas('keywords', fn ($kq) => $kq->where('keyword', 'like', "%{$search}%"));
                }
                if ($searchNorm !== '') {
                    $q->orWhereHas('keywords', function ($kq) use ($searchNorm) {
                        $kq->whereNotNull('keyword_normalized')
                            ->where('keyword_normalized', 'like', "%{$searchNorm}%");
                    });
                }
            });
        }

        $folders = $foldersQ->orderBy('name')->get();
        $docs = $docsQ->latest()->get();

        $items = [];

        foreach ($folders as $f) {
            $items[] = [
                'id' => $f->id,
                'kind' => 'folder',
                'name' => $f->name,
                'parent_id' => $f->parent_id,
                'is_public' => (bool) ($f->is_public ?? false),
                'created_at' => $f->created_at,
                'updated_at' => $f->updated_at,
                'count' => (int) $f->children()->count() + (int) $f->documents()->count(),
            ];
        }

        foreach ($docs as $d) {
            $items[] = [
                'id' => $d->id,
                'kind' => 'file',
                'title' => $d->title,
                'original_name' => $d->original_name,
                'file_type' => $d->file_type,
                'mime_type' => $d->mime_type,
                'size_bytes' => $d->size_bytes,
                'status' => $d->status,
                'language' => $d->language,
                'error_message' => $d->error_message,
                'folder_id' => $d->folder_id,
                'is_sds' => (bool) ($d->is_sds ?? false),
                'created_at' => $d->created_at,
                'updated_at' => $d->updated_at,
                'view_url' => "/api/library/documents/{$d->id}/view",
                'download_url' => "/api/library/documents/{$d->id}/download",
                'thumbnail_url' => $d->thumbnail_path ? "/api/library/documents/{$d->id}/thumbnail" : null,
            ];
        }

        return $this->success([
            'items' => $items,
            'folder' => $currentFolder ? [
                'id' => $currentFolder->id,
                'name' => $currentFolder->name,
                'is_public' => (bool) ($currentFolder->is_public ?? false),
                'parent_id' => $currentFolder->parent_id,
            ] : null,
        ]);
    }

    private function canUploadToFolder(?LibraryFolder $folder, ?User $user): bool
    {
        if (!$user) {
            return false;
        }

        if ($user->isAdminLike()) {
            return true;
        }

        if (!$folder) {
            return false;
        }

        if (!($folder->is_public ?? false)) {
            return false;
        }

        $role = (string) ($user->role ?? '');
        return in_array($role, [
            User::ROLE_SUPERVISOR,
            User::ROLE_RESPONSABLE,
            User::ROLE_HSE_MANAGER,
            User::ROLE_REGIONAL_HSE_MANAGER,
        ], true);
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

        $s = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $s) ?? $s;
        $s = preg_replace('/\s+/u', ' ', $s) ?? $s;
        return trim($s);
    }

    private function isSdsFolder(?LibraryFolder $folder): bool
    {
        if (!$folder) {
            return false;
        }
        return trim((string) $folder->name) === self::SDS_FOLDER_NAME;
    }

    private function parseSdsPictogramsFromName(string $baseName): array
    {
        $name = trim($baseName);
        if ($name === '') {
            return [[], $baseName];
        }

        $pos = strrpos($name, '-');
        if ($pos === false) {
            return [[], $baseName];
        }

        $suffix = trim(substr($name, $pos + 1));
        if ($suffix === '') {
            return [[], $baseName];
        }

        $digits = preg_replace('/[^0-9]/', '', $suffix);
        if (!is_string($digits) || $digits === '') {
            return [[], $baseName];
        }

        $out = [];
        foreach (str_split($digits) as $d) {
            $n = (int) $d;
            if ($n >= 1 && $n <= 9) {
                $out[] = $n;
            }
        }

        $out = array_values(array_unique($out));
        sort($out);

        $clean = trim(substr($name, 0, $pos));
        if ($clean === '') {
            $clean = $name;
        }

        return [$out, $clean];
    }

    private function stripLeadingFds(string $name): string
    {
        $s = trim($name);
        $s = preg_replace('/^FDS\s+/iu', '', $s) ?? $s;
        return trim($s);
    }

    private function sdsZipNameForDocument(LibraryDocument $doc): string
    {
        $base = $doc->original_name ?: ($doc->title . '.' . $doc->file_type);
        $base = pathinfo((string) $base, PATHINFO_FILENAME) ?: 'SDS';
        $base = preg_replace('/[\x00-\x1F\x7F]/', '', (string) $base);
        $base = preg_replace('/[^a-zA-Z0-9 _.-]/', '_', (string) $base);
        $base = trim((string) $base);
        if ($base === '') {
            $base = 'SDS';
        }
        return $base . '.zip';
    }

    private function ensureSdsGeneratedAssets(LibraryDocument $doc): array
    {
        $qrPath = (string) ($doc->sds_qr_pdf_path ?? '');
        $tagPath = (string) ($doc->sds_tag_pdf_path ?? '');

        if ($qrPath !== '' && $tagPath !== '' && Storage::disk('public')->exists($qrPath) && Storage::disk('public')->exists($tagPath)) {
            return [$qrPath, $tagPath];
        }

        $templatesDisk = Storage::disk('local');
        $qrTpl = $templatesDisk->path(self::SDS_QR_TEMPLATE);
        $tagTpl = $templatesDisk->path(self::SDS_TAG_TEMPLATE);
        $pictosDir = $templatesDisk->path(self::SDS_PICTO_DIR);

        if (!is_file($qrTpl) || !is_file($tagTpl) || !is_dir($pictosDir)) {
            throw new \RuntimeException('SDS templates/pictograms not found in storage/app/Templates');
        }

        $docPath = Storage::disk('public')->path((string) $doc->file_path);
        $productName = $this->stripLeadingFds((string) ($doc->title ?: ''));
        if ($productName === '') {
            $productName = $this->stripLeadingFds((string) (pathinfo((string) $doc->original_name, PATHINFO_FILENAME) ?: ''));
        }
        if ($productName === '') {
            $productName = 'Produit';
        }

        $token = (string) ($doc->sds_public_token ?? '');
        if ($token === '') {
            $token = Str::random(64);
            $doc->forceFill(['sds_public_token' => $token])->save();
        }

        $appUrl = rtrim((string) config('app.url'), '/');
        $publicUrl = $appUrl . '/api/public/sds/' . $token . '/view';

        $pictos = $doc->sds_pictograms;
        $pictos = is_array($pictos) ? $pictos : (is_string($pictos) ? json_decode($pictos, true) : []);
        if (!is_array($pictos)) {
            $pictos = [];
        }
        $pictos = array_values(array_filter(array_map('intval', $pictos), fn ($n) => $n >= 1 && $n <= 9));

        $tmp = storage_path('app/tmp');
        if (!is_dir($tmp)) {
            @mkdir($tmp, 0775, true);
        }

        $outQr = $tmp . DIRECTORY_SEPARATOR . 'sds_qr_' . $doc->id . '_' . Str::random(8) . '.pdf';
        $outTag = $tmp . DIRECTORY_SEPARATOR . 'sds_tag_' . $doc->id . '_' . Str::random(8) . '.pdf';

        $python = trim((string) env('LIBRARY_INDEXER_PYTHON', 'python'));
        $script = trim((string) env('SDS_GENERATOR_SCRIPT', base_path('scripts/sds_generator.py')));
        if ($script === '' || !is_file($script)) {
            throw new \RuntimeException('SDS generator script not found: ' . $script);
        }

        $args = [
            $python,
            $script,
            '--qr-template',
            $qrTpl,
            '--tag-template',
            $tagTpl,
            '--pictograms-dir',
            $pictosDir,
            '--product-name',
            $productName,
            '--public-url',
            $publicUrl,
            '--out-qr-pdf',
            $outQr,
            '--out-tag-pdf',
            $outTag,
            '--doc-id',
            (string) $doc->id,
            '--soffice',
            'C:/Program Files/LibreOffice/program/soffice.exe',
        ];

        foreach ($pictos as $n) {
            $args[] = '--picto';
            $args[] = (string) $n;
        }

        $cmd = 'set "PYTHONPATH=C:\\Users\\RAGHIB\\AppData\\Roaming\\Python\\Python314\\site-packages" && ' . implode(' ', array_map('escapeshellarg', $args));

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
        $env['PYTHONPATH'] = 'C:\\Users\\RAGHIB\\AppData\\Roaming\\Python\\Python314\\site-packages';

        $proc = proc_open($cmd, $descriptors, $pipes, null, $env);
        if (!is_resource($proc)) {
            throw new \RuntimeException('Failed to start SDS generator process');
        }

        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($proc);

        if ($exit !== 0) {
            throw new \RuntimeException('SDS generator failed: ' . trim((string) $stderr) . ' ' . trim((string) $stdout));
        }

        if (!is_file($outQr) || !is_file($outTag)) {
            throw new \RuntimeException('SDS generator did not produce expected PDFs');
        }

        $pubQr = 'sds_generated/' . $doc->id . '/qr.pdf';
        $pubTag = 'sds_generated/' . $doc->id . '/tag.pdf';

        Storage::disk('public')->put($pubQr, file_get_contents($outQr));
        Storage::disk('public')->put($pubTag, file_get_contents($outTag));

        @unlink($outQr);
        @unlink($outTag);

        $doc->forceFill([
            'sds_qr_pdf_path' => $pubQr,
            'sds_tag_pdf_path' => $pubTag,
        ])->save();

        return [$pubQr, $pubTag];
    }

    public function publicSdsView(Request $request, string $token)
    {
        $token = trim((string) $token);
        if ($token === '') {
            return $this->error('Not found', 404);
        }

        $doc = LibraryDocument::query()
            ->where('is_sds', true)
            ->where('sds_public_token', $token)
            ->first();

        if (!$doc) {
            return $this->error('Not found', 404);
        }

        $path = (string) ($doc->file_path ?? '');
        if ($path === '' || !Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        return view('sds-public', [
            'document' => $doc,
            'token' => $token
        ]);
    }

    public function publicSdsRaw(Request $request, string $token)
    {
        $token = trim((string) $token);
        if ($token === '') {
            return $this->error('Not found', 404);
        }

        $doc = LibraryDocument::query()
            ->where('is_sds', true)
            ->where('sds_public_token', $token)
            ->first();

        if (!$doc) {
            return $this->error('Not found', 404);
        }

        $path = (string) ($doc->file_path ?? '');
        if ($path === '' || !Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        $filename = $doc->original_name ?: ($doc->title . '.' . $doc->file_type);
        if (!$filename) {
            $filename = 'SDS.pdf';
        }

        $abs = Storage::disk('public')->path($path);

        return RangeFileResponse::file($request, $abs, 'application/pdf', 'inline', (string) $filename);
    }

    public function publicSdsDownload(Request $request, string $token)
    {
        $token = trim((string) $token);
        if ($token === '') {
            return $this->error('Not found', 404);
        }

        $doc = LibraryDocument::query()
            ->where('is_sds', true)
            ->where('sds_public_token', $token)
            ->first();

        if (!$doc) {
            return $this->error('Not found', 404);
        }

        $path = (string) ($doc->file_path ?? '');
        if ($path === '' || !Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        $fallbackPdfDownload = function () use ($doc, $path) {
            $filename = $doc->original_name ?: ($doc->title . '.' . $doc->file_type);
            if (!$filename) {
                $filename = 'SDS.pdf';
            }

            $abs = Storage::disk('public')->path($path);
            return response()->download($abs, $filename, [
                'Content-Type' => 'application/pdf',
            ]);
        };

        $wantPackage = (bool) $request->boolean('package', false);
        if (!$wantPackage) {
            return $fallbackPdfDownload();
        }

        if ((bool) ($doc->is_sds ?? false)) {
            try {
                if (!class_exists(\ZipArchive::class)) {
                    return $fallbackPdfDownload();
                }

                [$qrPdfPath, $tagPdfPath] = $this->ensureSdsGeneratedAssets($doc);

                $tmp = storage_path('app/tmp');
                if (!is_dir($tmp)) {
                    @mkdir($tmp, 0775, true);
                }

                $zipName = $this->sdsZipNameForDocument($doc);
                $zipPath = $tmp . DIRECTORY_SEPARATOR . 'sds_pkg_' . $doc->id . '_' . Str::random(8) . '.zip';

                if (file_exists($zipPath)) {
                    @unlink($zipPath);
                }

                $zip = new ZipArchive();
                if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                    return $fallbackPdfDownload();
                }

                // Add original SDS file
                $originalPath = Storage::disk('public')->path($path);
                if (file_exists($originalPath)) {
                    $zip->addFile($originalPath, $doc->original_name ?: ($doc->title . '.' . $doc->file_type));
                }

                // Add QR PDF if available
                $qrFullPath = Storage::disk('public')->path($qrPdfPath);
                if (file_exists($qrFullPath)) {
                    $zip->addFile($qrFullPath, 'QR_Code.pdf');
                }

                // Add Tag PDF if available
                $tagFullPath = Storage::disk('public')->path($tagPdfPath);
                if (file_exists($tagFullPath)) {
                    $zip->addFile($tagFullPath, 'Tags.pdf');
                }

                $zip->close();

                $response = response()->download($zipPath, $zipName);
                $response->headers->set('Content-Type', 'application/zip');
                
                // Delete the zip file after download
                register_shutdown_function(function() use ($zipPath) {
                    if (file_exists($zipPath)) {
                        @unlink($zipPath);
                    }
                });

                return $response;
            } catch (\Throwable $e) {
                return $fallbackPdfDownload();
            }
        }

        return $fallbackPdfDownload();
    }

    public function createFolder(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|integer|exists:library_folders,id',
        ]);

        $folder = LibraryFolder::create([
            'name' => trim((string) $validated['name']),
            'parent_id' => $validated['parent_id'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        return $this->success([
            'id' => $folder->id,
        ], 'Folder created');
    }

    public function renameFolder(Request $request, LibraryFolder $folder)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $folder->forceFill([
            'name' => trim((string) $validated['name']),
        ])->save();

        return $this->success([
            'id' => $folder->id,
        ], 'Folder updated');
    }

    public function destroyFolder(Request $request, LibraryFolder $folder)
    {
        $force = (string) $request->query('force', '0') === '1';

        $subfolderCount = (int) LibraryFolder::query()->where('parent_id', $folder->id)->count();
        $documentCount = (int) LibraryDocument::query()->where('folder_id', $folder->id)->count();

        if (!$force && ($subfolderCount > 0 || $documentCount > 0)) {
            return $this->error('Folder not empty', 400, [
                'documents' => $documentCount,
                'subfolders' => $subfolderCount,
            ]);
        }

        DB::transaction(function () use ($folder) {
            $this->deleteFolderRecursive($folder);
        });

        return $this->success(null, 'Deleted');
    }

    private function deleteFolderRecursive(LibraryFolder $folder): void
    {
        $docs = LibraryDocument::query()->where('folder_id', $folder->id)->get();
        foreach ($docs as $document) {
            LibraryDocumentKeyword::query()->where('document_id', $document->id)->delete();

            if ($document->thumbnail_path) {
                try {
                    Storage::disk('public')->delete($document->thumbnail_path);
                } catch (\Throwable) {
                }
            }

            if ($document->file_path) {
                try {
                    Storage::disk('public')->delete($document->file_path);
                } catch (\Throwable) {
                }
            }

            $document->delete();
        }

        $children = LibraryFolder::query()->where('parent_id', $folder->id)->get();
        foreach ($children as $child) {
            $this->deleteFolderRecursive($child);
        }

        $folder->delete();
    }

    public function upload(Request $request)
    {
        $validated = $request->validate([
            'folder_id' => 'nullable|integer|exists:library_folders,id',
            'title' => 'nullable|string|max:255',
            'file' => 'required|file|max:51200|mimes:' . self::UPLOAD_MIMES,
        ]);

        $targetFolder = null;
        if (!empty($validated['folder_id'])) {
            $targetFolder = LibraryFolder::query()->find((int) $validated['folder_id']);
        }

        if (!$this->canUploadToFolder($targetFolder, $request->user())) {
            return $this->error('Forbidden', 403);
        }

        $isSds = $this->isSdsFolder($targetFolder);
        if ($isSds && !$request->user()?->isAdminLike()) {
            return $this->error('Forbidden', 403);
        }

        $file = $request->file('file');
        $originalName = $file?->getClientOriginalName();
        $ext = strtolower((string) $file?->getClientOriginalExtension());

        $baseName = pathinfo((string) $originalName, PATHINFO_FILENAME) ?: (string) $originalName;
        $pictos = [];
        $cleanBase = $baseName;
        if ($isSds) {
            [$pictos, $cleanBase] = $this->parseSdsPictogramsFromName($baseName);
        }

        $cleanOriginalName = $originalName;
        if ($isSds && is_string($originalName) && $originalName !== '') {
            $cleanOriginalName = $cleanBase . ($ext !== '' ? ('.' . $ext) : '');
        }

        $title = trim((string) ($validated['title'] ?? ''));
        if ($title === '') {
            $title = $cleanBase ?: (pathinfo((string) $originalName, PATHINFO_FILENAME) ?: (string) $originalName);
        }

        $path = $file->store('library', 'public');

        $doc = LibraryDocument::create([
            'folder_id' => $validated['folder_id'] ?? null,
            'is_sds' => $isSds,
            'sds_public_token' => $isSds ? Str::random(64) : null,
            'sds_pictograms' => $isSds ? json_encode($pictos) : null,
            'title' => $title,
            'original_name' => $cleanOriginalName,
            'file_path' => $path,
            'file_type' => $ext,
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'uploaded_by' => $request->user()?->id,
            'status' => LibraryDocument::STATUS_PROCESSING,
        ]);

        if (in_array($ext, self::IMAGE_EXTS, true)) {
            $thumbPath = $this->tryGenerateThumbnail($path, $ext, (int) $doc->id);
            if (is_string($thumbPath) && $thumbPath !== '') {
                $doc->thumbnail_path = $thumbPath;
                $doc->save();
            }

            $doc->status = LibraryDocument::STATUS_INDEXED;
            $doc->save();
        }

        return $this->success([
            'id' => $doc->id,
        ], 'Uploaded');
    }

    public function setFolderVisibility(Request $request, LibraryFolder $folder)
    {
        $validated = $request->validate([
            'is_public' => 'required|boolean',
        ]);

        $folder->forceFill([
            'is_public' => (bool) $validated['is_public'],
        ])->save();

        return $this->success([
            'id' => $folder->id,
            'is_public' => (bool) $folder->is_public,
        ], 'Folder updated');
    }

    public function cancelDocument(Request $request, LibraryDocument $document)
    {
        if ((string) $document->status !== LibraryDocument::STATUS_PROCESSING) {
            return $this->error('Document is not processing', 400);
        }

        $document->forceFill([
            'status' => LibraryDocument::STATUS_FAILED,
            'error_message' => 'Cancelled by user',
        ])->save();

        return $this->success([
            'id' => $document->id,
        ], 'Cancelled');
    }

    private function tryGenerateThumbnail(string $publicDiskPath, string $ext, int $docId): ?string
    {
        try {
            if (!Storage::disk('public')->exists($publicDiskPath)) {
                return null;
            }

            $raw = Storage::disk('public')->get($publicDiskPath);
            if (!is_string($raw) || $raw === '') {
                return null;
            }

            $src = @imagecreatefromstring($raw);
            if (!$src) {
                return null;
            }

            $w = imagesx($src);
            $h = imagesy($src);
            if (!$w || !$h) {
                imagedestroy($src);
                return null;
            }

            $max = 420;
            $scale = min(1, $max / max($w, $h));
            $tw = max(1, (int) round($w * $scale));
            $th = max(1, (int) round($h * $scale));

            $dst = imagecreatetruecolor($tw, $th);
            if (strtolower($ext) === 'png') {
                imagealphablending($dst, false);
                imagesavealpha($dst, true);
                $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
                imagefilledrectangle($dst, 0, 0, $tw, $th, $transparent);
            }

            imagecopyresampled($dst, $src, 0, 0, 0, 0, $tw, $th, $w, $h);

            ob_start();
            if (strtolower($ext) === 'png') {
                imagepng($dst, null, 6);
                $outExt = 'png';
            } else {
                imagejpeg($dst, null, 70);
                $outExt = 'jpg';
            }
            $thumbBytes = ob_get_clean();

            imagedestroy($dst);
            imagedestroy($src);

            if (!is_string($thumbBytes) || $thumbBytes === '') {
                return null;
            }

            $thumbPath = "library_thumbs/{$docId}.{$outExt}";
            Storage::disk('public')->put($thumbPath, $thumbBytes);

            return $thumbPath;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function view(Request $request, LibraryDocument $document)
    {
        $path = $document->file_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        $filename = $document->original_name ?: ($document->title . '.' . $document->file_type);

        $abs = Storage::disk('public')->path($path);
        $type = (string) ($document->file_type ?: pathinfo((string) $filename, PATHINFO_EXTENSION));
        $isPdf = strtolower($type) === 'pdf';

        if ($isPdf) {
            return RangeFileResponse::file($request, $abs, 'application/pdf', 'inline', (string) $filename);
        }

        return response()->file($abs, [
            'Content-Type' => $isPdf ? 'application/pdf' : 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="' . addslashes((string) $filename) . '"',
        ]);
    }

    public function viewLink(Request $request, LibraryDocument $document)
    {
        $path = $document->file_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        $url = URL::temporarySignedRoute(
            'signed.library.documents.view',
            now()->addMinutes(5),
            ['document' => $document->id],
            false
        );

        return $this->success(['url' => $url]);
    }

    public function viewSigned(Request $request, LibraryDocument $document)
    {
        $path = $document->file_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            abort(404, 'File not found');
        }

        $filename = $document->original_name ?: ($document->title . '.' . $document->file_type);
        $abs = Storage::disk('public')->path($path);
        $type = (string) ($document->file_type ?: pathinfo((string) $filename, PATHINFO_EXTENSION));
        $isPdf = strtolower($type) === 'pdf';

        if ($isPdf) {
            return RangeFileResponse::file($request, $abs, 'application/pdf', 'inline', (string) $filename);
        }

        return response()->file($abs, [
            'Content-Type' => $isPdf ? 'application/pdf' : 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="' . addslashes((string) $filename) . '"',
        ]);
    }

    public function download(Request $request, LibraryDocument $document)
    {
        $path = $document->file_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        $fallbackFilename = $document->original_name ?: ($document->title . '.' . $document->file_type);

        if ((bool) ($document->is_sds ?? false)) {
            try {
                [$qrPdfPath, $tagPdfPath] = $this->ensureSdsGeneratedAssets($document);

                $tmp = storage_path('app/tmp');
                if (!is_dir($tmp)) {
                    @mkdir($tmp, 0775, true);
                }

                $zipName = $this->sdsZipNameForDocument($document);
                $zipPath = $tmp . DIRECTORY_SEPARATOR . 'sds_pkg_' . $document->id . '_' . Str::random(8) . '.zip';

                if (file_exists($zipPath)) {
                    @unlink($zipPath);
                }

                $zip = new ZipArchive();
                if ($zip->open($zipPath, ZipArchive::CREATE) !== true) {
                    return $this->error('Failed to create zip', 500);
                }

                $origFilename = $document->original_name ?: ($document->title . '.' . $document->file_type);
                $origFilename = preg_replace('/[\x00-\x1F\x7F]/', '', (string) $origFilename);
                if ($origFilename === '') {
                    $origFilename = 'SDS.' . ($document->file_type ?: 'pdf');
                }
                $zip->addFromString($origFilename, Storage::disk('public')->get($path));

                $productName = $this->stripLeadingFds((string) ($document->title ?: ''));
                if ($productName === '') {
                    $productName = $this->stripLeadingFds((string) (pathinfo((string) $document->original_name, PATHINFO_FILENAME) ?: ''));
                }
                if ($productName === '') {
                    $productName = 'Produit';
                }

                $qrFilename = 'QR ' . $productName . '.pdf';
                $tagFilename = "Tag d'identification " . $productName . '.pdf';

                $zip->addFromString($qrFilename, Storage::disk('public')->get($qrPdfPath));
                $zip->addFromString($tagFilename, Storage::disk('public')->get($tagPdfPath));

                $zip->close();

                return response()->download($zipPath, $zipName)->deleteFileAfterSend(true);
            } catch (\Throwable $e) {
                Log::error('SDS package generation failed, falling back to original file download', [
                    'document_id' => $document->id,
                    'error' => $e->getMessage(),
                ]);

                return Storage::disk('public')->download($path, $fallbackFilename);
            }
        }

        return Storage::disk('public')->download($path, $fallbackFilename);
    }

    public function thumbnail(Request $request, LibraryDocument $document)
    {
        $path = $document->thumbnail_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        return Storage::disk('public')->response($path);
    }

    public function downloadFolderZip(Request $request)
    {
        $folderId = (int) $request->route('folder');
        $folder = LibraryFolder::query()->find($folderId);
        if (!$folder) {
            return $this->error('Folder not found', 404);
        }

        $tmp = storage_path('app/tmp');
        if (!is_dir($tmp)) {
            @mkdir($tmp, 0775, true);
        }

        $safeName = preg_replace('/[^a-zA-Z0-9 _.-]/', '_', (string) $folder->name);
        $zipPath = $tmp . DIRECTORY_SEPARATOR . $safeName . '.zip';

        if (file_exists($zipPath)) {
            @unlink($zipPath);
        }

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE) !== true) {
            return $this->error('Failed to create zip', 500);
        }

        $this->addFolderToZip($zip, $folder, $safeName);

        $zip->close();

        return response()->download($zipPath, $safeName . '.zip')->deleteFileAfterSend(true);
    }

    private function addFolderToZip(ZipArchive $zip, LibraryFolder $folder, string $basePath): void
    {
        $docs = LibraryDocument::query()->where('folder_id', $folder->id)->get();
        foreach ($docs as $doc) {
            $path = $doc->file_path;
            if (!$path || !Storage::disk('public')->exists($path)) {
                continue;
            }

            $filename = $doc->original_name ?: ($doc->title . '.' . $doc->file_type);
            $filename = preg_replace('/[\x00-\x1F\x7F]/', '', (string) $filename);

            $zip->addFromString(
                $basePath . '/' . $filename,
                Storage::disk('public')->get($path)
            );
        }

        $children = LibraryFolder::query()->where('parent_id', $folder->id)->get();
        foreach ($children as $child) {
            $childName = preg_replace('/[^a-zA-Z0-9 _.-]/', '_', (string) $child->name);
            $this->addFolderToZip($zip, $child, $basePath . '/' . $childName);
        }
    }

    public function destroyDocument(Request $request, LibraryDocument $document)
    {
        try {
            LibraryDocumentKeyword::query()->where('document_id', $document->id)->delete();

            if ($document->thumbnail_path) {
                try {
                    Storage::disk('public')->delete($document->thumbnail_path);
                } catch (\Throwable) {
                    // ignore
                }
            }

            if ($document->file_path) {
                try {
                    Storage::disk('public')->delete($document->file_path);
                } catch (\Throwable) {
                    // ignore
                }
            }

            $document->delete();

            return $this->success(null, 'Deleted');
        } catch (\Throwable $e) {
            return $this->error('Failed to delete', 500);
        }
    }

    public function replaceDocument(Request $request, LibraryDocument $document)
    {
        $validated = $request->validate([
            'file' => 'required|file|max:51200|mimes:' . self::UPLOAD_MIMES,
        ]);

        $file = $request->file('file');
        $ext = strtolower((string) $file?->getClientOriginalExtension());

        $path = $file->store('library', 'public');

        $oldPath = $document->file_path;
        $oldThumb = $document->thumbnail_path;

        $document->forceFill([
            'file_path' => $path,
            'file_type' => $ext,
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'status' => LibraryDocument::STATUS_PROCESSING,
            'language' => null,
            'error_message' => null,
            'thumbnail_path' => null,
        ])->save();

        LibraryDocumentKeyword::query()->where('document_id', $document->id)->delete();

        if (in_array($ext, self::IMAGE_EXTS, true)) {
            $thumbPath = $this->tryGenerateThumbnail($path, $ext, (int) $document->id);
            if (is_string($thumbPath) && $thumbPath !== '') {
                $document->thumbnail_path = $thumbPath;
            }
            $document->status = LibraryDocument::STATUS_INDEXED;
            $document->save();
        }

        if ($oldPath) {
            try {
                Storage::disk('public')->delete($oldPath);
            } catch (\Throwable) {
                // ignore
            }
        }
        if ($oldThumb) {
            try {
                Storage::disk('public')->delete($oldThumb);
            } catch (\Throwable) {
                // ignore
            }
        }

        return $this->success(['id' => $document->id], 'Updated');
    }

    public function reindexDocument(Request $request, LibraryDocument $document)
    {
        $ext = strtolower((string) $document->file_type);
        if (in_array($ext, self::IMAGE_EXTS, true)) {
            $document->forceFill([
                'status' => LibraryDocument::STATUS_INDEXED,
                'error_message' => null,
            ])->save();
            return $this->success(['id' => $document->id], 'Reindexed');
        }

        LibraryDocumentKeyword::query()->where('document_id', $document->id)->delete();
        $document->forceFill([
            'status' => LibraryDocument::STATUS_PROCESSING,
            'language' => null,
            'error_message' => null,
        ])->save();

        return $this->success(['id' => $document->id], 'Reindexed');
    }

    public function downloadSdsBatchZip(Request $request, LibraryDocument $document)
    {
        if (!(bool) ($document->is_sds ?? false)) {
            return $this->error('Not an SDS document', 400);
        }

        $path = $document->file_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        try {
            [$qrPdfPath, $tagPdfPath] = $this->ensureSdsGeneratedAssets($document);

            $tmp = storage_path('app/tmp');
            if (!is_dir($tmp)) {
                @mkdir($tmp, 0775, true);
            }

            $zipName = $this->sdsZipNameForDocument($document);
            $zipPath = $tmp . DIRECTORY_SEPARATOR . 'sds_batch_' . $document->id . '_' . Str::random(8) . '.zip';

            if (file_exists($zipPath)) {
                @unlink($zipPath);
            }

            $zip = new ZipArchive();
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                return $this->error('Failed to create zip', 500);
            }

            // Add original SDS file
            $originalPath = Storage::disk('public')->path($path);
            if (file_exists($originalPath)) {
                $origFilename = $document->original_name ?: ($document->title . '.' . $document->file_type);
                $origFilename = preg_replace('/[\x00-\x1F\x7F]/', '', (string) $origFilename);
                if ($origFilename === '') {
                    $origFilename = 'SDS.pdf';
                }
                $zip->addFile($originalPath, $origFilename);
            }

            // Add QR PDF
            $qrFullPath = Storage::disk('public')->path($qrPdfPath);
            if (file_exists($qrFullPath)) {
                $productName = $this->stripLeadingFds((string) ($document->title ?: ''));
                if ($productName === '') {
                    $productName = $this->stripLeadingFds((string) (pathinfo((string) $document->original_name, PATHINFO_FILENAME) ?: ''));
                }
                if ($productName === '') {
                    $productName = 'Produit';
                }
                $zip->addFile($qrFullPath, 'QR ' . $productName . '.pdf');
            }

            // Add Tag PDF
            $tagFullPath = Storage::disk('public')->path($tagPdfPath);
            if (file_exists($tagFullPath)) {
                $productName = $this->stripLeadingFds((string) ($document->title ?: ''));
                if ($productName === '') {
                    $productName = $this->stripLeadingFds((string) (pathinfo((string) $document->original_name, PATHINFO_FILENAME) ?: ''));
                }
                if ($productName === '') {
                    $productName = 'Produit';
                }
                $zip->addFile($tagFullPath, "Tag d'identification " . $productName . '.pdf');
            }

            $zip->close();

            $response = response()->download($zipPath, $zipName);
            $response->headers->set('Content-Type', 'application/zip');

            register_shutdown_function(function() use ($zipPath) {
                if (file_exists($zipPath)) {
                    @unlink($zipPath);
                }
            });

            return $response;
        } catch (\Throwable $e) {
            Log::error('SDS batch ZIP generation failed', [
                'document_id' => $document->id,
                'error' => $e->getMessage(),
            ]);
            return $this->error('Failed to generate SDS package: ' . $e->getMessage(), 500);
        }
    }

    public function downloadSdsQrBadge(Request $request, LibraryDocument $document)
    {
        if (!(bool) ($document->is_sds ?? false)) {
            return $this->error('Not an SDS document', 400);
        }

        try {
            [$qrPdfPath, $tagPdfPath] = $this->ensureSdsGeneratedAssets($document);

            $qrFullPath = Storage::disk('public')->path($qrPdfPath);
            if (!file_exists($qrFullPath)) {
                return $this->error('QR badge not found', 404);
            }

            $productName = $this->stripLeadingFds((string) ($document->title ?: ''));
            if ($productName === '') {
                $productName = $this->stripLeadingFds((string) (pathinfo((string) $document->original_name, PATHINFO_FILENAME) ?: ''));
            }
            if ($productName === '') {
                $productName = 'Produit';
            }
            $filename = 'QR ' . $productName . '.pdf';

            return response()->download($qrFullPath, $filename, [
                'Content-Type' => 'application/pdf',
            ]);
        } catch (\Throwable $e) {
            Log::error('SDS QR badge download failed', [
                'document_id' => $document->id,
                'error' => $e->getMessage(),
            ]);
            return $this->error('Failed to generate QR badge: ' . $e->getMessage(), 500);
        }
    }

    public function downloadSdsIdTag(Request $request, LibraryDocument $document)
    {
        if (!(bool) ($document->is_sds ?? false)) {
            return $this->error('Not an SDS document', 400);
        }

        try {
            [$qrPdfPath, $tagPdfPath] = $this->ensureSdsGeneratedAssets($document);

            $tagFullPath = Storage::disk('public')->path($tagPdfPath);
            if (!file_exists($tagFullPath)) {
                return $this->error('ID tag not found', 404);
            }

            $productName = $this->stripLeadingFds((string) ($document->title ?: ''));
            if ($productName === '') {
                $productName = $this->stripLeadingFds((string) (pathinfo((string) $document->original_name, PATHINFO_FILENAME) ?: ''));
            }
            if ($productName === '') {
                $productName = 'Produit';
            }
            $filename = "Tag d'identification " . $productName . '.pdf';

            return response()->download($tagFullPath, $filename, [
                'Content-Type' => 'application/pdf',
            ]);
        } catch (\Throwable $e) {
            Log::error('SDS ID tag download failed', [
                'document_id' => $document->id,
                'error' => $e->getMessage(),
            ]);
            return $this->error('Failed to generate ID tag: ' . $e->getMessage(), 500);
        }
    }
}
