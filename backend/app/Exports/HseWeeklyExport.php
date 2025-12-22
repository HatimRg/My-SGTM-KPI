<?php

namespace App\Exports;

use App\Models\Project;
use App\Models\KpiReport;
use App\Models\DailyKpiSnapshot;
use App\Models\SorReport;
use App\Models\Worker;
use App\Models\WorkerTraining;
use App\Models\AwarenessSession;
use App\Models\Training;
use App\Models\Inspection;
use App\Models\WorkPermit;
use App\Helpers\WeekHelper;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\Exportable;

class HseWeeklyExport implements WithMultipleSheets
{
    use Exportable;

    protected Project $project;
    protected int $week;
    protected int $year;
    protected Carbon $weekStart;
    protected Carbon $weekEnd;
    protected Carbon $permitWeekStart;
    protected Carbon $permitWeekEnd;
    protected int $actualWeekNumber; // The real week number for Saturday-Friday week

    public function __construct(Project $project, int $week, int $year)
    {
        $this->project = $project;
        $this->week = $week;
        $this->year = $year;
        
        // Use WeekHelper to get correct Saturday-Friday dates
        $hseWeekDates = WeekHelper::getWeekDates($week, $year);
        $this->weekStart = $hseWeekDates['start']; // Saturday
        $this->weekEnd = $hseWeekDates['end']; // Friday
        
        // Work permits remain Monday–Sunday (use ISO week dates)
        $this->permitWeekStart = Carbon::now()->setISODate($year, $week, 1); // Monday
        $this->permitWeekEnd = Carbon::now()->setISODate($year, $week, 7);   // Sunday
        
        // The week number for display is the one passed in (already correct from WeekHelper)
        $this->actualWeekNumber = $week;
    }

    public function sheets(): array
    {
        return [
            new Sheets\HseWeekly\InfoProjetSheet($this->project, $this->actualWeekNumber, $this->year, $this->weekStart, $this->weekEnd),
            new Sheets\HseWeekly\ReportingHseSheet($this->project, $this->week, $this->year, $this->weekStart, $this->weekEnd),
            new Sheets\HseWeekly\IncidentsAccidentsSheet($this->project, $this->week, $this->year, $this->weekStart, $this->weekEnd),
            new Sheets\HseWeekly\EcartsSgtmSheet($this->project, $this->week, $this->year, $this->weekStart, $this->weekEnd),
            new Sheets\HseWeekly\EcartsStSheet($this->project, $this->week, $this->year, $this->weekStart, $this->weekEnd),
            new Sheets\HseWeekly\CategoriesEcartsSheet(),
            new Sheets\HseWeekly\HabilitationsSheet($this->project),
            new Sheets\HseWeekly\SuiviCollaSheet($this->project),
            new Sheets\HseWeekly\SensibilisationFormationSheet($this->project, $this->week, $this->year, $this->weekStart, $this->weekEnd),
            new Sheets\HseWeekly\InspectionsSheet($this->project, $this->week, $this->year, $this->weekStart, $this->weekEnd),
            new Sheets\HseWeekly\PermisTravailSheet($this->project, $this->week, $this->year, $this->permitWeekStart, $this->permitWeekEnd),
        ];
    }
}
