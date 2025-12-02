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

class WorkersTemplateExport implements WithStyles, WithColumnWidths, WithTitle, WithEvents
{
    protected $projects;
    protected $dataRows = 50; // Number of empty data rows

    public function __construct(array $projects = [])
    {
        $this->projects = $projects;
    }

    public function title(): string
    {
        return 'Travailleurs';
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18,
            'B' => 18,
            'C' => 22,
            'D' => 15,
            'E' => 16,
            'F' => 22,
            'G' => 25,
            'H' => 15,
            'I' => 12,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [];
    }

    public function registerEvents(): array
    {
        $projects = $this->projects;
        $dataRows = $this->dataRows;

        return [
            AfterSheet::class => function(AfterSheet $event) use ($projects, $dataRows) {
                $sheet = $event->sheet->getDelegate();
                
                // SGTM Theme colors - Orange and Black
                $primaryOrange = 'F97316';   // Orange-500
                $darkOrange = 'EA580C';      // Orange-600
                $lightOrange = 'FED7AA';     // Orange-200
                $black = '1F2937';           // Gray-800 (soft black)
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';       // Gray-50
                $grayBorder = '9CA3AF';      // Gray-400

                // === ROW 1: Title ===
                $sheet->setCellValue('A1', 'SGTM - MODÈLE D\'IMPORT TRAVAILLEURS');
                $sheet->mergeCells('A1:I1');
                $sheet->getStyle('A1:I1')->applyFromArray([
                    'font' => [
                        'bold' => true,
                        'size' => 18,
                        'color' => ['rgb' => $white],
                    ],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['rgb' => $black],
                    ],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                // === ROW 2: Instructions ===
                $sheet->setCellValue('A2', 'Instructions: CIN obligatoire et unique. STATUT: ACTIF/INACTIF (INACTIF = non visible dans le projet)');
                $sheet->mergeCells('A2:I2');
                $sheet->getStyle('A2:I2')->applyFromArray([
                    'font' => [
                        'size' => 11,
                        'italic' => true,
                        'color' => ['rgb' => $black],
                    ],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['rgb' => $lightOrange],
                    ],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_LEFT,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                    'borders' => [
                        'bottom' => [
                            'borderStyle' => Border::BORDER_MEDIUM,
                            'color' => ['rgb' => $primaryOrange],
                        ],
                    ],
                ]);
                $sheet->getRowDimension(2)->setRowHeight(28);

                // === ROW 3: Headers ===
                $headers = ['NOM', 'PRENOM', 'FONCTION', 'CIN', 'DATE DE NAISSANCE', 'ENTREPRISE', 'PROJET', 'DATE D\'ENTREE', 'STATUT'];
                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }
                
                $sheet->getStyle('A3:I3')->applyFromArray([
                    'font' => [
                        'bold' => true,
                        'size' => 11,
                        'color' => ['rgb' => $white],
                    ],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['rgb' => $primaryOrange],
                    ],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => Border::BORDER_THIN,
                            'color' => ['rgb' => $darkOrange],
                        ],
                    ],
                ]);
                $sheet->getRowDimension(3)->setRowHeight(30);

                // CIN header special styling (darker to emphasize importance)
                $sheet->getStyle('D3')->applyFromArray([
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['rgb' => $black],
                    ],
                ]);

                // === DATA ROWS (4 onwards) ===
                $lastRow = 3 + $dataRows;
                
                for ($row = 4; $row <= $lastRow; $row++) {
                    // Alternate row colors
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;
                    
                    $sheet->getStyle("A{$row}:I{$row}")->applyFromArray([
                        'fill' => [
                            'fillType' => Fill::FILL_SOLID,
                            'startColor' => ['rgb' => $bgColor],
                        ],
                        'borders' => [
                            'allBorders' => [
                                'borderStyle' => Border::BORDER_THIN,
                                'color' => ['rgb' => $grayBorder],
                            ],
                        ],
                        'alignment' => [
                            'vertical' => Alignment::VERTICAL_CENTER,
                        ],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(22);
                    
                    // Status dropdown validation (ACTIF/INACTIF)
                    $statusValidation = $sheet->getCell("I{$row}")->getDataValidation();
                    $statusValidation->setType(DataValidation::TYPE_LIST);
                    $statusValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $statusValidation->setAllowBlank(false);
                    $statusValidation->setShowDropDown(true);
                    $statusValidation->setFormula1('"ACTIF,INACTIF"');
                    $sheet->setCellValue("I{$row}", 'ACTIF'); // Default to ACTIF
                }

                // === PROJECT DROPDOWN VALIDATION ===
                if (!empty($projects)) {
                    // Create a hidden sheet for project list
                    $spreadsheet = $sheet->getParent();
                    $projectSheet = $spreadsheet->createSheet();
                    $projectSheet->setTitle('_Projets');
                    
                    // Write projects to hidden sheet
                    $projectRow = 1;
                    foreach ($projects as $project) {
                        $projectSheet->setCellValue("A{$projectRow}", $project);
                        $projectRow++;
                    }
                    
                    // Hide the project sheet
                    $projectSheet->setSheetState(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet::SHEETSTATE_HIDDEN);
                    
                    // Apply data validation to PROJET column (G) for all data rows
                    $projectRange = '_Projets!$A$1:$A$' . count($projects);
                    
                    for ($row = 4; $row <= $lastRow; $row++) {
                        $validation = $sheet->getCell("G{$row}")->getDataValidation();
                        $validation->setType(DataValidation::TYPE_LIST);
                        $validation->setErrorStyle(DataValidation::STYLE_STOP);
                        $validation->setAllowBlank(true);
                        $validation->setShowInputMessage(true);
                        $validation->setShowErrorMessage(true);
                        $validation->setShowDropDown(true);
                        $validation->setErrorTitle('Erreur');
                        $validation->setError('Veuillez sélectionner un projet valide dans la liste.');
                        $validation->setPromptTitle('Projet');
                        $validation->setPrompt('Sélectionnez un projet');
                        $validation->setFormula1($projectRange);
                    }
                }

                // === COMMENTS/TOOLTIPS ===
                $sheet->getComment('D3')->getText()->createTextRun(
                    "CIN = IDENTIFIANT UNIQUE\n\nObligatoire pour chaque travailleur.\nLes doublons seront fusionnés."
                );
                $sheet->getComment('D3')->setWidth('200px');
                $sheet->getComment('D3')->setHeight('70px');

                $sheet->getComment('E3')->getText()->createTextRun("Format: JJ/MM/AAAA");
                $sheet->getComment('E3')->setWidth('120px');

                $sheet->getComment('H3')->getText()->createTextRun("Format: JJ/MM/AAAA");
                $sheet->getComment('H3')->setWidth('120px');

                if (!empty($projects)) {
                    $sheet->getComment('G3')->getText()->createTextRun(
                        "Utilisez la liste déroulante\npour sélectionner un projet."
                    );
                    $sheet->getComment('G3')->setWidth('180px');
                }

                $sheet->getComment('I3')->getText()->createTextRun(
                    "ACTIF = visible dans le projet\nINACTIF = masqué du projet"
                );
                $sheet->getComment('I3')->setWidth('180px');

                // === FREEZE & PRINT SETTINGS ===
                $sheet->freezePane('A4');
                $sheet->setSelectedCell('A4');
                
                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setPrintArea("A1:I{$lastRow}");

                // Set active sheet back to main
                $spreadsheet = $sheet->getParent();
                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
