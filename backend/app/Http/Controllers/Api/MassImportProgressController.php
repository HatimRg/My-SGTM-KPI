<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MassImportProgressService;
use Illuminate\Http\Request;

class MassImportProgressController extends Controller
{
    public function show(Request $request, string $progressId)
    {
        $request->user();

        $service = new MassImportProgressService();
        $progress = $service->get($progressId);

        if (!$progress) {
            return $this->error('Progress not found', 404);
        }

        return $this->success($progress);
    }
}
