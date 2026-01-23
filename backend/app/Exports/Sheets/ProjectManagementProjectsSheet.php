<?php

namespace App\Exports\Sheets;

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
use Illuminate\Support\Facades\DB;
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
    protected int $maxResponsables;
    protected bool $hasExtraResponsables;

    public function __construct(int $year, string $lang = 'fr')
    {
        $this->year = $year;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
        $this->maxResponsables = 0;
        $this->hasExtraResponsables = false;
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    private function weekLabel(int $week): string
    {
        return 'S' . str_pad((string) $week, 2, '0', STR_PAD_LEFT);
    }

    private function formatWeeks(array $weeks): string
    {
        $weeks = array_values(array_unique(array_filter($weeks, fn ($w) => $w !== null && $w !== '')));
        $weeks = array_map(fn ($w) => (int) $w, $weeks);
        sort($weeks);
        $labels = array_map(fn ($w) => $this->weekLabel($w), $weeks);
        return implode(', ', $labels);
    }

    private function buildResponsableColumns(): void
    {
        $projects = Project::query()->with('responsables')->get();
        $max = 0;
        foreach ($projects as $project) {
            $count = $project->responsables?->count() ?? 0;
            if ($count > $max) {
                $max = $count;
            }
        }

        $cap = 10;
        $this->maxResponsables = min($max, $cap);
        $this->hasExtraResponsables = $max > $cap;
    }

    public function headings(): array
    {
        if ($this->maxResponsables === 0 && !$this->hasExtraResponsables) {
            $this->buildResponsableColumns();
        }

        $headings = [
            $this->tr('Projet', 'Project'),
            $this->tr('Code projet', 'Project Code'),
            $this->tr('Date début', 'Start Date'),
            $this->tr('Pôle', 'Pole'),
        ];

        for ($i = 1; $i <= $this->maxResponsables; $i++) {
            $headings[] = $this->tr("Responsable {$i} Nom", "Responsable {$i} Name");
            $headings[] = $this->tr("Responsable {$i} Rôle", "Responsable {$i} Role");
            $headings[] = $this->tr("Responsable {$i} Email", "Responsable {$i} Email");
        }

        if ($this->hasExtraResponsables) {
            $headings[] = $this->tr('Autres responsables', 'Other responsables');
        }

        return array_merge($headings, [
            $this->tr('Semaines rapports KPI', 'KPI report weeks'),
            $this->tr("Nb inspections ({$this->year})", "Inspections ({$this->year})"),
            $this->tr("Nb écarts / SOR ({$this->year})", "Deviations / SOR ({$this->year})"),
            $this->tr("Nb formations ({$this->year})", "Trainings ({$this->year})"),
            $this->tr("TBM ({$this->year})", "TBM ({$this->year})"),
            $this->tr("TBT ({$this->year})", "TBT ({$this->year})"),
            $this->tr('Semaines veille réglementaire', 'Regulatory watch weeks'),
            $this->tr('Effectif (actifs)', 'Workforce (active workers)'),
            $this->tr("Effectif avec induction ({$this->year})", "Workforce with induction ({$this->year})"),
            $this->tr("Effectif avec aptitude médicale ({$this->year})", "Workforce with medical aptitude ({$this->year})"),
            $this->tr('Nombre machines', 'Machines count'),
            $this->tr('EPI distribués (total)', 'PPE distributed (total)'),
        ]);
    }

    public function array(): array
    {
        if ($this->maxResponsables === 0 && !$this->hasExtraResponsables) {
            $this->buildResponsableColumns();
        }

        $projects = Project::query()
            ->with(['responsables'])
            ->orderBy('name')
            ->get();

        $kpiRows = KpiReport::query()
            ->select(['project_id', 'week_number', 'toolbox_talks', 'status'])
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

        $regRows = RegulatoryWatchSubmission::query()
            ->select(['project_id', 'week_number'])
            ->where('week_year', $this->year)
            ->get();

        $regWeeksByProject = $regRows
            ->groupBy('project_id')
            ->map(fn ($rows) => $rows->pluck('week_number')->filter()->all());

        $workerCounts = Worker::query()
            ->select('project_id', DB::raw('COUNT(*) as c'))
            ->where('is_active', true)
            ->groupBy('project_id')
            ->pluck('c', 'project_id');

        $inductionCounts = WorkerTraining::query()
            ->join('workers', 'workers.id', '=', 'worker_trainings.worker_id')
            ->select('workers.project_id', DB::raw('COUNT(DISTINCT worker_trainings.worker_id) as c'))
            ->where('workers.is_active', true)
            ->whereYear('worker_trainings.training_date', $this->year)
            ->where(function ($q) {
                $q->whereRaw('LOWER(worker_trainings.training_type) LIKE ?', ['%induction%'])
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
            $responsables = $project->responsables ?? collect();
            $respArray = $responsables->values()->all();

            $base = [
                $project->name,
                $project->code,
                $project->start_date?->format('Y-m-d'),
                $project->pole,
            ];

            for ($i = 0; $i < $this->maxResponsables; $i++) {
                $u = $respArray[$i] ?? null;
                $base[] = $u?->name;
                $base[] = $u?->role;
                $base[] = $u?->email;
            }

            if ($this->hasExtraResponsables) {
                $extra = array_slice($respArray, $this->maxResponsables);
                $base[] = collect($extra)
                    ->map(fn ($u) => trim(($u->name ?? '') . ' (' . ($u->role ?? '') . ') ' . ($u->email ?? '')))
                    ->filter(fn ($s) => $s !== '')
                    ->implode(' | ');
            }

            $kpisForProject = $kpiGrouped->get($project->id, collect());
            $kpiWeeks = $kpisForProject->pluck('week_number')->filter()->all();
            $tbt = (int) $kpisForProject->sum('toolbox_talks');

            $rows[] = array_merge($base, [
                $this->formatWeeks($kpiWeeks),
                (int) ($inspectionCounts[$project->id] ?? 0),
                (int) ($deviationCounts[$project->id] ?? 0),
                (int) ($trainingCounts[$project->id] ?? 0),
                (int) ($tbmCounts[$project->id] ?? 0),
                $tbt,
                $this->formatWeeks($regWeeksByProject->get($project->id, [])),
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
