<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;

class ProjectsTemplateExport implements WithStyles, WithColumnWidths, WithTitle, WithEvents
{
    protected int $dataRows;
    protected string $lang;

    public function __construct(int $dataRows = 200, string $lang = 'fr')
    {
        $this->dataRows = $dataRows;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    public function title(): string
    {
        return $this->tr('Projets', 'Projects');
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18,
            'B' => 28,
            'C' => 30,
            'D' => 22,
            'E' => 14,
            'F' => 14,
            'G' => 14,
            'H' => 22,
            'I' => 22,
            'J' => 40,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [];
    }

    public function registerEvents(): array
    {
        $dataRows = $this->dataRows;

        return [
            AfterSheet::class => function (AfterSheet $event) use ($dataRows) {
                $sheet = $event->sheet->getDelegate();

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->setCellValue('A1', $this->tr("SGTM - MODÈLE D'IMPORT PROJETS", 'SGTM - PROJECTS IMPORT TEMPLATE'));
                $sheet->mergeCells('A1:J1');
                $sheet->getStyle('A1:J1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                $sheet->setCellValue('A2', $this->tr(
                    'Instructions: CODE et NOM obligatoires. STATUT: active/completed/on_hold/cancelled. Les dates peuvent être au format YYYY-MM-DD.',
                    'Instructions: CODE and NAME are required. STATUS: active/completed/on_hold/cancelled. Dates can be in YYYY-MM-DD format.'
                ));
                $sheet->mergeCells('A2:J2');
                $sheet->getStyle('A2:J2')->applyFromArray([
                    'font' => ['size' => 11, 'italic' => true, 'color' => ['rgb' => $black]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $lightOrange]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_LEFT,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                    'borders' => [
                        'bottom' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['rgb' => $primaryOrange]],
                    ],
                ]);
                $sheet->getRowDimension(2)->setRowHeight(28);

                $headers = $this->lang === 'en'
                    ? ['CODE*', 'NAME*', 'POLE', 'CLIENT', 'STATUS', 'START_DATE', 'END_DATE', 'LOCATION', 'DESCRIPTION', 'RESPONSIBLE_EMAILS']
                    : ['CODE*', 'NOM*', 'POLE', 'CLIENT', 'STATUT', 'DATE_DEBUT', 'DATE_FIN', 'LOCALISATION', 'DESCRIPTION', 'RESPONSABLES_EMAILS'];
                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }

                $sheet->getStyle('A3:J3')->applyFromArray([
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
                $sheet->getRowDimension(3)->setRowHeight(36);

                $sheet->getStyle('A3:B3')->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                ]);

                $lastRow = 3 + $dataRows;
                for ($row = 4; $row <= $lastRow; $row++) {
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;

                    $sheet->getStyle("A{$row}:J{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bgColor]],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $grayBorder]],
                        ],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(22);

                    $statusValidation = $sheet->getCell("E{$row}")->getDataValidation();
                    $statusValidation->setType(DataValidation::TYPE_LIST);
                    $statusValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $statusValidation->setAllowBlank(true);
                    $statusValidation->setShowDropDown(true);
                    $statusValidation->setFormula1('"active,completed,on_hold,cancelled"');
                }

                $sheet->freezePane('A4');
                $sheet->setSelectedCell('A4');

                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setPrintArea("A1:J{$lastRow}");

                $spreadsheet = $sheet->getParent();
                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
