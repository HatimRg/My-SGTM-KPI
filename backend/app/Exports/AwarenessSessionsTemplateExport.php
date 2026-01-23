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

class AwarenessSessionsTemplateExport implements WithStyles, WithColumnWidths, WithTitle, WithEvents
{
    protected int $dataRows;
    protected array $projectCodes;
    protected array $themes;
    protected string $lang;

    public function __construct(int $dataRows = 200, array $projectCodes = [], array $themes = [], string $lang = 'fr')
    {
        $this->dataRows = max(10, $dataRows);
        $this->projectCodes = $projectCodes;
        $this->themes = $themes;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    public function title(): string
    {
        return 'TBM-TBT';
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18, // PROJECT_CODE
            'B' => 16, // DATE
            'C' => 26, // BY_NAME
            'D' => 52, // THEME
            'E' => 18, // DURATION_MINUTES
            'F' => 16, // PARTICIPANTS
            'G' => 14, // WEEK_NUMBER
            'H' => 14, // WEEK_YEAR
            'I' => 16, // SESSION_HOURS
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [];
    }

    public function registerEvents(): array
    {
        $dataRows = $this->dataRows;
        $projectCodes = $this->projectCodes;
        $themes = $this->themes;

        return [
            AfterSheet::class => function (AfterSheet $event) use ($dataRows, $projectCodes, $themes) {
                $sheet = $event->sheet->getDelegate();

                $spreadsheet = $sheet->getParent();
                $listsSheet = new Worksheet($spreadsheet, 'Lists');
                $spreadsheet->addSheet($listsSheet);
                $listsSheet->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

                $projectCodes = array_values(array_filter(array_map('trim', $projectCodes), fn ($v) => $v !== ''));
                sort($projectCodes, SORT_NATURAL | SORT_FLAG_CASE);

                $rowIndex = 1;
                foreach ($projectCodes as $code) {
                    $listsSheet->setCellValue('A' . $rowIndex, strtoupper($code));
                    $rowIndex++;
                }
                $projectCodesLastRow = max(1, count($projectCodes));

                $themes = array_values(array_filter(array_map('trim', $themes), fn ($v) => $v !== ''));
                $rowIndex = 1;
                foreach ($themes as $t) {
                    $listsSheet->setCellValue('B' . $rowIndex, $t);
                    $rowIndex++;
                }
                $themesLastRow = max(1, count($themes));

                $durations = [15, 30, 45, 60];
                $rowIndex = 1;
                foreach ($durations as $d) {
                    $listsSheet->setCellValue('C' . $rowIndex, (string) $d);
                    $rowIndex++;
                }
                $durationsLastRow = max(1, count($durations));

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->setCellValue('A1', $this->tr("SGTM - MODÈLE D'IMPORT TBM/TBT (MASS)", 'SGTM - TBM/TBT IMPORT TEMPLATE (MASS)'));
                $sheet->mergeCells('A1:I1');
                $sheet->getStyle('A1:I1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                $sheet->setCellValue('A2', $this->tr(
                    'Instructions: 1 ligne = 1 session TBM/TBT. Champs obligatoires: PROJECT_CODE*, DATE*, BY_NAME*, THEME*, DURATION_MINUTES*, PARTICIPANTS*. DATE au format YYYY-MM-DD. WEEK_NUMBER/WEEK_YEAR/SESSION_HOURS peuvent être laissés vides (calculés automatiquement).',
                    'Instructions: 1 row = 1 TBM/TBT session. Required fields: PROJECT_CODE*, DATE*, BY_NAME*, THEME*, DURATION_MINUTES*, PARTICIPANTS*. DATE in YYYY-MM-DD format. WEEK_NUMBER/WEEK_YEAR/SESSION_HOURS can be left empty (auto-calculated).'
                ));
                $sheet->mergeCells('A2:I2');
                $sheet->getStyle('A2:I2')->applyFromArray([
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

                $headers = [
                    'PROJECT_CODE*',
                    'DATE*',
                    'BY_NAME*',
                    'THEME*',
                    'DURATION_MINUTES*',
                    'PARTICIPANTS*',
                    'WEEK_NUMBER',
                    'WEEK_YEAR',
                    'SESSION_HOURS',
                ];

                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }

                $sheet->getStyle('A3:I3')->applyFromArray([
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

                $sheet->getStyle('A3:A3')->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                ]);
                $sheet->getStyle('B3:B3')->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                ]);
                $sheet->getStyle('C3:D3')->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                ]);

