<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\AwarenessSessionsExport;
use App\Exports\AwarenessSessionsFailedRowsExport;
use App\Exports\AwarenessSessionsTemplateExport;
use App\Imports\AwarenessSessionsImport;
use App\Models\AwarenessSession;
use App\Models\Project;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;

class AwarenessSessionController extends Controller
{
    /**
     * Get all awareness sessions with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = AwarenessSession::with(['project', 'submitter']);

        // Filter by user's projects if not admin
        if (!$user->hasGlobalProjectScope()) {
            $projectIds = $user->visibleProjectIds();
            if ($projectIds !== null) {
                $query->whereIn('project_id', $projectIds);
            }
        }

        // Apply filters
        if ($request->has('project_id') && $request->project_id) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->has('week') && $request->week) {
            $query->where('week_number', $request->week);
        }

        if ($request->has('year') && $request->year) {
            $query->where('week_year', $request->year);
        }

        if ($request->has('from_date')) {
            $query->where('date', '>=', $request->from_date);
        }

        if ($request->has('to_date')) {
            $query->where('date', '<=', $request->to_date);
        }

        // Order by date descending
        $sessions = $query->orderBy('date', 'desc')
                          ->paginate($request->get('per_page', 50));

        return response()->json($sessions);
    }

    public function export(Request $request)
    {
        $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'week' => 'nullable|integer|min:1|max:53',
            'year' => 'nullable|integer|min:2020|max:2100',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
        ]);

        $user = $request->user();
        $projectIds = $user ? $user->visibleProjectIds() : null;
        if ($projectIds !== null) {
            if (count($projectIds) === 0) {
                return response()->json(['message' => 'No projects available'], 422);
            }
            if ($request->filled('project_id') && !in_array((int) $request->project_id, array_map('intval', $projectIds), true)) {
                abort(403, 'Access denied');
            }
        }

        $filters = [
            'visible_project_ids' => $projectIds,
            'project_id' => $request->get('project_id'),
            'week' => $request->get('week'),
            'year' => $request->get('year'),
            'from_date' => $request->get('from_date'),
            'to_date' => $request->get('to_date'),
        ];

        $filename = 'awareness_sessions_' . date('Y-m-d_His') . '.xlsx';
        return \Maatwebsite\Excel\Facades\Excel::download(new AwarenessSessionsExport($filters), $filename);
    }

    public function template(Request $request)
    {
        try {
            $user = $request->user();

            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));

            if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
                return $this->error('XLSX export requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
            }

            $visibleProjectIds = $user ? $user->visibleProjectIds() : null;
            $projectCodes = [];
            if ($visibleProjectIds !== null) {
                if (count($visibleProjectIds) === 0) {
                    $projectCodes = [];
                } else {
                    $projectCodes = Project::whereIn('id', $visibleProjectIds)->orderBy('code')->pluck('code')->toArray();
                }
            } else {
                $projectCodes = Project::query()->orderBy('code')->pluck('code')->toArray();
            }

            $themesFr = [
                'Travaux en hauteur sécurisés avec nacelles et échafaudages conformes',
                'Sécurisation des zones de levage et élingage',
                'Circulation des engins et co-activité',
                'Communication entre opérateurs (signalisation, gestes, radios)',
                'Port correct des EPI obligatoires',
                'Risques électriques et consignation',
                'Manutention manuelle sécurisée',
                'Chutes d\'objets et sécurisation des outils en hauteur',
                'Sécurité des fouilles et tranchées',
                'Risques liés à la pression et aux équipements sous pression',
                'Incendie et manipulation des extincteurs',
                'Produits chimiques et FDS',
                'Travaux à chaud — permis feu et périmètre',
                'Blocage et consignation mécanique / hydraulique',
                'Sécurité autour des grues mobiles',
                'Travaux en espaces confinés — atmosphère, ventilation, urgence',
                'Gestion des déchets et propreté de zone',
                'Risque bruit et protection auditive',
                'Éclairage de chantier insuffisant',
                'Travail de nuit — vigilance et organisation',
                'Ergonomie et postures de travail',
                'Gestion des énergies dangereuses (LOTO complet)',
                'Sécurité lors de l\'utilisation des machines fixes et portatives',
                'Prévention des glissades et trébuchements',
                'Météo extrême (vent, pluie, chaleur) et adaptation du travail',
                'Sécurité autour des armoires électriques ouvertes',
                'Prévention des coupures / projections (scies, meuleuses, perceuses)',
                'Risque de chocs avec charges suspendues',
                'Sécurisation des accès et balisage de zones dangereuses',
                'Risque lié à la fatigue et manque de concentration',
                'Prévention des presqu\'accidents et retours d\'expérience',
                'Plan d\'évacuation et premiers secours',
                'Rangement et stockage des matériaux en zone de travail',
                'Other',
            ];

            $themesEn = [
                'Safe work at height using certified MEWPs and scaffolding',
                'Securing lifting zones and rigging operations',
                'Traffic management for heavy equipment and co-activity',
                'Communication between operators (signals, hand signs, radios)',
                'Correct use of mandatory PPE',
                'Electrical risks and lockout/tagout',
                'Safe manual handling',
                'Dropped objects prevention and tool securing at height',
                'Excavation and trench safety',
                'Pressure hazards and pressurized equipment safety',
                'Fire safety and extinguisher handling',
                'Chemical safety and SDS awareness',
                'Hot work — fire permit and controlled perimeter',
                'Mechanical / hydraulic energy isolation',
                'Mobile crane safety',
                'Confined space work — atmosphere testing, ventilation, rescue plan',
                'Waste management and housekeeping',
                'Noise hazards and hearing protection',
                'Insufficient lighting on site',
                'Night work — vigilance and organization',
                'Ergonomics and safe body positioning',
                'Hazardous energy control (full LOTO)',
                'Safe use of fixed and portable power tools',
                'Slips, trips, and falls prevention',
                'Extreme weather (wind, rain, heat) and work adaptation',
                'Safety near open electrical panels',
                'Cutting/grinding/drilling risk prevention',
                'Hazard of impact with suspended loads',
                'Securing access points and zone barricading',
                'Fatigue risk and lack of focus',
                'Near-miss prevention and lessons learned',
                'Emergency evacuation and first aid readiness',
                'Proper material storage and workplace organization',
                'Other',
            ];

            $themes = strtolower(trim($lang)) === 'en' ? $themesEn : $themesFr;

            $filename = 'SGTM-Awareness-Template.xlsx';
            return \Maatwebsite\Excel\Facades\Excel::download(new AwarenessSessionsTemplateExport(200, $projectCodes, $themes, $lang), $filename);
        } catch (\Throwable $e) {
            Log::error('Awareness template generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to generate awareness template: ' . $e->getMessage(), 422);
        }
    }

    public function import(Request $request)
    {
        @ini_set('max_execution_time', '300');
        @ini_set('memory_limit', '512M');

        if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
            return $this->error('XLSX import requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
        }

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $user = $request->user();
        $visibleProjectIds = $user ? $user->visibleProjectIds() : null;
        $import = new AwarenessSessionsImport($user ? (int) $user->id : 0, $visibleProjectIds);

        try {
            DB::beginTransaction();
            \Maatwebsite\Excel\Facades\Excel::import($import, $request->file('file'));
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Awareness bulk import failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to import awareness sessions: ' . $e->getMessage(), 422);
        }

        $errors = $import->getErrors();
        $failedRowsUrl = null;
        if (!empty($errors)) {
            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));
            $filename = 'awareness_sessions_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
            $path = 'imports/failed_rows/' . $filename;
            $contents = Excel::raw(new AwarenessSessionsFailedRowsExport($errors, $lang), ExcelFormat::XLSX);
            Storage::disk('public')->put($path, $contents);
            $failedRowsUrl = '/api/imports/failed-rows/' . $filename;
        }

        return $this->success([
            'imported' => $import->getImportedCount(),
            'updated' => $import->getUpdatedCount(),
            'failed_count' => count($errors),
            'failed_rows_url' => $failedRowsUrl,
            'errors' => $errors,
        ], 'Awareness sessions imported');
    }

    /**
     * Store a new awareness session
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'date' => 'required|date',
            'week_number' => 'required|integer|min:1|max:52',
            'week_year' => 'required|integer|min:2020|max:2100',
            'by_name' => 'required|string|max:255',
            'theme' => 'required|string|max:500',
            'duration_minutes' => 'required|integer|min:15|max:60',
            'participants' => 'required|integer|min:1',
            'session_hours' => 'required|numeric|min:0',
        ]);

        $validated['submitted_by'] = $request->user()->id;

        $session = AwarenessSession::create($validated);
        $session->load(['project', 'submitter']);

        // Notify admins
        NotificationService::awarenessSubmitted($session);

        return response()->json([
            'message' => 'Awareness session created successfully',
            'data' => $session,
        ], 201);
    }

    /**
     * Show a specific awareness session
     */
    public function show(AwarenessSession $awarenessSession)
    {
        $user = request()->user();

        // Check access
        $project = \App\Models\Project::findOrFail($awarenessSession->project_id);
        if (!$user->canAccessProject($project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'data' => $awarenessSession->load(['project', 'submitter']),
        ]);
    }

