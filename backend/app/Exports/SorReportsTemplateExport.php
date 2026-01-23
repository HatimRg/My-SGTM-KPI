<?php

namespace App\Exports;

use App\Models\SorReport;
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

class SorReportsTemplateExport implements WithStyles, WithColumnWidths, WithTitle, WithEvents
{
    protected int $dataRows;
    protected array $projectCodes;
    protected string $lang;

    public function __construct(int $dataRows = 200, array $projectCodes = [], string $lang = 'fr')
    {
        $this->dataRows = max(10, $dataRows);
        $this->projectCodes = $projectCodes;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    public function title(): string
    {
        return $this->tr('Suivi ecarts', 'Deviations');
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18, // PROJECT_CODE
            'B' => 18, // COMPANY
            'C' => 16, // OBSERVATION_DATE
            'D' => 14, // OBSERVATION_TIME
            'E' => 18, // ZONE
            'F' => 22, // SUPERVISOR
            'G' => 22, // CATEGORY
            'H' => 46, // NON_CONFORMITY
            'I' => 22, // RESPONSIBLE_PERSON
            'J' => 16, // DEADLINE
            'K' => 46, // CORRECTIVE_ACTION
            'L' => 16, // CORRECTIVE_ACTION_DATE
            'M' => 14, // CORRECTIVE_ACTION_TIME
            'N' => 14, // STATUS
            'O' => 40, // NOTES
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

        return [
            AfterSheet::class => function (AfterSheet $event) use ($dataRows, $projectCodes) {
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

                $categories = array_keys(SorReport::CATEGORIES);
                sort($categories, SORT_NATURAL | SORT_FLAG_CASE);
                $rowIndex = 1;
                foreach ($categories as $cat) {
                    $listsSheet->setCellValue('B' . $rowIndex, $cat);
                    $rowIndex++;
                }
                $categoriesLastRow = max(1, count($categories));

                $statuses = ['open', 'in_progress', 'closed'];
                $rowIndex = 1;
                foreach ($statuses as $s) {
                    $listsSheet->setCellValue('C' . $rowIndex, $s);
                    $rowIndex++;
                }
                $statusesLastRow = max(1, count($statuses));

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->setCellValue('A1', $this->tr("SGTM - MODÈLE D'IMPORT SUIVI D'ÉCARTS (MASS)", 'SGTM - DEVIATIONS IMPORT TEMPLATE (MASS)'));
                $sheet->mergeCells('A1:O1');
                $sheet->getStyle('A1:O1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                $sheet->setCellValue('A2', $this->tr(
                    'Instructions: 1 ligne = 1 observation. Champs obligatoires: PROJECT_CODE*, OBSERVATION_DATE*, CATEGORY*, NON_CONFORMITY*. Les dates au format YYYY-MM-DD. CATEGORY = clé (ex: epi, levage). STATUS optionnel: open/in_progress/closed. CORRECTIVE_ACTION_DATE/CORRECTIVE_ACTION_TIME optionnels.',
                    'Instructions: 1 row = 1 observation. Required fields: PROJECT_CODE*, OBSERVATION_DATE*, CATEGORY*, NON_CONFORMITY*. Dates in YYYY-MM-DD format. CATEGORY must be a key (e.g., epi, levage). Optional STATUS: open/in_progress/closed. Optional CORRECTIVE_ACTION_DATE/CORRECTIVE_ACTION_TIME.'
                ));
                $sheet->mergeCells('A2:O2');
                $sheet->getStyle('A2:O2')->applyFromArray([
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
                    'COMPANY',
                    'OBSERVATION_DATE*',
                    'OBSERVATION_TIME',
                    'ZONE',
                    'SUPERVISOR',
                    'CATEGORY*',
                    'NON_CONFORMITY*',
                    'RESPONSIBLE_PERSON',
                    'DEADLINE',
                    'CORRECTIVE_ACTION',
                    'CORRECTIVE_ACTION_DATE',
                    'CORRECTIVE_ACTION_TIME',
                    'STATUS',
                    'NOTES',
                ];

                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }

                $sheet->getStyle('A3:O3')->applyFromArray([
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
                $sheet->getStyle('C3:C3')->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                ]);
                $sheet->getStyle('G3:H3')->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                ]);

                $dataStartRow = 4;
                $lastRow = 3 + $dataRows;
                $sheet->setAutoFilter('A3:O3');

                for ($row = $dataStartRow; $row <= $lastRow; $row++) {
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;

                    $sheet->getStyle("A{$row}:O{$row}")->applyFromArray([
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

                    $catValidation = $sheet->getCell("G{$row}")->getDataValidation();
                    $catValidation->setType(DataValidation::TYPE_LIST);
                    $catValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $catValidation->setAllowBlank(false);
                    $catValidation->setShowDropDown(true);
                    $catValidation->setShowErrorMessage(true);
                    $catValidation->setErrorTitle($this->tr('Catégorie', 'Category'));
                    $catValidation->setError($this->tr('Veuillez sélectionner une catégorie valide dans la liste.', 'Please select a valid category from the list.'));
                    $catValidation->setFormula1("='Lists'!\$B\$1:\$B\${categoriesLastRow}");

                    $statusValidation = $sheet->getCell("N{$row}")->getDataValidation();
                    $statusValidation->setType(DataValidation::TYPE_LIST);
                    $statusValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $statusValidation->setAllowBlank(true);
                    $statusValidation->setShowDropDown(true);
                    $statusValidation->setFormula1("='Lists'!\$C\$1:\$C\${statusesLastRow}");
                }

                $sheet->getComment('A3')->getText()->createTextRun($this->tr('Code projet (ex: PRJ001).', 'Project code (e.g., PRJ001).'));
                $sheet->getComment('C3')->getText()->createTextRun($this->tr('Format recommandé: YYYY-MM-DD', 'Recommended format: YYYY-MM-DD'));
                $sheet->getComment('G3')->getText()->createTextRun($this->tr('Utiliser une clé de catégorie (ex: epi, levage).', 'Use a category key (e.g., epi, levage).'));
                $sheet->getComment('H3')->getText()->createTextRun($this->tr('Description obligatoire.', 'Description is required.'));
                $sheet->getComment('J3')->getText()->createTextRun($this->tr('Optionnel. Format recommandé: YYYY-MM-DD', 'Optional. Recommended format: YYYY-MM-DD'));

                // Example row (kept out of imports by skipping PROJECT_CODE=EXEMPLE/EXAMPLE in the import logic)
                $sheet->setCellValue('A4', 'EXEMPLE');
                $sheet->setCellValue('B4', 'SGTM');
                $sheet->setCellValue('C4', '2026-01-15');
                $sheet->setCellValue('D4', '08:30');
                $sheet->setCellValue('E4', 'Zone A');
                $sheet->setCellValue('F4', 'Chef chantier');
                $sheet->setCellValue('G4', !empty($categories) ? $categories[0] : 'epi');
                $sheet->setCellValue('H4', 'Ex: Port des EPI incomplet (lunettes absentes)');
                $sheet->setCellValue('I4', 'Responsable HSE');
                $sheet->setCellValue('J4', '2026-01-20');
                $sheet->setCellValue('K4', 'Rappel EPI + contrôle quotidien');
                $sheet->setCellValue('L4', '2026-01-18');
                $sheet->setCellValue('M4', '14:00');
                $sheet->setCellValue('N4', 'open');
                $sheet->setCellValue('O4', 'Exemple de ligne à supprimer avant import');

                $sheet->freezePane('A5');
                $sheet->setSelectedCell('A5');

                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setPrintArea("A1:O{$lastRow}");

                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
