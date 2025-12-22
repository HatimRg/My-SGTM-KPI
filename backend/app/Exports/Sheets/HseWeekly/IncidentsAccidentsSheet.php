<?php

namespace App\Exports\Sheets\HseWeekly;

use App\Models\Project;
use App\Models\DailyKpiSnapshot;
use App\Models\SorReport;
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

class IncidentsAccidentsSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize, WithDrawings
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
        // Build day headers (Sat-Fri)
        $dayNames = ['Sam', 'Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
        $days = [];
        for ($i = 0; $i < 7; $i++) {
            $date = $this->weekStart->copy()->addDays($i);
            $days[] = [
                'date' => $date,
                'key' => $date->format('Y-m-d'),
                'label' => $dayNames[$i] . ' ' . $date->format('d/m'),
            ];
        }

        // Get incident/accident data from SOR reports for this project
        $weeklyIncidents = SorReport::where('project_id', $this->project->id)
            ->whereBetween('observation_date', [$this->weekStart->format('Y-m-d'), $this->weekEnd->format('Y-m-d')])
            ->whereIn('category', ['accident', 'incident', 'near_miss', 'first_aid', 'environmental'])
            ->orderBy('observation_date')
            ->get();

        // Get cumulative data
        $projectStart = $this->project->start_date ?? Carbon::now()->subYear();
        $cumulativeIncidents = SorReport::where('project_id', $this->project->id)
            ->whereBetween('observation_date', [$projectStart, $this->weekEnd->format('Y-m-d')])
            ->whereIn('category', ['accident', 'incident', 'near_miss', 'first_aid', 'environmental'])
            ->get();

        // Calculate cumulative summary
        $cumulativeSummary = $this->calculateSummary($cumulativeIncidents);

        // Define incident types for rows
        $incidentTypes = [
            ['key' => 'fat', 'label' => 'FAT (Accident Mortel)'],
            ['key' => 'lta', 'label' => 'LTA (Accident avec arrêt)'],
            ['key' => 'nlta', 'label' => 'NLTA (Accident sans arrêt)'],
            ['key' => 'fac', 'label' => 'FAC (Premiers soins)'],
            ['key' => 'nm', 'label' => 'NM (Presqu\'accident)'],
            ['key' => 'pd', 'label' => 'PD (Dommage matériel)'],
            ['key' => 'env', 'label' => 'Env. (Environnemental)'],
            ['key' => 'lwd', 'label' => 'LWD (Jours d\'arrêt)'],
        ];

        // Build header row: Type | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Total Semaine | Cumul Projet
        $headerRow = ['Type d\'incident'];
        foreach ($days as $day) {
            $headerRow[] = $day['label'];
        }
        $headerRow[] = 'Total Semaine';
        $headerRow[] = 'Cumul Projet';

        $rows = [
            [''], // Logo row
            [''],
            [''],
            ['SUIVI DES INCIDENTS & ACCIDENTS'],
            ['Projet: ' . $this->project->name . ' | Semaine ' . $this->week . ': ' . $this->weekStart->format('d/m') . ' → ' . $this->weekEnd->format('d/m') . ' | Année: ' . $this->year],
            [''],
            ['RÉCAPITULATIF PAR JOUR'],
            $headerRow,
        ];

        // Helper function to force display of 0
        $forceZero = function($value) {
            return $value === 0 ? '0' : $value;
        };

        // Build data rows (one per incident type)
        foreach ($incidentTypes as $type) {
            $row = [$type['label']];
            $weeklyTotal = 0;

            foreach ($days as $day) {
                $dayIncidents = $weeklyIncidents->filter(function($inc) use ($day) {
                    return Carbon::parse($inc->observation_date)->format('Y-m-d') === $day['key'];
                });
                
                $count = $this->countByType($dayIncidents, $type['key']);
                $row[] = $forceZero($count);
                $weeklyTotal += $count;
            }

            $row[] = $forceZero($weeklyTotal);
            $row[] = $forceZero(($cumulativeSummary[$type['key']] ?? 0));
            $rows[] = $row;
        }

        // Add separator and detail table
        $rows[] = [''];
        $rows[] = [''];
        $rows[] = ['DÉTAIL DES INCIDENTS DE LA SEMAINE'];
        $rows[] = [
            'Type',
            'Description / Détails',
            'Date de l\'événement',
            'Heure',
            'Lieu / Zone',
            'Gravité',
            'Personne impliquée',
            'Entreprise',
            'Permis lié',
            'Jours d\'arrêt',
            'Action corrective',
            'Responsable action',
            'Statut',
            'Date de clôture',
            'Remarques'
        ];

        // Add incident detail rows
        foreach ($weeklyIncidents as $incident) {
            $rows[] = [
                $this->mapIncidentType($incident->category, $incident->severity),
                $incident->description ?? '',
                $incident->observation_date ? Carbon::parse($incident->observation_date)->format('d/m/Y') : '',
                $incident->observation_time ?? '',
                $incident->zone ?? '',
                $incident->severity ?? '',
                $incident->person_involved ?? '',
                $incident->company ?? 'SGTM',
                $incident->related_permit ?? '',
                $incident->lost_days ?? 0,
                $incident->corrective_action ?? '',
                $incident->action_responsible ?? '',
                $this->translateStatus($incident->status),
                $incident->closed_at ? Carbon::parse($incident->closed_at)->format('d/m/Y') : '',
                $incident->remarks ?? ''
            ];
        }

        // If no incidents, add empty row
        if ($weeklyIncidents->isEmpty()) {
            $rows[] = ['Aucun incident cette semaine', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        }

        return $rows;
    }

    protected function countByType($incidents, $type): int
    {
        switch ($type) {
            case 'fat':
                return $incidents->where('severity', 'fatal')->count();
            case 'lta':
                return $incidents->where('severity', 'serious')->where('category', 'accident')->count();
            case 'nlta':
                return $incidents->where('severity', 'minor')->where('category', 'accident')->count();
            case 'fac':
                return $incidents->where('category', 'first_aid')->count();
            case 'nm':
                return $incidents->where('category', 'near_miss')->count();
            case 'pd':
                return $incidents->where('category', 'property_damage')->count();
            case 'env':
                return $incidents->where('category', 'environmental')->count();
            case 'lwd':
                return $incidents->sum('lost_days');
            default:
                return 0;
        }
    }

    protected function calculateSummary($incidents): array
    {
        return [
            'fat' => $incidents->where('severity', 'fatal')->count(),
            'lta' => $incidents->where('severity', 'serious')->where('category', 'accident')->count(),
            'nlta' => $incidents->where('severity', 'minor')->where('category', 'accident')->count(),
            'fac' => $incidents->where('category', 'first_aid')->count(),
            'nm' => $incidents->where('category', 'near_miss')->count(),
            'pd' => $incidents->where('category', 'property_damage')->count(),
            'env' => $incidents->where('category', 'environmental')->count(),
            'lwd' => $incidents->sum('lost_days'),
        ];
    }

    protected function mapIncidentType($category, $severity): string
    {
        if ($severity === 'fatal') return 'FAT';
        if ($category === 'accident' && $severity === 'serious') return 'LTA';
        if ($category === 'accident' && $severity === 'minor') return 'NLTA';
        if ($category === 'first_aid') return 'FAC';
        if ($category === 'near_miss') return 'NM';
        if ($category === 'property_damage') return 'PD';
        if ($category === 'environmental') return 'Env.';
        return strtoupper($category ?? 'N/A');
    }

    protected function translateStatus($status): string
    {
        $statusMap = [
            'open' => 'Ouvert',
            'in_progress' => 'En cours',
            'closed' => 'Fermé',
            'pending' => 'En attente',
        ];
        return $statusMap[$status] ?? $status ?? 'Ouvert';
    }

    public function title(): string
    {
        return 'INCIDENTS & ACCIDENTS';
    }

    public function drawings()
    {
        $logoPath = public_path('assets/SGTM_Logo-F6jmcNP5.jpg');
        
        if (!file_exists($logoPath)) {
            return [];
        }

        $drawing = new Drawing();
        $drawing->setName('SGTM Logo');
        $drawing->setPath($logoPath);
        $drawing->setHeight(60);
        $drawing->setCoordinates('A1');

        return [$drawing];
    }

    public function styles(Worksheet $sheet)
    {
        $lastCol = 'J'; // A + 7 days + Total + Cumul = 10 columns

        // Title
        $sheet->mergeCells("A4:{$lastCol}4");
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'DC2626']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        // Summary section header (row 7)
        $sheet->mergeCells("A7:{$lastCol}7");
        $sheet->getStyle('A7')->applyFromArray([
            'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
        ]);

        // Summary table header (row 8)
        $sheet->getStyle("A8:{$lastCol}8")->applyFromArray([
            'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        // Summary data rows (rows 9-16 for 8 incident types)
        for ($row = 9; $row <= 16; $row++) {
            // Type column styling
            $sheet->getStyle("A{$row}")->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F3F4F6']],
            ]);
            // Data cells
            if ($row % 2 == 0) {
                $sheet->getStyle("B{$row}:H{$row}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
            $sheet->getStyle("A{$row}:{$lastCol}{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        // Total Semaine column (column I)
        $sheet->getStyle('I8:I16')->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEF3C7']],
        ]);

        // Cumul Projet column (column J)
        $sheet->getStyle('J8:J16')->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'DCFCE7']],
        ]);

        // Detail section title (row 19)
        $sheet->mergeCells('A19:O19');
        $sheet->getStyle('A19')->applyFromArray([
            'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
        ]);

        // Detail table header (row 20)
        $sheet->getStyle('A20:O20')->applyFromArray([
            'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        // Freeze at detail header
        $sheet->freezePane('A21');

        // Detail data rows styling
        $lastRow = $sheet->getHighestRow();
        for ($row = 21; $row <= $lastRow; $row++) {
            if ($row % 2 == 0) {
                $sheet->getStyle("A{$row}:O{$row}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
            $sheet->getStyle("A{$row}:O{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
            ]);
        }

        // Set column widths for summary section
        $sheet->getColumnDimension('A')->setWidth(30);
        foreach (range('B', 'J') as $col) {
            $sheet->getColumnDimension($col)->setWidth(14);
        }

        return [];
    }
}
