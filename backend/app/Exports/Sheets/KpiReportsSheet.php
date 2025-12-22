<?php

namespace App\Exports\Sheets;

use App\Models\KpiReport;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class KpiReportsSheet implements FromCollection, WithTitle, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    protected $year;
    protected $filters;

    public function __construct(int $year, array $filters = [])
    {
        $this->year = $year;
        $this->filters = $filters;
    }

    public function collection()
    {
        $query = KpiReport::with(['project', 'submitter'])
            ->where('report_year', $this->year)
            ->approved();

        if (!empty($this->filters['project_id'])) {
            $query->where('project_id', $this->filters['project_id']);
        }

        return $query->orderBy('week_number')->orderBy('project_id')->get();
    }

    public function headings(): array
    {
        return [
            'ID',
            'Project',
            'Project Code',
            'Week',
            'Start Date',
            'End Date',
            'Submitted By',
            // Accidents
            'Accidents',
            'Fatal',
            'Serious',
            'Minor',
            'Near Misses',
            'First Aid',
            // Training
            'Trainings Done',
            'Trainings Plan',
            'Employees Trained',
            'Training Hours',
            'Toolbox Talks',
            // Inspections
            'Inspections Done',
            'Inspections Plan',
            'Findings Open',
            'Findings Closed',
            'Corrective Actions',
            // Rates
            'Hours Worked',
            'Lost Workdays',
            'TF Rate',
            'TG Rate',
            // Compliance
            'HSE Compliance %',
            'Medical Compliance %',
            // Resources
            'Water (m³)',
            'Electricity (kWh)',
            'Work Permits',
            // Meta
            'Status',
            'Approved At',
        ];
    }

    public function map($report): array
    {
        return [
            $report->id,
            $report->project->name ?? 'N/A',
            $report->project->code ?? 'N/A',
            $report->week_number,
            $report->start_date?->format('Y-m-d'),
            $report->end_date?->format('Y-m-d'),
            $report->submitter->name ?? 'N/A',
            // Accidents
            $report->accidents,
            $report->accidents_fatal,
            $report->accidents_serious,
            $report->accidents_minor,
            $report->near_misses,
            $report->first_aid_cases,
            // Training
            $report->trainings_conducted,
            $report->trainings_planned,
            $report->employees_trained,
            $report->training_hours,
            $report->toolbox_talks,
            // Inspections
            $report->inspections_completed,
            $report->inspections_planned,
            $report->findings_open,
            $report->findings_closed,
            $report->corrective_actions,
            // Rates
            $report->hours_worked,
            $report->lost_workdays,
            $report->tf_value,
            $report->tg_value,
            // Compliance
            $report->hse_compliance_rate,
            $report->medical_compliance_rate,
            // Resources
            $report->water_consumption,
            $report->electricity_consumption,
            $report->work_permits,
            // Meta
            ucfirst($report->status),
            $report->approved_at?->format('Y-m-d H:i'),
        ];
    }

    public function title(): string
    {
        return 'KPI Reports';
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '1E40AF']
                ]
            ],
        ];
    }
}
