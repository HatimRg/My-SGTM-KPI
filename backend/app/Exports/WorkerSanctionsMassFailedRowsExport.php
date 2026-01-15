<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithTitle;

class WorkerSanctionsMassFailedRowsExport implements FromArray, WithColumnWidths, WithTitle
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
            'B' => 16,
            'C' => 20,
            'D' => 16,
            'E' => 44,
            'F' => 60,
        ];
    }

    public function array(): array
    {
        $out = [];
        $out[] = ['CIN', 'DATE_SANCTION', 'TYPE_SANCTION', 'MISE_A_PIED_DAYS', 'REASON', 'ERROR'];

        foreach ($this->rows as $r) {
            $out[] = [
                $r['cin'] ?? null,
                $r['sanction_date'] ?? null,
                $r['sanction_type'] ?? null,
                $r['mise_a_pied_days'] ?? null,
                $r['reason'] ?? null,
                $r['error'] ?? null,
            ];
        }

        return $out;
    }
}
