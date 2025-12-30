<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Machine extends Model
{
    use HasFactory;

    protected $fillable = [
        'serial_number',
        'internal_code',
        'machine_type',
        'brand',
        'model',
        'project_id',
        'is_active',
        'image_path',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    protected $appends = ['image_url'];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function documents()
    {
        return $this->hasMany(MachineDocument::class);
    }

    public function inspections()
    {
        return $this->hasMany(MachineInspection::class);
    }

    public function operators()
    {
        return $this->belongsToMany(Worker::class, 'machine_worker')
            ->withPivot(['assigned_at', 'created_by'])
            ->withTimestamps();
    }

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image_path) {
            return null;
        }

        return Storage::disk('public')->url($this->image_path);
    }
}
