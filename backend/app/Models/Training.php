<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Training extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'submitted_by',
        'date',
        'week_number',
        'week_year',
        'by_internal',
        'by_name',
        'external_company',
        'theme',
        'duration_label',
        'duration_hours',
        'participants',
        'training_hours',
        'photo_path',
    ];

    protected $casts = [
        'date' => 'date',
        'by_internal' => 'boolean',
        'duration_hours' => 'decimal:2',
        'training_hours' => 'decimal:2',
        'participants' => 'integer',
        'week_number' => 'integer',
        'week_year' => 'integer',
    ];

    protected $appends = ['photo_url'];

    // Accessors
    public function getPhotoUrlAttribute(): ?string
    {
        return $this->photo_path
            ? Storage::disk('public')->url($this->photo_path)
            : null;
    }

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
