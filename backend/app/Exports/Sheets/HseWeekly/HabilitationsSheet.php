<?php

namespace App\Exports\Sheets\HseWeekly;

use App\Models\Project;
use App\Models\Worker;
use App\Models\WorkerTraining;
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

class HabilitationsSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize, WithDrawings
{
    protected Project $project;

    public function __construct(Project $project)
    {
        $this->project = $project;
    }

    public function array(): array
    {
        // Get workers with their trainings/certifications
        // Only include workers that actually have at least one recorded training/certification
        // WorkerTraining model uses training_date (date d'obtention) and expiry_date
        $workers = Worker::where('project_id', $this->project->id)
            ->whereHas('trainings', function($q) {
                $q->whereNotNull('training_date');
            })
            ->with(['trainings' => function($q) {
                $q->whereNotNull('training_date');
            }])
            ->orderBy('nom')
            ->get();

        $rows = [
            [''],
            [''],
            [''],
            ['SUIVI DES HABILITATIONS'],
            ['Projet: ' . $this->project->name],
            [''],
            [
                'PRENOM',
                'NOM',
                'CIN',
                'DATE DE NAISSANCE',
                'POSTE',
                'SOCIETE',
                'TYPE HABILITATION',
                'DATE D\'OBTENTION',
                'DATE D\'EXPIRATION',
                'STATUT',
                'COMMENTAIRES'
            ]
        ];

        foreach ($workers as $worker) {
            if ($worker->trainings->isEmpty()) {
                $rows[] = [
                    $worker->prenom ?? '',
                    $worker->nom ?? '',
                    $worker->cin ?? '',
                    $worker->date_naissance ? Carbon::parse($worker->date_naissance)->format('d/m/Y') : '',
                    $worker->fonction ?? '',
                    $worker->entreprise ?? 'SGTM',
                    '-',
                    '-',
                    '-',
                    '-',
                    ''
                ];
            } else {
                foreach ($worker->trainings as $training) {
                    // expiry_date column stores the expiration date of the certification
                    $expirationDate = $training->expiry_date ? Carbon::parse($training->expiry_date) : null;
                    $status = 'Valide';
                    if ($expirationDate) {
                        if ($expirationDate->isPast()) {
                            $status = 'Expiré';
                        } elseif ($expirationDate->diffInDays(now()) <= 30) {
                            $status = 'À renouveler';
                        }
                    }

                    $rows[] = [
                        $worker->prenom ?? '',
                        $worker->nom ?? '',
                        $worker->cin ?? '',
                        $worker->date_naissance ? Carbon::parse($worker->date_naissance)->format('d/m/Y') : '',
                        $worker->fonction ?? '',
                        $worker->entreprise ?? 'SGTM',
                        $training->training_label ?? $training->training_type ?? '',
                        $training->training_date ? Carbon::parse($training->training_date)->format('d/m/Y') : '',
                        $expirationDate ? $expirationDate->format('d/m/Y') : '',
                        $status,
                        $training->remarks ?? ''
                    ];
                }
            }
        }

        if ($workers->isEmpty()) {
            $rows[] = ['Aucune habilitation enregistrée', '', '', '', '', '', '', '', '', '', ''];
        }

        return $rows;
    }

    public function title(): string
    {
        return 'HABILITATIONS';
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
        $sheet->mergeCells('A4:K4');
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '059669']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->getStyle('A7:K7')->applyFromArray([
            'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        $sheet->freezePane('A8');

        $lastRow = $sheet->getHighestRow();
        for ($row = 8; $row <= $lastRow; $row++) {
            if ($row % 2 == 0) {
                $sheet->getStyle("A{$row}:K{$row}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
            $sheet->getStyle("A{$row}:K{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
            ]);
        }

        return [];
    }
}
