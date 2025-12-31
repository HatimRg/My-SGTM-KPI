<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MachineDocumentKey;
use App\Models\Machine;
use Illuminate\Http\Request;

class HeavyMachineryController extends Controller
{
    private const DEFAULT_MACHINE_TYPES = [
        'Grue mobile',
        'Grue a tour',
        'Pelle sur chenille',
        'Pelle sur pneu',
        'Mini pelle',
        'Chargeuse',
        'Mini chargeuse',
        'Compresseur',
        'Compacteur',
        'Rouleaux vibrant',
        'Chariot élévateur',
        'Nacelle articulé',
        'Nacelle télescopique',
        'Nacelle ciseaux',
        'Bulldozer',
        'Camion a benne',
        'Camion citerne à eau',
        'Camion citerne à gasoil',
        'Tractopelle',
        'Autre',
    ];

    public function ping(Request $request)
    {
        return $this->success([
            'ok' => true,
        ]);
    }

    public function documentKeys(Request $request)
    {
        $list = MachineDocumentKey::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get(['key', 'label']);

        return $this->success($list);
    }

    public function machineTypes(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            abort(401);
        }

        $query = Machine::query()->whereNotNull('machine_type');

        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds instanceof \Illuminate\Support\Collection) {
            $visibleProjectIds = $visibleProjectIds->all();
        } elseif ($visibleProjectIds instanceof \Traversable) {
            $visibleProjectIds = iterator_to_array($visibleProjectIds);
        }

        if ($visibleProjectIds !== null) {
            if (count($visibleProjectIds) === 0) {
                return $this->success(self::DEFAULT_MACHINE_TYPES);
            }
            $query->whereIn('project_id', $visibleProjectIds);
        }

        $types = $query
            ->select('machine_type')
            ->distinct()
            ->orderBy('machine_type')
            ->pluck('machine_type')
            ->map(fn ($v) => trim((string) $v))
            ->filter(fn ($v) => $v !== '')
            ->values()
            ->toArray();

        $merged = array_values(array_unique(array_merge(self::DEFAULT_MACHINE_TYPES, $types)));
        sort($merged, SORT_NATURAL | SORT_FLAG_CASE);

        return $this->success($merged);
    }
}
