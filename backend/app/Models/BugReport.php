<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BugReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'role',
        'projects',
        'comment',
        'severity',
        'impact',
        'reproducibility',
        'extra_notes',
        'started_at',
        'ended_at',
        'duration_seconds',
        'console_logs',
        'network_logs',
        'route_logs',
        'metadata',
        'attachment_path',
        'attachment_original_name',
        'attachment_mime',
        'attachment_size',
    ];

    protected $casts = [
        'projects' => 'array',
        'console_logs' => 'array',
        'network_logs' => 'array',
        'route_logs' => 'array',
        'metadata' => 'array',
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
