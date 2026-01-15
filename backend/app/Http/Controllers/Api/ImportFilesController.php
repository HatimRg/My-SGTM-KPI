<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ImportFilesController extends Controller
{
    public function downloadFailedRows(Request $request, string $filename)
    {
        $request->user();

        if (!preg_match('/^[A-Za-z0-9._-]+\.xlsx$/', $filename)) {
            return $this->error('Invalid filename', 422);
        }

        $path = 'imports/failed_rows/' . $filename;
        if (!Storage::disk('public')->exists($path)) {
            return $this->error('File not found', 404);
        }

        return response()->streamDownload(function () use ($path) {
            $stream = Storage::disk('public')->readStream($path);
            if ($stream === false) {
                return;
            }

            fpassthru($stream);

            if (is_resource($stream)) {
                fclose($stream);
            }
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }
}
