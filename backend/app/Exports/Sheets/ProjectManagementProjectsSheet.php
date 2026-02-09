<?php

namespace App\Exports\Sheets;

use App\Helpers\WeekHelper;
use App\Models\AwarenessSession;
use App\Models\Inspection;
use App\Models\KpiReport;
use App\Models\Machine;
use App\Models\Project;
use App\Models\RegulatoryWatchSubmission;
use App\Models\SorReport;
use App\Models\Training;
use App\Models\Worker;
use App\Models\WorkerMedicalAptitude;
use App\Models\WorkerPpeIssue;
use App\Models\WorkerTraining;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ProjectManagementProjectsSheet implements FromArray, WithHeadings, WithTitle, WithStyles, ShouldAutoSize
{
    protected int $year;
    protected string $lang;
    protected ?string $pole;
    protected int $maxHseManagers;
    protected bool $hasExtraHseManagers;

    public function __construct(int $year, string $lang = 'fr', ?string $pole = null)
    {
        $this->year = $year;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
        $pole = is_string($pole) ? trim($pole) : null;
        $this->pole = ($pole !== null && $pole !== '') ? $pole : null;
        $this->maxHseManagers = 0;
        $this->hasExtraHseManagers = false;
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    private function projectStatusLabel(?string $status): string
    {
        $status = strtolower(trim((string) $status));

        // The API stores project status as: active/completed/on_hold/cancelled
        // The user requested export labels: active/finished/en pause/cancelled
        if ($status === Project::STATUS_ACTIVE) {
            return 'active';
        }
        if ($status === Project::STATUS_COMPLETED) {
            return 'finished';
        }
        if ($status === Project::STATUS_ON_HOLD) {
            return $this->lang === 'en' ? 'on hold' : 'en pause';
        }
        if ($status === Project::STATUS_CANCELLED) {
            return 'cancelled';
        }

        return $status;
    }

    private function weekLabel(int $week): string
    {
        return 'S' . str_pad((string) $week, 2, '0', STR_PAD_LEFT);
    }

    private function formatWeeks(array $weeks): string
    {
        $weeks = array_values(array_unique(array_filter($weeks, fn ($w) => $w !== null && $w !== '')));
        $weeks = array_map(function ($w) {
            if (is_string($w) && preg_match('/(\d{1,2})/', $w, $m)) {
                return (int) $m[1];
            }
            return (int) $w;
        }, $weeks);
        sort($weeks);
        $labels = array_map(fn ($w) => $this->weekLabel($w), $weeks);
        return implode(', ', $labels);
    }

    private function normalizeKpiWeekNumber(KpiReport $report): ?int
    {
        $week = (int) ($report->week_number ?? 0);
        if ($week >= 1 && $week <= 52) {
            return $week;
        }

        $date = $report->start_date ?: $report->report_date;
        if (!$date) {
            return null;
        }

        $info = WeekHelper::getWeekFromDate(Carbon::parse($date));
        if ((int) ($info['year'] ?? 0) !== $this->year) {
            return null;
        }

        $w = (int) ($info['week'] ?? 0);
        return ($w >= 1 && $w <= 52) ? $w : null;
    }

    private function buildHseManagerColumns(): void
    {
        $projectsQuery = Project::query()->with('hseManagers');
        if ($this->pole !== null) {
            $projectsQuery->where('pole', $this->pole);
        }

        $projects = $projectsQuery->get();
        $max = 0;
        foreach ($projects as $project) {
            $count = $project->hseManagers?->count() ?? 0;
            if ($count > $max) {
                $max = $count;
            }
        }

        $cap = 10;
        $this->maxHseManagers = max(1, min($max, $cap));
        $this->hasExtraHseManagers = $max > $cap;
    }

    public function headings(): array
    {
        if ($this->maxHseManagers === 0 && !$this->hasExtraHseManagers) {
            $this->buildHseManagerColumns();
        }

        $headings = [
            $this->tr('Projet', 'Project'),
            $this->tr('Status', 'Status'),
            $this->tr('Code projet', 'Project Code'),
            $this->tr('Date début', 'Start Date'),
            $this->tr('Pôle', 'Pole'),
        ];

        for ($i = 1; $i <= $this->maxHseManagers; $i++) {
            $headings[] = $this->tr("Responsable {$i} Nom", "Responsable {$i} Name");
            $headings[] = $this->tr("Responsable {$i} Rôle", "Responsable {$i} Role");
            $headings[] = $this->tr("Responsable {$i} Email", "Responsable {$i} Email");
        }

        if ($this->hasExtraHseManagers) {
            $headings[] = $this->tr('Autres responsables', 'Other responsables');
        }

        return array_merge($headings, [
            $this->tr('Semaines rapports KPI', 'KPI report weeks'),
            $this->tr("Nb inspections ({$this->year})", "Inspections ({$this->year})"),
            $this->tr("Nb écarts / SOR ({$this->year})", "Deviations / SOR ({$this->year})"),
            $this->tr("Nb formations ({$this->year})", "Trainings ({$this->year})"),
            $this->tr("TBM ({$this->year})", "TBM ({$this->year})"),
            $this->tr("TBT ({$this->year})", "TBT ({$this->year})"),
            $this->tr('Semaines réglementation SST', 'SST regulation weeks'),
            $this->tr('Semaines réglementation Environnement', 'Environment regulation weeks'),
            $this->tr('Effectif (actifs)', 'Workforce (active workers)'),
            $this->tr('Effectif avec induction', 'Workforce with induction'),
            $this->tr("Effectif avec aptitude médicale ({$this->year})", "Workforce with medical aptitude ({$this->year})"),
            $this->tr('Nombre machines', 'Machines count'),
            $this->tr('EPI distribués (total)', 'PPE distributed (total)'),
        ]);
    }

    public function array(): array
    {
        if ($this->maxHseManagers === 0 && !$this->hasExtraHseManagers) {
            $this->buildHseManagerColumns();
        }

        $projectsQuery = Project::query()
            ->with(['hseManagers'])
            ->orderBy('name');
        if ($this->pole !== null) {
            $projectsQuery->where('pole', $this->pole);
        }

        $projects = $projectsQuery->get();

        $kpiRows = KpiReport::query()
            ->select(['project_id', 'week_number', 'toolbox_talks', 'status', 'start_date', 'report_date', 'report_year'])
            ->where('report_year', $this->year)
            ->where('status', '!=', KpiReport::STATUS_DRAFT)
            ->get();

        $kpiGrouped = $kpiRows->groupBy('project_id');

        $inspectionCounts = Inspection::query()
            ->select('project_id', DB::raw('COUNT(*) as c'))
            ->where('week_year', $this->year)
            ->groupBy('project_id')
            ->pluck('c', 'project_id');

        $deviationCounts = SorReport::query()
            ->select('project_id', DB::raw('COUNT(*) as c'))
            ->whereYear('observation_date', $this->year)
            ->groupBy('project_id')
            ->pluck('c', 'project_id');

        $trainingCounts = Training::query()
            ->select('project_id', DB::raw('COUNT(*) as c'))
            ->where('week_year', $this->year)
            ->groupBy('project_id')
            ->pluck('c', 'project_id');

        $tbmCounts = AwarenessSession::query()
            ->select('project_id', DB::raw('COUNT(*) as c'))
            ->where('week_year', $this->year)
            ->groupBy('project_id')
            ->pluck('c', 'project_id');

        $hasCategory = Schema::hasColumn('regulatory_watch_submissions', 'category');
        $regSelect = ['project_id', 'week_number'];
        if ($hasCategory) {
            $regSelect[] = 'category';
        }

        $regRows = RegulatoryWatchSubmission::query()
            ->select($regSelect)
            ->where('week_year', $this->year)
            ->get();

        $regWeeksSstByProject = [];
        $regWeeksEnvByProject = [];

        foreach ($regRows as $r) {
            $pid = (int) ($r->project_id ?? 0);
            if ($pid <= 0) {
                continue;
            }

            $wk = $r->week_number ?? null;
            if ($wk === null || $wk === '') {
                continue;
            }

            $category = $hasCategory ? strtolower(trim((string) ($r->category ?? ''))) : '';
            if ($category === '' || $category === 'sst') {
                $regWeeksSstByProject[$pid][] = $wk;
                continue;
            }

            // accept legacy french value just in case
            if ($category === 'environnement') {
                $category = 'environment';
            }

            if ($category === 'environment') {
                $regWeeksEnvByProject[$pid][] = $wk;
            } else {
                // unknown category -> default to SST
                $regWeeksSstByProject[$pid][] = $wk;
            }
        }

        $workerCounts = Worker::query()
            ->select('project_id', DB::raw('COUNT(*) as c'))
            ->where('is_active', true)
            ->groupBy('project_id')
            ->pluck('c', 'project_id');

        $inductionCounts = WorkerTraining::query()
            ->join('workers', 'workers.id', '=', 'worker_trainings.worker_id')
            ->select('workers.project_id', DB::raw('COUNT(DISTINCT worker_trainings.worker_id) as c'))
            ->where('workers.is_active', true)
            ->where(function ($q) {
                // Generalized induction detection:
                // - covers mass imports which use training_type = induction_hse
                // - covers legacy/free-text variants
                $q->where('worker_trainings.training_type', 'induction_hse')
                    ->orWhereRaw('LOWER(worker_trainings.training_type) REGEXP ?', ['induction[^a-z0-9]*hse'])
                    ->orWhereRaw('LOWER(worker_trainings.training_type) LIKE ?', ['%induction%'])
                    ->orWhereRaw('LOWER(worker_trainings.training_label) LIKE ?', ['%induction%']);
            })
            ->groupBy('workers.project_id')
            ->pluck('c', 'workers.project_id');

        $medicalCounts = WorkerMedicalAptitude::query()
            ->join('workers', 'workers.id', '=', 'worker_medical_aptitudes.worker_id')
            ->select('workers.project_id', DB::raw('COUNT(DISTINCT worker_medical_aptitudes.worker_id) as c'))
            ->where('workers.is_active', true)
            ->groupBy('workers.project_id')
            ->pluck('c', 'workers.project_id');

        $machineCounts = Machine::query()
            ->select('project_id', DB::raw('COUNT(*) as c'))
            ->groupBy('project_id')
            ->pluck('c', 'project_id');

        $ppeTotals = WorkerPpeIssue::query()
            ->select('project_id', DB::raw('COALESCE(SUM(quantity), 0) as s'))
            ->groupBy('project_id')
            ->pluck('s', 'project_id');

        $rows = [];

        foreach ($projects as $project) {
            $hseManagers = $project->hseManagers ?? collect();
            $hmArray = $hseManagers->values()->all();

            $base = [
                $project->name,
                $this->projectStatusLabel($project->status),
                $project->code,
                $project->start_date?->format('Y-m-d'),
                $project->pole,
            ];

            for ($i = 0; $i < $this->maxHseManagers; $i++) {
                $u = $hmArray[$i] ?? null;
                $base[] = $u?->name;
                $base[] = $u?->role;
                $base[] = $u?->email;
            }

            if ($this->hasExtraHseManagers) {
                $extra = array_slice($hmArray, $this->maxHseManagers);
                $base[] = collect($extra)
                    ->map(fn ($u) => trim(($u->name ?? '') . ' (' . ($u->role ?? '') . ') ' . ($u->email ?? '')))
                    ->filter(fn ($s) => $s !== '')
                    ->implode(' | ');
            }

            $kpisForProject = $kpiGrouped->get($project->id, collect());
            $kpiWeeks = $kpisForProject
                ->map(fn (KpiReport $r) => $this->normalizeKpiWeekNumber($r))
                ->filter(fn ($w) => $w !== null)
                ->all();
            $tbt = (int) $kpisForProject->sum('toolbox_talks');

            $rows[] = array_merge($base, [
                $this->formatWeeks($kpiWeeks),
                (int) ($inspectionCounts[$project->id] ?? 0),
                (int) ($deviationCounts[$project->id] ?? 0),
                (int) ($trainingCounts[$project->id] ?? 0),
                (int) ($tbmCounts[$project->id] ?? 0),
                $tbt,
                $this->formatWeeks($regWeeksSstByProject[$project->id] ?? []),
                $this->formatWeeks($regWeeksEnvByProject[$project->id] ?? []),
                (int) ($workerCounts[$project->id] ?? 0),
                (int) ($inductionCounts[$project->id] ?? 0),
                (int) ($medicalCounts[$project->id] ?? 0),
                (int) ($machineCounts[$project->id] ?? 0),
                (int) ($ppeTotals[$project->id] ?? 0),
            ]);
        }

        return $rows;
    }

    public function title(): string
    {
        return $this->tr('Projets', 'Projects');
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '1F2937'],
                ],
            ],
        ];
    }
}
