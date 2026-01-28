<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\WasteExport;
use App\Services\AuditLogService;
use Illuminate\Http\Request;

class WasteExportController extends Controller
{
    private const WASTE_TYPES = [
        'banales',
        'bétons',
        'liquides sanitaires',
        'mélange banales',
        'ferraile',
        'huiles usées',
        'solides dangereux',
        'médicaux',
        'autre',
    ];

    private const TRANSPORT_METHODS = [
        'benne satellite',
        'camion hydrocureur',
        'camion plateau',
        'camion 8x4',
        'camion citerne',
        'remorque à benne',
        'autre',
    ];

    private const TREATMENTS = [
        'décharge',
        'incinération',
        'recyclage',
        'prétraitement + incinération',
        'recyclage sur chantier',
        'traitement physico-chimique',
        'régénération (huiles usées)',
        'valorisation (ferraile / mélange)',
        'stockage temporaire (dangereux / médicaux)',
        'neutralisation (dangereux)',
        'autre',
    ];

    public function index(Request $request)
    {
        $user = $request->user();

        $query = WasteExport::query();

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', (int) $request->project_id);
        }

        if ($request->filled('waste_type')) {
            $query->where('waste_type', $request->waste_type);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('date', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            if ($search !== '') {
                $query->where('plate_number', 'like', '%' . $search . '%');
            }
        }

        if ($request->boolean('include_archived')) {
            $query->withTrashed();
        }

        $perPage = (int) $request->get('per_page', 50);
        $perPage = max(5, min(100, $perPage));

        $rows = $query
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($perPage);

        $items = $rows->getCollection()->map(function (WasteExport $row) use ($user) {
            $canManage = $user->canManageProjectActions();
            $isOwner = (int) $row->created_by === (int) $user->id;

            $row->setAttribute('can_edit', $canManage || $isOwner);
            $row->setAttribute('can_delete', $canManage || $isOwner);
            return $row;
        });
        $rows->setCollection($items);

        return $this->paginated($rows);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user->isAdminLike() && !$user->isHseManager() && !$user->isRegionalHseManager() && !$user->isResponsable()) {
            return $this->error('Access denied', 403);
        }

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'date' => 'required|date',
            'waste_type' => 'required|in:' . implode(',', self::WASTE_TYPES),
            'waste_type_other' => 'required_if:waste_type,autre|nullable|string|max:255',
            'quantity' => 'required|numeric|gt:0',
            'trips_count' => 'required|integer|min:1',
            'transport_method' => 'required|in:' . implode(',', self::TRANSPORT_METHODS),
            'transport_method_other' => 'required_if:transport_method,autre|nullable|string|max:255',
            'plate_number' => 'required|string|max:50',
            'treatment' => 'required|in:' . implode(',', self::TREATMENTS),
            'treatment_other' => 'required_if:treatment,autre|nullable|string|max:255',
        ]);

        $project = Project::findOrFail((int) $validated['project_id']);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $row = WasteExport::create([
            'project_id' => (int) $validated['project_id'],
            'date' => $validated['date'],
            'waste_type' => $validated['waste_type'],
            'waste_type_other' => $validated['waste_type_other'] ?? null,
            'quantity' => $validated['quantity'],
            'trips_count' => (int) $validated['trips_count'],
            'transport_method' => $validated['transport_method'],
            'transport_method_other' => $validated['transport_method_other'] ?? null,
            'plate_number' => $validated['plate_number'],
            'treatment' => $validated['treatment'],
            'treatment_other' => $validated['treatment_other'] ?? null,
            'created_by' => $user->id,
        ]);

        $row->setAttribute('can_edit', true);
        $row->setAttribute('can_delete', true);

        AuditLogService::record($request, $row, 'create', null, $row->toArray());

        return $this->success($row, 'Waste export created successfully', 201);
    }

    public function update(Request $request, WasteExport $wasteExport)
    {
        $user = $request->user();

        $project = Project::findOrFail($wasteExport->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        if (!$user->canManageProjectActions() && $wasteExport->created_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $validated = $request->validate([
            'project_id' => 'sometimes|exists:projects,id',
            'date' => 'sometimes|date',
            'waste_type' => 'sometimes|in:' . implode(',', self::WASTE_TYPES),
            'waste_type_other' => 'required_if:waste_type,autre|nullable|string|max:255',
            'quantity' => 'sometimes|numeric|gt:0',
            'trips_count' => 'sometimes|integer|min:1',
            'transport_method' => 'sometimes|in:' . implode(',', self::TRANSPORT_METHODS),
            'transport_method_other' => 'required_if:transport_method,autre|nullable|string|max:255',
            'plate_number' => 'sometimes|string|max:50',
            'treatment' => 'sometimes|in:' . implode(',', self::TREATMENTS),
            'treatment_other' => 'required_if:treatment,autre|nullable|string|max:255',
        ]);

        if (array_key_exists('project_id', $validated)) {
            $newProject = Project::findOrFail((int) $validated['project_id']);
            if (!$user->canAccessProject($newProject)) {
                return $this->error('Access denied', 403);
            }
            $validated['project_id'] = (int) $validated['project_id'];
        }

        $old = $wasteExport->toArray();
        $wasteExport->update($validated);
        AuditLogService::record($request, $wasteExport, 'update', $old, $wasteExport->toArray());

        $fresh = $wasteExport->fresh();
        $canManage = $user->canManageProjectActions();
        $isOwner = (int) $fresh->created_by === (int) $user->id;
        $fresh->setAttribute('can_edit', $canManage || $isOwner);
        $fresh->setAttribute('can_delete', $canManage || $isOwner);

        return $this->success($fresh, 'Waste export updated successfully');
    }

    public function destroy(Request $request, WasteExport $wasteExport)
    {
        $user = $request->user();

        $project = Project::findOrFail($wasteExport->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        if (!$user->canManageProjectActions() && $wasteExport->created_by !== $user->id) {
            return $this->error('Access denied', 403);
        }

        $old = $wasteExport->toArray();
        $wasteExport->delete();
        AuditLogService::record($request, $wasteExport, 'delete', $old, null);

        return $this->success(null, 'Waste export archived successfully');
    }
}
