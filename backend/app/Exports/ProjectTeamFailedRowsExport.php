<?php

namespace App\Exports;

use App\Support\ImportErrorTranslator;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class ProjectTeamFailedRowsExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    private array $rows;
    private string $lang;

    public function __construct(array $rows, string $lang = 'fr')
    {
        $this->rows = $rows;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    private function translateError(?string $msg): ?string
    {
        return ImportErrorTranslator::translate($msg, $this->lang);
    }

    public function title(): string
    {
        return $this->tr('Lignes en erreur', 'Failed Rows');
    }

    public function columnWidths(): array
    {
        return [
            'A' => 6,
            'B' => 40,
            'C' => 60,
        ];
    }

    public function array(): array
    {
        $out = [];
        $out[] = [$this->tr("SGTM - RAPPORT DES LIGNES EN ERREUR (EQUIPE PROJET)", 'SGTM - FAILED ROWS REPORT (PROJECT TEAM)')];
        $out[] = [$this->tr(
            "Ce fichier contient uniquement les lignes qui n'ont pas été importées.",
            'This file contains only the rows that were not imported.'
        )];

        $out[] = $this->lang === 'en'
            ? ['#', 'EMAIL', 'ERROR']
            : ['#', 'Email', 'Erreur'];

        $i = 0;
        foreach ($this->rows as $r) {
            $i++;
            $out[] = [
                $i,
                $r['email'] ?? null,
                $this->translateError($r['error'] ?? null),
            ];
        }

        return $out;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $highestRow = $sheet->getHighestRow();

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->mergeCells('A1:C1');
                $sheet->getStyle('A1:C1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(34);

                $sheet->mergeCells('A2:C2');
                $sheet->getStyle('A2:C2')->applyFromArray([
                    'font' => ['size' => 11, 'italic' => true, 'color' => ['rgb' => $black]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $lightOrange]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_LEFT,
                        'vertical' => Alignment::VERTICAL_CENTER,
                        'wrapText' => true,
                    ],
                    'borders' => [
                        'bottom' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['rgb' => $primaryOrange]],
                    ],
                ]);
                $sheet->getRowDimension(2)->setRowHeight(34);

                $sheet->getStyle('A3:C3')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $primaryOrange]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                        'wrapText' => true,
                    ],
                    'borders' => [
                        'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $darkOrange]],
                    ],
                ]);
                $sheet->getRowDimension(3)->setRowHeight(28);

                $dataStartRow = 4;
                for ($row = $dataStartRow; $row <= $highestRow; $row++) {
                    $bgColor = ($row % 2 === 0) ? $grayLight : $white;
                    $sheet->getStyle("A{$row}:C{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bgColor]],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $grayBorder]],
                        ],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(20);
                }

                $sheet->freezePane('A4');
                $sheet->setAutoFilter('A3:C3');
            },
        ];
    }
}
