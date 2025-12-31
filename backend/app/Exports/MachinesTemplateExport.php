<?php

namespace App\Exports;

use App\Models\Project;
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

class MachinesTemplateExport implements WithStyles, WithColumnWidths, WithTitle, WithEvents
{
    private const MACHINE_TYPES = [
        'Grue mobile',
        'Grue a tour',
        'Pelle sur chenille',
        'Pelle sur pneu',
        'Mini pelle',
        'Chargeuse',
        'Mini chargeuse',
        'Compresseur',
        'Compacteur',
        'Rouleaux vibrant',
        'Chariot élévateur',
        'Nacelle articulé',
        'Nacelle télescopique',
        'Nacelle ciseaux',
        'Bulldozer',
        'Camion a benne',
        'Camion citerne à eau',
        'Camion citerne à gasoil',
        'Tractopelle',
        'Autre',
    ];

    protected int $dataRows;
    protected array $projectCodes;

    public function __construct(int $dataRows = 200, array $projectCodes = [])
    {
        $this->dataRows = $dataRows;
        $this->projectCodes = $projectCodes;
    }

    public function title(): string
    {
        return 'Engins';
    }

    public function columnWidths(): array
    {
        return [
            'A' => 24,
            'B' => 18,
            'C' => 18,
            'D' => 16,
            'E' => 16,
            'F' => 18,
            'G' => 12,
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

                $machineTypes = self::MACHINE_TYPES;
                sort($machineTypes, SORT_NATURAL | SORT_FLAG_CASE);
                $machineTypes = array_values(array_filter(array_map('trim', $machineTypes), fn ($v) => $v !== ''));

                $rowIndex = 1;
                foreach ($machineTypes as $type) {
                    $listsSheet->setCellValue('A' . $rowIndex, $type);
                    $rowIndex++;
                }
                $machineTypesLastRow = max(1, count($machineTypes));

                $projectCodes = array_values(array_filter(array_map('trim', $projectCodes), fn ($v) => $v !== ''));
                $rowIndex = 1;
                foreach ($projectCodes as $code) {
                    $listsSheet->setCellValue('B' . $rowIndex, $code);
                    $rowIndex++;
                }
                $projectCodesLastRow = max(1, count($projectCodes));

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->setCellValue('A1', 'SGTM - MODÈLE D\'IMPORT ENGINS');
                $sheet->mergeCells('A1:G1');
                $sheet->getStyle('A1:G1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                $sheet->setCellValue('A2', 'Instructions: SERIAL_NUMBER* obligatoire et unique. MACHINE_TYPE* et BRAND* obligatoires. PROJECT_CODE (optionnel) doit correspondre à un code projet existant dans votre périmètre. ACTIF: ACTIF/INACTIF (optionnel, par défaut ACTIF).');
                $sheet->mergeCells('A2:G2');
                $sheet->getStyle('A2:G2')->applyFromArray([
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

                $headers = ['SERIAL_NUMBER*', 'INTERNAL_CODE', 'MACHINE_TYPE*', 'BRAND*', 'MODEL', 'PROJECT_CODE', 'ACTIF'];
                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }

                $sheet->getStyle('A3:G3')->applyFromArray([
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

                $lastRow = 3 + $dataRows;
                for ($row = 4; $row <= $lastRow; $row++) {
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;

                    $sheet->getStyle("A{$row}:G{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bgColor]],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $grayBorder]],
                        ],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(22);

                    $activeValidation = $sheet->getCell("G{$row}")->getDataValidation();
                    $activeValidation->setType(DataValidation::TYPE_LIST);
                    $activeValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $activeValidation->setAllowBlank(true);
                    $activeValidation->setShowDropDown(true);
                    $activeValidation->setFormula1('"ACTIF,INACTIF"');
                    $sheet->setCellValue("G{$row}", 'ACTIF');

                    $typeValidation = $sheet->getCell("C{$row}")->getDataValidation();
                    $typeValidation->setType(DataValidation::TYPE_LIST);
                    $typeValidation->setErrorStyle(DataValidation::STYLE_INFORMATION);
                    $typeValidation->setAllowBlank(false);
                    $typeValidation->setShowDropDown(true);
                    $typeValidation->setShowErrorMessage(true);
                    $typeValidation->setErrorTitle('Machine type');
                    $typeValidation->setError('Select a machine type from the list, or type a new value if needed.');
                    $typeValidation->setFormula1("='Lists'!\$A\$1:\$A\${machineTypesLastRow}");

                    if (!empty($projectCodes)) {
                        $projectValidation = $sheet->getCell("F{$row}")->getDataValidation();
                        $projectValidation->setType(DataValidation::TYPE_LIST);
                        $projectValidation->setErrorStyle(DataValidation::STYLE_STOP);
                        $projectValidation->setAllowBlank(true);
                        $projectValidation->setShowDropDown(true);

                        $projectValidation->setFormula1("='Lists'!\$B\$1:\$B\${projectCodesLastRow}");
                    }
                }

                $sheet->freezePane('A4');
                $sheet->setSelectedCell('A4');

                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setPrintArea("A1:G{$lastRow}");

                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
