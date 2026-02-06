<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'sent_by',
        'project_id',
        'title',
        'message',
        'type',
        'urgency',
        'dedupe_key',
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
    const TYPE_URGENT = 'urgent';
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

    const TYPE_PPE_LOW_STOCK = 'ppe_low_stock';

    const TYPE_EFFECTIF_MISSING = 'effectif_missing';
    const TYPE_DAILY_EFFECTIF_MISSING = 'daily_effectif_missing';

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sent_by');
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
