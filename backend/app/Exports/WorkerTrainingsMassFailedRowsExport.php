<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithTitle;

class WorkerTrainingsMassFailedRowsExport implements FromArray, WithColumnWidths, WithTitle
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
            'B' => 24,
            'C' => 16,
            'D' => 16,
            'E' => 60,
        ];
    }

    public function array(): array
    {
        $out = [];
        $out[] = ['CIN', 'TYPE_FORMATION', 'DATE_FORMATION', 'DATE_EXPIRATION', 'ERROR'];

        foreach ($this->rows as $r) {
            $out[] = [
                $r['cin'] ?? null,
                $r['training_type'] ?? null,
                $r['training_date'] ?? null,
                $r['expiry_date'] ?? null,
                $r['error'] ?? null,
            ];
        }

        return $out;
    }
}
