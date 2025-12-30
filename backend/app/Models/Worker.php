<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\WorkerTraining;
use App\Models\WorkerQualification;
use App\Models\WorkerMedicalAptitude;

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
        'image_path',
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

    public function qualifications()
    {
        return $this->hasMany(WorkerQualification::class);
    }

    public function medicalAptitudes()
    {
        return $this->hasMany(WorkerMedicalAptitude::class);
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
     * Apply the Worker Management filters to a query.
     *
     * This is used by the list, statistics, and export endpoints so they all stay consistent.
     *
     * Supported filters (array keys):
     * - visible_project_ids: array<int>
     * - search, project_id, pole, entreprise, fonction, is_active
     * - training_type, training_label, training_presence (has|missing), training_expiry (any|valid|expired)
     * - qualification_type, qualification_presence (has|missing), qualification_expiry (any|valid|expired)
     * - medical_presence (has|missing), medical_status (apte|inapte|any), medical_expiry (any|valid|expired)
     * - expired_filter (any|only_expired|without_expired): checks expiry across trainings/qualifications/medical.
     */
    public function scopeApplyFilters($query, array $filters)
    {
        $today = now()->startOfDay();

        // Project visibility scoping (directors / assigned-only users)
        if (array_key_exists('visible_project_ids', $filters) && is_array($filters['visible_project_ids'])) {
            $ids = $filters['visible_project_ids'];
            if (count($ids) === 0) {
                return $query->whereRaw('1=0');
            }
            $query->whereIn('project_id', $ids);
        }

        // Basic filters
        if (!empty($filters['search'])) {
            $query->search($filters['search']);
        }

        if (!empty($filters['project_id'])) {
            $query->forProject($filters['project_id']);
        }

        if (($pole = $filters['pole'] ?? null) !== null && $pole !== '') {
            $query->whereHas('project', function ($q) use ($pole) {
                $q->where('pole', $pole);
            });
        }

        if (!empty($filters['entreprise'])) {
            $query->forEnterprise($filters['entreprise']);
        }

        if (!empty($filters['fonction'])) {
            $query->where('fonction', 'like', '%' . $filters['fonction'] . '%');
        }

        if (array_key_exists('is_active', $filters) && $filters['is_active'] !== null) {
            $query->where('is_active', (bool) $filters['is_active']);
        }

        // Trainings filter (by training_type and optional label)
        if (!empty($filters['training_type'])) {
            $type = (string) $filters['training_type'];
            $label = (string) ($filters['training_label'] ?? '');
            $presence = (string) ($filters['training_presence'] ?? 'has');
            $expiry = (string) ($filters['training_expiry'] ?? 'any');

            $trainingConstraint = function ($q) use ($type, $label, $expiry, $today) {
                $q->where('training_type', $type);
                if ($label !== '') {
                    $q->where('training_label', $label);
                }
                if ($expiry === 'valid') {
                    $q->where(function ($d) use ($today) {
                        $d->whereNull('expiry_date')->orWhere('expiry_date', '>=', $today);
                    });
                } elseif ($expiry === 'expired') {
                    $q->whereNotNull('expiry_date')->where('expiry_date', '<', $today);
                }
            };

            if ($presence === 'missing') {
                $query->whereDoesntHave('trainings', $trainingConstraint);
            } else {
                $query->whereHas('trainings', $trainingConstraint);
            }
        }

        // Qualifications filter
        if (!empty($filters['qualification_type'])) {
            $type = (string) $filters['qualification_type'];
            $presence = (string) ($filters['qualification_presence'] ?? 'has');
            $expiry = (string) ($filters['qualification_expiry'] ?? 'any');

            $qualificationConstraint = function ($q) use ($type, $expiry, $today) {
                $q->where('qualification_type', $type);
                if ($expiry === 'valid') {
                    $q->where(function ($d) use ($today) {
                        $d->whereNull('expiry_date')->orWhere('expiry_date', '>=', $today);
                    });
                } elseif ($expiry === 'expired') {
                    $q->whereNotNull('expiry_date')->where('expiry_date', '<', $today);
                }
            };

            if ($presence === 'missing') {
                $query->whereDoesntHave('qualifications', $qualificationConstraint);
            } else {
                $query->whereHas('qualifications', $qualificationConstraint);
            }
        }

        // Medical aptitude filter
        if (!empty($filters['medical_presence'])) {
            $presence = (string) $filters['medical_presence'];
            $status = (string) ($filters['medical_status'] ?? 'any');
            $expiry = (string) ($filters['medical_expiry'] ?? 'any');

            $medicalConstraint = function ($q) use ($status, $expiry, $today) {
                if ($status === 'apte' || $status === 'inapte') {
                    $q->where('aptitude_status', $status);
                }
                if ($expiry === 'valid') {
                    $q->where(function ($d) use ($today) {
                        $d->whereNull('expiry_date')->orWhere('expiry_date', '>=', $today);
                    });
                } elseif ($expiry === 'expired') {
                    $q->whereNotNull('expiry_date')->where('expiry_date', '<', $today);
                }
            };

            if ($presence === 'missing') {
                $query->whereDoesntHave('medicalAptitudes', $medicalConstraint);
            } else {
                $query->whereHas('medicalAptitudes', $medicalConstraint);
            }
        }

        // Independent expired filter (any expired record in trainings/qualifications/medical)
        $expiredFilter = (string) ($filters['expired_filter'] ?? 'any');
        if ($expiredFilter === 'only_expired') {
            $query->where(function ($q) use ($today) {
                $q->whereHas('trainings', function ($t) use ($today) {
                    $t->whereNotNull('expiry_date')->where('expiry_date', '<', $today);
                })->orWhereHas('qualifications', function ($t) use ($today) {
                    $t->whereNotNull('expiry_date')->where('expiry_date', '<', $today);
                })->orWhereHas('medicalAptitudes', function ($t) use ($today) {
                    $t->whereNotNull('expiry_date')->where('expiry_date', '<', $today);
                });
            });
        } elseif ($expiredFilter === 'without_expired') {
            $query->whereDoesntHave('trainings', function ($t) use ($today) {
                $t->whereNotNull('expiry_date')->where('expiry_date', '<', $today);
            })->whereDoesntHave('qualifications', function ($t) use ($today) {
                $t->whereNotNull('expiry_date')->where('expiry_date', '<', $today);
            })->whereDoesntHave('medicalAptitudes', function ($t) use ($today) {
                $t->whereNotNull('expiry_date')->where('expiry_date', '<', $today);
            });
        }

        return $query;
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
