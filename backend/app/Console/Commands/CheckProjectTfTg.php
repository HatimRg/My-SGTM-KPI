<?php

namespace App\Console\Commands;

use App\Models\KpiReport;
use App\Models\Project;
use Illuminate\Console\Command;

class CheckProjectTfTg extends Command
{
    protected $signature = 'kpi:check-project-tf-tg
        {code : Project code (e.g. P001014)}
        {--year= : Report year (default: current year)}
        {--status=approved : Filter by report status (default: approved)}';

    protected $description = 'Validate TF/TG for a project by recomputing from database totals (accidents, lost_workdays, hours_worked).';

    public function handle(): int
    {
        $code = (string) $this->argument('code');
        $year = (int) ($this->option('year') ?: now()->year);
        $status = (string) ($this->option('status') ?: 'approved');

        $project = Project::query()->where('code', $code)->first();
        if (!$project) {
            $this->error('Project not found: ' . $code);
            return Command::FAILURE;
        }

        $reports = KpiReport::query()
            ->where('project_id', $project->id)
            ->where('report_year', $year)
            ->when($status !== '', fn ($q) => $q->where('status', $status))
            ->orderBy('week_number')
            ->get([
                'id',
                'week_number',
                'start_date',
                'end_date',
                'accidents',
                'lost_workdays',
                'hours_worked',
                'tf_value',
                'tg_value',
            ]);

        $accidents = (int) $reports->sum('accidents');
        $lostWorkdays = (int) $reports->sum('lost_workdays');
        $hours = (float) $reports->sum('hours_worked');

        $tfWeighted = $hours > 0 ? ($accidents * 1000000.0) / $hours : 0.0;
        $tgWeighted = $hours > 0 ? ($lostWorkdays * 1000.0) / $hours : 0.0;

        $avgTf = (float) $reports->avg('tf_value');
        $avgTg = (float) $reports->avg('tg_value');

        $this->line('Project: ' . $project->code . ' - ' . $project->name . ' (id=' . $project->id . ')');
        $this->line('Year: ' . $year . ' | Status: ' . ($status !== '' ? $status : '(any)'));
        $this->line('Reports: ' . $reports->count());
        $this->newLine();

        $this->line('Totals (from kpi_reports):');
        $this->line('  accidents=' . $accidents);
        $this->line('  lost_workdays=' . $lostWorkdays);
        $this->line('  hours_worked=' . round($hours, 2));
        $this->newLine();

        $this->line('Recomputed (weighted by total hours):');
        $this->line('  TF=' . round($tfWeighted, 2));
        $this->line('  TG=' . round($tgWeighted, 2));
        $this->newLine();

        $this->line('Averages of stored per-report values:');
        $this->line('  AVG(tf_value)=' . round($avgTf, 2));
        $this->line('  AVG(tg_value)=' . round($avgTg, 2));
        $this->newLine();

        if ($reports->isEmpty()) {
            $this->warn('No KPI reports found for this project/year/status.');
            return Command::SUCCESS;
        }

        $this->line('Per report:');
        foreach ($reports as $r) {
            $this->line(
                '  week=' . ($r->week_number ?? '-') .
                ' id=' . $r->id .
                ' hours=' . (float) $r->hours_worked .
                ' acc=' . (int) $r->accidents .
                ' lost=' . (int) $r->lost_workdays .
                ' tf=' . round((float) $r->tf_value, 2) .
                ' tg=' . round((float) $r->tg_value, 2)
            );
        }

        return Command::SUCCESS;
    }
}
