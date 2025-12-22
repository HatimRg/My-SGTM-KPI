<?php

namespace App\Exports\Sheets;

use App\Models\KpiReport;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class WeeklyTrendsSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize
{
    protected $year;

    public function __construct(int $year)
    {
        $this->year = $year;
    }

    public function array(): array
    {
        $trends = KpiReport::where('report_year', $this->year)
            ->approved()
            ->whereNotNull('week_number')
            ->selectRaw('
                week_number,
                SUM(accidents) as accidents,
                SUM(accidents_fatal) as fatal,
                SUM(accidents_serious) as serious,
                SUM(accidents_minor) as minor,
                SUM(near_misses) as near_misses,
                SUM(trainings_conducted) as trainings,
                SUM(employees_trained) as employees_trained,
                SUM(inspections_completed) as inspections,
                SUM(findings_open) as findings_open,
                SUM(findings_closed) as findings_closed,
                (SUM(hours_worked) * 10.0) as hours_worked,
                SUM(lost_workdays) as lost_workdays,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(accidents) * 1000000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as avg_tf,
                CASE WHEN SUM(hours_worked) > 0 THEN (SUM(lost_workdays) * 1000.0) / (SUM(hours_worked) * 10.0) ELSE 0 END as avg_tg,
                AVG(hse_compliance_rate) as avg_hse,
                COUNT(*) as report_count
            ')
            ->groupBy('week_number')
            ->orderBy('week_number')
            ->get();

        $data = [
            [
                'Week',
                'Reports',
                'Accidents',
                'Fatal',
                'Serious',
                'Minor',
                'Near Misses',
                'Trainings',
                'Employees Trained',
                'Inspections',
                'Findings Open',
                'Findings Closed',
                'Hours Worked',
                'Lost Days',
                'Avg TF Rate',
                'Avg TG Rate',
                'Avg HSE %',
            ]
        ];

        foreach ($trends as $trend) {
            $data[] = [
                'S' . $trend->week_number,
                $trend->report_count,
                $trend->accidents,
                $trend->fatal,
                $trend->serious,
                $trend->minor,
                $trend->near_misses,
                $trend->trainings,
                $trend->employees_trained,
                $trend->inspections,
                $trend->findings_open,
                $trend->findings_closed,
                number_format($trend->hours_worked, 0),
                $trend->lost_workdays,
                number_format($trend->avg_tf, 4),
                number_format($trend->avg_tg, 4),
                number_format($trend->avg_hse, 2) . '%',
            ];
        }

        return $data;
    }

    public function title(): string
    {
        return 'Weekly Trends';
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'DC2626']
                ]
            ],
        ];
    }
}
