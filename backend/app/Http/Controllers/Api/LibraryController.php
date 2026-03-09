<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LibraryDocument;
use App\Models\LibraryDocumentKeyword;
use App\Models\LibraryFolder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class LibraryController extends Controller
{
    private const UPLOAD_MIMES = 'pdf,png,jpg,jpeg,xlsx,pptx,docx,txt';
    private const IMAGE_EXTS = ['png', 'jpg', 'jpeg'];

    public function index(Request $request)
    {
        $folderId = $request->filled('folder_id') ? (int) $request->query('folder_id') : null;
        $search = trim((string) $request->query('search', ''));

        if ($folderId !== null) {
            $exists = LibraryFolder::query()->where('id', $folderId)->exists();
            if (!$exists) {
                return $this->error('Folder not found', 404);
            }
        }

        $foldersQ = LibraryFolder::query()->where('parent_id', $folderId);
        $docsQ = LibraryDocument::query()->where('folder_id', $folderId);

        if ($search !== '') {
            $foldersQ->where('name', 'like', "%{$search}%");
            $docsQ->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhereHas('keywords', fn ($kq) => $kq->where('keyword', 'like', "%{$search}%"));
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
                'created_at' => $d->created_at,
                'updated_at' => $d->updated_at,
                'view_url' => "/api/library/documents/{$d->id}/view",
                'download_url' => "/api/library/documents/{$d->id}/download",
                'thumbnail_url' => $d->thumbnail_path ? "/api/library/documents/{$d->id}/thumbnail" : null,
            ];
        }

        return $this->success([
            'items' => $items,
        ]);
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

    public function upload(Request $request)
    {
        $validated = $request->validate([
            'folder_id' => 'nullable|integer|exists:library_folders,id',
            'title' => 'nullable|string|max:255',
            'file' => 'required|file|max:51200|mimes:' . self::UPLOAD_MIMES,
        ]);

        $file = $request->file('file');
        $originalName = $file?->getClientOriginalName();
        $ext = strtolower((string) $file?->getClientOriginalExtension());

        $title = trim((string) ($validated['title'] ?? ''));
        if ($title === '') {
            $title = pathinfo((string) $originalName, PATHINFO_FILENAME) ?: (string) $originalName;
        }

        $path = $file->store('library', 'public');

        $doc = LibraryDocument::create([
            'folder_id' => $validated['folder_id'] ?? null,
            'title' => $title,
            'original_name' => $originalName,
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

        return Storage::disk('public')->response($path, $filename, [
            'Content-Disposition' => 'inline; filename="' . addslashes($filename) . '"',
        ]);
    }

    public function download(Request $request, LibraryDocument $document)
    {
        $path = $document->file_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        $filename = $document->original_name ?: ($document->title . '.' . $document->file_type);

        return Storage::disk('public')->download($path, $filename);
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
}
