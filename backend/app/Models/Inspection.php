<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

class Inspection extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'created_by',
        'inspection_date',
        'nature',
        'nature_other',
        'type',
        'location',
        'start_date',
        'end_date',
        'zone',
        'inspector',
        'enterprise',
        'status',
        'week_number',
        'week_year',
        'notes',
    ];

    protected $casts = [
        'inspection_date' => 'date',
        'start_date' => 'date',
        'end_date' => 'date',
        'week_number' => 'integer',
        'week_year' => 'integer',
    ];

    // Nature constants
    const NATURE_SST = 'sst';
    const NATURE_ENVIRONMENT = 'environment';
    const NATURE_THIRD_PARTY = 'third_party';
    const NATURE_EQUIPMENT = 'equipment';
    const NATURE_OTHER = 'other';

    const NATURES = [
        self::NATURE_SST => 'Inspection SST',
        self::NATURE_ENVIRONMENT => 'Inspection environnement',
        self::NATURE_THIRD_PARTY => 'Inspection par une tierce partie',
        self::NATURE_EQUIPMENT => 'Inspections du matériel équipements et outillages',
        self::NATURE_OTHER => 'Autres',
    ];

    // Type constants
    const TYPE_INTERNAL = 'internal';
    const TYPE_EXTERNAL = 'external';

    // Status constants
    const STATUS_OPEN = 'open';
    const STATUS_CLOSED = 'closed';

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
        return $query->where('week_number', $weekNumber)->where('week_year', $year);
    }

    public function scopeOpen($query)
    {
        return $query->where('status', self::STATUS_OPEN);
    }

    public function scopeClosed($query)
    {
        return $query->where('status', self::STATUS_CLOSED);
    }

    // Helper to calculate week info from date
    public static function calculateWeekFromDate($date)
    {
        $carbon = Carbon::parse($date);
        return [
            'week_number' => $carbon->isoWeek(),
            'week_year' => $carbon->isoWeekYear(),
        ];
    }
}
