<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\WorkerTraining;

class Worker extends Model
{
    use HasFactory;

    protected $fillable = [
        'nom',
        'prenom',
        'fonction',
        'cin',
        'date_naissance',
        'entreprise',
        'project_id',
        'date_entree',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'date_naissance' => 'date',
        'date_entree' => 'date',
        'is_active' => 'boolean',
    ];

    protected $appends = ['full_name'];

    /**
     * Get the worker's full name
     */
    public function getFullNameAttribute(): string
    {
        return "{$this->prenom} {$this->nom}";
    }

    /**
     * Project relationship
     */
    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Creator relationship
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Updater relationship
     */
    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function trainings()
    {
        return $this->hasMany(WorkerTraining::class);
    }

    /**
     * Scope for active workers
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope for inactive workers
     */
    public function scopeInactive($query)
    {
        return $query->where('is_active', false);
    }

    /**
     * Scope by project
     */
    public function scopeForProject($query, $projectId)
    {
        return $query->where('project_id', $projectId);
    }

    /**
     * Scope by enterprise
     */
    public function scopeForEnterprise($query, $entreprise)
    {
        return $query->where('entreprise', $entreprise);
    }

    /**
     * Search scope
     */
    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('nom', 'like', "%{$search}%")
              ->orWhere('prenom', 'like', "%{$search}%")
              ->orWhere('cin', 'like', "%{$search}%")
              ->orWhere('fonction', 'like', "%{$search}%")
              ->orWhere('entreprise', 'like', "%{$search}%");
        });
    }

    /**
     * Find or merge by CIN
     * If worker with same CIN exists, update it with new data
     */
    public static function findOrMergeByCin(array $data, int $userId): self
    {
        $existingWorker = self::where('cin', $data['cin'])->first();

        if ($existingWorker) {
            // Merge: update with new data, keeping non-null values
            $existingWorker->update(array_merge($data, ['updated_by' => $userId]));
            return $existingWorker;
        }

        // Create new worker
        return self::create(array_merge($data, [
            'created_by' => $userId,
            'updated_by' => $userId,
        ]));
    }
}
