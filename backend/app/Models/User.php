<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\Hash;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'cin',
        'password',
        'must_change_password',
        'role',
        'pole',
        'phone',
        'avatar',
        'preferred_language',
        'project_list_preference',
        'is_active',
        'created_by',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_active' => 'boolean',
        'must_change_password' => 'boolean',
    ];

    public function setPasswordAttribute($value)
    {
        if ($value === null || $value === '') {
            $this->attributes['password'] = $value;
            return;
        }

        // Avoid double-hashing: avoid re-hashing if it's already a valid hash
        // for the current hashing configuration.
        if (!Hash::needsRehash($value)) {
            $this->attributes['password'] = $value;
            return;
        }

        $this->attributes['password'] = Hash::make($value);
    }

    // Role constants
    const ROLE_ADMIN = 'admin';
    const ROLE_CONSULTATION = 'consultation';
    const ROLE_HSE_MANAGER = 'hse_manager';
    const ROLE_REGIONAL_HSE_MANAGER = 'regional_hse_manager';
    const ROLE_RESPONSABLE = 'responsable';
    const ROLE_USER = 'user';
    const ROLE_SUPERVISOR = 'supervisor';
    const ROLE_HR = 'hr';
    const ROLE_DEV = 'dev';

    const ROLE_POLE_DIRECTOR = 'pole_director';
    const ROLE_WORKS_DIRECTOR = 'works_director';
    const ROLE_HSE_DIRECTOR = 'hse_director';
    const ROLE_HR_DIRECTOR = 'hr_director';

    // Roles that responsable can create
    const HSE_MANAGER_CREATABLE_ROLES = [
        self::ROLE_RESPONSABLE,
        self::ROLE_SUPERVISOR,
        self::ROLE_USER,
    ];

    const RESPONSABLE_CREATABLE_ROLES = [
        self::ROLE_SUPERVISOR,
        self::ROLE_USER,
    ];

    // Roles that can access workers management
    const WORKERS_ACCESS_ROLES = [
        self::ROLE_HSE_MANAGER,
        self::ROLE_REGIONAL_HSE_MANAGER,
        self::ROLE_RESPONSABLE,
        self::ROLE_SUPERVISOR,
        self::ROLE_USER,
        self::ROLE_HR,
        self::ROLE_POLE_DIRECTOR,
        self::ROLE_WORKS_DIRECTOR,
        self::ROLE_HSE_DIRECTOR,
        self::ROLE_HR_DIRECTOR,
    ];

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN || $this->role === self::ROLE_CONSULTATION || $this->role === self::ROLE_DEV;
    }

    public function isAdminLike(): bool
    {
        $role = (string) $this->role;
        $roles = config('roles.roles', []);
        if (isset($roles[$role]) && array_key_exists('admin_routes', $roles[$role])) {
            return (bool) $roles[$role]['admin_routes'];
        }
        return $this->isAdmin();
    }

    public function isPoleDirector(): bool
    {
        return $this->role === self::ROLE_POLE_DIRECTOR;
    }

    public function isWorksDirector(): bool
    {
        return $this->role === self::ROLE_WORKS_DIRECTOR;
    }

    public function getProjectScopeType(): string
    {
        $role = (string) $this->role;
        $roles = config('roles.roles', []);
        $scope = $roles[$role]['project_scope'] ?? null;
        return is_string($scope) && $scope !== '' ? $scope : ($this->isAdmin() ? 'all' : 'assigned');
    }

    public function hasGlobalProjectScope(): bool
    {
        return $this->getProjectScopeType() === 'all';
    }

    public function visibleProjectIds()
    {
        $scope = $this->getProjectScopeType();
        if ($scope === 'all') {
            return null;
        }

        if ($scope === 'pole') {
            $pole = $this->pole;
            if ($pole === null || $pole === '') {
                return [];
            }

            return \App\Models\Project::query()
                ->where('pole', $pole)
                ->pluck('id');
        }

        // assigned
        $assigned = $this->projects()->pluck('projects.id');
        $team = $this->teamProjects()->pluck('projects.id');
        return $assigned->merge($team)->unique()->values();
    }

    public function canAccessProject(Project $project): bool
    {
        if ($this->hasGlobalProjectScope()) {
            return true;
        }

        return \App\Models\Project::query()
            ->visibleTo($this)
            ->whereKey($project->id)
            ->exists();
    }

    public function isDev(): bool
    {
        return $this->role === self::ROLE_DEV;
    }

    public function isHseManager(): bool
    {
        return in_array($this->role, [self::ROLE_HSE_MANAGER, self::ROLE_REGIONAL_HSE_MANAGER], true);
    }

    public function isRegionalHseManager(): bool
    {
        return $this->role === self::ROLE_REGIONAL_HSE_MANAGER;
    }

    public function isResponsable(): bool
    {
        return $this->role === self::ROLE_RESPONSABLE;
    }

    public function isUser(): bool
    {
        return $this->role === self::ROLE_USER;
    }

    public function isSupervisor(): bool
    {
        return $this->role === self::ROLE_SUPERVISOR;
    }

    public function isHR(): bool
    {
        return $this->role === self::ROLE_HR;
    }

    /**
     * Check if user can access workers management
     */
    public function canAccessWorkers(): bool
    {
        return $this->isAdmin() || in_array($this->role, self::WORKERS_ACCESS_ROLES);
    }

    /**
     * Check if user has any project affiliation
     */
    public function hasProjectAccess(): bool
    {
        return $this->projects()->exists() || $this->teamProjects()->exists();
    }

    /**
     * Check if user can access work permits
     */
    public function canAccessWorkPermits(): bool
    {
        return $this->isAdminLike() || $this->isHseManager() || $this->isRegionalHseManager() || $this->isResponsable() || $this->isSupervisor();
    }

    // Relationships
    public function projects()
    {
        return $this->belongsToMany(Project::class, 'project_user')
            ->withPivot('assigned_at')
            ->withTimestamps();
    }

    public function kpiReports()
    {
        return $this->hasMany(KpiReport::class, 'submitted_by');
    }

    public function dailyKpiSnapshots()
    {
        return $this->hasMany(DailyKpiSnapshot::class, 'submitted_by');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    /**
     * Projects where user is a team member (HSE Officers)
     */
    public function teamProjects()
    {
        return $this->belongsToMany(Project::class, 'project_teams')
            ->withPivot('added_by', 'created_at')
            ->withTimestamps();
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeAdmins($query)
    {
        return $query->where('role', self::ROLE_ADMIN);
    }

    public function scopeResponsables($query)
    {
        return $query->where('role', self::ROLE_RESPONSABLE);
    }

    public function scopeHseManagers($query)
    {
        return $query->whereIn('role', [self::ROLE_HSE_MANAGER, self::ROLE_REGIONAL_HSE_MANAGER]);
    }

    public function scopeHseOfficers($query)
    {
        return $query->where('role', self::ROLE_USER);
    }

    public function scopeSupervisors($query)
    {
        return $query->where('role', self::ROLE_SUPERVISOR);
    }

    public function scopeCreatableByHseManager($query)
    {
        return $query->whereIn('role', self::HSE_MANAGER_CREATABLE_ROLES);
    }

    public function scopeCreatableByResponsable($query)
    {
        return $query->whereIn('role', self::RESPONSABLE_CREATABLE_ROLES);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function createdUsers()
    {
        return $this->hasMany(User::class, 'created_by');
    }

    public function sorReports()
    {
        return $this->hasMany(SorReport::class, 'submitted_by');
    }

    public function workPermits()
    {
        return $this->hasMany(WorkPermit::class, 'created_by');
    }
}
