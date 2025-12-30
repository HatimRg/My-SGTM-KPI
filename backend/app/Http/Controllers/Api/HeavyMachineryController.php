<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MachineDocumentKey;
use App\Models\Machine;
use Illuminate\Http\Request;

class HeavyMachineryController extends Controller
{
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
        if ($visibleProjectIds !== null) {
            if (count($visibleProjectIds) === 0) {
                return $this->success([]);
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

        return $this->success($types);
    }
}
