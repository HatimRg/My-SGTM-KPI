<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class WorkerTraining extends Model
{
    use HasFactory;

    protected $fillable = [
        'worker_id',
        'training_type',
        'training_label',
        'training_date',
        'expiry_date',
        'certificate_path',
        'created_by',
    ];

    protected $casts = [
        'training_date' => 'date',
        'expiry_date' => 'date',
    ];

    protected $appends = ['certificate_url', 'status'];

    public function worker()
    {
        return $this->belongsTo(Worker::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getCertificateUrlAttribute(): ?string
    {
        if (!$this->certificate_path) {
            return null;
        }

        return Storage::disk('public')->url($this->certificate_path);
    }

    public function getStatusAttribute(): string
    {
        if (!$this->expiry_date) {
            return 'no_expiry';
        }

        $today = now()->startOfDay();
        $expiringLimit = now()->addDays(30)->endOfDay();

        if ($this->expiry_date->lt($today)) {
            return 'expired';
        }

        if ($this->expiry_date->between($today, $expiringLimit)) {
            return 'expiring';
        }

        return 'valid';
    }
}
