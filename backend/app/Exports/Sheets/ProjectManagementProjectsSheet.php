<?php

namespace App\Exports\Sheets;

use App\Helpers\WeekHelper;
use App\Models\AwarenessSession;
use App\Models\Inspection;
use App\Models\KpiReport;
use App\Models\Machine;
use App\Models\LightingMeasurement;
use App\Models\Project;
use App\Models\RegulatoryWatchSubmission;
use App\Models\SorReport;
use App\Models\SubcontractorOpening;
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
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Conditional;
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

    private function formatMonthList(array $months): string
    {
        $months = array_values(array_unique(array_filter(array_map(function ($m) {
            $x = (int) $m;
            return ($x >= 1 && $x <= 12) ? $x : null;
        }, $months), fn ($x) => $x !== null)));
        sort($months);
        $labels = array_map(fn ($m) => str_pad((string) $m, 2, '0', STR_PAD_LEFT), $months);
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
            $this->tr("TBM/TBT ({$this->year})", "TBM/TBT ({$this->year})"),
            $this->tr('Semaines réglementation SST', 'SST regulation weeks'),
            $this->tr('Semaines réglementation Environnement', 'Environment regulation weeks'),
            $this->tr('Effectif (actifs)', 'Workforce (active workers)'),
            $this->tr('Effectif avec induction', 'Workforce with induction'),
            $this->tr("Effectif avec aptitude médicale ({$this->year})", "Workforce with medical aptitude ({$this->year})"),
            $this->tr('Nombre machines', 'Machines count'),
            $this->tr('Conformité documents machines %', 'Machine documents conformity %'),
            $this->tr('Nombre sous-traitants', 'Subcontractors count'),
            $this->tr('Conformité documents sous-traitants %', 'Subcontractors document conformity %'),
            $this->tr('Mesure mensuel bruit', 'Monthly noise measure'),
            $this->tr('Mesure mensuel eau', 'Monthly water measure'),
            $this->tr('Mesure mensuel électricité', 'Monthly electricity measure'),
            $this->tr('Mesure lux (soumissions)', 'Lux measurements (submissions)'),
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
            ->where('is_active', true)
            ->groupBy('project_id')
            ->pluck('c', 'project_id');

        // Heavy machinery document conformity % (same required docs as monthly report)
        $machines = Machine::query()
            ->whereIn('project_id', $projects->pluck('id')->all())
            ->where('is_active', true)
            ->with(['documents', 'operators'])
            ->get(['id', 'project_id', 'machine_type']);

        $vehicleMachineTypes = array_fill_keys([
            'ambulance',
            'bus',
            'camion ampiroll',
            'camion atelier (entretien)',
            'camion citerne (eau)',
            'camion citerne (gasoil)',
            'camion de servitude',
            'camion malaxeur béton',
            'camion pompe à béton',
            'camion semi-remorque',
            'camion à benne',
            'malaxeur à béton',
            'minibus',
            'pick-up',
            'remorque',
            'véhicule de service',
            'vehicule de service',
        ], true);

        $noOperatorMachineTypes = array_fill_keys([
            'ascenseur',
            'compresseur d’air',
            'compresseur d\'air',
            'concasseur',
            'concasseur mobile',
            'crible',
            'dame sauteuse',
            'fabrique de glace',
            'fraiseuse routière',
            'groupe de refroidissement',
            'groupe électrogène',
            'installation de lavage de sable',
            'plaque vibrante',
            'pompe d’injection',
            'pompe d\'injection',
            'pompe à béton projeté',
            'pompe à béton stationnaire',
            'pompe à eau',
            'poste électrique / transformateur',
            'scie à câble',
            'sondeuse',
            'tour d’éclairage',
            'trancheuse',
            'élévateur de charges (monte-charge)',
            'elevateur de charges (monte-charge)',
        ], true);
        $requiredMachineDocCount = 2;
        $machineCompletionByProject = [];
        $today = now()->startOfDay();
        foreach ($machines as $m) {
            $pid = (int) $m->project_id;

            $machineType = strtolower(trim((string) ($m->machine_type ?? '')));
            $regulatoryDocKey = isset($vehicleMachineTypes[$machineType]) ? 'visite_technique' : 'rapport_reglementaire';
            $requiredMachineDocKeys = [$regulatoryDocKey, 'assurance'];
            $skipOperator = isset($noOperatorMachineTypes[$machineType]);

            $uploadedKeys = [];
            foreach ($m->documents as $doc) {
                $key = strtolower(trim((string) ($doc->document_key ?? '')));
                if (!in_array($key, $requiredMachineDocKeys, true)) {
                    continue;
                }

                $hasFile = !empty($doc->file_path);
                $expiry = $doc->expiry_date ? Carbon::parse($doc->expiry_date)->startOfDay() : null;
                $isExpired = $expiry !== null && $expiry->lt($today);
                if ($hasFile && !$isExpired) {
                    $uploadedKeys[$key] = true;
                }
            }

            $hasOperator = ($m->operators?->count() ?? 0) > 0;
            $operatorScore = (!$skipOperator && $hasOperator) ? 1 : 0;

            $totalRequired = $requiredMachineDocCount + ($skipOperator ? 0 : 1);
            $totalComplete = count($uploadedKeys) + $operatorScore;
            $pct = $totalRequired > 0 ? round(($totalComplete * 100.0) / $totalRequired, 1) : 0.0;

            $machineCompletionByProject[$pid] = $machineCompletionByProject[$pid] ?? [];
            $machineCompletionByProject[$pid][] = $pct;
        }

        $machineDocConformityPctByProject = [];
        foreach ($projects as $p) {
            $vals = $machineCompletionByProject[(int) $p->id] ?? [];
            $machineDocConformityPctByProject[(int) $p->id] = count($vals) ? round(array_sum($vals) / count($vals), 1) : 0.0;
        }

        // Subcontractors: count openings + average document completion % (snapshot)
        $openings = SubcontractorOpening::query()
            ->whereIn('project_id', $projects->pluck('id')->all())
            ->with(['documents'])
            ->get(['id', 'project_id']);

        $requiredKeys = array_values(array_filter(array_map(
            fn ($d) => is_array($d) ? ($d['key'] ?? null) : null,
            SubcontractorOpening::REQUIRED_DOCUMENTS
        )));
        $requiredSet = array_fill_keys($requiredKeys, true);
        $requiredCount = count($requiredKeys);

        $subCountByProject = [];
        $subCompletionByProject = [];
        foreach ($openings as $o) {
            $pid = (int) $o->project_id;
            $subCountByProject[$pid] = ($subCountByProject[$pid] ?? 0) + 1;

            $docKeys = [];
            foreach ($o->documents as $d) {
                $key = trim((string) ($d->document_key ?? ''));
                if ($key === '' || empty($requiredSet[$key])) {
                    continue;
                }

                $hasFile = !empty($d->file_path);
                $expiry = $d->expiry_date ? Carbon::parse($d->expiry_date)->startOfDay() : null;
                $isExpired = $expiry !== null && $expiry->lt($today);
                if ($hasFile && !$isExpired) {
                    $docKeys[$key] = true;
                }
            }

            $uploaded = count($docKeys);
            $pct = $requiredCount > 0 ? round(($uploaded * 100.0) / $requiredCount, 1) : 0.0;
            $subCompletionByProject[$pid] = $subCompletionByProject[$pid] ?? [];
            $subCompletionByProject[$pid][] = $pct;
        }

        $subDocConformityPctByProject = [];
        foreach ($projects as $p) {
            $pid = (int) $p->id;
            $vals = $subCompletionByProject[$pid] ?? [];
            $subDocConformityPctByProject[$pid] = count($vals) ? round(array_sum($vals) / count($vals), 1) : 0.0;
        }

        // Monthly measures: output the list of months filled (01..12) per metric.
        $kpiMonthlyRows = KpiReport::query()
            ->where('report_year', $this->year)
            ->where('status', KpiReport::STATUS_APPROVED)
            ->get([
                'project_id',
                'report_month',
                'noise_monitoring',
                'water_consumption',
                'electricity_consumption',
            ]);

        $noiseMonthsByProject = [];
        $waterMonthsByProject = [];
        $electricityMonthsByProject = [];

        foreach ($kpiMonthlyRows as $r) {
            $pid = (int) ($r->project_id ?? 0);
            $month = (int) ($r->report_month ?? 0);
            if ($pid <= 0 || $month < 1 || $month > 12) {
                continue;
            }

            if ($r->noise_monitoring !== null && (float) $r->noise_monitoring > 0) {
                $noiseMonthsByProject[$pid] = $noiseMonthsByProject[$pid] ?? [];
                $noiseMonthsByProject[$pid][] = $month;
            }
            if ($r->water_consumption !== null && (float) $r->water_consumption > 0) {
                $waterMonthsByProject[$pid] = $waterMonthsByProject[$pid] ?? [];
                $waterMonthsByProject[$pid][] = $month;
            }
            if ($r->electricity_consumption !== null && (float) $r->electricity_consumption > 0) {
                $electricityMonthsByProject[$pid] = $electricityMonthsByProject[$pid] ?? [];
                $electricityMonthsByProject[$pid][] = $month;
            }
        }

        $noiseByProject = [];
        $waterByProject = [];
        $electricityByProject = [];
        foreach ($projects as $p) {
            $pid = (int) $p->id;
            $noiseByProject[$pid] = $this->formatMonthList($noiseMonthsByProject[$pid] ?? []);
            $waterByProject[$pid] = $this->formatMonthList($waterMonthsByProject[$pid] ?? []);
            $electricityByProject[$pid] = $this->formatMonthList($electricityMonthsByProject[$pid] ?? []);
        }

        $luxCounts = LightingMeasurement::query()
            ->select('project_id', DB::raw('COUNT(*) as c'))
            ->where('year', $this->year)
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
            $tbmTbtTotal = (int) ($tbmCounts[$project->id] ?? 0) + $tbt;

            $rows[] = array_merge($base, [
                $this->formatWeeks($kpiWeeks),
                (int) ($inspectionCounts[$project->id] ?? 0),
                (int) ($deviationCounts[$project->id] ?? 0),
                (int) ($trainingCounts[$project->id] ?? 0),
                $tbmTbtTotal,
                $this->formatWeeks($regWeeksSstByProject[$project->id] ?? []),
                $this->formatWeeks($regWeeksEnvByProject[$project->id] ?? []),
                (int) ($workerCounts[$project->id] ?? 0),
                (int) ($inductionCounts[$project->id] ?? 0),
                (int) ($medicalCounts[$project->id] ?? 0),
                (int) ($machineCounts[$project->id] ?? 0),
                (float) ($machineDocConformityPctByProject[(int) $project->id] ?? 0.0),
                (int) ($subCountByProject[(int) $project->id] ?? 0),
                (float) ($subDocConformityPctByProject[(int) $project->id] ?? 0.0),
                (string) ($noiseByProject[(int) $project->id] ?? ''),
                (string) ($waterByProject[(int) $project->id] ?? ''),
                (string) ($electricityByProject[(int) $project->id] ?? ''),
                (int) ($luxCounts[(int) $project->id] ?? 0),
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
        if ($this->maxHseManagers === 0 && !$this->hasExtraHseManagers) {
            $this->buildHseManagerColumns();
        }

        $lastRow = max(2, (int) $sheet->getHighestRow());
        $baseCols = 5 + ($this->maxHseManagers * 3) + ($this->hasExtraHseManagers ? 1 : 0);

        // After base columns, the appended KPI columns are:
        // 1) KPI weeks
        // 2) Inspections
        // 3) Deviations
        // 4) Trainings
        // 5) TBM/TBT
        // 6) Reg SST
        // 7) Reg Env
        // 8) Effectif
        // 9) Induction
        // 10) Medical
        // 11) Machines
        // 12) Machine doc %
        // 13) Subcontractors count
        // 14) Subcontractor doc %
        $effectifCol = Coordinate::stringFromColumnIndex($baseCols + 8);
        $inductionCol = Coordinate::stringFromColumnIndex($baseCols + 9);
        $medicalCol = Coordinate::stringFromColumnIndex($baseCols + 10);
        $machineDocCol = Coordinate::stringFromColumnIndex($baseCols + 12);
        $subDocCol = Coordinate::stringFromColumnIndex($baseCols + 14);

        $fillGreen = 'C6EFCE';
        $fillYellow = 'FFEB9C';
        $fillOrange = 'FFD966';
        $fillRed = 'FFC7CE';
        $textDark = '1F2937';

        $makeCond = function (string $formula, string $fillRgb) use ($textDark) {
            $cond = new Conditional();
            $cond->setConditionType(Conditional::CONDITION_EXPRESSION);
            $cond->setOperatorType(Conditional::OPERATOR_NONE);
            $cond->addCondition($formula);
            $cond->getStyle()->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($fillRgb);
            $cond->getStyle()->getFont()->getColor()->setRGB($textDark);
            $cond->setStopIfTrue(true);
            return $cond;
        };

        $applyConds = function (string $range, array $conds) use ($sheet) {
            $sheet->getStyle($range)->setConditionalStyles($conds);
        };

        $inductionRange = $inductionCol . '2:' . $inductionCol . $lastRow;
        $inductionConds = [
            $makeCond("IF(\${$effectifCol}2=0,0,\${$inductionCol}2/\${$effectifCol}2)>=0.9", $fillGreen),
            $makeCond("IF(\${$effectifCol}2=0,0,\${$inductionCol}2/\${$effectifCol}2)>=0.7", $fillYellow),
            $makeCond("IF(\${$effectifCol}2=0,0,\${$inductionCol}2/\${$effectifCol}2)>=0.4", $fillOrange),
            $makeCond('TRUE', $fillRed),
        ];
        $applyConds($inductionRange, $inductionConds);

        $medicalRange = $medicalCol . '2:' . $medicalCol . $lastRow;
        $medicalConds = [
            $makeCond("IF(\${$effectifCol}2=0,0,\${$medicalCol}2/\${$effectifCol}2)>=0.9", $fillGreen),
            $makeCond("IF(\${$effectifCol}2=0,0,\${$medicalCol}2/\${$effectifCol}2)>=0.7", $fillYellow),
            $makeCond("IF(\${$effectifCol}2=0,0,\${$medicalCol}2/\${$effectifCol}2)>=0.4", $fillOrange),
            $makeCond('TRUE', $fillRed),
        ];
        $applyConds($medicalRange, $medicalConds);

        $machineDocRange = $machineDocCol . '2:' . $machineDocCol . $lastRow;
        $machineDocConds = [
            $makeCond("\${$machineDocCol}2>=90", $fillGreen),
            $makeCond("\${$machineDocCol}2>=70", $fillYellow),
            $makeCond("\${$machineDocCol}2>=40", $fillOrange),
            $makeCond('TRUE', $fillRed),
        ];
        $applyConds($machineDocRange, $machineDocConds);

        $subDocRange = $subDocCol . '2:' . $subDocCol . $lastRow;
        $subDocConds = [
            $makeCond("\${$subDocCol}2>=90", $fillGreen),
            $makeCond("\${$subDocCol}2>=70", $fillYellow),
            $makeCond("\${$subDocCol}2>=40", $fillOrange),
            $makeCond('TRUE', $fillRed),
        ];
        $applyConds($subDocRange, $subDocConds);

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
