<?php

namespace App\Support;

class MachineTypeCatalog
{
    private const TYPES = [
        ['key' => 'ambulance', 'fr' => 'Ambulance', 'en' => 'Ambulance'],
        ['key' => 'ascenseur', 'fr' => 'Ascenseur', 'en' => 'Elevator'],
        ['key' => 'brise_roche_hydraulique', 'fr' => 'Brise-roche hydraulique', 'en' => 'Hydraulic breaker'],
        ['key' => 'bulldozer', 'fr' => 'Bulldozer', 'en' => 'Bulldozer'],
        ['key' => 'bus', 'fr' => 'Bus', 'en' => 'Bus'],
        ['key' => 'camion_atelier_entretien', 'fr' => 'Camion atelier (entretien)', 'en' => 'Workshop truck'],
        ['key' => 'camion_a_benne', 'fr' => 'Camion à benne', 'en' => 'Dump truck'],
        ['key' => 'camion_ampiroll', 'fr' => 'Camion ampiroll', 'en' => 'Roll-off truck'],
        ['key' => 'camion_citerne_eau', 'fr' => 'Camion citerne (eau)', 'en' => 'Water tanker truck'],
        ['key' => 'camion_citerne_gasoil', 'fr' => 'Camion citerne (gasoil)', 'en' => 'Fuel tanker truck'],
        ['key' => 'camion_de_servitude', 'fr' => 'Camion de servitude', 'en' => 'Service truck'],
        ['key' => 'camion_malaxeur_beton', 'fr' => 'Camion malaxeur béton', 'en' => 'Concrete mixer truck'],
        ['key' => 'camion_pompe_a_beton', 'fr' => 'Camion pompe à béton', 'en' => 'Concrete pump truck'],
        ['key' => 'camion_semi_remorque', 'fr' => 'Camion semi-remorque', 'en' => 'Semi-trailer truck'],
        ['key' => 'chariot_elevateur', 'fr' => 'Chariot élévateur', 'en' => 'Forklift'],
        ['key' => 'chariot_telescopique', 'fr' => 'Chariot télescopique', 'en' => 'Telescopic handler'],
        ['key' => 'chargeuse', 'fr' => 'Chargeuse', 'en' => 'Wheel loader'],
        ['key' => 'compacteur', 'fr' => 'Compacteur', 'en' => 'Compactor'],
        ['key' => 'compacteur_a_bille', 'fr' => 'Compacteur a bille', 'en' => 'Tandem roller'],
        ['key' => 'compresseur_air', 'fr' => 'Compresseur d’air', 'en' => 'Air compressor'],
        ['key' => 'concasseur', 'fr' => 'Concasseur', 'en' => 'Crusher'],
        ['key' => 'concasseur_mobile', 'fr' => 'Concasseur mobile', 'en' => 'Mobile crusher'],
        ['key' => 'central_a_beton', 'fr' => 'Central a béton', 'en' => 'Concrete batching plant'],
        ['key' => 'crible', 'fr' => 'Crible', 'en' => 'Screening plant'],
        ['key' => 'dame_sauteuse', 'fr' => 'Dame sauteuse', 'en' => 'Tamping rammer'],
        ['key' => 'dumper', 'fr' => 'Dumper', 'en' => 'Dumper'],
        ['key' => 'elevateur_de_charges', 'fr' => 'Élévateur de charges (monte-charge)', 'en' => 'Goods hoist'],
        ['key' => 'fabrique_de_glace', 'fr' => 'Fabrique de glace', 'en' => 'Ice making machine'],
        ['key' => 'fraiseuse_routiere', 'fr' => 'Fraiseuse routière', 'en' => 'Milling machine'],
        ['key' => 'groupe_electrogene', 'fr' => 'Groupe électrogène', 'en' => 'Generator set'],
        ['key' => 'groupe_de_refroidissement', 'fr' => 'Groupe de refroidissement', 'en' => 'Cooling unit'],
        ['key' => 'grue_a_tour', 'fr' => 'Grue à tour', 'en' => 'Tower crane'],
        ['key' => 'grue_mobile', 'fr' => 'Grue mobile', 'en' => 'Mobile crane'],
        ['key' => 'grue_sur_chenilles', 'fr' => 'Grue sur chenilles', 'en' => 'Crawler crane'],
        ['key' => 'grue_telescopique', 'fr' => 'Grue télescopique', 'en' => 'Telescopic crane'],
        ['key' => 'installation_lavage_sable', 'fr' => 'Installation de lavage de sable', 'en' => 'Sand washing plant'],
        ['key' => 'malaxeur_a_beton', 'fr' => 'Malaxeur à béton', 'en' => 'Concrete mixer'],
        ['key' => 'mini_chargeuse', 'fr' => 'Mini-chargeuse', 'en' => 'Skid steer loader'],
        ['key' => 'mini_dumper', 'fr' => 'Mini-dumper', 'en' => 'Mini dumper'],
        ['key' => 'mini_pelle', 'fr' => 'Mini-pelle', 'en' => 'Mini excavator'],
        ['key' => 'minibus', 'fr' => 'Minibus', 'en' => 'Minibus'],
        ['key' => 'nacelle_articulee', 'fr' => 'Nacelle articulée', 'en' => 'Articulated boom lift'],
        ['key' => 'nacelle_a_ciseaux', 'fr' => 'Nacelle à ciseaux', 'en' => 'Scissor lift'],
        ['key' => 'nacelle_elevatrice', 'fr' => 'Nacelle élévatrice', 'en' => 'Aerial work platform'],
        ['key' => 'nacelle_telescopique', 'fr' => 'Nacelle télescopique', 'en' => 'Telescopic boom lift'],
        ['key' => 'niveleuse', 'fr' => 'Niveleuse', 'en' => 'Motor grader'],
        ['key' => 'pelle_hydraulique_sur_chenilles', 'fr' => 'Pelle hydraulique sur chenilles', 'en' => 'Crawler excavator'],
        ['key' => 'pelle_hydraulique_sur_pneus', 'fr' => 'Pelle hydraulique sur pneus', 'en' => 'Wheeled excavator'],
        ['key' => 'pick_up', 'fr' => 'Pick-up', 'en' => 'Pickup truck'],
        ['key' => 'plaque_vibrante', 'fr' => 'Plaque vibrante', 'en' => 'Plate compactor'],
        ['key' => 'pompe_a_beton_projete', 'fr' => 'Pompe à béton projeté', 'en' => 'Shotcrete pump'],
        ['key' => 'pompe_a_beton_stationnaire', 'fr' => 'Pompe à béton stationnaire', 'en' => 'Stationary concrete pump'],
        ['key' => 'pompe_a_eau', 'fr' => 'Pompe à eau', 'en' => 'Water pump'],
        ['key' => 'pompe_d_injection', 'fr' => 'Pompe d’injection', 'en' => 'Injection pump'],
        ['key' => 'poste_electrique_transformateur', 'fr' => 'Poste électrique / transformateur', 'en' => 'Electrical substation / transformer'],
        ['key' => 'remorque', 'fr' => 'Remorque', 'en' => 'Trailer'],
        ['key' => 'rouleau_vibrant', 'fr' => 'Rouleau vibrant', 'en' => 'Vibratory roller'],
        ['key' => 'scie_a_cable', 'fr' => 'Scie à câble', 'en' => 'Cable saw'],
        ['key' => 'sondeuse', 'fr' => 'Sondeuse', 'en' => 'Drilling rig'],
        ['key' => 'tour_d_eclairage', 'fr' => 'Tour d’éclairage', 'en' => 'Lighting tower'],
        ['key' => 'tractopelle', 'fr' => 'Tractopelle', 'en' => 'Backhoe loader'],
        ['key' => 'trancheuse', 'fr' => 'Trancheuse', 'en' => 'Trencher'],
        ['key' => 'vehicule_de_service', 'fr' => 'Véhicule de service', 'en' => 'Service vehicle'],
        ['key' => 'other', 'fr' => 'Autres', 'en' => 'Other'],
    ];

