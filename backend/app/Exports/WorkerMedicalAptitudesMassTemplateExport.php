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

class WorkerMedicalAptitudesMassTemplateExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    private int $dataRows;

    private string $aptitudeStatusCsv = 'apte,inapte';

    private string $examNatureCsv = 'embauche_reintegration,visite_systematique,surveillance_medical_special,visite_de_reprise,visite_spontanee';

    public function __construct(int $dataRows = 200)
    {
        $this->dataRows = max(10, $dataRows);
    }

    public function title(): string
    {
        return 'Aptitudes';
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18,
            'B' => 18,
            'C' => 28,
            'D' => 32,
            'E' => 16,
            'F' => 16,
        ];
    }

    public function array(): array
    {
        $rows = [];
        $rows[] = ["SGTM - MODÈLE D'IMPORT APTITUDES MÉDICALES (MASS)"];
        $rows[] = ['Instructions: 1 ligne par CIN. PDF dans le ZIP: CIN.pdf. CIN*, APTITUDE_STATUS*, EXAM_NATURE* et EXAM_DATE* obligatoires. ABLE_TO optionnel (valeurs séparées par virgule).'];
        $rows[] = ['CIN*', 'APTITUDE_STATUS*', 'EXAM_NATURE*', 'ABLE_TO', 'EXAM_DATE*', 'DATE_EXPIRATION'];

        for ($i = 0; $i < $this->dataRows; $i++) {
            $rows[] = ['', '', '', '', '', ''];
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

                $statuses = array_values(array_filter(array_map('trim', explode(',', $this->aptitudeStatusCsv)), fn ($v) => $v !== ''));
                sort($statuses, SORT_NATURAL | SORT_FLAG_CASE);
                $rowIndex = 1;
                foreach ($statuses as $v) {
                    $listsSheet->setCellValue('A' . $rowIndex, $v);
                    $rowIndex++;
                }
                $statusesLastRow = max(1, count($statuses));

                $natures = array_values(array_filter(array_map('trim', explode(',', $this->examNatureCsv)), fn ($v) => $v !== ''));
                sort($natures, SORT_NATURAL | SORT_FLAG_CASE);
                $rowIndex = 1;
                foreach ($natures as $v) {
                    $listsSheet->setCellValue('B' . $rowIndex, $v);
                    $rowIndex++;
                }
                $naturesLastRow = max(1, count($natures));

                $dataStartRow = 4;
                $lastRow = $dataStartRow + $this->dataRows - 1;

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->setCellValue('A1', 'SGTM - MODÈLE D\'IMPORT APTITUDES MÉDICALES (MASS)');
                $sheet->mergeCells('A1:F1');
                $sheet->getStyle('A1:F1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                $sheet->setCellValue('A2', 'Instructions: 1 ligne par CIN. PDF dans le ZIP: CIN.pdf. CIN*, APTITUDE_STATUS*, EXAM_NATURE* et EXAM_DATE* obligatoires. ABLE_TO optionnel (valeurs séparées par virgule).');
                $sheet->mergeCells('A2:F2');
                $sheet->getStyle('A2:F2')->applyFromArray([
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

                $headers = ['CIN*', 'APTITUDE_STATUS*', 'EXAM_NATURE*', 'ABLE_TO', 'EXAM_DATE*', 'DATE_EXPIRATION'];
                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }

                $sheet->getStyle('A3:F3')->applyFromArray([
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

                $sheet->setAutoFilter('A3:F3');
                for ($row = $dataStartRow; $row <= $lastRow; $row++) {
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;

                    $sheet->getStyle("A{$row}:F{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bgColor]],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $grayBorder]],
                        ],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(22);

                    $statusValidation = $sheet->getCell("B{$row}")->getDataValidation();
                    $statusValidation->setType(DataValidation::TYPE_LIST);
                    $statusValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $statusValidation->setAllowBlank(false);
                    $statusValidation->setShowDropDown(true);
                    $statusValidation->setShowErrorMessage(true);
                    $statusValidation->setErrorTitle('Aptitude status');
                    $statusValidation->setError('Veuillez sélectionner un statut valide dans la liste.');
                    $statusValidation->setFormula1("='Lists'!\$A\$1:\$A\${statusesLastRow}");

                    $natureValidation = $sheet->getCell("C{$row}")->getDataValidation();
                    $natureValidation->setType(DataValidation::TYPE_LIST);
                    $natureValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $natureValidation->setAllowBlank(false);
                    $natureValidation->setShowDropDown(true);
                    $natureValidation->setShowErrorMessage(true);
                    $natureValidation->setErrorTitle('Exam nature');
                    $natureValidation->setError('Veuillez sélectionner une nature d\'examen valide dans la liste.');
                    $natureValidation->setFormula1("='Lists'!\$B\$1:\$B\${naturesLastRow}");
                }

                $sheet->getComment('A3')->getText()->createTextRun("CIN = IDENTIFIANT UNIQUE\n\nLe PDF dans le ZIP doit s'appeler: CIN.pdf");
                $sheet->getComment('A3')->setWidth('220px');
                $sheet->getComment('A3')->setHeight('90px');

                $sheet->getComment('D3')->getText()->createTextRun('Optionnel. Ex: travaux_en_hauteur, operateur');
                $sheet->getComment('D3')->setWidth('220px');

                $sheet->getComment('E3')->getText()->createTextRun('Format recommandé: AAAA-MM-JJ');
                $sheet->getComment('E3')->setWidth('170px');

                $sheet->getComment('F3')->getText()->createTextRun('Optionnel. Format recommandé: AAAA-MM-JJ');
                $sheet->getComment('F3')->setWidth('190px');

                $sheet->freezePane('A4');
                $sheet->setSelectedCell('A4');

                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setPrintArea("A1:F{$lastRow}");

                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
