<?php

namespace App\Services;

class PdfCompressionService
{
    public const TARGET_BYTES = 5242880; // 5MB

    public function isCompressionNeeded(int $bytes): bool
    {
        return $bytes > self::TARGET_BYTES;
    }

    public function compressToUnderLimit(string $inputPath, string $outputPath, int $targetBytes = self::TARGET_BYTES): array
    {
        $inputSize = @filesize($inputPath);

        if ($inputSize === false) {
            return [
                'success' => false,
                'available' => false,
                'message' => 'Unable to read input file size',
                'input_bytes' => null,
                'output_bytes' => null,
            ];
        }

        if ($inputSize <= $targetBytes) {
            @copy($inputPath, $outputPath);

            return [
                'success' => true,
                'available' => false,
                'message' => 'Compression not needed',
                'input_bytes' => $inputSize,
                'output_bytes' => $inputSize,
            ];
        }

        $gs = $this->findGhostscriptBinary();
        if (!$gs) {
            return [
                'success' => false,
                'available' => false,
                'message' => 'Ghostscript not available for PDF compression',
                'input_bytes' => $inputSize,
                'output_bytes' => null,
            ];
        }

        $settings = ['/screen', '/ebook', '/printer'];
        $bestBytes = null;
        $bestPath = null;

        foreach ($settings as $setting) {
            $tmpOut = $outputPath . '.' . trim($setting, '/') . '.pdf';
            $ok = $this->runGhostscript($gs, $inputPath, $tmpOut, $setting);
            if (!$ok) {
                continue;
            }

            $outSize = @filesize($tmpOut);
            if ($outSize === false) {
                continue;
            }

            if ($bestBytes === null || $outSize < $bestBytes) {
                $bestBytes = $outSize;
                $bestPath = $tmpOut;
            }

            if ($outSize <= $targetBytes) {
                break;
            }
        }

        if ($bestPath && $bestBytes !== null) {
            @copy($bestPath, $outputPath);
            foreach ($settings as $setting) {
                $tmpOut = $outputPath . '.' . trim($setting, '/') . '.pdf';
                if ($tmpOut !== $bestPath && file_exists($tmpOut)) {
                    @unlink($tmpOut);
                }
            }
            if (file_exists($bestPath) && $bestPath !== $outputPath) {
                @unlink($bestPath);
            }

            return [
                'success' => true,
                'available' => true,
                'message' => $bestBytes <= $targetBytes ? 'Compressed under limit' : 'Compressed but still above limit',
                'input_bytes' => $inputSize,
                'output_bytes' => $bestBytes,
            ];
        }

        return [
            'success' => false,
            'available' => true,
            'message' => 'Compression failed',
            'input_bytes' => $inputSize,
            'output_bytes' => null,
        ];
    }

    private function findGhostscriptBinary(): ?string
    {
        if (!function_exists('shell_exec')) {
            return null;
        }

        $candidates = [];
        if (PHP_OS_FAMILY === 'Windows') {
            $candidates = ['gswin64c', 'gswin32c', 'gs'];
            foreach ($candidates as $bin) {
                $out = @shell_exec('where ' . $bin . ' 2>NUL');
                $path = $this->firstLine($out);
                if ($path) {
                    return trim($path);
                }
            }
            return null;
        }

        $out = @shell_exec('command -v gs 2>/dev/null');
        $path = $this->firstLine($out);
        return $path ? trim($path) : null;
    }

    private function runGhostscript(string $gs, string $inputPath, string $outputPath, string $pdfSettings): bool
    {
        $gsEsc = $this->escapeShellArg($gs);
        $outEsc = $this->escapeShellArg($outputPath);
        $inEsc = $this->escapeShellArg($inputPath);

        $cmd = $gsEsc . ' -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=' . $pdfSettings . ' -dNOPAUSE -dQUIET -dBATCH -sOutputFile=' . $outEsc . ' ' . $inEsc;

        $exitCode = 0;
        @exec($cmd, $lines, $exitCode);

        return $exitCode === 0 && file_exists($outputPath);
    }

    private function firstLine(?string $output): ?string
    {
        if (!$output) {
            return null;
        }
        $lines = preg_split('/\r\n|\r|\n/', trim($output));
        return $lines && isset($lines[0]) && trim($lines[0]) !== '' ? $lines[0] : null;
    }

    private function escapeShellArg(string $arg): string
    {
        if (PHP_OS_FAMILY === 'Windows') {
            $arg = str_replace('"', '""', $arg);
            return '"' . $arg . '"';
        }

        return escapeshellarg($arg);
    }
}
