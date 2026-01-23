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

class WorkerQualificationsMassTemplateExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    private int $dataRows;
    private string $lang;

    private string $qualificationTypesCsv = 'elingueur,equipier_premiere_intervention,habilitation_electrique,inspecteur_echafaudage,monteur_echafaudage,monteur_grue_a_tour,operateur_bulldozer,operateur_chargeuse,operateur_chariot_elevateur,operateur_compacteur,operateur_dumper,operateur_grue_a_tour,operateur_grue_mobile,operateur_niveleuse,operateur_nacelle,operateur_pelle,sst,soudeur,utilisation_meule,other';

    public function __construct(int $dataRows = 200, string $lang = 'fr')
    {
        $this->dataRows = max(10, $dataRows);
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    public function title(): string
    {
        return $this->tr('Qualifications', 'Qualifications');
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18,
            'B' => 26,
            'C' => 18,
            'D' => 24,
            'E' => 16,
            'F' => 16,
        ];
    }

    public function array(): array
    {
        $rows = [];
        $rows[] = [$this->tr("SGTM - MODÈLE D'IMPORT QUALIFICATIONS (MASS)", 'SGTM - QUALIFICATIONS MASS IMPORT TEMPLATE')];
        $rows[] = [$this->tr(
            'Instructions: 1 ligne par CIN. PDF dans le ZIP: CIN.pdf. CIN*, TYPE_QUALIFICATION* et DATE_DEBUT* obligatoires. Si type=other, LIBELLE_QUALIFICATION est obligatoire.',
            'Instructions: 1 row per CIN. PDF in the ZIP: CIN.pdf. CIN*, TYPE_QUALIFICATION* and DATE_DEBUT* are required. If type=other, LIBELLE_QUALIFICATION is required.'
        )];
        $rows[] = ['CIN*', 'TYPE_QUALIFICATION*', 'NIVEAU_QUALIFICATION', 'LIBELLE_QUALIFICATION', 'DATE_DEBUT*', 'DATE_EXPIRATION'];

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

                $types = array_values(array_filter(array_map('trim', explode(',', $this->qualificationTypesCsv)), fn ($v) => $v !== ''));
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

                $sheet->setCellValue('A1', $this->tr("SGTM - MODÈLE D'IMPORT QUALIFICATIONS (MASS)", 'SGTM - QUALIFICATIONS MASS IMPORT TEMPLATE'));
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

                $sheet->setCellValue('A2', $this->tr(
                    'Instructions: 1 ligne par CIN. PDF dans le ZIP: CIN.pdf. CIN*, TYPE_QUALIFICATION* et DATE_DEBUT* obligatoires. Si type=other, LIBELLE_QUALIFICATION est obligatoire.',
                    'Instructions: 1 row per CIN. PDF in the ZIP: CIN.pdf. CIN*, TYPE_QUALIFICATION* and DATE_DEBUT* are required. If type=other, LIBELLE_QUALIFICATION is required.'
                ));
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

                $headers = ['CIN*', 'TYPE_QUALIFICATION*', 'NIVEAU_QUALIFICATION', 'LIBELLE_QUALIFICATION', 'DATE_DEBUT*', 'DATE_EXPIRATION'];
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

                $sheet->getStyle('A3:B3')->applyFromArray([
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

                    $typeValidation = $sheet->getCell("B{$row}")->getDataValidation();
                    $typeValidation->setType(DataValidation::TYPE_LIST);
                    $typeValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $typeValidation->setAllowBlank(false);
                    $typeValidation->setShowDropDown(true);
                    $typeValidation->setShowErrorMessage(true);
                    $typeValidation->setErrorTitle($this->tr('Type qualification', 'Qualification type'));
                    $typeValidation->setError($this->tr('Veuillez sélectionner un type de qualification valide dans la liste.', 'Please select a valid qualification type from the list.'));
                    $typeValidation->setFormula1("='Lists'!\$A\$1:\$A\${typesLastRow}");
                }

                $sheet->getComment('A3')->getText()->createTextRun($this->tr(
                    "CIN = IDENTIFIANT UNIQUE\n\nLe PDF dans le ZIP doit s'appeler: CIN.pdf",
                    'CIN = UNIQUE IDENTIFIER\n\nThe PDF in the ZIP must be named: CIN.pdf'
                ));
                $sheet->getComment('A3')->setWidth('220px');
                $sheet->getComment('A3')->setHeight('90px');

                $sheet->getComment('E3')->getText()->createTextRun($this->tr('Format recommandé: AAAA-MM-JJ', 'Recommended format: YYYY-MM-DD'));
                $sheet->getComment('E3')->setWidth('170px');

                $sheet->getComment('F3')->getText()->createTextRun($this->tr('Optionnel. Format recommandé: AAAA-MM-JJ', 'Optional. Recommended format: YYYY-MM-DD'));
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
