<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DailyKpiSnapshot extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Table name (explicit for clarity)
     */
    protected $table = 'daily_kpi_snapshots';

    /**
     * Mass assignable attributes
     */
    protected $fillable = [
        'project_id',
        'submitted_by',
        'entry_date',
        'week_number',
        'year',
        'day_name',

        'effectif',
        'induction',
        'releve_ecarts',
        'sensibilisation',
        'presquaccident',
        'premiers_soins',
        'accidents',
        'jours_arret',
        'heures_travaillees',
        'inspections',
        'heures_formation',
        'permis_travail',
        'mesures_disciplinaires',
        'conformite_hse',
        'conformite_medicale',
        'suivi_bruit',
        'consommation_eau',
        'consommation_electricite',

        'status',
        'notes',
    ];

    /**
     * Attribute casting
     */
    protected $casts = [
        'entry_date' => 'date',
        'week_number' => 'integer',
        'year' => 'integer',

        'effectif' => 'integer',
        'induction' => 'integer',
        'releve_ecarts' => 'integer',
        'sensibilisation' => 'integer',
        'presquaccident' => 'integer',
        'premiers_soins' => 'integer',
        'accidents' => 'integer',
        'jours_arret' => 'integer',
        'heures_travaillees' => 'decimal:2',
        'inspections' => 'integer',
        'heures_formation' => 'decimal:2',
        'permis_travail' => 'integer',
        'mesures_disciplinaires' => 'integer',
        'conformite_hse' => 'decimal:2',
        'conformite_medicale' => 'decimal:2',
        'suivi_bruit' => 'decimal:2',
        'consommation_eau' => 'decimal:2',
        'consommation_electricite' => 'decimal:2',
    ];

    const STATUS_DRAFT = 'draft';
    const STATUS_SUBMITTED = 'submitted';

    /**
     * Relationships
     */
    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * Scopes
     */
    public function scopeForProject($query, int $projectId)
    {
        return $query->where('project_id', $projectId);
    }

    public function scopeForWeek($query, int $weekNumber, int $year)
    {
        return $query->where('week_number', $weekNumber)
            ->where('year', $year);
    }

    public function scopeSubmitted($query)
    {
        return $query->where('status', self::STATUS_SUBMITTED);
    }

    /**
     * Aggregate daily entries for a project/week into KPI metrics.
     * This does NOT calculate TF/TG directly, but prepares the
     * inputs (hours_worked, lost_workdays, accidents, etc.).
     */
    public static function aggregateForWeek(int $projectId, int $weekNumber, int $year): array
    {
        // Only use submitted daily entries when building KPI numbers
        $entries = self::forProject($projectId)
            ->forWeek($weekNumber, $year)
            ->submitted()
            ->get();

        if ($entries->isEmpty()) {
            return [];
        }

        return [
            // Effectif - MAX of the week (highest workforce count)
            'effectif' => self::getEffectif($entries),
            
            // Induction - SUM of the week
            'induction' => self::getInduction($entries),
            
            // Relevé des écarts - SUM (from daily entries + SOR reports)
            'releve_ecarts' => self::getReleveEcarts($projectId, $weekNumber, $year, $entries),
            
            // Sensibilisation - SUM (from daily + awareness sessions)
            'sensibilisation' => self::getSensibilisation($projectId, $weekNumber, $year, $entries),
            
            // Presqu'accident (near misses) - SUM
            'near_misses' => self::getNearMisses($entries),
            
            // Premiers soins (first aid) - SUM
            'first_aid_cases' => self::getFirstAidCases($entries),
            
            // Accidents - SUM
            'accidents' => self::getAccidents($entries),
            
            // Jours d'arrêt (lost workdays) - SUM
            'lost_workdays' => self::getLostWorkdays($entries),
            
            // Hours worked - SUM (for TF/TG calculation)
            'hours_worked' => self::getHoursWorked($entries),
            
            // Inspections - SUM (coming soon from other pages)
            'inspections_completed' => self::getInspections($entries),
            
            // Training hours - SUM (from training + awareness pages)
            'training_hours' => self::getTrainingHours($projectId, $weekNumber, $year, $entries),
            
            // Work permits - SUM (from work permits page)
            'work_permits' => self::getWorkPermits($projectId, $weekNumber, $year, $entries),
            
            // Toolbox talks count
            'toolbox_talks' => self::getSensibilisation($projectId, $weekNumber, $year, $entries),
            
            // Mesures disciplinaires - SUM (coming soon)
            'disciplinary_actions' => self::getDisciplinaryActions($entries),
            
            // HSE Compliance - AVG of the week
            'hse_compliance_rate' => self::getHseCompliance($entries),
            
            // Medical Compliance - AVG of the week
            'medical_compliance_rate' => self::getMedicalCompliance($entries),
            
            // Noise monitoring - AVG of the week
            'noise_monitoring' => self::getNoiseMonitoring($entries),
            
            // Water consumption - SUM
            'water_consumption' => self::getWaterConsumption($entries),
            
            // Electricity consumption - SUM
            'electricity_consumption' => self::getElectricityConsumption($entries),
        ];
    }

    // =====================================================
    // INDIVIDUAL AGGREGATION FUNCTIONS
    // =====================================================

    /**
     * Effectif: MAX of the week (highest workforce count)
     */
    public static function getEffectif($entries): int
    {
        return (int) $entries->max('effectif');
    }

    /**
     * Induction: SUM of the week
     */
    public static function getInduction($entries): int
    {
        return (int) $entries->sum('induction');
    }

    /**
     * Relevé des écarts: SUM from daily entries + SOR reports
     */
    public static function getReleveEcarts(int $projectId, int $weekNumber, int $year, $entries = null): int
    {
        $dailyTotal = $entries ? (int) $entries->sum('releve_ecarts') : 0;
        
        // Add SOR reports from the week (by date range)
        $weekDates = \App\Helpers\WeekHelper::getWeekDates($weekNumber, $year);
        $sorCount = \App\Models\SorReport::where('project_id', $projectId)
            ->whereBetween('observation_date', [$weekDates['start']->toDateString(), $weekDates['end']->toDateString()])
            ->count();
        
        return $dailyTotal + $sorCount;
    }

    /**
     * Sensibilisation: SUM from daily entries + awareness sessions
     */
    public static function getSensibilisation(int $projectId, int $weekNumber, int $year, $entries = null): int
    {
        $dailyTotal = $entries ? (int) $entries->sum('sensibilisation') : 0;
        
        // Add awareness sessions from the week
        $awarenessCount = \App\Models\AwarenessSession::where('project_id', $projectId)
            ->where('week_number', $weekNumber)
            ->where('week_year', $year)
            ->count();
        
        return $dailyTotal + $awarenessCount;
    }

    /**
     * Near misses (Presqu'accident): SUM of the week
     */
    public static function getNearMisses($entries): int
    {
        return (int) $entries->sum('presquaccident');
    }

    /**
     * First aid cases (Premiers soins): SUM of the week
     */
    public static function getFirstAidCases($entries): int
    {
        return (int) $entries->sum('premiers_soins');
    }

    /**
     * Accidents: SUM of the week
     */
    public static function getAccidents($entries): int
    {
        return (int) $entries->sum('accidents');
    }

    /**
     * Lost workdays (Jours d'arrêt): SUM of the week
     */
    public static function getLostWorkdays($entries): int
    {
        return (int) $entries->sum('jours_arret');
    }

    /**
     * Hours worked: SUM of the week (used for TF/TG)
     */
    public static function getHoursWorked($entries): float
    {
        return (float) $entries->sum('heures_travaillees');
    }

    /**
     * Inspections: SUM from daily entries (coming soon from other pages)
     */
    public static function getInspections($entries): int
    {
        return (int) $entries->sum('inspections');
    }

    /**
     * Training hours: SUM from daily entries + training page + awareness page
     */
    public static function getTrainingHours(int $projectId, int $weekNumber, int $year, $entries = null): float
    {
        $dailyTotal = $entries ? (float) $entries->sum('heures_formation') : 0;
        
        // Add training hours from Training table
        $trainingHours = \App\Models\Training::where('project_id', $projectId)
            ->where('week_number', $weekNumber)
            ->where('week_year', $year)
            ->sum('training_hours');
        
        // Add session hours from Awareness table (TBM/TBT)
        $awarenessHours = \App\Models\AwarenessSession::where('project_id', $projectId)
            ->where('week_number', $weekNumber)
            ->where('week_year', $year)
            ->sum('session_hours');
        
        return $dailyTotal + (float) $trainingHours + (float) $awarenessHours;
    }

    /**
     * Work permits: SUM from daily entries + work permits page
     */
    public static function getWorkPermits(int $projectId, int $weekNumber, int $year, $entries = null): int
    {
        $dailyTotal = $entries ? (int) $entries->sum('permis_travail') : 0;
        
        try {
            // Add work permits from WorkPermit table
            $permitCount = \App\Models\WorkPermit::where('project_id', $projectId)
                ->where('week_number', $weekNumber)
                ->where('year', $year)
                ->count();
            
            return $dailyTotal + $permitCount;
        } catch (\Exception $e) {
            return $dailyTotal;
        }
    }

    /**
     * Disciplinary actions: SUM of the week (coming soon)
     */
    public static function getDisciplinaryActions($entries): int
    {
        return (int) $entries->sum('mesures_disciplinaires');
    }

    /**
     * HSE Compliance rate: AVG of the week
     */
    public static function getHseCompliance($entries): float
    {
        $values = $entries->whereNotNull('conformite_hse')->pluck('conformite_hse');
        return $values->count() > 0 ? round($values->avg(), 2) : 0;
    }

    /**
     * Medical Compliance rate: AVG of the week
     */
    public static function getMedicalCompliance($entries): float
    {
        $values = $entries->whereNotNull('conformite_medicale')->pluck('conformite_medicale');
        return $values->count() > 0 ? round($values->avg(), 2) : 0;
    }

    /**
     * Noise monitoring: AVG of the week
     */
    public static function getNoiseMonitoring($entries): float
    {
        $values = $entries->whereNotNull('suivi_bruit')->pluck('suivi_bruit');
        return $values->count() > 0 ? round($values->avg(), 2) : 0;
    }

    /**
     * Water consumption: SUM of the week
     */
    public static function getWaterConsumption($entries): float
    {
        return (float) $entries->sum('consommation_eau');
    }

    /**
     * Electricity consumption: SUM of the week
     */
    public static function getElectricityConsumption($entries): float
    {
        return (float) $entries->sum('consommation_electricite');
    }

    /**
     * Get daily entries as array for a week (for Excel/manual entry)
     */
    public static function getDailyEntriesForWeek(int $projectId, int $weekNumber, int $year): array
    {
        $entries = self::forProject($projectId)
            ->forWeek($weekNumber, $year)
            ->orderBy('entry_date')
            ->get()
            ->keyBy(fn($e) => $e->entry_date->format('Y-m-d'));

        return $entries->toArray();
    }
}
