<?php

namespace App\Exports;

use App\Models\Worker;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class WorkersExport implements FromCollection, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    protected $filters;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function collection()
    {
        $query = Worker::with('project:id,name,code')
            ->orderBy('nom')
            ->orderBy('prenom');

        if (!empty($this->filters['search'])) {
            $query->search($this->filters['search']);
        }

        if (!empty($this->filters['project_id'])) {
            $query->forProject($this->filters['project_id']);
        }

        if (!empty($this->filters['entreprise'])) {
            $query->forEnterprise($this->filters['entreprise']);
        }

        if (!empty($this->filters['fonction'])) {
            $query->where('fonction', 'like', '%' . $this->filters['fonction'] . '%');
        }

        if (isset($this->filters['is_active'])) {
            $query->where('is_active', $this->filters['is_active']);
        }

        return $query->get();
    }

    public function headings(): array
    {
        return [
            'NOM',
            'PRENOM',
            'FONCTION',
            'CIN',
            'DATE DE NAISSANCE',
            'ENTREPRISE',
            'PROJET',
            'DATE D\'ENTREE',
            'STATUT',
        ];
    }

    public function map($worker): array
    {
        return [
            $worker->nom,
            $worker->prenom,
            $worker->fonction,
            $worker->cin,
            $worker->date_naissance ? $worker->date_naissance->format('d/m/Y') : '',
            $worker->entreprise,
            $worker->project ? $worker->project->name : '',
            $worker->date_entree ? $worker->date_entree->format('d/m/Y') : '',
            $worker->is_active ? 'Actif' : 'Inactif',
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '0D9488'],
                ],
            ],
        ];
    }
}
