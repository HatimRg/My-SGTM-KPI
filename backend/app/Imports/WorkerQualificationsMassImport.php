<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;

class WorkerQualificationsMassImport implements ToCollection
{
    protected array $rows = [];

    public function collection(Collection $rows)
    {
        $raw = $rows->toArray();

        $headerIndex = $this->detectHeaderIndex($raw);
        $headerIndex = $headerIndex ?? 2;

        $headersRow = array_values($raw[$headerIndex] ?? []);
        $headers = [];
        foreach ($headersRow as $colIndex => $headerValue) {
            $key = $this->normalizeHeaderKey($headerValue);
            $headers[(int) $colIndex] = $key !== '' ? $key : 'col_' . (int) $colIndex;
        }

        $mapped = [];
        for ($r = $headerIndex + 1; $r < count($raw); $r++) {
            $row = array_values($raw[$r] ?? []);
            $assoc = [];
            foreach ($headers as $colIndex => $key) {
                $assoc[$key] = $row[$colIndex] ?? null;
            }
            $mapped[] = $assoc;
        }

        $this->rows = $mapped;
    }

    private function detectHeaderIndex(array $raw): ?int
    {
        $max = min(60, count($raw));
        for ($i = 0; $i < $max; $i++) {
            $row = array_values($raw[$i] ?? []);
            $cells = [];
            foreach ($row as $cell) {
                $k = $this->normalizeHeaderKey($cell);
                if ($k !== '') {
                    $cells[] = $k;
                }
            }

            if (count($cells) < 2) {
                continue;
            }

            $hasCinExact = in_array('cin', $cells, true) || in_array('cni', $cells, true) || in_array('numero_cin', $cells, true) || in_array('id', $cells, true);
            $hasQualification = false;
            foreach ($cells as $c) {
                if ($c === 'type_qualification' || $c === 'qualification_type' || $c === 'qualification' || str_contains($c, 'qualification')) {
                    $hasQualification = true;
                    break;
                }
            }

            $hasType = false;
            foreach ($cells as $c) {
                if ($c === 'type' || str_contains($c, 'type')) {
                    $hasType = true;
                    break;
                }
            }

            if ($hasCinExact && $hasQualification && $hasType) {
                return $i;
            }
        }

        return null;
    }

    private function normalizeHeaderKey($value): string
    {
        if ($value === null) {
            return '';
        }

        $s = trim(str_replace("\u{00A0}", ' ', (string) $value));
        if ($s === '') {
            return '';
        }

        $s = str_replace('*', '', $s);
        $s = strtolower($s);
        $s = preg_replace('/\s+/u', ' ', $s);
        $s = str_replace(' ', '_', $s);
        $s = preg_replace('/[^a-z0-9_]/', '', $s);

        return $s ?? '';
    }

    public function getRows(): array
    {
        return $this->rows;
    }
}
