<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class KpiReport extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'submitted_by',
        'report_date',
        'report_month',
        'report_year',
        'week_number',
        'start_date',
        'end_date',
        
        // Accident metrics
        'accidents',
        'accidents_fatal',
        'accidents_serious',
        'accidents_minor',
        'near_misses',
        'first_aid_cases',
        
        // Training metrics
        'trainings_conducted',
        'trainings_planned',
        'employees_trained',
        'training_hours',
        'toolbox_talks',
        
        // Inspection metrics
        'inspections_completed',
        'inspections_planned',
        'findings_open',
        'findings_closed',
        'corrective_actions',
        
        // TG (Taux de Gravité) - Severity Rate
        'tg_value',
        'lost_workdays',
        
        // TF (Taux de Fréquence) - Frequency Rate
        'tf_value',
        'hours_worked',
        
        // Additional metrics
        'unsafe_acts_reported',
        'unsafe_conditions_reported',
        'emergency_drills',
        'hse_compliance_rate',
        'medical_compliance_rate',
        'noise_monitoring',
        'water_consumption',
        'electricity_consumption',
        'work_permits',
        
        // Notes
        'notes',
        'status',
        'approved_by',
        'approved_at',
        
        // Rejection tracking
        'rejection_reason',
        'rejected_at',
        'rejected_by',
        'submission_count',
        'last_submitted_at',
    ];

    protected $casts = [
        'report_date' => 'date',
        'start_date' => 'date',
        'end_date' => 'date',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'last_submitted_at' => 'datetime',
        'week_number' => 'integer',
        'submission_count' => 'integer',
        'accidents' => 'integer',
        'accidents_fatal' => 'integer',
        'accidents_serious' => 'integer',
        'accidents_minor' => 'integer',
        'near_misses' => 'integer',
        'first_aid_cases' => 'integer',
        'trainings_conducted' => 'integer',
        'trainings_planned' => 'integer',
        'employees_trained' => 'integer',
        'training_hours' => 'decimal:2',
        'toolbox_talks' => 'integer',
        'inspections_completed' => 'integer',
        'inspections_planned' => 'integer',
        'findings_open' => 'integer',
        'findings_closed' => 'integer',
        'corrective_actions' => 'integer',
        'tg_value' => 'decimal:4',
        'lost_workdays' => 'integer',
        'tf_value' => 'decimal:4',
        'hours_worked' => 'decimal:2',
        'unsafe_acts_reported' => 'integer',
        'unsafe_conditions_reported' => 'integer',
        'emergency_drills' => 'integer',
        'hse_compliance_rate' => 'decimal:2',
        'medical_compliance_rate' => 'decimal:2',
        'noise_monitoring' => 'decimal:2',
        'water_consumption' => 'decimal:2',
        'electricity_consumption' => 'decimal:2',
        'work_permits' => 'integer',
    ];

    // Status constants
    const STATUS_DRAFT = 'draft';
    const STATUS_SUBMITTED = 'submitted';
    const STATUS_APPROVED = 'approved';
    const STATUS_REJECTED = 'rejected';

    // Relationships
    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejector()
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    // Scopes
    public function scopeForProject($query, $projectId)
    {
        return $query->where('project_id', $projectId);
    }

    public function scopeForMonth($query, $month, $year)
    {
        return $query->where('report_month', $month)->where('report_year', $year);
    }

    public function scopeForWeek($query, $week, $year)
    {
        return $query->where('week_number', $week)->where('report_year', $year);
    }

    public function scopeDraft($query)
    {
        return $query->where('status', self::STATUS_DRAFT);
    }

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_SUBMITTED);
    }

    // Check if report was previously rejected
    public function wasRejected(): bool
    {
        return !is_null($this->rejection_reason);
    }

    public function scopeApproved($query)
    {
        return $query->where('status', self::STATUS_APPROVED);
    }

    public function scopeSubmitted($query)
    {
        return $query->where('status', self::STATUS_SUBMITTED);
    }

    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('report_date', [$startDate, $endDate]);
    }

    // Calculate TF (Frequency Rate) = (Accidents × 1,000,000) / Hours Worked
    public function calculateTf(): float
    {
        $effectiveHours = (float) $this->hours_worked * 10.0;
        if ($effectiveHours > 0) {
            return ($this->accidents * 1000000) / $effectiveHours;
        }
        return 0;
    }

    // Calculate TG (Severity Rate) = (Lost Workdays × 1,000) / Hours Worked
    public function calculateTg(): float
    {
        $effectiveHours = (float) $this->hours_worked * 10.0;
        if ($effectiveHours > 0) {
            return ($this->lost_workdays * 1000) / $effectiveHours;
        }
        return 0;
    }

    // Auto-calculate rates before saving
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($model) {
            $model->tf_value = $model->calculateTf();
            $model->tg_value = $model->calculateTg();
        });
    }
}
