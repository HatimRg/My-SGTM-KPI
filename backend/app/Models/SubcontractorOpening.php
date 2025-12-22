<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SubcontractorOpening extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'contractor_name',
        'work_type',
        'contractor_start_date',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'contractor_start_date' => 'date',
    ];

    protected $appends = [
        'required_documents',
        'required_documents_count',
    ];

    public const EXPIRING_DAYS = 30;

    public const REQUIRED_DOCUMENTS = [
        [
            'key' => 'attestation_assurance',
            'label' => "Attestation d’assurance (AT/RC/TRC)*",
        ],
        [
            'key' => 'plan_hse_annexe_s',
            'label' => 'Plan HSE conformément aux exigences contractuelles « Annexe S »',
        ],
        [
            'key' => 'pic',
            'label' => 'Plan d’installation du chantier PIC',
        ],
        [
            'key' => 'organigramme_equipe',
            'label' => 'Organigramme de l’équipe sur chantier',
        ],
        [
            'key' => 'organisation_hse_cvs',
            'label' => 'Organisation HSE Projet, CV’s des Responsables HSE',
        ],
        [
            'key' => 'liste_personnels_autorises',
            'label' => 'Liste des personnels autorisées à accéder au site',
        ],
        [
            'key' => 'engagement_institution_medicale',
            'label' => 'Engagement d’une institution médicale sur la même ville',
        ],
        [
            'key' => 'convention_ambulance',
            'label' => 'Convention d’Ambulance',
        ],
        [
            'key' => 'aptitude_physique',
            'label' => 'Aptitude physique des travailleurs',
        ],
        [
            'key' => 'prise_en_charge_assureur',
            'label' => 'Prise en charge cachetée par l’assureur',
        ],
        [
            'key' => 'liste_agents_cnss_valides',
            'label' => 'Liste nominative des agents validés auprès de la CNSS',
        ],
        [
            'key' => 'engagement_declaration_recrues_cnss',
            'label' => 'Engagement de déclaration des nouvelles recrues cacheté par la CNSS',
        ],
        [
            'key' => 'copie_contrat_medecin_travail',
            'label' => 'Copie de contrat liant l’entreprise à son médecin de travail',
        ],
        [
            'key' => 'liste_moyens_materiels',
            'label' => 'Liste des moyens matériels autorisés à accéder au site',
        ],
        [
            'key' => 'equipements_engins',
            'label' => 'Equipements et Engins à utiliser et à monter sur site',
        ],
        [
            'key' => 'fiche_induction_employes',
            'label' => 'Fiche d’induction des employées de l’entreprise avant accès sur site',
        ],
        [
            'key' => 'liste_produits_chimiques_fds',
            'label' => 'Liste des produits chimiques à utiliser sur site et leurs *FDS',
        ],
        [
            'key' => 'permis_fouille',
            'label' => 'Autorisation ou permis de fouille délivré par les entités concernées avant excavation',
        ],
        [
            'key' => 'fiche_signee_cachetee',
            'label' => 'La présente fiche signée et cacheté',
        ],
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function documents()
    {
        return $this->hasMany(SubcontractorOpeningDocument::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function getRequiredDocumentsAttribute(): array
    {
        return self::REQUIRED_DOCUMENTS;
    }

    public function getRequiredDocumentsCountAttribute(): int
    {
        return count(self::REQUIRED_DOCUMENTS);
    }
}
