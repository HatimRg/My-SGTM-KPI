<?php

namespace App\Exports;

use App\Models\AwarenessSession;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class AwarenessSessionsExport implements FromCollection, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    private array $filters;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function collection(): Collection
    {
        /** @var Builder $query */
        $query = AwarenessSession::query()->with(['project:id,name,code', 'submitter:id,name']);

        if (!empty($this->filters['visible_project_ids']) && is_array($this->filters['visible_project_ids'])) {
            $query->whereIn('project_id', $this->filters['visible_project_ids']);
        }

        if (!empty($this->filters['project_id'])) {
            $query->where('project_id', (int) $this->filters['project_id']);
        }

        if (!empty($this->filters['week'])) {
            $query->where('week_number', (int) $this->filters['week']);
        }

        if (!empty($this->filters['year'])) {
            $query->where('week_year', (int) $this->filters['year']);
        }

        if (!empty($this->filters['from_date'])) {
            $query->whereDate('date', '>=', $this->filters['from_date']);
        }

        if (!empty($this->filters['to_date'])) {
            $query->whereDate('date', '<=', $this->filters['to_date']);
        }

        return $query
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function headings(): array
    {
        return [
            'ID',
            'PROJET',
            'CODE PROJET',
            'DATE',
            'SEMAINE',
            'ANNEE',
            'ANIMEE PAR',
            'THEME',
            'DUREE (MIN)',
            'PARTICIPANTS',
            'HEURES SESSION',
            'SOUMIS PAR',
        ];
    }

    public function map($session): array
    {
        return [
            $session->id,
            $session->project?->name ?? '',
            $session->project?->code ?? '',
            $session->date ? substr((string) $session->date, 0, 10) : '',
            $session->week_number ?? '',
            $session->week_year ?? '',
            $session->by_name ?? '',
            $session->theme ?? '',
            $session->duration_minutes ?? '',
            $session->participants ?? '',
            $session->session_hours ?? '',
            $session->submitter?->name ?? '',
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
