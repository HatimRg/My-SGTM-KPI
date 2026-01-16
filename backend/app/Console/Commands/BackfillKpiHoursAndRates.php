<?php

namespace App\Console\Commands;

use App\Helpers\WeekHelper;
use App\Models\DailyKpiSnapshot;
use App\Models\KpiReport;
use Illuminate\Console\Command;

class BackfillKpiHoursAndRates extends Command
{
    protected $signature = 'kpi:backfill-hours-and-rates
        {--year= : Only backfill reports for this report_year}
        {--project= : Only backfill reports for this project_id}
        {--week= : Only backfill reports for this week_number}
        {--status=approved : Filter by report status (default: approved)}
        {--dry-run : Do not write changes}
        {--set-zero-when-missing : If no daily snapshots found for a report, set hours_worked to 0 anyway (default: skip)}';

    protected $description = 'Backfill kpi_reports.hours_worked from DailyKpiSnapshot.heures_travaillees and recompute TF/TG.';

    public function handle(): int
    {
        $year = $this->option('year');
        $projectId = $this->option('project');
        $week = $this->option('week');
        $status = (string) ($this->option('status') ?: 'approved');
        $dryRun = (bool) $this->option('dry-run');
        $setZeroWhenMissing = (bool) $this->option('set-zero-when-missing');

        $query = KpiReport::query();

        if ($status !== '') {
            $query->where('status', $status);
        }
        if ($year !== null && $year !== '') {
            $query->where('report_year', (int) $year);
        }
        if ($projectId !== null && $projectId !== '') {
            $query->where('project_id', (int) $projectId);
        }
        if ($week !== null && $week !== '') {
            $query->where('week_number', (int) $week);
        }

        $seen = 0;
        $updated = 0;
        $skippedNoWeek = 0;
        $skippedMissingSnapshots = 0;

        $query->orderBy('id')->chunkById(200, function ($reports) use (&$seen, &$updated, &$skippedNoWeek, &$skippedMissingSnapshots, $dryRun, $setZeroWhenMissing) {
            foreach ($reports as $report) {
                $seen++;

                $weekNumber = $report->week_number;
                if ($weekNumber === null) {
                    $skippedNoWeek++;
                    continue;
                }

                $startDate = $report->start_date;
                $endDate = $report->end_date;

                if (!$startDate || !$endDate) {
                    $dates = WeekHelper::getWeekDates((int) $weekNumber, (int) $report->report_year);
                    $startDate = $dates['start']->format('Y-m-d');
                    $endDate = $dates['end']->format('Y-m-d');
                }

                $hours = (float) DailyKpiSnapshot::query()
                    ->where('project_id', $report->project_id)
                    ->whereBetween('entry_date', [$startDate, $endDate])
                    ->sum('heures_travaillees');

                if ($hours <= 0 && !$setZeroWhenMissing) {
                    $hasAny = DailyKpiSnapshot::query()
                        ->where('project_id', $report->project_id)
                        ->whereBetween('entry_date', [$startDate, $endDate])
                        ->exists();

                    if (!$hasAny) {
                        $skippedMissingSnapshots++;
                        continue;
                    }
                }

                $report->hours_worked = $hours;
                $report->tf_value = $report->calculateTf();
                $report->tg_value = $report->calculateTg();

                if (!$dryRun) {
                    $report->save();
                }

                $updated++;
            }
        });

        $this->info('Backfill complete');
        $this->line('Seen: ' . $seen);
        $this->line('Updated: ' . $updated . ($dryRun ? ' (dry-run)' : ''));
        $this->line('Skipped (no week_number): ' . $skippedNoWeek);
        $this->line('Skipped (no daily snapshots): ' . $skippedMissingSnapshots);

        return Command::SUCCESS;
    }
}
