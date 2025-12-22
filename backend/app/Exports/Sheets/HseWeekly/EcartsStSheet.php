<?php

namespace App\Exports\Sheets\HseWeekly;

use App\Models\Project;
use App\Models\SorReport;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithDrawings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

class EcartsStSheet implements FromArray, WithTitle, WithStyles, WithDrawings, WithEvents
{
    protected Project $project;
    protected int $week;
    protected int $year;
    protected Carbon $weekStart;
    protected Carbon $weekEnd;
    protected $deviations;

    public function __construct(Project $project, int $week, int $year, Carbon $weekStart, Carbon $weekEnd)
    {
        $this->project = $project;
        $this->week = $week;
        $this->year = $year;
        $this->weekStart = $weekStart;
        $this->weekEnd = $weekEnd;
        
        // Pre-load deviations
        $this->deviations = SorReport::where('project_id', $this->project->id)
            ->whereBetween('observation_date', [$this->weekStart->format('Y-m-d'), $this->weekEnd->format('Y-m-d')])
            ->where('company', '!=', 'SGTM')
            ->whereNotNull('company')
            ->where('company', '!=', '')
            ->orderBy('observation_date')
            ->get();
    }

    public function array(): array
    {
        // Calculate actual week number for Saturday-Friday period
        $actualWeekNumber = $this->weekStart->isoWeek();
        
        $rows = [
            [''],
            [''],
            [''],
            ['SUIVI D\'ECARTS (SOUS-TRAITANTS)'],
            ['Projet: ' . $this->project->name . ' | Semaine ' . $actualWeekNumber . ': ' . $this->weekStart->format('d/m') . ' → ' . $this->weekEnd->format('d/m') . ' | Année: ' . $this->year],
            [''],
            // Headers - includes SOCIETE column
            [
                'DATE',
                'HEURE',
                'ZONE',
                'SOCIETE',
                'SUPERVISEUR / ANIMATEUR',
                'NON CONFORMITE',
                'PHOTO',
                'CATEGORIE DE L\'ECART',
                'RESPONSABLE CONCERNE',
                'DATE BUTOIR',
                'ACTION DE MAITRISE',
                'PHOTO_ACTION',
                'STATUT',
                'COMMENTAIRES'
            ]
        ];

        foreach ($this->deviations as $deviation) {
            $dueDate = $deviation->corrective_action_date ?? $deviation->deadline;
            $rows[] = [
                $deviation->observation_date ? Carbon::parse($deviation->observation_date)->format('d/m/Y') : '',
                $deviation->observation_time ?? '',
                $deviation->zone ?? '',
                $deviation->company ?? '',
                $deviation->supervisor ?? $deviation->submitter_name ?? '',
                $deviation->non_conformity ?? $deviation->description ?? '',
                '', // Photo placeholder - will be filled with image
                $this->translateCategory($deviation->category),
                $deviation->responsible_person ?? '',
                $dueDate ? Carbon::parse($dueDate)->format('d/m/Y') : '',
                $deviation->corrective_action ?? '',
                '', // Action photo placeholder - will be filled with image
                $this->translateStatus($deviation->status),
                $deviation->notes ?? ''
            ];
        }

        if ($this->deviations->isEmpty()) {
            $rows[] = ['Aucun écart sous-traitant cette semaine', '', '', '', '', '', '', '', '', '', '', '', '', ''];
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
        ];
        return $statusMap[$status] ?? $status ?? 'Ouvert';
    }