    /**
     * Update an awareness session
     */
    public function update(Request $request, AwarenessSession $awarenessSession)
    {
        $user = $request->user();

        $project = \App\Models\Project::findOrFail($awarenessSession->project_id);
        if (!$user->canAccessProject($project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Check access
        if (!$user->canManageProjectActions() && $awarenessSession->submitted_by !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'project_id' => 'sometimes|exists:projects,id',
            'date' => 'sometimes|date',
            'week_number' => 'sometimes|integer|min:1|max:52',
            'week_year' => 'sometimes|integer|min:2020|max:2100',
            'by_name' => 'sometimes|string|max:255',
            'theme' => 'sometimes|string|max:500',
            'duration_minutes' => 'sometimes|integer|min:15|max:60',
            'participants' => 'sometimes|integer|min:1',
            'session_hours' => 'sometimes|numeric|min:0',
        ]);

        $awarenessSession->update($validated);

        return response()->json([
            'message' => 'Awareness session updated successfully',
            'data' => $awarenessSession->fresh()->load(['project', 'submitter']),
        ]);
    }

    /**
     * Delete an awareness session
     */
    public function destroy(AwarenessSession $awarenessSession)
    {
        $user = request()->user();

        $project = \App\Models\Project::findOrFail($awarenessSession->project_id);
        if (!$user->canAccessProject($project)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Only admin or submitter can delete
        if (!$user->canManageProjectActions() && $awarenessSession->submitted_by !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $awarenessSession->delete();

        return response()->json([
            'message' => 'Awareness session deleted successfully',
        ]);
    }

    /**
     * Get awareness session statistics
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $query = AwarenessSession::query();

        if (!$user->hasGlobalProjectScope()) {
            $projectIds = $user->visibleProjectIds();
            if ($projectIds !== null) {
                $query->whereIn('project_id', $projectIds);
            }
        }

        if ($request->has('project_id') && $request->project_id) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->has('year') && $request->year) {
            $query->where('week_year', $request->year);
        }

        $stats = [
            'total_sessions' => $query->count(),
            'total_participants' => $query->sum('participants'),
            'total_hours' => $query->sum('session_hours'),
        ];

        return response()->json(['data' => $stats]);
    }
}
