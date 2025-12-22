<?php

namespace App\Exports\Sheets;

use App\Models\KpiReport;
use App\Models\Project;
use App\Models\User;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

class SummarySheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize
{
    protected $year;

    public function __construct(int $year)
    {
        $this->year = $year;
    }

    public function array(): array
    {
        $reports = KpiReport::where('report_year', $this->year)->approved()->get();
        $projects = Project::active()->count();
        $users = User::active()->count();

        return [
            ['HSE KPI ANNUAL REPORT - ' . $this->year],
            ['Generated: ' . now()->format('Y-m-d H:i:s')],
            [''],
            ['OVERVIEW STATISTICS'],
            [''],
            ['Metric', 'Value'],
            ['Active Projects', $projects],
            ['Active Users', $users],
            ['Total Reports', $reports->count()],
            ['Total Weeks Reported', $reports->pluck('week_number')->unique()->count()],
            [''],
            ['SAFETY METRICS'],
            [''],
            ['Metric', 'Value'],
            ['Total Accidents', $reports->sum('accidents')],
            ['Fatal Accidents', $reports->sum('accidents_fatal')],
            ['Serious Accidents', $reports->sum('accidents_serious')],
            ['Minor Accidents', $reports->sum('accidents_minor')],
            ['Near Misses', $reports->sum('near_misses')],
            ['First Aid Cases', $reports->sum('first_aid_cases')],
            ['Lost Workdays', $reports->sum('lost_workdays')],
            [''],
            ['TRAINING METRICS'],
            [''],
            ['Metric', 'Value'],
            ['Trainings Conducted', $reports->sum('trainings_conducted')],
            ['Trainings Planned', $reports->sum('trainings_planned')],
            ['Employees Trained', $reports->sum('employees_trained')],
            ['Training Hours', number_format($reports->sum('training_hours'), 2)],
            ['Toolbox Talks', $reports->sum('toolbox_talks')],
            [''],
            ['INSPECTION METRICS'],
            [''],
            ['Metric', 'Value'],
            ['Inspections Completed', $reports->sum('inspections_completed')],
            ['Inspections Planned', $reports->sum('inspections_planned')],
            ['Findings Open', $reports->sum('findings_open')],
            ['Findings Closed', $reports->sum('findings_closed')],
            ['Corrective Actions', $reports->sum('corrective_actions')],
            [''],
            ['RATES & COMPLIANCE'],
            [''],
            ['Metric', 'Value'],
            ['Total Hours Worked', number_format($reports->sum('hours_worked'), 0)],
            ['Average TF Rate', number_format($reports->avg('tf_value'), 4)],
            ['Average TG Rate', number_format($reports->avg('tg_value'), 4)],
            ['Average HSE Compliance %', number_format($reports->avg('hse_compliance_rate'), 2) . '%'],
            ['Average Medical Compliance %', number_format($reports->avg('medical_compliance_rate'), 2) . '%'],
            [''],
            ['RESOURCE CONSUMPTION'],
            [''],
            ['Metric', 'Value'],
            ['Total Water Consumption (m³)', number_format($reports->sum('water_consumption'), 2)],
            ['Total Electricity (kWh)', number_format($reports->sum('electricity_consumption'), 2)],
            ['Total Work Permits', $reports->sum('work_permits')],
        ];
    }

    public function title(): string
    {
        return 'Summary';
    }

    public function styles(Worksheet $sheet)
    {
        // Title style
        $sheet->mergeCells('A1:B1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        // Section headers
        $sectionRows = [4, 12, 23, 32, 41, 50];
        foreach ($sectionRows as $row) {
            $sheet->mergeCells("A{$row}:B{$row}");
            $sheet->getStyle("A{$row}")->applyFromArray([
                'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            ]);
        }

        // Table headers
        $headerRows = [6, 14, 25, 34, 43, 52];
        foreach ($headerRows as $row) {
            $sheet->getStyle("A{$row}:B{$row}")->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E5E7EB']],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            ]);
        }

        return [];
    }
}
