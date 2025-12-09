<?php

namespace App\Exports\Sheets\HseWeekly;

use App\Models\Project;
use App\Models\Inspection;
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

class InspectionsSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize, WithDrawings
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
        $inspections = Inspection::where('project_id', $this->project->id)
            ->whereBetween('inspection_date', [$this->weekStart->format('Y-m-d'), $this->weekEnd->format('Y-m-d')])
            ->orderBy('inspection_date')
            ->get();

        // Calculate actual week number for Saturday-Friday period
        $actualWeekNumber = $this->weekStart->isoWeek();

        $rows = [
            [''],
            [''],
            [''],
            ['SUIVI DES INSPECTIONS'],
            ['Projet: ' . $this->project->name . ' | Semaine ' . $actualWeekNumber . ': ' . $this->weekStart->format('d/m') . ' → ' . $this->weekEnd->format('d/m') . ' | Année: ' . $this->year],
            [''],
            [
                'N°',
                'Nature d\'inspection',
                'Type d\'inspection',
                'Lieu',
                'Date de début',
                'Date d\'achèvement',
                'Zone',
                'Inspecteur',
                'Entreprise',
                'Statut',
                'Observations',
                'Action requise',
                'Responsable',
                'Date butoir'
            ]
        ];

        $counter = 1;
        foreach ($inspections as $inspection) {
            $rows[] = [
                $counter++,
                $inspection->nature ?? '',
                $inspection->type ?? 'internal',
                $inspection->location ?? '',
                $inspection->inspection_date ? Carbon::parse($inspection->inspection_date)->format('d/m/Y') : '',
                $inspection->start_date ? Carbon::parse($inspection->start_date)->format('d/m/Y') : '', // Date d'achèvement
                $inspection->zone ?? '',
                $inspection->inspector ?? '', // Inspecteur
                $inspection->enterprise ?? 'SGTM',
                $this->translateStatus($inspection->status),
                $inspection->notes ?? '', // Observations
                $inspection->action_required ?? '', // Placeholder for future field
                $inspection->action_responsible ?? '', // Placeholder for future field
                $inspection->end_date ? Carbon::parse($inspection->end_date)->format('d/m/Y') : '' // Date butoir
            ];
        }

        if ($inspections->isEmpty()) {
            $rows[] = ['-', 'Aucune inspection cette semaine', '', '', '', '', '', '', '', '', '', '', '', ''];
        }

        return $rows;
    }

    protected function translateStatus($status): string
    {
        $statusMap = [
            'open' => 'Ouvert',
            'in_progress' => 'En cours',
            'closed' => 'Fermé',
            'pending' => 'En attente',
            'completed' => 'Terminé',
        ];
        return $statusMap[$status] ?? $status ?? 'Ouvert';
    }

    public function title(): string
    {
        return 'INSPECTIONS';
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
        $sheet->mergeCells('A4:N4');
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0284C7']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->getStyle('A7:N7')->applyFromArray([
            'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        $sheet->freezePane('A8');

        $lastRow = $sheet->getHighestRow();
        for ($row = 8; $row <= $lastRow; $row++) {
            if ($row % 2 == 0) {
                $sheet->getStyle("A{$row}:N{$row}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
            $sheet->getStyle("A{$row}:N{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
            ]);
        }

        return [];
    }
}
