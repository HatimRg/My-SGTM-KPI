<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

class WorkPermit extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'week_number',
        'year',
        'permit_number',
        'serial_number',
        'type_cold',
        'type_work_at_height',
        'type_hot_work',
        'type_confined_spaces',
        'type_electrical_isolation',
        'type_energized_work',
        'type_excavation',
        'type_mechanical_isolation',
        'type_7inch_grinder',
        'description',
        'area',
        'permit_user',
        'signed_by',
        'authorizer',
        'commence_date',
        'end_date',
        'enterprise',
        'status',
        'created_by',
    ];

    protected $casts = [
        'type_cold' => 'boolean',
        'type_work_at_height' => 'boolean',
        'type_hot_work' => 'boolean',
        'type_confined_spaces' => 'boolean',
        'type_electrical_isolation' => 'boolean',
        'type_energized_work' => 'boolean',
        'type_excavation' => 'boolean',
        'type_mechanical_isolation' => 'boolean',
        'type_7inch_grinder' => 'boolean',
        'commence_date' => 'date',
        'end_date' => 'date',
        'week_number' => 'integer',
        'year' => 'integer',
        'serial_number' => 'integer',
    ];

    // Status constants
    const STATUS_DRAFT = 'draft';
    const STATUS_ACTIVE = 'active';
    const STATUS_CLOSED = 'closed';
    const STATUS_CANCELLED = 'cancelled';

    // Permit type constants
    const PERMIT_TYPES = [
        'type_cold' => 'Cold Permit',
        'type_work_at_height' => 'Work at Height Permit',
        'type_hot_work' => 'Hot Work Permit',
        'type_confined_spaces' => 'Confined Spaces Permit',
        'type_electrical_isolation' => 'Electrical Isolation Permit',
        'type_energized_work' => 'Energized Work Permit',
        'type_excavation' => 'Excavation Permit',
        'type_mechanical_isolation' => 'Mechanical Isolation Permit',
        'type_7inch_grinder' => '7 Inch Grinder Permit',
    ];

    // Relationships
    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Scopes
    public function scopeForProject($query, $projectId)
    {
        return $query->where('project_id', $projectId);
    }

    public function scopeForWeek($query, $weekNumber, $year)
    {
        return $query->where('week_number', $weekNumber)->where('year', $year);
    }

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    // Helper methods

    /**
     * Generate permit number: SGTM-{project_code}-S{week}-{serial}
     */
    public static function generatePermitNumber($projectCode, $weekNumber, $serialNumber)
    {
        $weekFormatted = 'S' . str_pad($weekNumber, 2, '0', STR_PAD_LEFT);
        $serialFormatted = str_pad($serialNumber, 3, '0', STR_PAD_LEFT);
        return "SGTM-{$projectCode}-{$weekFormatted}-{$serialFormatted}";
    }

    /**
     * Get next serial number for a project/week combination
     */
    public static function getNextSerialNumber($projectId, $weekNumber, $year)
    {
        $used = self::where('project_id', $projectId)
            ->where('week_number', $weekNumber)
            ->where('year', $year)
            ->pluck('serial_number')
            ->map(fn ($v) => (int) $v)
            ->filter(fn ($v) => $v > 0)
            ->values()
            ->toArray();

        if (empty($used)) {
            return 1;
        }

        $lookup = array_fill_keys($used, true);
        $candidate = 1;
        while (isset($lookup[$candidate])) {
            $candidate++;
        }

        return $candidate;
    }

    /**
     * Get week dates (Monday to Saturday)
     * Week starts on Monday
     */
    public static function getWeekDates($weekNumber, $year)
    {
        // ISO week - week 1 is the first week with Thursday in it
        $date = Carbon::now()->setISODate($year, $weekNumber, 1); // Monday
        $startDate = $date->copy();
        $endDate = $date->copy()->addDays(5); // Saturday

        return [
            'start' => $startDate->format('Y-m-d'),
            'end' => $endDate->format('Y-m-d'),
        ];
    }

    /**
     * Get current ISO week number
     */
    public static function getCurrentWeek()
    {
        return Carbon::now()->isoWeek();
    }

    /**
     * Get current year
     */
    public static function getCurrentYear()
    {
        return Carbon::now()->year;
    }

    /**
     * Get active permit types for this permit
     */
    public function getActiveTypesAttribute()
    {
        $types = [];
        foreach (self::PERMIT_TYPES as $field => $label) {
            if ($this->$field) {
                $types[] = $field;
            }
        }
        return $types;
    }

    /**
     * Get active permit type labels
     */
    public function getActiveTypeLabelsAttribute()
    {
        $labels = [];
        foreach (self::PERMIT_TYPES as $field => $label) {
            if ($this->$field) {
                $labels[] = $label;
            }
        }
        return $labels;
    }

    /**
     * Reinitialize permit numbers for a week
     * Uses a temp suffix to avoid unique constraint during renumbering
     */
    public static function reinitializePermitNumbers($projectId, $weekNumber, $year)
    {
        $permits = self::where('project_id', $projectId)
            ->where('week_number', $weekNumber)
            ->where('year', $year)
            ->orderBy('id')
            ->get();

        $project = Project::find($projectId);
        
        // First pass: assign temporary unique permit numbers to avoid conflicts
        foreach ($permits as $permit) {
            $permit->permit_number = 'TEMP-' . uniqid() . '-' . $permit->id;
            $permit->saveQuietly(); // Skip events/observers
        }
        
        // Second pass: assign correct sequential numbers
        $serial = 1;
        foreach ($permits as $permit) {
            // Find next available serial number
            $newPermitNumber = self::generatePermitNumber($project->code, $weekNumber, $serial);
            while (self::withTrashed()
                ->where('permit_number', $newPermitNumber)
                ->where('id', '!=', $permit->id)
                ->exists()) {
                $serial++;
                $newPermitNumber = self::generatePermitNumber($project->code, $weekNumber, $serial);
            }
            
            $permit->serial_number = $serial;
            $permit->permit_number = $newPermitNumber;
            $permit->saveQuietly();
            $serial++;
        }

        return $permits->count();
    }
}
