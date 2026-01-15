<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithTitle;

class WorkerMedicalAptitudesMassFailedRowsExport implements FromArray, WithColumnWidths, WithTitle
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
            'C' => 28,
            'D' => 30,
            'E' => 16,
            'F' => 16,
            'G' => 60,
        ];
    }

    public function array(): array
    {
        $out = [];
        $out[] = ['CIN', 'APTITUDE_STATUS', 'EXAM_NATURE', 'ABLE_TO', 'EXAM_DATE', 'DATE_EXPIRATION', 'ERROR'];

        foreach ($this->rows as $r) {
            $out[] = [
                $r['cin'] ?? null,
                $r['aptitude_status'] ?? null,
                $r['exam_nature'] ?? null,
                $r['able_to'] ?? null,
                $r['exam_date'] ?? null,
                $r['expiry_date'] ?? null,
                $r['error'] ?? null,
            ];
        }

        return $out;
    }
}
