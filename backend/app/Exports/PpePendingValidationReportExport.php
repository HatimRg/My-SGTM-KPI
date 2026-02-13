<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class PpePendingValidationReportExport implements FromArray, WithHeadings, WithStyles
{
    private array $meta;
    private array $rows;

    public function __construct(array $meta, array $rows)
    {
        $this->meta = $meta;
        $this->rows = $rows;
    }

    public function headings(): array
    {
        return [
            'Article',
            'Current Stock',
            'Distributed in Last Week',
            'Distributed in Last Month',
        ];
    }

    public function array(): array
    {
        $out = [];

        // Meta section (project general data)
        $out[] = ['Project Name', $this->meta['project_name'] ?? ''];
        $out[] = ['Project Pole', $this->meta['project_pole'] ?? ''];
        $out[] = ['HSE Manager Name', $this->meta['hse_manager_name'] ?? ''];
        $out[] = ['HSE Manager Email', $this->meta['hse_manager_email'] ?? ''];
        $out[] = ['Current Total Workers', $this->meta['current_total_workers'] ?? 0];
        $out[] = ['Report Date', $this->meta['report_date'] ?? ''];
        $out[] = [];

        // Header row
        $out[] = $this->headings();

        foreach ($this->rows as $row) {
            $out[] = [
                $row['article'] ?? ($row['item_name'] ?? ''),
                (int) ($row['current_stock'] ?? 0),
                (int) ($row['distributed_last_week'] ?? 0),
                (int) ($row['distributed_last_month'] ?? 0),
            ];
        }

        return $out;
    }

    public function styles(Worksheet $sheet)
    {
        $sheet->getStyle('A1')->getFont()->setBold(true);
        $sheet->getStyle('A2')->getFont()->setBold(true);
        $sheet->getStyle('A3')->getFont()->setBold(true);
        $sheet->getStyle('A4')->getFont()->setBold(true);
        $sheet->getStyle('A5')->getFont()->setBold(true);
        $sheet->getStyle('A6')->getFont()->setBold(true);

        // Table header is at row 8 (6 meta + blank row + header)
        $sheet->getStyle('A8:D8')->getFont()->setBold(true);
        $sheet->freezePane('A9');

        foreach (range('A', 'D') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        return [];
    }
}
