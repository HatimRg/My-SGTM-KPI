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

class UsersTemplateExport implements WithStyles, WithColumnWidths, WithTitle, WithEvents
{
    protected int $dataRows;
    protected array $roleOptions;

    protected function roleLabel(string $role): string
    {
        $map = [
            'admin' => 'Administrateur',
            'hse_manager' => 'Manager HSE',
            'responsable' => 'Responsable HSE',
            'supervisor' => 'Superviseur HSE',
            'user' => 'Animateur HSE',
            'hr' => 'Responsable administratif',
            'dev' => 'Développeur',
            'pole_director' => 'Directeur de pôle',
            'works_director' => 'Directeur Travaux',
            'hse_director' => 'Directeur HSE',
            'hr_director' => 'Directeur RH',
        ];

        return $map[$role] ?? $role;
    }

    public function __construct(int $dataRows = 200, array $roleOptions = [])
    {
        $this->dataRows = $dataRows;
        $this->roleOptions = $roleOptions;
    }

    public function title(): string
    {
        return 'Utilisateurs';
    }

    public function columnWidths(): array
    {
        return [
            'A' => 26,
            'B' => 24,
            'C' => 18,
            'D' => 16,
            'E' => 16,
            'F' => 18,
            'G' => 14,
            'H' => 40,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [];
    }

    public function registerEvents(): array
    {
        $dataRows = $this->dataRows;
        $roleOptions = $this->roleOptions;

        return [
            AfterSheet::class => function (AfterSheet $event) use ($dataRows, $roleOptions) {
                $sheet = $event->sheet->getDelegate();

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->setCellValue('A1', 'SGTM - MODÈLE D\'IMPORT UTILISATEURS');
                $sheet->mergeCells('A1:H1');
                $sheet->getStyle('A1:H1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                $sheet->setCellValue('A2', 'Instructions: EMAIL, NOM et ROLE obligatoires. Mot de passe requis pour les nouveaux utilisateurs. ACTIF: ACTIF/INACTIF. PROJECT_CODES (optionnel) = codes projets séparés par virgule. POLE (optionnel) = ignoré sauf si ROLE = Directeur de pôle.');
                $sheet->mergeCells('A2:H2');
                $sheet->getStyle('A2:H2')->applyFromArray([
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

                $headers = ['EMAIL*', 'NOM*', 'MOT_DE_PASSE', 'ROLE*', 'POLE', 'TELEPHONE', 'ACTIF', 'PROJECT_CODES'];
                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }

                $sheet->getStyle('A3:H3')->applyFromArray([
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

                $lastRow = 3 + $dataRows;
                for ($row = 4; $row <= $lastRow; $row++) {
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;

                    $sheet->getStyle("A{$row}:H{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bgColor]],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $grayBorder]],
                        ],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(22);

                    $roleValidation = $sheet->getCell("D{$row}")->getDataValidation();
                    $roleValidation->setType(DataValidation::TYPE_LIST);
                    $roleValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $roleValidation->setAllowBlank(false);
                    $roleValidation->setShowDropDown(true);
                    $roleLabels = !empty($roleOptions)
                        ? array_map(fn ($r) => $this->roleLabel((string) $r), $roleOptions)
                        : ['Administrateur', 'Manager HSE', 'Responsable HSE', 'Superviseur HSE', 'Responsable administratif', 'Animateur HSE', 'Développeur', 'Directeur de pôle', 'Directeur Travaux', 'Directeur HSE', 'Directeur RH'];
                    $rolesCsv = implode(',', $roleLabels);
                    $roleValidation->setFormula1('"' . $rolesCsv . '"');

                    $activeValidation = $sheet->getCell("G{$row}")->getDataValidation();
                    $activeValidation->setType(DataValidation::TYPE_LIST);
                    $activeValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $activeValidation->setAllowBlank(true);
                    $activeValidation->setShowDropDown(true);
                    $activeValidation->setFormula1('"ACTIF,INACTIF"');
                    $sheet->setCellValue("G{$row}", 'ACTIF');
                }

                $sheet->freezePane('A4');
                $sheet->setSelectedCell('A4');

                $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setPrintArea("A1:H{$lastRow}");

                $spreadsheet = $sheet->getParent();
                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
