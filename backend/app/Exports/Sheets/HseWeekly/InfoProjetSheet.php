<?php

namespace App\Exports\Sheets\HseWeekly;

use App\Models\Project;
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

class InfoProjetSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize, WithDrawings
{
    protected Project $project;
    protected int $week;
    protected int $year;
    protected ?Carbon $weekStart = null;
    protected ?Carbon $weekEnd = null;

    public function __construct(Project $project, int $week, int $year, ?Carbon $weekStart = null, ?Carbon $weekEnd = null)
    {
        $this->project = $project;
        $this->week = $week;
        $this->year = $year;
        $this->weekStart = $weekStart;
        $this->weekEnd = $weekEnd;
    }

    public function array(): array
    {
        // Use provided week dates or fallback to calculation
        $weekStart = $this->weekStart ?: Carbon::now()->setISODate($this->year, $this->week, 6); // Saturday
        $weekEnd = $this->weekEnd ?: (clone $weekStart)->addDays(6); // Friday
        $month = $weekStart->translatedFormat('F');
        
        // Calculate actual week number for Saturday-Friday period
        $actualWeekNumber = $weekStart->isoWeek();
        
        // Get HSE responsable from project team - prioritize 'responsable' role
        $hseResponsable = $this->project->users()
            ->where('role', 'responsable')
            ->first();
        
        // If no responsable found, try supervisor
        if (!$hseResponsable) {
            $hseResponsable = $this->project->users()
                ->where('role', 'supervisor')
                ->first();
        }
        
        // Fallback to any user assigned to the project (excluding admin)
        if (!$hseResponsable) {
            $hseResponsable = $this->project->users()
                ->where('role', '!=', 'admin')
                ->first();
        }

        return [
            [''], // Row for logo
            [''],
            [''],
            [''],
            ['INFO PROJET'],
            [''],
            ['', ''],
            ['Nom du projet', $this->project->name ?? ''],
            ['Société', 'Société Générale des Travaux du Maroc | SGTM'],
            ['Date début de projet', $this->project->start_date ? Carbon::parse($this->project->start_date)->format('d/m/Y') : ''],
            ['Responsable HSE', $hseResponsable->name ?? ''],
            ['Numéro du projet / Code', $this->project->code ?? ''],
            ['Semaine sélectionnée', "Semaine {$actualWeekNumber}: {$weekStart->format('d/m')} → {$weekEnd->format('d/m')}"],
            ['Mois', $month],
            ['Année', $this->year],
            ['Contact HSE', $hseResponsable->email ?? ($hseResponsable->phone ?? '')],
        ];
    }

    public function title(): string
    {
        return 'INFO PROJET';
    }

    public function drawings()
    {
        $logoPath = public_path('assets/SGTM_Logo-F6jmcNP5.jpg');
        
        if (!file_exists($logoPath)) {
            return [];
        }

        $drawing = new Drawing();
        $drawing->setName('SGTM Logo');
        $drawing->setDescription('SGTM Logo');
        $drawing->setPath($logoPath);
        $drawing->setHeight(80);
        $drawing->setCoordinates('A1');
        $drawing->setOffsetX(50);
        $drawing->setOffsetY(10);

        return [$drawing];
    }

    public function styles(Worksheet $sheet)
    {
        // Set row heights for logo area
        $sheet->getRowDimension(1)->setRowHeight(20);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        $sheet->getRowDimension(4)->setRowHeight(20);

        // Title style
        $sheet->mergeCells('A5:B5');
        $sheet->getStyle('A5')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        // Header row
        $sheet->getStyle('A7:B7')->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E5E7EB']],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        // Data rows
        $sheet->getStyle('A8:B16')->applyFromArray([
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        // Label column style
        $sheet->getStyle('A8:A16')->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F3F4F6']],
        ]);

        // Freeze header row
        $sheet->freezePane('A8');

        // Set column widths
        $sheet->getColumnDimension('A')->setWidth(30);
        $sheet->getColumnDimension('B')->setWidth(50);

        return [];
    }
}
