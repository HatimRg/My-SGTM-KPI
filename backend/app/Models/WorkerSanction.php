<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class WorkerSanction extends Model
{
    use HasFactory;

    protected $fillable = [
        'worker_id',
        'project_id',
        'sanction_date',
        'reason',
        'sanction_type',
        'mise_a_pied_days',
        'document_path',
        'created_by',
    ];

    protected $casts = [
        'sanction_date' => 'date',
        'mise_a_pied_days' => 'integer',
    ];

    protected $appends = ['document_url'];

    public function worker()
    {
        return $this->belongsTo(Worker::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getDocumentUrlAttribute(): ?string
    {
        if (!$this->document_path) {
            return null;
        }

        $url = Storage::disk('public')->url($this->document_path);
        if (is_string($url) && str_starts_with($url, 'http')) {
            $parsed = parse_url($url);
            $path = $parsed['path'] ?? null;
            $query = isset($parsed['query']) ? ('?' . $parsed['query']) : '';
            return $path ? ($path . $query) : $url;
        }

        return $url;
    }
}
