<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class KpiReportsExport implements FromCollection, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    protected $reports;

    public function __construct(Collection $reports)
    {
        $this->reports = $reports;
    }

    public function collection()
    {
        return $this->reports;
    }

    public function headings(): array
    {
        return [
            'Project',
            'Project Code',
            'Week',
            'Year',
            'Start Date',
            'End Date',
            'Submitted By',
            'Accidents (Total)',
            'Fatal',
            'Serious',
            'Minor',
            'Near Misses',
            'First Aid Cases',
            'Trainings Conducted',
            'Employees Trained',
            'Training Hours',
            'Toolbox Talks',
            'Inspections Completed',
            'Findings Open',
            'Findings Closed',
            'Hours Worked',
            'Lost Workdays',
            'TF Rate',
            'TG Rate',
            'HSE Compliance %',
            'Status',
        ];
    }

    public function map($report): array
    {
        return [
            $report->project->name ?? 'N/A',
            $report->project->code ?? 'N/A',
            $report->week_number,
            $report->report_year,
            $report->start_date?->format('Y-m-d'),
            $report->end_date?->format('Y-m-d'),
            $report->submitter->name ?? 'N/A',
            $report->accidents,
            $report->accidents_fatal,
            $report->accidents_serious,
            $report->accidents_minor,
            $report->near_misses,
            $report->first_aid_cases,
            $report->trainings_conducted,
            $report->employees_trained,
            $report->training_hours,
            $report->toolbox_talks,
            $report->inspections_completed,
            $report->findings_open,
            $report->findings_closed,
            $report->hours_worked,
            $report->lost_workdays,
            $report->tf_value,
            $report->tg_value,
            $report->hse_compliance_rate,
            ucfirst($report->status),
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '1E40AF']
                ]
            ],
        ];
    }
}
