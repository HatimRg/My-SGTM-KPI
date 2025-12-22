<?php

namespace App\Exports;

use App\Models\WorkPermit;
use App\Models\Project;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class WorkPermitsExport implements FromArray, WithStyles, WithColumnWidths, WithTitle
{
    protected $projectId;
    protected $weekNumber;
    protected $year;
    protected $project;

    // Permit type translations
    const PERMIT_TYPE_LABELS = [
        'type_cold' => 'Cold work',
        'type_work_at_height' => 'Travail en hauteur',
        'type_hot_work' => 'Travail à chaud',
        'type_confined_spaces' => 'Espace confiné',
        'type_electrical_isolation' => 'Isolation électrique',
        'type_energized_work' => 'Travail sous tension',
        'type_excavation' => 'Excavation',
        'type_mechanical_isolation' => 'Isolation mécanique',
        'type_7inch_grinder' => 'Meuleuse 7 pouces',
    ];

    public function __construct($projectId, $weekNumber, $year)
    {
        $this->projectId = $projectId;
        $this->weekNumber = $weekNumber;
        $this->year = $year;
        $this->project = Project::find($projectId);
    }

    public function array(): array
    {
        $rows = [];

        // Header row 1 - Project info
        $rows[] = [
            'Type du Permis',
            'Permis No:',
            'Project: ' . ($this->project->name ?? ''),
            '',
            'Demandeur du permis',
            'Emetteur du permis',
            'Autorisateur/mondateur du permis',
            'Date de commencement',
            'Date de fermerture du permis',
        ];

        // Header row 2 - Sub-headers under Project
        $rows[] = [
            '',
            '',
            'Description',
            'Zone',
            '',
            '',
            '',
            '',
            '',
        ];

        // Get permits for the week
        $permits = WorkPermit::where('project_id', $this->projectId)
            ->where('week_number', $this->weekNumber)
            ->where('year', $this->year)
            ->orderBy('serial_number')
            ->get();

        // Process each permit - create a row for each active permit type
        foreach ($permits as $permit) {
            $activeTypes = $this->getActiveTypes($permit);
            
            foreach ($activeTypes as $typeLabel) {
                $rows[] = [
                    $typeLabel,
                    $permit->permit_number,
                    $permit->description ?? '',
                    $permit->area ?? '',
                    $permit->permit_user ?? '',
                    $permit->signed_by ?? '',
                    $permit->authorizer ?? '',
                    $permit->commence_date ? $permit->commence_date->format('d/m/Y') : '',
                    $permit->end_date ? $permit->end_date->format('d/m/Y') : '',
                ];
            }
        }

        return $rows;
    }

    protected function getActiveTypes($permit): array
    {
        $types = [];
        foreach (self::PERMIT_TYPE_LABELS as $field => $label) {
            if ($permit->$field) {
                $types[] = $label;
            }
        }
        return $types;
    }

    public function styles(Worksheet $sheet)
    {
        $lastRow = $sheet->getHighestRow();
        $lastCol = 'I';

        // Style header row 1 (red background, white text)
        $sheet->getStyle('A1:I1')->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 11,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'C00000'], // Dark red
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => '000000'],
                ],
            ],
        ]);

        // Style header row 2 (red background, white text)
        $sheet->getStyle('A2:I2')->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 11,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'C00000'], // Dark red
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => '000000'],
                ],
            ],
        ]);

        // Merge cells for "Project:" header
        $sheet->mergeCells('C1:D1');

        // Style data rows
        if ($lastRow > 2) {
            $sheet->getStyle("A3:{$lastCol}{$lastRow}")->applyFromArray([
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER,
                    'wrapText' => true,
                ],
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['rgb' => '000000'],
                    ],
                ],
            ]);
        }

        // Set row height for headers
        $sheet->getRowDimension(1)->setRowHeight(35);
        $sheet->getRowDimension(2)->setRowHeight(25);

        return [];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 15, // Type du Permis
            'B' => 18, // Permis No
            'C' => 35, // Description
            'D' => 12, // Zone
            'E' => 18, // Demandeur du permis
            'F' => 18, // Emetteur du permis
            'G' => 22, // Autorisateur
            'H' => 16, // Date de commencement
            'I' => 16, // Date de fermerture
        ];
    }

    public function title(): string
    {
        return 'Permis S' . str_pad($this->weekNumber, 2, '0', STR_PAD_LEFT);
    }
}
