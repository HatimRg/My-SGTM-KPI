<?php

namespace App\Exports;

use App\Models\SorReport;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class DeviationsExport implements FromCollection, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    private array $filters;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function collection(): Collection
    {
        /** @var Builder $query */
        $query = SorReport::query()->with(['project:id,name,code', 'submitter:id,name', 'closer:id,name']);

        if (!empty($this->filters['visible_project_ids']) && is_array($this->filters['visible_project_ids'])) {
            $query->whereIn('project_id', $this->filters['visible_project_ids']);
        }

        if (!empty($this->filters['project_id'])) {
            $query->where('project_id', (int) $this->filters['project_id']);
        }

        if (!empty($this->filters['status'])) {
            $query->where('status', $this->filters['status']);
        }

        if (!empty($this->filters['category'])) {
            $query->where('category', $this->filters['category']);
        }

        if (!empty($this->filters['from_date'])) {
            $query->whereDate('observation_date', '>=', $this->filters['from_date']);
        }

        if (!empty($this->filters['to_date'])) {
            $query->whereDate('observation_date', '<=', $this->filters['to_date']);
        }

        return $query
            ->orderBy('observation_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function headings(): array
    {
        return [
            'ID',
            'PROJET',
            'CODE PROJET',
            'ENTREPRISE',
            'DATE OBSERVATION',
            'HEURE OBSERVATION',
            'ZONE',
            'SUPERVISEUR',
            'CATEGORIE',
            'NON CONFORMITE',
            'RESPONSABLE',
            'DELAI',
            'ACTION CORRECTIVE',
            'DATE ACTION',
            'HEURE ACTION',
            'STATUT',
            'PINNED',
            'SOUMIS PAR',
            'CLOTURE PAR',
        ];
    }

    public function map($report): array
    {
        return [
            $report->id,
            $report->project?->name ?? '',
            $report->project?->code ?? '',
            $report->company ?? '',
            $report->observation_date ? $report->observation_date->format('d/m/Y') : '',
            $report->observation_time ?? '',
            $report->zone ?? '',
            $report->supervisor ?? '',
            $report->category ?? '',
            $report->non_conformity ?? '',
            $report->responsible_person ?? '',
            $report->deadline ? $report->deadline->format('d/m/Y') : '',
            $report->corrective_action ?? '',
            $report->corrective_action_date ? $report->corrective_action_date->format('d/m/Y') : '',
            $report->corrective_action_time ?? '',
            $report->status ?? '',
            $report->is_pinned ? '1' : '0',
            $report->submitter?->name ?? ($report->submitter_name ?? ''),
            $report->closer?->name ?? ($report->closer_name ?? ''),
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '0D9488'],
                ],
            ],
        ];
    }
}
