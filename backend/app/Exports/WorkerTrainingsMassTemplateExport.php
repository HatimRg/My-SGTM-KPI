<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

class WorkerTrainingsMassTemplateExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    private int $dataRows;
    private string $lang;

    private string $trainingTypesCsv = 'bypassing_safety_controls,formation_coactivite,formation_coffrage_decoffrage,formation_conduite_defensive,formation_analyse_des_risques,formation_elingage_manutention,formation_ergonomie,formation_excavations,formation_outils_electroportatifs,formation_epi,formation_environnement,formation_espaces_confines,formation_flagman,formation_jha,formation_line_of_fire,formation_manutention_manuelle,formation_manutention_mecanique,formation_point_chaud,formation_produits_chimiques,formation_risques_electriques,induction_hse,travail_en_hauteur';

    private function labelizeKey(string $value): string
    {
        $v = trim($value);
        if ($v === '') {
            return '';
        }
        $v = str_replace('_', ' ', $v);
        $v = preg_replace('/\s+/', ' ', $v);
        return ucwords(strtolower($v));
    }

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
        return $this->tr('Formations', 'Trainings');
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18,
            'B' => 24,
            'C' => 16,
            'D' => 16,
        ];
    }

    public function array(): array
    {
        $rows = [];
        $rows[] = [$this->tr("SGTM - MODÈLE D'IMPORT FORMATIONS (MASS)", 'SGTM - TRAININGS MASS IMPORT TEMPLATE')];
        $rows[] = [$this->tr(
            'Instructions: 1 ligne par CIN. PDF dans le ZIP: CIN.pdf (optionnel pour Induction HSE). CIN*, Type formation* et Date formation* obligatoires.',
            'Instructions: 1 row per CIN. PDF in the ZIP: CIN.pdf (optional for Induction HSE). CIN*, TYPE_FORMATION* and DATE_FORMATION* are required.'
        )];
        $rows[] = $this->lang === 'en'
            ? ['CIN*', 'TYPE_FORMATION*', 'DATE_FORMATION*', 'DATE_EXPIRATION']
            : ['CIN*', 'Type formation*', 'Date formation*', 'Date expiration'];

        for ($i = 0; $i < $this->dataRows; $i++) {
            $rows[] = ['', '', '', ''];
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

                $typeKeys = array_values(array_filter(array_map('trim', explode(',', $this->trainingTypesCsv)), fn ($v) => $v !== ''));
                sort($typeKeys, SORT_NATURAL | SORT_FLAG_CASE);
                $types = array_values(array_filter(array_map(fn ($k) => $this->labelizeKey((string) $k), $typeKeys), fn ($v) => $v !== ''));
                $rowIndex = 1;
                foreach ($types as $type) {
                    $listsSheet->setCellValue('A' . $rowIndex, $type);
                    $rowIndex++;
                }
                $typesLastRow = max(1, count($types));

                $dataStartRow = 4;
                $lastRow = $dataStartRow + $this->dataRows - 1;

                // SGTM Theme colors (same palette as other templates)
                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                // === ROW 1: Title ===
                $sheet->setCellValue('A1', $this->tr("SGTM - MODÈLE D'IMPORT FORMATIONS (MASS)", 'SGTM - TRAININGS MASS IMPORT TEMPLATE'));
                $sheet->mergeCells('A1:D1');
                $sheet->getStyle('A1:D1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                // === ROW 2: Instructions ===
                $sheet->setCellValue('A2', $this->tr(
                    'Instructions: 1 ligne par CIN. PDF dans le ZIP: CIN.pdf (optionnel pour Induction HSE). CIN*, Type formation* et Date formation* obligatoires.',
                    'Instructions: 1 row per CIN. PDF in the ZIP: CIN.pdf (optional for Induction HSE). CIN*, TYPE_FORMATION* and DATE_FORMATION* are required.'
                ));
                $sheet->mergeCells('A2:D2');
                $sheet->getStyle('A2:D2')->applyFromArray([
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
                $sheet->getRowDimension(2)->setRowHeight(42);

                // === ROW 3: Headers ===
                $headers = $this->lang === 'en'
                    ? ['CIN*', 'TYPE_FORMATION*', 'DATE_FORMATION*', 'DATE_EXPIRATION']
                    : ['CIN*', 'Type formation*', 'Date formation*', 'Date expiration'];
                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }

                $sheet->getStyle('A3:D3')->applyFromArray([
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

                // Highlight required fields (same pattern as other templates)
                $sheet->getStyle('A3:C3')->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                ]);

                // === Data rows: zebra + borders + validations ===
                $sheet->setAutoFilter('A3:D3');
                for ($row = $dataStartRow; $row <= $lastRow; $row++) {
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;

                    $sheet->getStyle("A{$row}:D{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bgColor]],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $grayBorder]],
                        ],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(22);

                    // TYPE_FORMATION dropdown
                    $typeValidation = $sheet->getCell("B{$row}")->getDataValidation();
                    $typeValidation->setType(DataValidation::TYPE_LIST);
                    $typeValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $typeValidation->setAllowBlank(false);
                    $typeValidation->setShowDropDown(true);
                    $typeValidation->setShowErrorMessage(true);
                    $typeValidation->setErrorTitle($this->tr('Type formation', 'Training type'));
                    $typeValidation->setError($this->tr('Veuillez sélectionner un type de formation valide dans la liste.', 'Please select a valid training type from the list.'));
                    $typeValidation->setFormula1("='Lists'!\$A\$1:\$A\$" . $typesLastRow);
                }

                $sheet->getStyle("C{$dataStartRow}:C{$lastRow}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_DATE_DDMMYYYY);
                $sheet->getStyle("D{$dataStartRow}:D{$lastRow}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_DATE_DDMMYYYY);

                // Header hints
                $sheet->getComment('A3')->getText()->createTextRun($this->tr(
                    "CIN = IDENTIFIANT UNIQUE\n\nLe PDF dans le ZIP doit s'appeler: CIN.pdf",
                    'CIN = UNIQUE IDENTIFIER\n\nThe PDF in the ZIP must be named: CIN.pdf'
                ));
                $sheet->getComment('A3')->setWidth('220px');
                $sheet->getComment('A3')->setHeight('90px');

                $sheet->getComment('C3')->getText()->createTextRun($this->tr('Format recommandé: JJ/MM/AAAA', 'Recommended format: DD/MM/YYYY'));
                $sheet->getComment('C3')->setWidth('170px');

                $sheet->getComment('D3')->getText()->createTextRun($this->tr('Optionnel. Format recommandé: JJ/MM/AAAA', 'Optional. Recommended format: DD/MM/YYYY'));
                $sheet->getComment('D3')->setWidth('190px');

                // Freeze & print settings
                $sheet->freezePane('A4');
                $sheet->setSelectedCell('A4');

                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);

                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
