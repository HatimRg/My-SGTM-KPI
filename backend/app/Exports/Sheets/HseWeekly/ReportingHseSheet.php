<?php

namespace App\Exports\Sheets\HseWeekly;

use App\Models\Project;
use App\Models\DailyKpiSnapshot;
use App\Models\KpiReport;
use App\Models\WorkPermit;
use App\Models\Inspection;
use App\Models\Training;
use App\Models\AwarenessSession;
use App\Models\SorReport;
use App\Models\Worker;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithDrawings;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

class ReportingHseSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize, WithDrawings
{
    protected Project $project;
    protected int $week;
    protected int $year;
    protected Carbon $weekStart;
    protected Carbon $weekEnd;

    public function __construct(Project $project, int $week, int $year, Carbon $weekStart, Carbon $weekEnd)
    {
        $this->project = $project;
        $this->week = $week;
        $this->year = $year;
        $this->weekStart = $weekStart;
        $this->weekEnd = $weekEnd;
    }

    public function array(): array
    {
        // Get daily snapshots for the week (7 days)
        $dailySnapshots = DailyKpiSnapshot::where('project_id', $this->project->id)
            ->whereBetween('entry_date', [$this->weekStart->format('Y-m-d'), $this->weekEnd->format('Y-m-d')])
            ->orderBy('entry_date')
            ->get()
            ->keyBy(function($item) {
                return Carbon::parse($item->entry_date)->format('Y-m-d');
            });

        // Get KPI Report for this week (if exists)
        $weeklyKpiReport = KpiReport::where('project_id', $this->project->id)
            ->where('week_number', $this->week)
            ->where('report_year', $this->year)
            ->first();

        // Get data from other pages for this week
        $weeklyWorkPermits = WorkPermit::where('project_id', $this->project->id)
            ->where('week_number', $this->week)
            ->where('year', $this->year)
            ->count();

        $weeklyInspections = Inspection::where('project_id', $this->project->id)
            ->whereBetween('inspection_date', [$this->weekStart->format('Y-m-d'), $this->weekEnd->format('Y-m-d')])
            ->count();

        $weeklyTrainings = Training::where('project_id', $this->project->id)
            ->where('week_number', $this->week)
            ->where('week_year', $this->year)
            ->get();
        $weeklyTrainingHours = $weeklyTrainings->sum('training_hours');
        $weeklyTrainedEmployees = $weeklyTrainings->sum('participants');

        $weeklyAwareness = AwarenessSession::where('project_id', $this->project->id)
            ->where('week_number', $this->week)
            ->where('week_year', $this->year)
            ->get();
        $weeklyAwarenessCount = $weeklyAwareness->count();
        $weeklyAwarenessHours = $weeklyAwareness->sum('session_hours');

        $weeklySorReports = SorReport::where('project_id', $this->project->id)
            ->whereBetween('observation_date', [$this->weekStart->format('Y-m-d'), $this->weekEnd->format('Y-m-d')])
            ->get();
        $weeklyDeviations = $weeklySorReports->count();
        $weeklyNearMisses = $weeklySorReports->where('category', 'near_miss')->count();
        $weeklyFirstAid = $weeklySorReports->where('category', 'first_aid')->count();
        $weeklyAccidents = $weeklySorReports->whereIn('category', ['accident', 'incident'])->count();

        // Get workforce count from Workers table
        $activeWorkers = Worker::where('project_id', $this->project->id)
            ->where('is_active', true)
            ->count();

        // Get cumulative data from KpiReport for most fields
        $cumulativeData = KpiReport::where('project_id', $this->project->id)
            ->where(function($q) {
                $q->where('report_year', '<', $this->year)
                    ->orWhere(function($q2) {
                        $q2->where('report_year', $this->year)
                            ->where('week_number', '<', $this->week); // Changed from <= to <
                    });
            })
            ->selectRaw('
                SUM(COALESCE(employees_trained, 0)) as total_trained,
                SUM(COALESCE(trainings_conducted, 0)) as total_inductions,
                SUM(COALESCE(findings_open, 0)) as total_deviations,
                SUM(COALESCE(toolbox_talks, 0)) as total_sensibilisation,
                SUM(COALESCE(near_misses, 0)) as total_near_misses,
                SUM(COALESCE(first_aid_cases, 0)) as total_first_aid,
                SUM(COALESCE(accidents, 0)) as total_accidents,
                SUM(COALESCE(lost_workdays, 0)) as total_lwd,
                SUM(COALESCE(inspections_completed, 0)) as total_inspections,
                SUM(COALESCE(work_permits, 0)) as total_permits
            ')
            ->first();

        // Get cumulative data from DailyKpiSnapshot for specific fields
        $projectStart = $this->project->start_date ?? Carbon::now()->subYear();
        // Get cumulative UP TO current week (excluding current week)
        $cumulativeSnapshots = DailyKpiSnapshot::where('project_id', $this->project->id)
            ->whereBetween('entry_date', [$projectStart, $this->weekStart->copy()->subDay()->format('Y-m-d')])
            ->get();

        // Calculate cumulative totals from snapshots for fields not in KpiReport
        $cumulativeFromSnapshots = [
            'total_training_hours' => $cumulativeSnapshots->sum('training_hours') + $cumulativeSnapshots->sum('session_hours'),
            'total_water' => $cumulativeSnapshots->sum('consommation_eau'),
            'total_electricity' => $cumulativeSnapshots->sum('consommation_electricite'),
            'total_hours' => $cumulativeSnapshots->sum('heures_travaillees'),
            'total_induction' => $cumulativeSnapshots->sum('induction'), // Add induction from snapshots
        ];

        // Calculate cumulative averages for compliance rates and noise
        $allCumulativeSnapshots = DailyKpiSnapshot::where('project_id', $this->project->id)
            ->whereBetween('entry_date', [$projectStart, $this->weekEnd->format('Y-m-d')])
            ->get();

        $cumulativeAverages = [
            'avg_hse' => $allCumulativeSnapshots->where('conformite_hse', '>', 0)->avg('conformite_hse') ?? 0,
            'avg_medical' => $allCumulativeSnapshots->where('conformite_medicale', '>', 0)->avg('conformite_medicale') ?? 0,
            'avg_noise' => $allCumulativeSnapshots->where('suivi_bruit', '>', 0)->avg('suivi_bruit') ?? 0,
        ];

        // Build day headers (Sat-Fri)
        $dayNames = ['Sam', 'Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
        $days = [];
        for ($i = 0; $i < 7; $i++) {
            $date = $this->weekStart->copy()->addDays($i);
            $days[] = [
                'date' => $date,
                'key' => $date->format('Y-m-d'),
                'label' => $dayNames[$i] . ' ' . $date->format('d/m'),
            ];
        }

        // Build header row
        $headerRow = ['Indicateur'];
        foreach ($days as $day) {
            $headerRow[] = $day['label'];
        }
        $headerRow[] = 'Total Semaine';
        $headerRow[] = 'Cumul Projet';

        $rows = [
            [''], // Logo row
            [''],
            [''],
            ['REPORTING HSE'],
            ['Projet: ' . $this->project->name, '', "Semaine {$this->week}: {$this->weekStart->format('d/m')} → {$this->weekEnd->format('d/m')}", '', 'Année: ' . $this->year, '', 'Généré le: ' . now()->format('d/m/Y H:i')],
            [''],
            $headerRow,
        ];

        // Helper function to get daily value with fallback
        $getDailyValue = function($day, $field) use ($dailySnapshots) {
            $snapshot = $dailySnapshots->get($day['key']);
            $value = $snapshot ? ($snapshot->{$field} ?? 0) : 0;
            // Force 0 to be displayed as string "0" to avoid empty cells in Excel
            return $value === 0 ? '0' : $value;
        };

        // Helper function to force display of 0 in totals
        $forceZero = function($value) {
            return $value === 0 ? '0' : $value;
        };

        // 1. Effectif (Workforce) - from Workers or daily snapshots
        $effectifRow = ['Effectif'];
        $maxEffectif = 0;
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'effectif');
            $effectifRow[] = $val;
            $maxEffectif = max($maxEffectif, $val);
        }
        $weeklyEffectif = $maxEffectif ?: 0;
        $effectifRow[] = $forceZero($weeklyEffectif);
        $effectifRow[] = $forceZero($weeklyEffectif); // Current workforce
        $rows[] = $effectifRow;

        // 2. Induction - from daily snapshots or KPI report
        $inductionRow = ['Induction'];
        $totalInduction = 0;
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'induction');
            $inductionRow[] = $val;
            $totalInduction += $val;
        }
        $weeklyInduction = $totalInduction;
        $inductionRow[] = $forceZero($weeklyInduction);
        $cumulativeInduction = ($cumulativeFromSnapshots['total_induction'] ?? 0) + $weeklyInduction;
        $inductionRow[] = $forceZero($cumulativeInduction);
        $rows[] = $inductionRow;

        // 3. Relevé des écarts (Deviations) - from SOR reports
        $ecartsRow = ['Relevé des écarts'];
        foreach ($days as $day) {
            $dayDeviations = $weeklySorReports->filter(function($sor) use ($day) {
                return Carbon::parse($sor->observation_date)->format('Y-m-d') === $day['key'];
            })->count();
            $ecartsRow[] = $forceZero($dayDeviations);
        }
        $ecartsRow[] = $forceZero($weeklyDeviations);
        $ecartsRow[] = $forceZero(($cumulativeData->total_deviations ?? 0) + $weeklyDeviations);
        $rows[] = $ecartsRow;

        // 4. Sensibilisation - from Awareness Sessions
        $sensibRow = ['Nombre de Sensibilisation'];
        foreach ($days as $day) {
            $dayAwareness = $weeklyAwareness->filter(function($a) use ($day) {
                return Carbon::parse($a->date)->format('Y-m-d') === $day['key'];
            })->count();
            $sensibRow[] = $forceZero($dayAwareness);
        }
        $sensibRow[] = $forceZero($weeklyAwarenessCount);
        $sensibRow[] = $forceZero(($cumulativeData->total_sensibilisation ?? 0) + $weeklyAwarenessCount);
        $rows[] = $sensibRow;

        // 5. Near Misses - from SOR reports
        $nmRow = ['Presqu\'accident (NM)'];
        foreach ($days as $day) {
            $dayNm = $weeklySorReports->filter(function($sor) use ($day) {
                return Carbon::parse($sor->observation_date)->format('Y-m-d') === $day['key'] 
                    && $sor->category === 'near_miss';
            })->count();
            $nmRow[] = $forceZero($dayNm);
        }
        $nmRow[] = $forceZero($weeklyNearMisses);
        $nmRow[] = $forceZero(($cumulativeData->total_near_misses ?? 0) + $weeklyNearMisses);
        $rows[] = $nmRow;

        // 6. First Aid - from SOR reports
        $facRow = ['Premiers soins (FAC)'];
        foreach ($days as $day) {
            $dayFac = $weeklySorReports->filter(function($sor) use ($day) {
                return Carbon::parse($sor->observation_date)->format('Y-m-d') === $day['key'] 
                    && $sor->category === 'first_aid';
            })->count();
            $facRow[] = $forceZero($dayFac);
        }
        $facRow[] = $forceZero($weeklyFirstAid);
        $facRow[] = $forceZero(($cumulativeData->total_first_aid ?? 0) + $weeklyFirstAid);
        $rows[] = $facRow;

        // 7. Accidents - from SOR reports or daily snapshots
        $accRow = ['Accident (LTA/NLTA/FAT)'];
        $totalDailyAccidents = 0;
        foreach ($days as $day) {
            $dayAcc = $getDailyValue($day, 'accidents');
            if (!$dayAcc) {
                $dayAcc = $weeklySorReports->filter(function($sor) use ($day) {
                    return Carbon::parse($sor->observation_date)->format('Y-m-d') === $day['key'] 
                        && in_array($sor->category, ['accident', 'incident']);
                })->count();
            }
            $accRow[] = $forceZero($dayAcc);
            $totalDailyAccidents += $dayAcc;
        }
        $weeklyAccidentsTotal = $totalDailyAccidents ?: $weeklyAccidents;
        $accRow[] = $forceZero($weeklyAccidentsTotal);
        $accRow[] = $forceZero(($cumulativeData->total_accidents ?? 0) + $weeklyAccidentsTotal);
        $rows[] = $accRow;

        // 8. Lost Workdays - from daily snapshots or KPI report
        $lwdRow = ['Nombre de jours d\'arrêt (LWD)'];
        $totalLwd = 0;
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'jours_arret');
            $lwdRow[] = $forceZero($val);
            $totalLwd += $val;
        }
        $weeklyLwd = $totalLwd;
        $lwdRow[] = $forceZero($weeklyLwd);
        $lwdRow[] = $forceZero(($cumulativeData->total_lwd ?? 0) + $weeklyLwd);
        $rows[] = $lwdRow;

        // 9. Inspections - from Inspections table
        $inspRow = ['Nombre d\'Inspections'];
        foreach ($days as $day) {
            $dayInsp = Inspection::where('project_id', $this->project->id)
                ->whereDate('inspection_date', $day['key'])
                ->count();
            $inspRow[] = $forceZero($dayInsp);
        }
        $inspRow[] = $forceZero($weeklyInspections);
        $inspRow[] = $forceZero(($cumulativeData->total_inspections ?? 0) + $weeklyInspections);
        $rows[] = $inspRow;

        // 10. Training Hours - from Training + Awareness
        $trainingRow = ['Heures de formation'];
        foreach ($days as $day) {
            $dayTraining = $weeklyTrainings->filter(function($t) use ($day) {
                return Carbon::parse($t->training_date ?? $t->created_at)->format('Y-m-d') === $day['key'];
            })->sum('training_hours');
            $dayAwarenessHours = $weeklyAwareness->filter(function($a) use ($day) {
                return Carbon::parse($a->date)->format('Y-m-d') === $day['key'];
            })->sum('session_hours');
            $total = $dayTraining + $dayAwarenessHours;
            $trainingRow[] = $forceZero($total);
        }
        $totalTrainingHours = $weeklyTrainingHours + $weeklyAwarenessHours;
        $trainingRow[] = $forceZero($totalTrainingHours);
        $trainingRow[] = $forceZero(($cumulativeFromSnapshots['total_training_hours'] ?? 0) + $totalTrainingHours);
        $rows[] = $trainingRow;

        // 11. Work Permits - from WorkPermit table
        $permitRow = ['Permis de travail'];
        foreach ($days as $day) {
            $dayPermits = WorkPermit::where('project_id', $this->project->id)
                ->whereDate('commence_date', $day['key'])
                ->count();
            $permitRow[] = $forceZero($dayPermits);
        }
        $permitRow[] = $forceZero($weeklyWorkPermits);
        $permitRow[] = $forceZero(($cumulativeData->total_permits ?? 0) + $weeklyWorkPermits);
        $rows[] = $permitRow;

        // 12. Disciplinary Actions - from daily snapshots
        $discRow = ['Mesures disciplinaires'];
        $totalDisc = 0;
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'mesures_disciplinaires');
            $discRow[] = $forceZero($val);
            $totalDisc += $val;
        }
        $discRow[] = $forceZero($totalDisc);
        $discRow[] = $forceZero($totalDisc); // No cumulative tracking yet
        $rows[] = $discRow;

        // 13. HSE Compliance Rate - from daily snapshots or KPI report
        $hseRow = ['Taux conformité HSE (%)'];
        $hseValues = [];
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'conformite_hse');
            // Always display a value, even when zero
            $hseRow[] = $val . '%';
            if ($val) $hseValues[] = $val;
        }
        $avgHse = count($hseValues) > 0 ? round(array_sum($hseValues) / count($hseValues), 1) : 0;
        $hseRow[] = $avgHse . '%';
        $hseRow[] = round($cumulativeAverages['avg_hse'], 1) . '%';
        $rows[] = $hseRow;

        // 14. Medical Compliance Rate - from daily snapshots or KPI report
        $medRow = ['Taux conformité médecine (%)'];
        $medValues = [];
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'conformite_medicale');
            // Always display a value, even when zero
            $medRow[] = $val . '%';
            if ($val) $medValues[] = $val;
        }
        $avgMed = count($medValues) > 0 ? round(array_sum($medValues) / count($medValues), 1) : 0;
        $medRow[] = $avgMed . '%';
        $medRow[] = round($cumulativeAverages['avg_medical'], 1) . '%';
        $rows[] = $medRow;

        // 15. Noise Monitoring - from daily snapshots
        $noiseRow = ['Suivi du bruit'];
        $noiseValues = [];
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'suivi_bruit');
            $noiseRow[] = $val ?: '-';
            if ($val) $noiseValues[] = $val;
        }
        $avgNoise = count($noiseValues) > 0 ? round(array_sum($noiseValues) / count($noiseValues), 1) : 0;
        $noiseRow[] = $avgNoise ?: '-';
        $noiseRow[] = round($cumulativeAverages['avg_noise'], 1) ?: '-';
        $rows[] = $noiseRow;

        // 16. Water Consumption - from daily snapshots or KPI report
        $waterRow = ['Consommation Eau (m³)'];
        $totalWater = 0;
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'consommation_eau');
            $waterRow[] = $forceZero($val);
            $totalWater += $val;
        }
        $weeklyWater = $totalWater;
        $waterRow[] = $forceZero($weeklyWater);
        $waterRow[] = $forceZero(($cumulativeFromSnapshots['total_water'] ?? 0) + $weeklyWater);
        $rows[] = $waterRow;

        // 17. Electricity Consumption - from daily snapshots or KPI report
        $elecRow = ['Consommation Électricité (kWh)'];
        $totalElec = 0;
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'consommation_electricite');
            $elecRow[] = $forceZero($val);
            $totalElec += $val;
        }
        $weeklyElec = $totalElec;
        $elecRow[] = $forceZero($weeklyElec);
        $elecRow[] = $forceZero(($cumulativeFromSnapshots['total_electricity'] ?? 0) + $weeklyElec);
        $rows[] = $elecRow;

        // 18. Hours Worked - from daily snapshots or KPI report
        $hoursRow = ['Heures travaillées'];
        $totalHours = 0;
        foreach ($days as $day) {
            $val = $getDailyValue($day, 'heures_travaillees');
            $hoursRow[] = $forceZero($val);
            $totalHours += $val;
        }
        $weeklyHours = $totalHours;
        $hoursRow[] = $forceZero($weeklyHours);
        $cumulHours = ($cumulativeFromSnapshots['total_hours'] ?? 0) + $weeklyHours;
        $hoursRow[] = $forceZero($cumulHours);
        $rows[] = $hoursRow;

        // TG Row (Severity Rate)
        $tgRow = ['TG (Taux de Gravité)'];
        foreach ($days as $day) {
            $hours = $getDailyValue($day, 'heures_travaillees');
            $lwd = $getDailyValue($day, 'jours_arret');
            $tg = $hours > 0 ? round(($lwd * 1000000) / $hours, 2) : 0;
            $tgRow[] = $forceZero($tg);
        }
        $weeklyTg = $weeklyHours > 0 ? round(($weeklyLwd * 1000000) / $weeklyHours, 2) : 0;
        $tgRow[] = $forceZero($weeklyTg);
        $cumulLwd = ($cumulativeData->total_lwd ?? 0) + $weeklyLwd;
        $cumulHours = ($cumulativeFromSnapshots['total_hours'] ?? 0) + $weeklyHours;
        $cumulTg = $cumulHours > 0 ? round(($cumulLwd * 1000000) / $cumulHours, 2) : 0;
        $tgRow[] = $forceZero($cumulTg);
        $rows[] = $tgRow;

        // TF Row (Frequency Rate)
        $tfRow = ['TF (Taux de Fréquence)'];
        foreach ($days as $day) {
            $hours = $getDailyValue($day, 'heures_travaillees');
            $accidents = $getDailyValue($day, 'accidents');
            $tf = $hours > 0 ? round(($accidents * 1000000) / $hours, 2) : 0;
            $tfRow[] = $forceZero($tf);
        }
        $weeklyTf = $weeklyHours > 0 ? round(($weeklyAccidentsTotal * 1000000) / $weeklyHours, 2) : 0;
        $tfRow[] = $forceZero($weeklyTf);
        $cumulAccidents = ($cumulativeData->total_accidents ?? 0) + $weeklyAccidentsTotal;
        $cumulHours = ($cumulativeFromSnapshots['total_hours'] ?? 0) + $weeklyHours;
        $cumulTf = $cumulHours > 0 ? round(($cumulAccidents * 1000000) / $cumulHours, 2) : 0;
        $tfRow[] = $forceZero($cumulTf);
        $rows[] = $tfRow;

        return $rows;
    }

    public function title(): string
    {
        return 'REPORTING HSE';
    }

    public function drawings()
    {
        $logoPath = public_path('assets/SGTM_Logo-F6jmcNP5.jpg');
        
        if (!file_exists($logoPath)) {
            return [];
        }

        $drawing = new Drawing();
        $drawing->setName('SGTM Logo');
        $drawing->setDescription('SGTM Logo');
        $drawing->setPath($logoPath);
        $drawing->setHeight(60);
        $drawing->setCoordinates('A1');

        return [$drawing];
    }

    public function styles(Worksheet $sheet)
    {
        $lastCol = 'J'; // A + 7 days + Total + Cumul = 10 columns
        $lastRow = $sheet->getHighestRow();

        // Title style
        $sheet->mergeCells("A4:{$lastCol}4");
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        // Info row
        $sheet->getStyle("A5:{$lastCol}5")->applyFromArray([
            'font' => ['italic' => true, 'size' => 10],
        ]);

        // Header row (row 7)
        $sheet->getStyle("A7:{$lastCol}7")->applyFromArray([
            'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        // Freeze header and first column
        $sheet->freezePane('B8');

        // Indicator column style (first column - bold labels)
        $sheet->getStyle("A8:A{$lastRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F3F4F6']],
        ]);

        // Data cells styling
        for ($row = 8; $row <= $lastRow; $row++) {
            // Alternating row colors
            if ($row % 2 == 0) {
                $sheet->getStyle("B{$row}:{$lastCol}{$row}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
            // Borders for all cells
            $sheet->getStyle("A{$row}:{$lastCol}{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        // Total Semaine column style (column I)
        $sheet->getStyle("I7:I{$lastRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEF3C7']],
        ]);

        // Cumul Projet column style (column J)
        $sheet->getStyle("J7:J{$lastRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'DCFCE7']],
        ]);

        // Set column widths
        $sheet->getColumnDimension('A')->setWidth(35);
        foreach (range('B', 'J') as $col) {
            $sheet->getColumnDimension($col)->setWidth(14);
        }

        return [];
    }
}
