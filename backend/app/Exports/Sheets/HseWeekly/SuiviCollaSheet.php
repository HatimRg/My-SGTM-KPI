<?php

namespace App\Exports\Sheets\HseWeekly;

use App\Models\Project;
use App\Models\Worker;
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

class SuiviCollaSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize, WithDrawings
{
    protected Project $project;

    public function __construct(Project $project)
    {
        $this->project = $project;
    }

    public function array(): array
    {
        $workers = Worker::where('project_id', $this->project->id)
            ->with('trainings')
            ->orderBy('nom')
            ->get();

        $rows = [
            [''],
            [''],
            [''],
            ['SUIVI COLLABORATEURS'],
            ['Projet: ' . $this->project->name],
            [''],
            [
                'NOM',
                'PRENOM',
                'FONCTION',
                'CIN',
                'DATE DE NAISSANCE',
                'ENTREPRISE',
                'DATE D\'ENTREE',
                'DATE DE SORTIE',
                'INDUCTION HSE',
                'APTITUDE PHYSIQUE',
                'TRAVAIL EN HAUTEUR',
                'ELINGUAGE',
                'OUTILLAGE ELECTRIQUE',
                'ECHAFAUDAGE',
                'SECOURISME',
                'RECONNAISSANCE HSE',
                'MESURE DISCIPLINAIRE'
            ]
        ];

        foreach ($workers as $worker) {
            $trainings = $worker->trainings->keyBy(function($t) {
                return strtolower($t->training_label ?? $t->training_type ?? '');
            });

            $rows[] = [
                $worker->nom ?? '',
                $worker->prenom ?? '',
                $worker->fonction ?? '',
                $worker->cin ?? '',
                $worker->date_naissance ? Carbon::parse($worker->date_naissance)->format('d/m/Y') : '',
                $worker->entreprise ?? 'SGTM',
                $worker->date_entree ? Carbon::parse($worker->date_entree)->format('d/m/Y') : '',
                '',
                $this->getTrainingDate($trainings, ['induction', 'induction hse']),
                $this->getTrainingDate($trainings, ['aptitude', 'aptitude physique', 'medical']),
                $this->getTrainingDate($trainings, ['hauteur', 'travail en hauteur', 'height']),
                $this->getTrainingDate($trainings, ['elinguage', 'elingage', 'slinging']),
                $this->getTrainingDate($trainings, ['electrique', 'electrical', 'outillage']),
                $this->getTrainingDate($trainings, ['echafaudage', 'scaffolding']),
                $this->getTrainingDate($trainings, ['secourisme', 'first aid', 'premiers soins']),
                '',
                ''
            ];
        }

        if ($workers->isEmpty()) {
            $rows[] = ['Aucun collaborateur enregistré', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        }

        return $rows;
    }

    protected function getTrainingDate($trainings, array $keywords): string
    {
        foreach ($keywords as $keyword) {
            foreach ($trainings as $key => $training) {
                if (str_contains($key, $keyword)) {
                    return $training->training_date
                        ? Carbon::parse($training->training_date)->format('d/m/Y')
                        : 'Oui';
                }
            }
        }
        return '';
    }

    public function title(): string
    {
        return 'SUIVI COLLA';
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
        $sheet->mergeCells('A4:Q4');
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0891B2']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->getStyle('A7:Q7')->applyFromArray([
            'font' => ['bold' => true, 'size' => 8, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        $sheet->freezePane('A8');

        $lastRow = $sheet->getHighestRow();
        for ($row = 8; $row <= $lastRow; $row++) {
            if ($row % 2 == 0) {
                $sheet->getStyle("A{$row}:Q{$row}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
            $sheet->getStyle("A{$row}:Q{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
            ]);
        }

        return [];
    }
}
