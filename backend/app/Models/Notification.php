<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'project_id',
        'title',
        'message',
        'type',
        'icon',
        'data',
        'action_url',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    // Type constants
    const TYPE_INFO = 'info';
    const TYPE_WARNING = 'warning';
    const TYPE_SUCCESS = 'success';
    const TYPE_ERROR = 'error';
    const TYPE_SYSTEM = 'system';
    const TYPE_REMINDER = 'reminder';
    const TYPE_KPI_SUBMITTED = 'kpi_submitted';
    const TYPE_KPI_APPROVED = 'kpi_approved';
    const TYPE_KPI_REJECTED = 'kpi_rejected';
    const TYPE_PROJECT_ASSIGNED = 'project_assigned';
    const TYPE_SOR_SUBMITTED = 'sor_submitted';
    const TYPE_SOR_CORRECTED = 'sor_corrected';
    const TYPE_TRAINING_SUBMITTED = 'training_submitted';
    const TYPE_AWARENESS_SUBMITTED = 'awareness_submitted';
    const TYPE_WORKER_TRAINING_EXPIRING = 'worker_training_expiring';
    const TYPE_WORKER_TRAINING_EXPIRED = 'worker_training_expired';

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    // Scopes
    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }

    public function scopeRead($query)
    {
        return $query->whereNotNull('read_at');
    }

    // Methods
    public function markAsRead()
    {
        $this->update(['read_at' => now()]);
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }
}
