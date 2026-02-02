<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'description',
        'location',
        'start_date',
        'end_date',
        'status',
        'pole',
        'client_name',
        'zones',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'zones' => 'array',
    ];

    // Status constants
    const STATUS_ACTIVE = 'active';
    const STATUS_COMPLETED = 'completed';
    const STATUS_ON_HOLD = 'on_hold';
    const STATUS_CANCELLED = 'cancelled';

    // Relationships
    public function users()
    {
        return $this->belongsToMany(User::class, 'project_user')
            ->withPivot('assigned_at')
            ->withTimestamps();
    }

    public function responsables()
    {
        return $this->users()->where('role', User::ROLE_RESPONSABLE);
    }

    public function hseManagers()
    {
        return $this->users()->where('role', User::ROLE_HSE_MANAGER);
    }

    /**
     * Team members (HSE Officers) assigned by HSE Managers
     */
    public function teamMembers()
    {
        return $this->belongsToMany(User::class, 'project_teams')
            ->withPivot('added_by', 'created_at')
            ->withTimestamps();
    }

    /**
     * Get HSE Officers in the team
     */
    public function hseOfficers()
    {
        return $this->teamMembers()->where('role', User::ROLE_USER);
    }

    public function kpiReports()
    {
        return $this->hasMany(KpiReport::class);
    }

    public function dailyKpiSnapshots()
    {
        return $this->hasMany(DailyKpiSnapshot::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function codeAliases()
    {
        return $this->hasMany(ProjectCodeAlias::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeAssignedTo($query, User $user)
    {
        return $query->where(function ($q) use ($user) {
            $q->whereHas('users', function ($qq) use ($user) {
                $qq->where('users.id', $user->id);
            })->orWhereHas('teamMembers', function ($qq) use ($user) {
                $qq->where('users.id', $user->id);
            });
        });
    }

    public function scopeVisibleTo($query, User $user)
    {
        $scope = $user->getProjectScopeType();

        if ($scope === 'all') {
            return $query;
        }

        if ($scope === 'pole') {
            $pole = $user->pole;
            if ($pole === null || $pole === '') {
                return $query->whereRaw('1 = 0');
            }
            return $query->where('pole', $pole);
        }

        // assigned
        return $query->assignedTo($user);
    }

    public function scopeForUser($query, User $user)
    {
        return $query->visibleTo($user);
    }

    // Accessors
    public function getTotalAccidentsAttribute()
    {
        return $this->kpiReports()->sum('accidents');
    }

    public function getTotalTrainingsAttribute()
    {
        return $this->kpiReports()->sum('trainings_conducted');
    }

    public function getTotalInspectionsAttribute()
    {
        return $this->kpiReports()->sum('inspections_completed');
    }

    public function getLatestKpiAttribute()
    {
        return $this->kpiReports()->latest()->first();
    }
}
