<?php

namespace App\Support;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RangeFileResponse
{
    public static function file(Request $request, string $absPath, string $contentType, string $disposition, string $filename): StreamedResponse
    {
        if (!is_file($absPath) || !is_readable($absPath)) {
            abort(404, 'File not found');
        }

        $size = (int) filesize($absPath);
        $rangeHeader = (string) $request->headers->get('Range', '');

        $headers = [
            'Content-Type' => $contentType,
            'Content-Disposition' => $disposition . '; filename="' . addslashes($filename) . '"',
            'Accept-Ranges' => 'bytes',
        ];

        $start = 0;
        $end = max(0, $size - 1);
        $status = 200;

        if ($rangeHeader !== '' && preg_match('/bytes=\s*(\d*)-(\d*)/i', $rangeHeader, $m)) {
            $startStr = (string) ($m[1] ?? '');
            $endStr = (string) ($m[2] ?? '');

            if ($startStr === '' && $endStr === '') {
                // ignore invalid
            } elseif ($startStr === '') {
                // suffix range: last N bytes
                $suffix = (int) $endStr;
                if ($suffix > 0) {
                    $start = max(0, $size - $suffix);
                }
            } else {
                $start = (int) $startStr;
                if ($endStr !== '') {
                    $end = (int) $endStr;
                }
            }

            if ($start > $end || $start >= $size) {
                $headers['Content-Range'] = 'bytes */' . $size;
                return response()->stream(function () {
                }, 416, $headers);
            }

            $end = min($end, $size - 1);
            $status = 206;
            $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
        }

        $length = ($end - $start) + 1;
        $headers['Content-Length'] = (string) $length;

        $method = strtoupper((string) $request->getMethod());
        if ($method === 'HEAD') {
            return response()->stream(function () {
            }, $status, $headers);
        }

        return response()->stream(function () use ($absPath, $start, $length) {
            $fh = fopen($absPath, 'rb');
            if ($fh === false) {
                return;
            }

            try {
                if ($start > 0) {
                    fseek($fh, $start);
                }

                $remaining = $length;
                $chunk = 8192;
                while ($remaining > 0 && !feof($fh)) {
                    $read = ($remaining > $chunk) ? $chunk : $remaining;
                    $buf = fread($fh, $read);
                    if ($buf === false || $buf === '') {
                        break;
                    }
                    $remaining -= strlen($buf);
                    echo $buf;
                    if (function_exists('flush')) {
                        flush();
                    }
                }
            } finally {
                fclose($fh);
            }
        }, $status, $headers);
    }
}
