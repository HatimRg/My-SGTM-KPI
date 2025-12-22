<?php

namespace App\Exports\Sheets;

use App\Models\Project;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class ProjectsSheet implements FromCollection, WithTitle, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    public function collection()
    {
        return Project::with(['users', 'creator'])
            ->withCount('kpiReports')
            ->orderBy('name')
            ->get();
    }

    public function headings(): array
    {
        return [
            'ID',
            'Name',
            'Code',
            'Description',
            'Location',
            'Pole',
            'Client',
            'Status',
            'Start Date',
            'End Date',
            'Created By',
            'Assigned Users',
            'Total Reports',
            'Created At',
        ];
    }

    public function map($project): array
    {
        return [
            $project->id,
            $project->name,
            $project->code,
            $project->description,
            $project->location,
            $project->pole,
            $project->client_name,
            ucfirst($project->status),
            $project->start_date?->format('Y-m-d'),
            $project->end_date?->format('Y-m-d'),
            $project->creator->name ?? 'N/A',
            $project->users->pluck('name')->implode(', '),
            $project->kpi_reports_count,
            $project->created_at?->format('Y-m-d H:i'),
        ];
    }

    public function title(): string
    {
        return 'Projects';
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '059669']
                ]
            ],
        ];
    }
}
