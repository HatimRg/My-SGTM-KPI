<?php

namespace App\Support;

class ImportErrorTranslator
{
    public static function translate(?string $message, string $lang = 'fr'): ?string
    {
        if ($message === null) {
            return null;
        }

        $raw = trim((string) $message);
        if ($raw === '') {
            return $raw;
        }

        $lang = strtolower(trim($lang));
        if ($lang === 'en') {
            return $raw;
        }

        $map = [
            'Missing required fields' => 'Champs obligatoires manquants',
            'Duplicate CIN in import file' => 'CIN en double dans le fichier',
            'Duplicate EMAIL in import file' => 'Email en double dans le fichier',
            'Duplicate CODE in import file' => 'CODE en double dans le fichier',
            'Duplicate SERIAL_NUMBER in import file' => 'Numéro de série en double dans le fichier',
            'Invalid email' => 'Email invalide',
            'Invalid role' => 'Rôle invalide',
            'Invalid status' => 'Statut invalide',
            'Access denied' => 'Accès refusé',
            'Unknown project' => 'Projet inconnu',
            'Unknown project code' => 'Code projet inconnu',
            'Ambiguous project name' => 'Nom projet ambigu',
            'Project is required for your access scope' => 'Projet obligatoire selon votre périmètre',
            'Project not allowed for your access scope' => 'Projet non autorisé selon votre périmètre',
            'User not found' => 'Utilisateur introuvable',
            'Only HSE Officers (role=user) can be added' => 'Seuls les animateurs HSE (rôle=user) peuvent être ajoutés',
            'Password required for new user' => 'Mot de passe obligatoire pour un nouvel utilisateur',
            'Password does not meet complexity requirements for role' => 'Mot de passe ne respecte pas la complexité requise pour ce rôle',
            'One or more responsable emails not found' => 'Un ou plusieurs emails responsables introuvables',
            'INTERNAL_CODE already used by another machine' => 'Code interne déjà utilisé par une autre machine',
            'Invalid MACHINE_TYPE' => "Type d'engin invalide",
            'Invalid DATE' => 'DATE invalide',
            'Invalid OBSERVATION_DATE' => "Date d'observation invalide",
            'Invalid CATEGORY' => 'Catégorie invalide',
            'No data rows found in Excel' => 'Aucune ligne de données trouvée dans le fichier Excel',
            'Invalid template headers: please use the provided template' => "En-têtes du modèle invalides: veuillez utiliser le modèle fourni",
            'Future date not allowed' => 'Date future non autorisée',
            'Missing CIN' => 'CIN manquant',
            'Duplicate CIN in Excel' => 'CIN en double dans le fichier Excel',
            'Worker not found' => 'Ouvrier introuvable',
            'Failed to read PDF from ZIP' => 'Impossible de lire le PDF depuis le ZIP',
        ];

        foreach ($map as $en => $fr) {
            if ($raw === $en) {
                return $fr;
            }

            if (str_starts_with($raw, $en . ':')) {
                return $fr . ':' . substr($raw, strlen($en) + 1);
            }

            if (str_starts_with($raw, $en . ' (')) {
                return $fr . substr($raw, strlen($en));
            }
        }

        $prefixMap = [
            'Unknown project code:' => 'Code projet inconnu:',
            'Unknown project:' => 'Projet inconnu:',
            'Ambiguous project name:' => 'Nom projet ambigu:',
            'Invalid MACHINE_TYPE:' => "Type d'engin invalide:",
            'Invalid STATUS:' => 'Statut invalide:',
            'Invalid STATUS: ' => 'Statut invalide: ',
            'Invalid STATUS:' => 'Statut invalide:',
            'Invalid STATUS' => 'Statut invalide',
            'Invalid STATUS:' => 'Statut invalide:',
            'Invalid STATUS: ' => 'Statut invalide: ',
        ];

        foreach ($prefixMap as $enPrefix => $frPrefix) {
            if (str_starts_with($raw, $enPrefix)) {
                return $frPrefix . substr($raw, strlen($enPrefix));
            }
        }

        if (str_starts_with($raw, 'Unexpected error: ')) {
            return 'Erreur inattendue: ' . substr($raw, strlen('Unexpected error: '));
        }

        if (str_starts_with($raw, 'The ') && str_ends_with($raw, ' field is required.')) {
            $field = substr($raw, strlen('The '), -strlen(' field is required.'));
            return "Le champ {$field} est obligatoire.";
        }

        if ($raw === 'The email field must be a valid email address.') {
            return "Le champ email doit être une adresse email valide.";
        }

        return $raw;
    }
}
