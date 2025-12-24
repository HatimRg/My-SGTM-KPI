<?php

namespace App\Exports;

use App\Models\Inspection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class InspectionsExport implements FromCollection, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    private array $filters;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function collection(): Collection
    {
        /** @var Builder $query */
        $query = Inspection::query()->with(['project:id,name,code']);

        if (!empty($this->filters['project_id'])) {
            $query->where('project_id', (int) $this->filters['project_id']);
        }

        if (!empty($this->filters['status'])) {
            $query->where('status', $this->filters['status']);
        }

        if (!empty($this->filters['nature'])) {
            $query->where('nature', $this->filters['nature']);
        }

        if (!empty($this->filters['type'])) {
            $query->where('type', $this->filters['type']);
        }

        return $query
            ->orderBy('inspection_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function headings(): array
    {
        return [
            'ID',
            'PROJET',
            'CODE PROJET',
            'DATE INSPECTION',
            'NATURE',
            'TYPE',
            'LIEU',
            'DATE DEBUT',
            'DATE FIN',
            'ZONE',
            'INSPECTEUR',
            'ENTREPRISE',
            'STATUT',
            'NOTES',
        ];
    }

    public function map($inspection): array
    {
        return [
            $inspection->id,
            $inspection->project?->name ?? '',
            $inspection->project?->code ?? '',
            $inspection->inspection_date ? $inspection->inspection_date->format('d/m/Y') : '',
            $inspection->nature ?? '',
            $inspection->type ?? '',
            $inspection->location ?? '',
            $inspection->start_date ? $inspection->start_date->format('d/m/Y') : '',
            $inspection->end_date ? $inspection->end_date->format('d/m/Y') : '',
            $inspection->zone ?? '',
            $inspection->inspector ?? '',
            $inspection->enterprise ?? '',
            $inspection->status ?? '',
            $inspection->notes ?? '',
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '1E40AF'],
                ],
            ],
        ];
    }
}
