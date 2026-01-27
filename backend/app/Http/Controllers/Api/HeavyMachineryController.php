<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MachineDocumentKey;
use App\Support\MachineTypeCatalog;
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

        $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));
        $format = strtolower(trim((string) $request->get('format', 'labels')));

        if ($format === 'options') {
            return $this->success(MachineTypeCatalog::optionList($lang));
        }

        return $this->success(MachineTypeCatalog::labels($lang));
    }
}