                $dataStartRow = 4;
                $lastRow = 3 + $dataRows;
                $sheet->setAutoFilter('A3:I3');

                for ($row = $dataStartRow; $row <= $lastRow; $row++) {
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;

                    $sheet->getStyle("A{$row}:I{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bgColor]],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $grayBorder]],
                        ],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(22);

                    if (!empty($projectCodes)) {
                        $projectValidation = $sheet->getCell("A{$row}")->getDataValidation();
                        $projectValidation->setType(DataValidation::TYPE_LIST);
                        $projectValidation->setErrorStyle(DataValidation::STYLE_STOP);
                        $projectValidation->setAllowBlank(false);
                        $projectValidation->setShowDropDown(true);
                        $projectValidation->setShowErrorMessage(true);
                        $projectValidation->setErrorTitle($this->tr('Code projet', 'Project code'));
                        $projectValidation->setError($this->tr('Veuillez sélectionner un code projet valide dans la liste.', 'Please select a valid project code from the list.'));
                        $projectValidation->setFormula1("='Lists'!\$A\$1:\$A\${projectCodesLastRow}");
                    }

                    if (!empty($themes)) {
                        $themeValidation = $sheet->getCell("D{$row}")->getDataValidation();
                        $themeValidation->setType(DataValidation::TYPE_LIST);
                        $themeValidation->setErrorStyle(DataValidation::STYLE_STOP);
                        $themeValidation->setAllowBlank(false);
                        $themeValidation->setShowDropDown(true);
                        $themeValidation->setShowErrorMessage(true);
                        $themeValidation->setErrorTitle($this->tr('Thème', 'Theme'));
                        $themeValidation->setError($this->tr('Veuillez sélectionner un thème valide dans la liste.', 'Please select a valid theme from the list.'));
                        $themeValidation->setFormula1("='Lists'!\$B\$1:\$B\${themesLastRow}");
                    }

                    $durationValidation = $sheet->getCell("E{$row}")->getDataValidation();
                    $durationValidation->setType(DataValidation::TYPE_LIST);
                    $durationValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $durationValidation->setAllowBlank(false);
                    $durationValidation->setShowDropDown(true);
                    $durationValidation->setShowErrorMessage(true);
                    $durationValidation->setErrorTitle($this->tr('Durée', 'Duration'));
                    $durationValidation->setError($this->tr('Veuillez sélectionner une durée valide.', 'Please select a valid duration.'));
                    $durationValidation->setFormula1("='Lists'!\$C\$1:\$C\${durationsLastRow}");
                }

                $sheet->getComment('A3')->getText()->createTextRun($this->tr('Code projet (ex: PRJ001).', 'Project code (e.g., PRJ001).'));
                $sheet->getComment('B3')->getText()->createTextRun($this->tr('Format recommandé: YYYY-MM-DD', 'Recommended format: YYYY-MM-DD'));
                $sheet->getComment('D3')->getText()->createTextRun($this->tr('Choisir un thème dans la liste (ou utiliser "Autre" si applicable).', 'Choose a theme from the list (or use "Other" when applicable).'));
                $sheet->getComment('E3')->getText()->createTextRun($this->tr('Durée en minutes (15/30/45/60).', 'Duration in minutes (15/30/45/60).'));
                $sheet->getComment('I3')->getText()->createTextRun($this->tr('Optionnel, calculé automatiquement si vide.', 'Optional, auto-calculated when empty.'));

                // Example row (kept out of imports by skipping PROJECT_CODE=EXEMPLE/EXAMPLE in the import logic)
                $sheet->setCellValue('A4', 'EXEMPLE');
                $sheet->setCellValue('B4', '2026-01-15');
                $sheet->setCellValue('C4', $this->tr('Nom Prénom', 'First Last'));
                $sheet->setCellValue('D4', !empty($themes) ? $themes[0] : 'Other');
                $sheet->setCellValue('E4', '30');
                $sheet->setCellValue('F4', '12');
                $sheet->setCellValue('G4', '');
                $sheet->setCellValue('H4', '');
                $sheet->setCellValue('I4', '');

                $sheet->freezePane('A5');
                $sheet->setSelectedCell('A5');

                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setPrintArea("A1:I{$lastRow}");

                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
