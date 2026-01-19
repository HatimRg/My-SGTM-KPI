<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LightingMeasurement extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'entered_by',
        'measured_at',
        'year',
        'month',
        'location',
        'lux_value',
        'threshold',
        'is_compliant',
        'notes',
    ];

    protected $casts = [
        'measured_at' => 'date',
        'year' => 'integer',
        'month' => 'integer',
        'lux_value' => 'decimal:2',
        'threshold' => 'decimal:2',
        'is_compliant' => 'boolean',
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
