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
        'role',
        'phone',
        'avatar',
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
    const ROLE_RESPONSABLE = 'responsable';
    const ROLE_USER = 'user';
    const ROLE_SUPERVISOR = 'supervisor';
    const ROLE_ANIMATEUR = 'animateur';
    const ROLE_HR = 'hr';

    // Roles that responsable can create
    const RESPONSABLE_CREATABLE_ROLES = [
        self::ROLE_RESPONSABLE,
        self::ROLE_SUPERVISOR,
        self::ROLE_ANIMATEUR,
    ];

    // Roles that can access workers management
    const WORKERS_ACCESS_ROLES = [
        self::ROLE_RESPONSABLE,
        self::ROLE_SUPERVISOR,
        self::ROLE_HR,
    ];

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
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

    public function isAnimateur(): bool
    {
        return $this->role === self::ROLE_ANIMATEUR;
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
        return $this->isResponsable() || $this->isSupervisor();
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

    public function scopeHseOfficers($query)
    {
        return $query->where('role', self::ROLE_USER);
    }

    public function scopeSupervisors($query)
    {
        return $query->where('role', self::ROLE_SUPERVISOR);
    }

    public function scopeAnimateurs($query)
    {
        return $query->where('role', self::ROLE_ANIMATEUR);
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
