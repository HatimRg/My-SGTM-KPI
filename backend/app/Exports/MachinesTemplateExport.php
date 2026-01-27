<?php

namespace App\Exports;

use App\Models\Project;
use App\Support\MachineTypeCatalog;
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
    protected int $dataRows;
    protected array $projectNames;
    protected string $lang;
    protected array $machineTypes;

    public function __construct(int $dataRows = 200, array $projectNames = [], string $lang = 'fr', array $machineTypes = [])
    {
        $this->dataRows = $dataRows;
        $this->projectNames = $projectNames;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';

        $this->machineTypes = array_values(array_unique(array_filter(array_map('trim', $machineTypes), fn ($v) => $v !== '')));
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    public function title(): string
    {
        return $this->tr('Engins', 'Machines');
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
        $projectNames = $this->projectNames;

        return [
            AfterSheet::class => function (AfterSheet $event) use ($dataRows, $projectNames) {
                $sheet = $event->sheet->getDelegate();

                $spreadsheet = $sheet->getParent();
                $listsSheet = new Worksheet($spreadsheet, 'Lists');
                $spreadsheet->addSheet($listsSheet);
                $listsSheet->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

                $machineTypes = MachineTypeCatalog::labels($this->lang);
                $machineTypesSet = array_fill_keys($machineTypes, true);
                foreach ($this->machineTypes as $rawType) {
                    $mappedKey = MachineTypeCatalog::keyFromInput($rawType);
                    if (!$mappedKey) {
                        continue;
                    }
                    $label = MachineTypeCatalog::labelForKey($mappedKey, $this->lang);
                    if ($label !== '' && !isset($machineTypesSet[$label])) {
                        $machineTypes[] = $label;
                        $machineTypesSet[$label] = true;
                    }
                }

                usort($machineTypes, function ($a, $b) {
                    $aStr = trim((string) $a);
                    $bStr = trim((string) $b);
                    $aOther = strcasecmp($aStr, $this->lang === 'en' ? 'Other' : 'Autres') === 0;
                    $bOther = strcasecmp($bStr, $this->lang === 'en' ? 'Other' : 'Autres') === 0;
                    if ($aOther && !$bOther) {
                        return 1;
                    }
                    if ($bOther && !$aOther) {
                        return -1;
                    }
                    return strnatcasecmp($aStr, $bStr);
                });

                $machineTypes = array_values(array_filter(array_map('trim', $machineTypes), fn ($v) => $v !== ''));

                $rowIndex = 1;
                foreach ($machineTypes as $type) {
                    $listsSheet->setCellValue('A' . $rowIndex, $type);
                    $rowIndex++;
                }
                $machineTypesLastRow = max(1, count($machineTypes));

                $projectNames = array_values(array_unique(array_filter(array_map('trim', $projectNames), fn ($v) => $v !== '')));
                $projectNamesCount = count($projectNames);
                if ($projectNamesCount > 0) {
                    $rowIndex = 1;
                    foreach ($projectNames as $name) {
                        $listsSheet->setCellValue('B' . $rowIndex, $name);
                        $rowIndex++;
                    }
                } else {
                    // Keep a valid range even when user has no visible projects.
                    $listsSheet->setCellValue('B1', '');
                    $projectNamesCount = 1;
                }

                $activeValues = $this->lang === 'en' ? ['ACTIVE', 'INACTIVE'] : ['ACTIF', 'INACTIF'];
                $rowIndex = 1;
                foreach ($activeValues as $v) {
                    $listsSheet->setCellValue('C' . $rowIndex, $v);
                    $rowIndex++;
                }
                $activeLastRow = max(1, count($activeValues));

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->setCellValue('A1', $this->tr("SGTM - MODÈLE D'IMPORT ENGINS", 'SGTM - MACHINES IMPORT TEMPLATE'));
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

                $sheet->setCellValue('A2', $this->tr(
                    'Instructions: Numéro de série* obligatoire et unique. Type engin* et Marque* obligatoires. Nom projet (optionnel) doit correspondre à un projet existant dans votre périmètre. Actif: ACTIF/INACTIF (optionnel, par défaut ACTIF).',
                    'Instructions: SERIAL_NUMBER* is required and must be unique. MACHINE_TYPE* and BRAND* are required. PROJECT_NAME (optional) must match an existing project within your scope. ACTIVE: ACTIVE/INACTIVE (optional, defaults to ACTIVE).'
                ));
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

                $headers = $this->lang === 'en'
                    ? ['SERIAL_NUMBER*', 'INTERNAL_CODE', 'MACHINE_TYPE*', 'BRAND*', 'MODEL', 'PROJECT_NAME', 'ACTIVE']
                    : ['Numéro de série*', 'Code interne', 'Type engin*', 'Marque*', 'Modèle', 'Nom du projet', 'Actif'];
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
                    $activeValidation->setShowErrorMessage(true);
                    $activeValidation->setErrorTitle($this->tr('Statut', 'Status'));
                    $activeValidation->setError($this->tr('Choisissez une valeur dans la liste.', 'Choose a value from the list.'));
                    $activeValidation->setFormula1("='Lists'!\$C\$1:\$C\$" . $activeLastRow);
                    $sheet->setCellValue("G{$row}", $this->lang === 'en' ? 'ACTIVE' : 'ACTIF');

                    $typeValidation = $sheet->getCell("C{$row}")->getDataValidation();
                    $typeValidation->setType(DataValidation::TYPE_LIST);
                    $typeValidation->setErrorStyle(DataValidation::STYLE_INFORMATION);
                    $typeValidation->setAllowBlank(false);
                    $typeValidation->setShowDropDown(true);
                    $typeValidation->setShowErrorMessage(true);
                    $typeValidation->setErrorTitle($this->tr('Type engin', 'Machine type'));
                    $typeValidation->setError($this->tr('Sélectionnez un type d\'engin dans la liste, ou saisissez une nouvelle valeur si nécessaire.', 'Select a machine type from the list, or type a new value if needed.'));
                    $typeValidation->setFormula1("='Lists'!\$A\$1:\$A\$" . $machineTypesLastRow);

                    $projectValidation = $sheet->getCell("F{$row}")->getDataValidation();
                    $projectValidation->setType(DataValidation::TYPE_LIST);
                    $projectValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $projectValidation->setAllowBlank(true);
                    $projectValidation->setShowDropDown(true);
                    $projectValidation->setShowErrorMessage(true);
                    $projectValidation->setErrorTitle($this->tr('Projet', 'Project'));
                    $projectValidation->setError($this->tr('Choisissez un projet existant dans la liste.', 'Choose an existing project from the list.'));
                    $projectValidation->setFormula1("='Lists'!\$B\$1:\$B\$" . $projectNamesCount);
                }

                $sheet->freezePane('A4');
                $sheet->setSelectedCell('A4');

                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);

                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
