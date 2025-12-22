<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SorReport extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'submitted_by',
        'company',
        'observation_date',
        'observation_time',
        'zone',
        'supervisor',
        'non_conformity',
        'photo_path',
        'category',
        'responsible_person',
        'deadline',
        'corrective_action',
        'corrective_action_date',
        'corrective_action_time',
        'corrective_action_photo_path',
        'status',
        'is_pinned',
        'pinned_at',
        'closed_at',
        'closed_by',
        'notes',
    ];

    protected $casts = [
        'observation_date' => 'date',
        'deadline' => 'date',
        'corrective_action_date' => 'date',
        'is_pinned' => 'boolean',
        'pinned_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    // Status constants
    const STATUS_OPEN = 'open';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_CLOSED = 'closed';

    // Category constants (from Page 5)
    const CATEGORIES = [
        'nettoyage_rangement' => 'Nettoyage et Rangement',
        'protection_chute' => 'Protection contre les chute',
        'echafaudage' => 'Echafaudage/Echelles/Escaliers',
        'epi' => 'Equipements de Protection Individuel',
        'excavations' => 'Excavations',
        'levage' => 'Levage',
        'methode_travail' => 'Méthode de travail - SPA',
        'manutention' => 'Manutention',
        'vehicule_transport' => 'Vehicule/Transport',
        'outils_equipements' => 'Outils/Equipements',
        'chute_trebuchement' => 'Chute & Trébuchement',
        'electricite' => 'Electricité',
        'protection_incendie' => 'Protection Incendie',
        'communication_attitude' => 'Communication/Attitude',
        'acces_passage' => 'Accès/Passage/Issues de Secours',
        'formation_toolbox' => 'Formation/Toolbox/Réunion',
        'inspection_evaluation' => 'Inspection et Evaluation',
        'documentation_hse' => 'Documentation HSE & Evaluation',
        'gestion_sous_traitants' => 'Gestion des sous-traitants',
        'autre' => 'Autre',
    ];

    // Relationships
    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function closer()
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    // Scopes
    public function scopeForProject($query, $projectId)
    {
        return $query->where('project_id', $projectId);
    }

    public function scopeOpen($query)
    {
        return $query->where('status', self::STATUS_OPEN);
    }

    public function scopeInProgress($query)
    {
        return $query->where('status', self::STATUS_IN_PROGRESS);
    }

    public function scopeClosed($query)
    {
        return $query->where('status', self::STATUS_CLOSED);
    }

    public function scopeOverdue($query)
    {
        return $query->where('status', '!=', self::STATUS_CLOSED)
                     ->whereNotNull('deadline')
                     ->where('deadline', '<', now());
    }

    // Scopes for pinned
    public function scopePinned($query)
    {
        return $query->where('is_pinned', true);
    }

    // Accessors
    protected $appends = ['photo_url', 'corrective_action_photo_url', 'photo_view_url', 'corrective_action_photo_view_url', 'closer_name', 'submitter_name'];

    public function getCloserNameAttribute()
    {
        return $this->closer ? $this->closer->name : null;
    }

    public function getSubmitterNameAttribute()
    {
        return $this->submitter ? $this->submitter->name : null;
    }

    public function getPhotoUrlAttribute()
    {
        if ($this->photo_path) {
            return asset('storage/' . $this->photo_path);
        }
        return null;
    }

    public function getPhotoViewUrlAttribute()
    {
        if ($this->photo_path) {
            return '/sor-reports/' . $this->id . '/photo';
        }
        return null;
    }

    public function getCorrectiveActionPhotoUrlAttribute()
    {
        if ($this->corrective_action_photo_path) {
            return asset('storage/' . $this->corrective_action_photo_path);
        }
        return null;
    }

    public function getCorrectiveActionPhotoViewUrlAttribute()
    {
        if ($this->corrective_action_photo_path) {
            return '/sor-reports/' . $this->id . '/corrective-photo';
        }
        return null;
    }
}
