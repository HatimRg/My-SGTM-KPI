<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class MachineInspection extends Model
{
    use HasFactory;

    protected $fillable = [
        'machine_id',
        'parent_id',
        'version',
        'start_date',
        'end_date',
        'file_path',
        'file_size',
        'uploaded_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    protected $appends = ['file_url'];

    public function machine()
    {
        return $this->belongsTo(Machine::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function getFileUrlAttribute(): ?string
    {
        if (!$this->file_path) {
            return null;
        }

        return Storage::disk('public')->url($this->file_path);
    }
}
