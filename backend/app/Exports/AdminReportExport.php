<?php

namespace App\Exports;

use App\Models\KpiReport;
use App\Models\Project;
use App\Models\User;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class AdminReportExport implements WithMultipleSheets
{
    protected $year;
    protected $filters;

    public function __construct(int $year, array $filters = [])
    {
        $this->year = $year;
        $this->filters = $filters;
    }

    public function sheets(): array
    {
        return [
            'Summary' => new Sheets\SummarySheet($this->year),
            'KPI Reports' => new Sheets\KpiReportsSheet($this->year, $this->filters),
            'Projects' => new Sheets\ProjectsSheet(),
            'Users' => new Sheets\UsersSheet(),
            'Weekly Trends' => new Sheets\WeeklyTrendsSheet($this->year),
        ];
    }
}