    protected function translateCategory($category): string
    {
        $categories = [
            'nettoyage_rangement' => 'Nettoyage et Rangement',
            'protection_chute' => 'Protection contre les chutes',
            'echafaudage' => 'Echafaudage/Echelles/Escaliers',
            'epi' => 'Equipements de Protection Individuel',
            'excavations' => 'Excavations',
            'levage' => 'Levage',
            'methode_travail' => 'Méthode de travail - SPA',
            'manutention' => 'Manutention',
            'vehicule_transport' => 'Vehicule/Transport',
            'outils_equipements' => 'Outils/Equipements',
            'chute_trebuchement' => 'Chute & Trébuchement',
            'electricite' => 'Electricité',
            'protection_incendie' => 'Protection Incendie',
            'communication_attitude' => 'Communication/Attitude',
            'acces_passage' => 'Accès/Passage/Issues de Secours',
            'formation_toolbox' => 'Formation/Toolbox/Réunion',
            'inspection_evaluation' => 'Inspection et Evaluation',
            'documentation_hse' => 'Documentation HSE & Evaluation',
            'gestion_sous_traitants' => 'Gestion des sous-traitants',
            'autre' => 'Autre',
        ];
        return $categories[$category] ?? $category ?? '';
    }

    public function title(): string
    {
        return 'ECARTS ST';
    }

    public function drawings()
    {
        $drawings = [];
        
        // Add logo
        $logoPath = public_path('assets/SGTM_Logo-F6jmcNP5.jpg');
        if (file_exists($logoPath)) {
            $logo = new Drawing();
            $logo->setName('SGTM Logo');
            $logo->setPath($logoPath);
            $logo->setHeight(60);
            $logo->setCoordinates('A1');
            $drawings[] = $logo;
        }

        // Add deviation photos
        $rowIndex = 8; // Data starts at row 8
        foreach ($this->deviations as $deviation) {
            // Problem photo (column G for ST sheet - has extra SOCIETE column)
            if ($deviation->photo_path) {
                $photoPath = $this->getImagePath($deviation->photo_path);
                if ($photoPath && file_exists($photoPath)) {
                    $drawing = new Drawing();
                    $drawing->setName('Photo ' . $rowIndex);
                    $drawing->setPath($photoPath);
                    $drawing->setHeight(60);
                    $drawing->setCoordinates('G' . $rowIndex);
                    $drawing->setOffsetX(5);
                    $drawing->setOffsetY(5);
                    $drawings[] = $drawing;
                }
            }
            
            // Corrective action photo (column L for ST sheet) - use correct field name
            $actionPhotoPath = $deviation->corrective_action_photo_path ?? $deviation->action_photo_path ?? null;
            if ($actionPhotoPath) {
                $resolvedPath = $this->getImagePath($actionPhotoPath);
                if ($resolvedPath && file_exists($resolvedPath)) {
                    $drawing = new Drawing();
                    $drawing->setName('Action Photo ' . $rowIndex);
                    $drawing->setPath($resolvedPath);
                    $drawing->setHeight(60);
                    $drawing->setCoordinates('L' . $rowIndex);
                    $drawing->setOffsetX(5);
                    $drawing->setOffsetY(5);
                    $drawings[] = $drawing;
                }
            }
            
            $rowIndex++;
        }

        return $drawings;
    }
    
    protected function getImagePath($path): ?string
    {
        if (!$path) return null;
        
        // Handle different path formats
        if (str_starts_with($path, 'storage/')) {
            return public_path($path);
        } elseif (str_starts_with($path, '/storage/')) {
            return public_path(ltrim($path, '/'));
        } elseif (str_starts_with($path, 'sor_photos/') || str_starts_with($path, 'sor_actions/')) {
            return storage_path('app/public/' . $path);
        } else {
            $storagePath = storage_path('app/public/' . $path);
            if (file_exists($storagePath)) {
                return $storagePath;
            }
            return public_path('storage/' . $path);
        }
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                
                // Set column widths for photo columns
                $sheet->getColumnDimension('G')->setWidth(15);
                $sheet->getColumnDimension('L')->setWidth(15);
                
                // Set row heights for data rows to accommodate images
                $rowIndex = 8;
                foreach ($this->deviations as $deviation) {
                    $sheet->getRowDimension($rowIndex)->setRowHeight(50);
                    $rowIndex++;
                }
            },
        ];
    }

    public function styles(Worksheet $sheet)
    {
        $sheet->mergeCells('A4:N4');
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '7C3AED']],
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
                'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
            ]);
        }

        return [];
    }
}
