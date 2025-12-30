<?php

namespace Database\Seeders;

use App\Models\MachineDocumentKey;
use Illuminate\Database\Seeder;

class MachineDocumentKeySeeder extends Seeder
{
    public function run(): void
    {
        $keys = [
            ['key' => 'rapport_reglementaire', 'label' => 'Rapport reglementaire', 'sort_order' => 10],
            ['key' => 'assurance', 'label' => 'Assurance', 'sort_order' => 20],
            ['key' => 'visite_technique', 'label' => 'Visite technique', 'sort_order' => 30],
            ['key' => 'carnet_maintenance', 'label' => 'Carnet de maintenance', 'sort_order' => 40],
            ['key' => 'fiche_technique', 'label' => 'Fiche technique', 'sort_order' => 50],
            ['key' => 'carte_grise', 'label' => 'Carte grise', 'sort_order' => 60],
            ['key' => 'permis_operateur', 'label' => 'Permis d\'operateur', 'sort_order' => 70],
            ['key' => 'other', 'label' => 'Other', 'sort_order' => 1000],
        ];

        $allowed = array_map(fn ($r) => $r['key'], $keys);
        MachineDocumentKey::query()
            ->whereNotIn('key', $allowed)
            ->update(['is_active' => false]);

        foreach ($keys as $row) {
            MachineDocumentKey::updateOrCreate(
                ['key' => $row['key']],
                [
                    'label' => $row['label'],
                    'sort_order' => $row['sort_order'],
                    'is_active' => true,
                ]
            );
        }
    }
}
