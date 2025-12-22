<?php

namespace App\Exports\Sheets\HseWeekly;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;

class CategoriesEcartsSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize
{
    public function array(): array
    {
        // Standard HSE deviation categories
        $categories = [
            ['1', 'EPI', 'Équipement de Protection Individuelle', 'Non-port ou mauvaise utilisation des EPI', 'Sécurité', 'Oui'],
            ['2', 'HAUTEUR', 'Travail en Hauteur', 'Écarts liés aux travaux en hauteur', 'Sécurité', 'Oui'],
            ['3', 'ELECT', 'Risque Électrique', 'Écarts liés aux installations électriques', 'Sécurité', 'Oui'],
            ['4', 'INCENDIE', 'Risque Incendie', 'Écarts liés à la prévention incendie', 'Sécurité', 'Oui'],
            ['5', 'CHIMIQUE', 'Risque Chimique', 'Manipulation produits chimiques', 'Sécurité', 'Oui'],
            ['6', 'MANUT', 'Manutention', 'Levage et manutention manuelle/mécanique', 'Sécurité', 'Oui'],
            ['7', 'CIRC', 'Circulation', 'Circulation piétons et véhicules', 'Sécurité', 'Oui'],
            ['8', 'FOUILLE', 'Travaux de Fouille', 'Excavations et tranchées', 'Sécurité', 'Oui'],
            ['9', 'ECHAF', 'Échafaudage', 'Montage et utilisation échafaudages', 'Sécurité', 'Oui'],
            ['10', 'ORDRE', 'Ordre et Propreté', 'Rangement et propreté du chantier', 'Sécurité', 'Oui'],
            ['11', 'BRUIT', 'Nuisances Sonores', 'Exposition au bruit', 'Sécurité', 'Oui'],
            ['12', 'POUS', 'Poussières', 'Exposition aux poussières', 'Sécurité', 'Oui'],
            ['13', 'DECHET', 'Gestion Déchets', 'Tri et évacuation des déchets', 'Environnement', 'Oui'],
            ['14', 'EAU', 'Pollution Eau', 'Risque de pollution des eaux', 'Environnement', 'Oui'],
            ['15', 'SOL', 'Pollution Sol', 'Risque de pollution des sols', 'Environnement', 'Oui'],
            ['16', 'ENERGIE', 'Consommation Énergie', 'Gaspillage énergie', 'Environnement', 'Oui'],
            ['17', 'CONF', 'Espace Confiné', 'Travaux en espace confiné', 'Sécurité', 'Oui'],
            ['18', 'PERMIS', 'Permis de Travail', 'Absence ou non-conformité permis', 'Sécurité', 'Oui'],
            ['19', 'FORM', 'Formation', 'Absence de formation requise', 'Sécurité', 'Oui'],
            ['20', 'AUTRE', 'Autre', 'Autres types d\'écarts', 'Général', 'Oui'],
        ];

        $rows = [
            ['CATEGORIES DES RELEVES D\'ECARTS'],
            ['Table de référence pour les validations'],
            [''],
            ['ID', 'CODE_CATEGORIE', 'LIBELLE', 'DESCRIPTION', 'TYPE', 'ACTIF'],
        ];

        foreach ($categories as $category) {
            $rows[] = $category;
        }

        return $rows;
    }

    public function title(): string
    {
        return 'CATEGORIES ECARTS';
    }

    public function styles(Worksheet $sheet)
    {
        $sheet->mergeCells('A1:F1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->getStyle('A4:F4')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '374151']],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        $sheet->freezePane('A5');

        $lastRow = $sheet->getHighestRow();
        for ($row = 5; $row <= $lastRow; $row++) {
            if ($row % 2 == 1) {
                $sheet->getStyle("A{$row}:F{$row}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F9FAFB']],
                ]);
            }
            $sheet->getStyle("A{$row}:F{$row}")->applyFromArray([
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]],
            ]);
        }

        return [];
    }
}
