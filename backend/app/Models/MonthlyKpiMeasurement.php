<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MonthlyKpiMeasurement extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'entered_by',
        'year',
        'month',
        'indicator',
        'value',
        'method',
    ];

    protected $casts = [
        'year' => 'integer',
        'month' => 'integer',
        'value' => 'decimal:2',
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
