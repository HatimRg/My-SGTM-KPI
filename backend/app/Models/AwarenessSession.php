<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AwarenessSession extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'submitted_by',
        'date',
        'week_number',
        'week_year',
        'by_name',
        'theme',
        'duration_minutes',
        'participants',
        'session_hours',
    ];

    protected $casts = [
        'date' => 'date',
        'duration_minutes' => 'integer',
        'participants' => 'integer',
        'session_hours' => 'decimal:2',
        'week_number' => 'integer',
        'week_year' => 'integer',
    ];

    // Relationships
    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    // Scopes
    public function scopeForProject($query, $projectId)
    {
        return $query->where('project_id', $projectId);
    }

    public function scopeForWeek($query, $week, $year = null)
    {
        $query->where('week_number', $week);
        if ($year) {
            $query->where('week_year', $year);
        }
        return $query;
    }

    public function scopeForUser($query, $user)
    {
        if (!$user->isAdmin()) {
            $projectIds = $user->projects()->pluck('projects.id');
            $query->whereIn('project_id', $projectIds);
        }
        return $query;
    }
}
