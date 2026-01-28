<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WasteExport extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'date',
        'waste_type',
        'waste_type_other',
        'quantity',
        'trips_count',
        'transport_method',
        'transport_method_other',
        'plate_number',
        'treatment',
        'treatment_other',
        'created_by',
    ];

    protected $hidden = [
        'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'quantity' => 'decimal:3',
        'trips_count' => 'integer',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
