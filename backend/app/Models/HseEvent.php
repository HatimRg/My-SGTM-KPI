<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class HseEvent extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'entered_by',
        'event_date',
        'event_year',
        'event_month',
        'week_number',
        'week_year',
        'pole',
        'type',
        'description',
        'severity',
        'lost_time',
        'lost_days',
        'location',
    ];

    protected $casts = [
        'event_date' => 'date',
        'event_year' => 'integer',
        'event_month' => 'integer',
        'week_number' => 'integer',
        'week_year' => 'integer',
        'lost_time' => 'boolean',
        'lost_days' => 'integer',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'entered_by');
    }
}
