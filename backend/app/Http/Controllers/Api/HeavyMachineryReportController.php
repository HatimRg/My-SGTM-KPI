<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MachineDocument;
use App\Models\WorkerTraining;
use Illuminate\Http\Request;

class HeavyMachineryReportController extends Controller
{
    private const EXPIRING_DAYS = 30;

    public function expiredDocumentation(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            abort(401);
        }

        $visibleProjectIds = $user->visibleProjectIds();
        if ($visibleProjectIds !== null && count($visibleProjectIds) === 0) {
            return $this->success([
                'stats' => [
                    'expiring_count' => 0,
                    'expired_count' => 0,
                ],
                'projects' => [],
            ]);
        }

        $today = now()->startOfDay();
        $expiringLimit = now()->addDays(self::EXPIRING_DAYS)->endOfDay();

        $machineDocsQuery = MachineDocument::query()
            ->whereNotNull('expiry_date')
            ->with(['machine.project:id,name']);

        if ($visibleProjectIds !== null) {
            $machineDocsQuery->whereHas('machine', function ($q) use ($visibleProjectIds) {
                $q->whereIn('project_id', $visibleProjectIds);
            });
        }

        $workerTrainingsQuery = WorkerTraining::query()
            ->whereNotNull('expiry_date')
            ->with(['worker.project:id,name']);

        if ($visibleProjectIds !== null) {
            $workerTrainingsQuery->whereHas('worker', function ($q) use ($visibleProjectIds) {
                $q->whereIn('project_id', $visibleProjectIds);
            });
        }

        $machineDocs = $machineDocsQuery
            ->orderBy('expiry_date')
            ->get();

        $workerTrainings = $workerTrainingsQuery
            ->orderBy('expiry_date')
            ->get();

        $expiringCount = 0;
        $expiredCount = 0;

        $projects = [];

        foreach ($machineDocs as $doc) {
            $machine = $doc->machine;
            $project = $machine ? $machine->project : null;
            $projectId = $project ? (int) $project->id : 0;

            if (!$doc->expiry_date) {
                continue;
            }

            $isExpired = $doc->expiry_date->lt($today);
            $isExpiring = !$isExpired && $doc->expiry_date->between($today, $expiringLimit);

            if (!$isExpired && !$isExpiring) {
                continue;
            }

            if ($isExpired) {
                $expiredCount++;
            } else {
                $expiringCount++;
            }

            if (!array_key_exists($projectId, $projects)) {
                $projects[$projectId] = [
                    'project' => $project ? ['id' => $project->id, 'name' => $project->name] : null,
                    'machines' => [],
                    'operators' => [],
                ];
            }

            $machineId = $machine ? (int) $machine->id : 0;
            if (!array_key_exists($machineId, $projects[$projectId]['machines'])) {
                $projects[$projectId]['machines'][$machineId] = [
                    'machine' => $machine ? [
                        'id' => $machine->id,
                        'serial_number' => $machine->serial_number,
                        'internal_code' => $machine->internal_code,
                        'machine_type' => $machine->machine_type,
                        'brand' => $machine->brand,
                        'model' => $machine->model,
                    ] : null,
                    'documents' => [],
                ];
            }

            $projects[$projectId]['machines'][$machineId]['documents'][] = [
                'id' => $doc->id,
                'document_key' => $doc->document_key,
                'document_label' => $doc->document_label,
                'expiry_date' => optional($doc->expiry_date)->format('Y-m-d'),
                'status' => $doc->status,
            ];
        }

        foreach ($workerTrainings as $t) {
            if (!$t->expiry_date) {
                continue;
            }

            $isExpired = $t->expiry_date->lt($today);
            $isExpiring = !$isExpired && $t->expiry_date->between($today, $expiringLimit);

            if (!$isExpired && !$isExpiring) {
                continue;
            }

            if ($isExpired) {
                $expiredCount++;
            } else {
                $expiringCount++;
            }

            $worker = $t->worker;
            $project = $worker ? $worker->project : null;
            $projectId = $project ? (int) $project->id : 0;

            if (!array_key_exists($projectId, $projects)) {
                $projects[$projectId] = [
                    'project' => $project ? ['id' => $project->id, 'name' => $project->name] : null,
                    'machines' => [],
                    'operators' => [],
                ];
            }

            $workerId = $worker ? (int) $worker->id : 0;
            if (!array_key_exists($workerId, $projects[$projectId]['operators'])) {
                $projects[$projectId]['operators'][$workerId] = [
                    'worker' => $worker ? [
                        'id' => $worker->id,
                        'full_name' => $worker->full_name,
                        'cin' => $worker->cin,
                        'fonction' => $worker->fonction,
                    ] : null,
                    'trainings' => [],
                ];
            }

            $label = $t->training_type === 'other' ? ($t->training_label ?: 'Other') : $t->training_type;

            $projects[$projectId]['operators'][$workerId]['trainings'][] = [
                'id' => $t->id,
                'training_type' => $t->training_type,
                'training_label' => $label,
                'expiry_date' => optional($t->expiry_date)->format('Y-m-d'),
                'status' => $t->status,
            ];
        }

        $projectsOut = array_values(array_map(function ($p) {
            $p['machines'] = array_values($p['machines']);
            $p['operators'] = array_values($p['operators']);
            return $p;
        }, $projects));

        usort($projectsOut, function ($a, $b) {
            $aName = strtolower(trim((string) (($a['project']['name'] ?? '') ?: '')));
            $bName = strtolower(trim((string) (($b['project']['name'] ?? '') ?: '')));
            return $aName <=> $bName;
        });

        return $this->success([
            'stats' => [
                'expiring_count' => $expiringCount,
                'expired_count' => $expiredCount,
            ],
            'projects' => $projectsOut,
        ]);
    }
}
