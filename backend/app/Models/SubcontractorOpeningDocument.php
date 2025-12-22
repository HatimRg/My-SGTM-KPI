<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class SubcontractorOpeningDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'subcontractor_opening_id',
        'document_key',
        'document_label',
        'start_date',
        'expiry_date',
        'file_path',
        'file_size',
        'compressed_size',
        'was_compressed',
        'uploaded_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'expiry_date' => 'date',
        'was_compressed' => 'boolean',
    ];

    protected $appends = ['file_url', 'status'];

    public function opening()
    {
        return $this->belongsTo(SubcontractorOpening::class, 'subcontractor_opening_id');
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

    public function getStatusAttribute(): string
    {
        if (!$this->expiry_date) {
            return 'no_expiry';
        }

        $today = now()->startOfDay();
        $expiringLimit = now()->addDays(SubcontractorOpening::EXPIRING_DAYS)->endOfDay();

        if ($this->expiry_date->lt($today)) {
            return 'expired';
        }

        if ($this->expiry_date->between($today, $expiringLimit)) {
            return 'expiring';
        }

        return 'valid';
    }
}
