<?php

namespace App\Exports\Sheets\HseWeekly;

use App\Models\Project;
use App\Models\WorkPermit;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithDrawings;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

class PermisTravailSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize, WithDrawings
{
    protected Project $project;
    protected int $week;
    protected int $year;
    protected Carbon $weekStart;
    protected Carbon $weekEnd;

    public function __construct(Project $project, int $week, int $year, Carbon $weekStart, Carbon $weekEnd)
    {
        $this->project = $project;
        $this->week = $week;
        $this->year = $year;
        $this->weekStart = $weekStart;
        $this->weekEnd = $weekEnd;
    }

    public function array(): array
    {
        $permits = WorkPermit::where('project_id', $this->project->id)
            ->where('week_number', $this->week)
            ->where('year', $this->year)
            ->orderBy('commence_date')
            ->get();

        $rows = [
            [''],
            [''],
            [''],
            ['PERMIS DE TRAVAIL'],
            ['Projet: ' . $this->project->name . ' | Semaine ' . $this->week . ': ' . $this->weekStart->format('d/m') . ' → ' . $this->weekEnd->format('d/m') . ' | Année: ' . $this->year],
            [''],
            [
                'Permit No:',
                'Permit Type',
                'Description',
                'Area / Equipment No',
                'Permit Issuer',
                'Commence Date',
                'Finished Date',
                'Entreprise',
                'Statut',
                'Observations'
            ]
        ];

        foreach ($permits as $permit) {
            $rows[] = [
                $permit->permit_number ?? '',
                $this->getPermitType($permit),
                $permit->description ?? '',
                $permit->area ?? '',
                $permit->permit_user ?? '',
                $permit->commence_date ? Carbon::parse($permit->commence_date)->format('d/m/Y') : '',
                $permit->end_date ? Carbon::parse($permit->end_date)->format('d/m/Y') : '',
                $permit->enterprise ?? 'SGTM',
                $this->translateStatus($permit->status),
                ''
            ];
        }

        if ($permits->isEmpty()) {
            $rows[] = ['-', 'Aucun permis de travail cette semaine', '', '', '', '', '', '', '', ''];
        }

        return $rows;
    }

    protected function getPermitType($permit): string
    {
        $types = [];
        if ($permit->type_cold) $types[] = 'Travail à froid';
        if ($permit->type_work_at_height) $types[] = 'Travail en hauteur';
        if ($permit->type_hot_work) $types[] = 'Travail à chaud';
        if ($permit->type_confined_spaces) $types[] = 'Espace confiné';
        if ($permit->type_electrical_isolation) $types[] = 'Isolation électrique';
        if ($permit->type_energized_work) $types[] = 'Travail sous tension';
        if ($permit->type_excavation) $types[] = 'Excavation';
        if ($permit->type_mechanical_isolation) $types[] = 'Isolation mécanique';
        if ($permit->type_7inch_grinder) $types[] = 'Meuleuse 7 pouces';
        return implode(', ', $types) ?: 'Non spécifié';
    }

    protected function translateStatus($status): string
    {
        $statusMap = [
            'active' => 'Valide',
            'valid' => 'Valide',
            'expired' => 'Expiré',
            'cancelled' => 'Annulé',
            'closed' => 'Fermé',
            'pending' => 'En attente',
        ];
        return $statusMap[$status] ?? $status ?? 'Valide';
    }

    public function title(): string
    {
        return 'PERMIS TRAVAIL';
    }

    public function drawings()
    {
        $logoPath = public_path('assets/SGTM_Logo-F6jmcNP5.jpg');
        if (!file_exists($logoPath)) return [];

        $drawing = new Drawing();
        $drawing->setName('SGTM Logo');
        $drawing->setPath($logoPath);
        $drawing->setHeight(60);
        $drawing->setCoordinates('A1');

        return [$drawing];
    }

    public function styles(Worksheet $sheet)
    {
        $sheet->mergeCells('A4:J4');
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'DC2626']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->getStyle('A7:J7')->applyFromArray([
            'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        $sheet->freezePane('A8');

        $lastRow = $sheet->getHighestRow();
        for ($row = 8; $row <= $lastRow; $row++) {
            if ($row % 2 == 0) {
                $sheet->getStyle("A{$row}:J{$row}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
            $sheet->getStyle("A{$row}:J{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
            ]);
        }

        return [];
    }
}
