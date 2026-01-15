<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithTitle;

class WorkerQualificationsMassFailedRowsExport implements FromArray, WithColumnWidths, WithTitle
{
    private array $rows;

    public function __construct(array $rows)
    {
        $this->rows = $rows;
    }

    public function title(): string
    {
        return 'Failed Rows';
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18,
            'B' => 26,
            'C' => 18,
            'D' => 28,
            'E' => 16,
            'F' => 16,
            'G' => 60,
        ];
    }

    public function array(): array
    {
        $out = [];
        $out[] = ['CIN', 'TYPE_QUALIFICATION', 'NIVEAU_QUALIFICATION', 'LIBELLE_QUALIFICATION', 'DATE_DEBUT', 'DATE_EXPIRATION', 'ERROR'];

        foreach ($this->rows as $r) {
            $out[] = [
                $r['cin'] ?? null,
                $r['qualification_type'] ?? null,
                $r['qualification_level'] ?? null,
                $r['qualification_label'] ?? null,
                $r['start_date'] ?? null,
                $r['expiry_date'] ?? null,
                $r['error'] ?? null,
            ];
        }

        return $out;
    }
}
