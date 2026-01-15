<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class WorkerSanctionsMassTemplateExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    private int $dataRows;

    private string $sanctionTypesCsv = 'mise_a_pied,avertissement,rappel_a_lordre,blame';

    public function __construct(int $dataRows = 200)
    {
        $this->dataRows = max(10, $dataRows);
    }

    public function title(): string
    {
        return 'Sanctions';
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18,
            'B' => 16,
            'C' => 20,
            'D' => 18,
            'E' => 44,
        ];
    }

    public function array(): array
    {
        $rows = [];
        $rows[] = ["SGTM - MODÈLE D'IMPORT SANCTIONS (MASS)"];
        $rows[] = ['Instructions: 1 ligne par CIN. PDF dans le ZIP: CIN.pdf. CIN*, DATE_SANCTION*, TYPE_SANCTION* et REASON* obligatoires. Si type=mise_a_pied, MISE_A_PIED_DAYS est obligatoire.'];
        $rows[] = ['CIN*', 'DATE_SANCTION*', 'TYPE_SANCTION*', 'MISE_A_PIED_DAYS', 'REASON*'];

        for ($i = 0; $i < $this->dataRows; $i++) {
            $rows[] = ['', '', '', '', ''];
        }

        return $rows;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                $spreadsheet = $sheet->getParent();
                $listsSheet = new Worksheet($spreadsheet, 'Lists');
                $spreadsheet->addSheet($listsSheet);
                $listsSheet->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

                $types = array_values(array_filter(array_map('trim', explode(',', $this->sanctionTypesCsv)), fn ($v) => $v !== ''));
                sort($types, SORT_NATURAL | SORT_FLAG_CASE);
                $rowIndex = 1;
                foreach ($types as $type) {
                    $listsSheet->setCellValue('A' . $rowIndex, $type);
                    $rowIndex++;
                }
                $typesLastRow = max(1, count($types));

                $dataStartRow = 4;
                $lastRow = $dataStartRow + $this->dataRows - 1;

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->setCellValue('A1', 'SGTM - MODÈLE D\'IMPORT SANCTIONS (MASS)');
                $sheet->mergeCells('A1:E1');
                $sheet->getStyle('A1:E1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                $sheet->setCellValue('A2', 'Instructions: 1 ligne par CIN. PDF dans le ZIP: CIN.pdf. CIN*, DATE_SANCTION*, TYPE_SANCTION* et REASON* obligatoires. Si type=mise_a_pied, MISE_A_PIED_DAYS est obligatoire.');
                $sheet->mergeCells('A2:E2');
                $sheet->getStyle('A2:E2')->applyFromArray([
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
                $sheet->getRowDimension(2)->setRowHeight(46);

                $headers = ['CIN*', 'DATE_SANCTION*', 'TYPE_SANCTION*', 'MISE_A_PIED_DAYS', 'REASON*'];
                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }

                $sheet->getStyle('A3:E3')->applyFromArray([
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
                $sheet->getRowDimension(3)->setRowHeight(34);

                $sheet->getStyle('A3:C3')->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                ]);
                $sheet->getStyle('E3')->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                ]);

                $sheet->setAutoFilter('A3:E3');
                for ($row = $dataStartRow; $row <= $lastRow; $row++) {
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;

                    $sheet->getStyle("A{$row}:E{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bgColor]],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $grayBorder]],
                        ],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(22);

                    $typeValidation = $sheet->getCell("C{$row}")->getDataValidation();
                    $typeValidation->setType(DataValidation::TYPE_LIST);
                    $typeValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $typeValidation->setAllowBlank(false);
                    $typeValidation->setShowDropDown(true);
                    $typeValidation->setShowErrorMessage(true);
                    $typeValidation->setErrorTitle('Sanction type');
                    $typeValidation->setError('Veuillez sélectionner un type de sanction valide dans la liste.');
                    $typeValidation->setFormula1("='Lists'!\$A\$1:\$A\${typesLastRow}");
                }

                $sheet->getComment('A3')->getText()->createTextRun("CIN = IDENTIFIANT UNIQUE\n\nLe PDF dans le ZIP doit s'appeler: CIN.pdf");
                $sheet->getComment('A3')->setWidth('220px');
                $sheet->getComment('A3')->setHeight('90px');

                $sheet->getComment('B3')->getText()->createTextRun('Format recommandé: AAAA-MM-JJ');
                $sheet->getComment('B3')->setWidth('170px');

                $sheet->getComment('D3')->getText()->createTextRun('Requis si TYPE_SANCTION = mise_a_pied');
                $sheet->getComment('D3')->setWidth('200px');

                $sheet->freezePane('A4');
                $sheet->setSelectedCell('A4');

                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setPrintArea("A1:E{$lastRow}");

                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