    public static function items(): array
    {
        return self::TYPES;
    }

    public static function keys(): array
    {
        return array_values(array_map(fn ($t) => (string) ($t['key'] ?? ''), self::TYPES));
    }

    public static function optionList(string $lang = 'fr'): array
    {
        $lang = strtolower(trim($lang));
        $lang = $lang === 'en' ? 'en' : 'fr';

        $options = array_values(array_filter(array_map(function ($t) use ($lang) {
            $key = (string) ($t['key'] ?? '');
            if ($key === '') {
                return null;
            }
            $label = (string) ($lang === 'en' ? ($t['en'] ?? $key) : ($t['fr'] ?? $key));
            $label = trim($label);
            return ['value' => $key, 'label' => $label];
        }, self::TYPES)));

        usort($options, function ($a, $b) {
            $aVal = (string) ($a['value'] ?? '');
            $bVal = (string) ($b['value'] ?? '');
            if ($aVal === 'other' && $bVal !== 'other') {
                return 1;
            }
            if ($bVal === 'other' && $aVal !== 'other') {
                return -1;
            }
            return strnatcasecmp((string) ($a['label'] ?? ''), (string) ($b['label'] ?? ''));
        });

        return $options;
    }

    public static function labels(string $lang = 'fr'): array
    {
        return array_values(array_map(fn ($o) => (string) $o['label'], self::optionList($lang)));
    }

    public static function labelForKey(string $key, string $lang = 'fr'): string
    {
        $lang = strtolower(trim($lang));
        $lang = $lang === 'en' ? 'en' : 'fr';

        foreach (self::TYPES as $t) {
            if ((string) ($t['key'] ?? '') === $key) {
                $label = (string) ($lang === 'en' ? ($t['en'] ?? $key) : ($t['fr'] ?? $key));
                $label = trim($label);
                return $label !== '' ? $label : $key;
            }
        }

        return $key;
    }

    public static function keyFromInput(?string $input): ?string
    {
        if ($input === null) {
            return null;
        }

        $raw = trim((string) $input);
        if ($raw === '') {
            return null;
        }

        $candidate = self::normalizeComparable($raw);
        if ($candidate === '') {
            return null;
        }

        foreach (self::TYPES as $t) {
            $key = (string) ($t['key'] ?? '');
            if ($key === '') {
                continue;
            }

            if (self::normalizeComparable($key) === $candidate) {
                return $key;
            }

            $fr = (string) ($t['fr'] ?? '');
            $en = (string) ($t['en'] ?? '');

            if ($fr !== '' && self::normalizeComparable($fr) === $candidate) {
                return $key;
            }
            if ($en !== '' && self::normalizeComparable($en) === $candidate) {
                return $key;
            }
        }

        return null;
    }

    private static function normalizeComparable(string $value): string
    {
        $v = trim(str_replace("\u{00A0}", ' ', $value));
        if ($v === '') {
            return '';
        }

        $ascii = function_exists('iconv') ? @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $v) : false;
        if (is_string($ascii) && $ascii !== '') {
            $v = $ascii;
        }

        $v = strtolower($v);
        $v = preg_replace('/[^a-z0-9]+/', '_', $v);
        $v = preg_replace('/_+/', '_', $v);
        $v = trim((string) $v, '_');

        return $v;
    }
}
