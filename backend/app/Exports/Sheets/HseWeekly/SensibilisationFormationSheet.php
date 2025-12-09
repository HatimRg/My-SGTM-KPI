<?php

namespace App\Exports\Sheets\HseWeekly;

use App\Models\Project;
use App\Models\AwarenessSession;
use App\Models\Training;
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

class SensibilisationFormationSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize, WithDrawings
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
        // Get awareness sessions (TBM/TBT)
        $awarenessSessions = AwarenessSession::where('project_id', $this->project->id)
            ->whereBetween('date', [$this->weekStart->format('Y-m-d'), $this->weekEnd->format('Y-m-d')])
            ->orderBy('date')
            ->get();

        // Get trainings (from trainings table)
        $trainings = Training::where('project_id', $this->project->id)
            ->whereBetween('date', [$this->weekStart->format('Y-m-d'), $this->weekEnd->format('Y-m-d')])
            ->orderBy('date')
            ->get();

        $rows = [
            [''],
            [''],
            [''],
            ['SENSIBILISATION & FORMATION'],
            ['Projet: ' . $this->project->name . ' | Semaine ' . $this->week . ': ' . $this->weekStart->format('d/m') . ' → ' . $this->weekEnd->format('d/m') . ' | Année: ' . $this->year],
            [''],
            // Two side-by-side tables
            ['SENSIBILISATION (TBM / TBT)', '', '', '', '', 'FORMATION', '', '', ''],
            ['DATE', 'SENSIBILISATION', 'NBR PARTICIPANTS', 'DUREE (h)', '', 'DATE', 'FORMATION', 'NBR PARTICIPANTS', 'DUREE (h)'],
        ];

        // Get max rows needed
        $maxRows = max($awarenessSessions->count(), $trainings->count(), 1);
        
        $awarenessArray = $awarenessSessions->values()->all();
        $trainingsArray = $trainings->values()->all();

        $totalAwarenessParticipants = 0;
        $totalAwarenessHours = 0;
        $totalTrainingParticipants = 0;
        $totalTrainingHours = 0;

        for ($i = 0; $i < $maxRows; $i++) {
            $awareness = $awarenessArray[$i] ?? null;
            $training = $trainingsArray[$i] ?? null;

            $awarenessParticipants = $awareness ? ($awareness->participants ?? 0) : 0;
            $awarenessHours = $awareness ? (($awareness->duration_minutes ?? 0) / 60) : 0;
            $trainingParticipants = $training ? ($training->participants ?? 0) : 0;
            $trainingHours = $training ? ($training->duration_hours ?? $training->training_hours ?? 0) : 0;

            $totalAwarenessParticipants += $awarenessParticipants;
            $totalAwarenessHours += $awarenessHours;
            $totalTrainingParticipants += $trainingParticipants;
            $totalTrainingHours += $trainingHours;

            $rows[] = [
                $awareness ? Carbon::parse($awareness->date)->format('d/m/Y') : '',
                $awareness ? ($awareness->theme ?? '') : '',
                $awarenessParticipants,
                $awarenessHours,
                '',
                $training ? Carbon::parse($training->date)->format('d/m/Y') : '',
                $training ? ($training->theme ?? '') : '',
                $trainingParticipants,
                $trainingHours
            ];
        }

        // Add totals row
        $rows[] = [
            'TOTAL SEMAINE',
            '',
            $totalAwarenessParticipants,
            $totalAwarenessHours,
            '',
            'TOTAL SEMAINE',
            '',
            $totalTrainingParticipants,
            $totalTrainingHours
        ];

        return $rows;
    }

    public function title(): string
    {
        return 'SENSIB. & FORMATION';
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
        $sheet->mergeCells('A4:I4');
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '7C3AED']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        // Sensibilisation header
        $sheet->mergeCells('A7:D7');
        $sheet->getStyle('A7:D7')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F59E0B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        // Formation header
        $sheet->mergeCells('F7:I7');
        $sheet->getStyle('F7:I7')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '059669']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        // Column headers
        $sheet->getStyle('A8:D8')->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEF3C7']],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);
        $sheet->getStyle('F8:I8')->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'DCFCE7']],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        $sheet->freezePane('A9');

        $lastRow = $sheet->getHighestRow();
        for ($row = 9; $row < $lastRow; $row++) {
            $sheet->getStyle("A{$row}:D{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
            ]);
            $sheet->getStyle("F{$row}:I{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
            ]);
        }

        // Total row
        $sheet->getStyle("A{$lastRow}:D{$lastRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEF3C7']],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM]],
        ]);
        $sheet->getStyle("F{$lastRow}:I{$lastRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'DCFCE7']],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM]],
        ]);

        return [];
    }
}
