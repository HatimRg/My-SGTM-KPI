<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\WeekHelper;
use App\Models\DailyEffectifEntry;
use App\Models\DailyKpiSnapshot;
use App\Models\Project;
use App\Models\SorReport;
use App\Models\Training;
use App\Models\AwarenessSession;
use App\Models\RegulatoryWatchSubmission;
use App\Models\WorkerSanction;
use App\Models\WorkPermit;
use App\Models\Inspection;
use App\Models\HseEvent;
use App\Models\Worker;
use App\Models\WorkerMedicalAptitude;
use App\Exports\DailyKpiTemplateExport;
use App\Imports\DailyKpiTemplateImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DailyKpiSnapshotController extends Controller
{
    private const MONTHLY_ONLY_FIELDS = [
        'suivi_bruit',
        'consommation_eau',
        'consommation_electricite',
    ];

    private function rejectMonthlyOnlyDailyFields(array $data)
    {
        foreach (self::MONTHLY_ONLY_FIELDS as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null && $data[$field] !== '') {
                return $this->error('Noise, water, and electricity measurements are monthly-only and cannot be entered daily.', 422, [
                    'field' => $field,
                ]);
            }
        }
        return null;
    }

    /**
     * List daily KPI snapshots with filters.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = DailyKpiSnapshot::with(['project', 'submitter']);

        // Restrict to user's projects if not admin
        if (!$user->hasGlobalProjectScope()) {
            $projectIds = $user->visibleProjectIds();
            if ($projectIds !== null) {
                $query->whereIn('project_id', $projectIds);
            }
        }

        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }

        if ($week = $request->get('week')) {
            $query->where('week_number', $week);
        }

        if ($year = $request->get('year')) {
            $query->where('year', $year);
        }

        if ($from = $request->get('from_date')) {
            $query->where('entry_date', '>=', $from);
        }

        if ($to = $request->get('to_date')) {
            $query->where('entry_date', '<=', $to);
        }

        $snapshots = $query->orderBy('entry_date', 'desc')
            ->paginate($request->get('per_page', 50));

        return $this->paginated($snapshots);
    }

    /**
     * Store or update a daily KPI snapshot for a project/date.
     * One row per project per day (upsert based on project_id + entry_date).
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user->isAdminLike() && !$user->isResponsable()) {
            return $this->error('Only admins and responsables can manage daily KPI entries', 403);
        }

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'entry_date' => 'required|date',

            'effectif' => 'nullable|integer|min:0',
            'induction' => 'nullable|integer|min:0',
            'releve_ecarts' => 'nullable|integer|min:0',
            'sensibilisation' => 'nullable|integer|min:0',
            'presquaccident' => 'nullable|integer|min:0',
            'premiers_soins' => 'nullable|integer|min:0',
            'accidents' => 'nullable|integer|min:0',
            'jours_arret' => 'nullable|integer|min:0',
            'heures_travaillees' => 'nullable|numeric|min:0',
            'inspections' => 'nullable|integer|min:0',
            'heures_formation' => 'nullable|numeric|min:0',
            'permis_travail' => 'nullable|integer|min:0',
            'mesures_disciplinaires' => 'nullable|integer|min:0',
            'conformite_hse' => 'nullable|numeric|min:0|max:100',
            'conformite_medicale' => 'nullable|numeric|min:0|max:100',
            'suivi_bruit' => 'nullable|numeric|min:0',
            'consommation_eau' => 'nullable|numeric|min:0',
            'consommation_electricite' => 'nullable|numeric|min:0',

            'status' => 'nullable|in:draft,submitted',
            'notes' => 'nullable|string',
        ]);

        if ($resp = $this->rejectMonthlyOnlyDailyFields($validated)) {
            return $resp;
        }

        $project = Project::findOrFail($validated['project_id']);
        if (!$user->canAccessProject($project)) {
            return $this->error('You do not have access to this project', 403);
        }

        $entryDate = Carbon::parse($validated['entry_date']);
        $weekInfo = WeekHelper::getWeekFromDate($entryDate);

        $validated['week_number'] = $weekInfo['week'];
        $validated['year'] = $weekInfo['year'];
        $validated['day_name'] = $entryDate->englishDayOfWeek;
        $validated['submitted_by'] = $user->id;
        $validated['status'] = $validated['status'] ?? DailyKpiSnapshot::STATUS_DRAFT;

        // Auto-extract training & TBM/TBT hours from existing data for that day
        $trainingHours = Training::where('project_id', $validated['project_id'])
            ->whereDate('date', $entryDate->toDateString())
            ->sum('training_hours');

        $tbmQuery = AwarenessSession::where('project_id', $validated['project_id'])
            ->whereDate('date', $entryDate->toDateString());

        $tbmHours = (float) $tbmQuery->sum('session_hours');
        $tbmCount = (int) $tbmQuery->count();

        if (!array_key_exists('heures_formation', $validated) || $validated['heures_formation'] === null) {
            $validated['heures_formation'] = $trainingHours + $tbmHours;
        }

        if (!array_key_exists('sensibilisation', $validated) || $validated['sensibilisation'] === null) {
            $validated['sensibilisation'] = $tbmCount;
        }

        // Auto-fill effectif from DailyEffectifEntry when not provided
        if (!array_key_exists('effectif', $validated) || $validated['effectif'] === null) {
            $effectifEntry = DailyEffectifEntry::query()
                ->where('project_id', $validated['project_id'])
                ->where('entry_date', $entryDate->toDateString())
                ->first();
            if ($effectifEntry) {
                $validated['effectif'] = (int) $effectifEntry->effectif;
            }
        }

        $snapshot = DailyKpiSnapshot::updateOrCreate(
            [
                'project_id' => $validated['project_id'],
                'entry_date' => $entryDate->toDateString(),
            ],
            $validated
        );

        $snapshot->load(['project', 'submitter']);

        return $this->success($snapshot, 'Daily KPI entry saved successfully');
    }

    /**
     * Show a single daily KPI snapshot.
     */
    public function show(Request $request, DailyKpiSnapshot $dailyKpiSnapshot)
    {
        $user = $request->user();

        $project = Project::findOrFail($dailyKpiSnapshot->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $dailyKpiSnapshot->load(['project', 'submitter']);

        return $this->success($dailyKpiSnapshot);
    }

    /**
     * Update a daily KPI snapshot.
     */
    public function update(Request $request, DailyKpiSnapshot $dailyKpiSnapshot)
    {
        $user = $request->user();

        if (!$user->isAdminLike() && !$user->isResponsable()) {
            return $this->error('Only admins and responsables can manage daily KPI entries', 403);
        }

        $project = Project::findOrFail($dailyKpiSnapshot->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $validated = $request->validate([
            'effectif' => 'nullable|integer|min:0',
            'induction' => 'nullable|integer|min:0',
            'releve_ecarts' => 'nullable|integer|min:0',
            'sensibilisation' => 'nullable|integer|min:0',
            'presquaccident' => 'nullable|integer|min:0',
            'premiers_soins' => 'nullable|integer|min:0',
            'accidents' => 'nullable|integer|min:0',
            'jours_arret' => 'nullable|integer|min:0',
            'heures_travaillees' => 'nullable|numeric|min:0',
            'inspections' => 'nullable|integer|min:0',
            'heures_formation' => 'nullable|numeric|min:0',
            'permis_travail' => 'nullable|integer|min:0',
            'mesures_disciplinaires' => 'nullable|integer|min:0',
            'conformite_hse' => 'nullable|numeric|min:0|max:100',
            'conformite_medicale' => 'nullable|numeric|min:0|max:100',
            'suivi_bruit' => 'nullable|numeric|min:0',
            'consommation_eau' => 'nullable|numeric|min:0',
            'consommation_electricite' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:draft,submitted',
            'notes' => 'nullable|string',
        ]);

        if ($resp = $this->rejectMonthlyOnlyDailyFields($validated)) {
            return $resp;
        }

        $dailyKpiSnapshot->update($validated);

        return $this->success($dailyKpiSnapshot->fresh()->load(['project', 'submitter']), 'Daily KPI entry updated successfully');
    }

    /**
     * Delete a daily KPI snapshot.
     */
    public function destroy(Request $request, DailyKpiSnapshot $dailyKpiSnapshot)
    {
        $user = $request->user();

        if (!$user->isAdminLike() && !$user->isResponsable()) {
            return $this->error('Only admins and responsables can delete daily KPI entries', 403);
        }

        $project = Project::findOrFail($dailyKpiSnapshot->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }

        $dailyKpiSnapshot->delete();

        return $this->success(null, 'Daily KPI entry deleted successfully');
    }

    /**
     * Download Excel template for daily KPI entry.
     */
    public function downloadTemplate(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020|max:2100',
            'lang' => 'nullable|string|in:en,fr',
        ]);

        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $project = Project::findOrFail($request->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('Access denied', 403);
        }
        $projectId = $project->id;
        $weekNumber = (int) $request->week_number;
        $year = (int) $request->year;
        $lang = $request->query('lang') ?: ($user->preferred_language ?? 'fr');
        
        // Template now only contains user-editable fields (effectif, induction).
        // Authoritative indicators are computed elsewhere; keep template minimal.
        $autoFillValues = [];
        
        $filename = "KPI_Journalier_{$project->code}_S{$weekNumber}_{$year}.xlsx";
        
        return Excel::download(
            new DailyKpiTemplateExport(
                $project->name,
                $project->code,
                $weekNumber,
                $year,
                $autoFillValues,
                $lang
            ),
            $filename
        );
    }

    /**
     * Parse uploaded Excel template and return preview data.
     */
    public function parseTemplate(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls',
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020|max:2100',
        ]);

        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        if (!$user->isAdminLike() && !$user->isResponsable() && !$user->isHseManager()) {
            return $this->error('Only admins, responsables, and HSE managers can upload KPI data', 403);
        }

        $project = Project::findOrFail($request->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('You do not have access to this project', 403);
        }

        try {
            $dailyData = DailyKpiTemplateImport::parse($request->file('file'));
            $aggregates = DailyKpiTemplateImport::calculateAggregates($dailyData);

            foreach ($dailyData as $row) {
                if ($resp = $this->rejectMonthlyOnlyDailyFields($row)) {
                    return $resp;
                }
            }

            return $this->success([
                'daily_entries' => $dailyData,
                'aggregates' => $aggregates,
                'project_id' => $request->project_id,
                'week_number' => (int) $request->week_number,
                'year' => (int) $request->year,
            ], 'Template parsed successfully');
        } catch (\Exception $e) {
            return $this->error('Failed to parse Excel file: ' . $e->getMessage(), 422);
        }
    }

    /**
     * Bulk save daily KPI entries for a week.
     */
    public function bulkSave(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }
        if (!$user->isAdminLike() && !$user->isResponsable() && !$user->isHseManager()) {
            return $this->error('Only admins, responsables, and HSE managers can save KPI data', 403);
        }

        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020|max:2100',
            'entries' => 'required|array',
            'entries.*.entry_date' => 'required|date',
        ]);

        $project = Project::findOrFail($request->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('You do not have access to this project', 403);
        }

        $savedEntries = [];
        foreach ($request->entries as $entry) {
            $entryDate = Carbon::parse($entry['entry_date']);
            $weekInfo = WeekHelper::getWeekFromDate($entryDate);

            $data = [
                'project_id' => $request->project_id,
                'submitted_by' => $user->id,
                'entry_date' => $entryDate->toDateString(),
                'week_number' => $weekInfo['week'],
                'year' => $weekInfo['year'],
                'day_name' => $entryDate->englishDayOfWeek,
                'status' => 'submitted',
            ];

            // Map user-editable KPI fields only
            $fields = [
                'effectif',
                'induction',
            ];

            foreach ($fields as $field) {
                if (isset($entry[$field]) && $entry[$field] !== null && $entry[$field] !== '') {
                    $data[$field] = $entry[$field];
                }
            }

            if (!array_key_exists('effectif', $data)) {
                $effectifEntry = DailyEffectifEntry::query()
                    ->where('project_id', $request->project_id)
                    ->where('entry_date', $entryDate->toDateString())
                    ->first();
                if ($effectifEntry) {
                    $data['effectif'] = (int) $effectifEntry->effectif;
                }
            }

            $snapshot = DailyKpiSnapshot::updateOrCreate(
                [
                    'project_id' => $request->project_id,
                    'entry_date' => $entryDate->toDateString(),
                ],
                $data
            );

            $savedEntries[] = $snapshot;
        }

        // Calculate aggregates from saved entries
        $kpiAggregates = DailyKpiSnapshot::aggregateForWeek(
            $request->project_id,
            (int) $request->week_number,
            (int) $request->year
        );

        $aggregates = [];
        if (!empty($kpiAggregates)) {
            $aggregates = [
                'effectif' => $kpiAggregates['effectif'] ?? 0,
                'induction' => $kpiAggregates['induction'] ?? 0,
                'releve_ecarts' => $kpiAggregates['releve_ecarts'] ?? 0,
                'sensibilisation' => $kpiAggregates['sensibilisation'] ?? 0,
                'presquaccident' => $kpiAggregates['near_misses'] ?? 0,
                'premiers_soins' => $kpiAggregates['first_aid_cases'] ?? 0,
                'accidents' => $kpiAggregates['accidents'] ?? 0,
                'jours_arret' => $kpiAggregates['lost_workdays'] ?? 0,
                'heures_travaillees' => $kpiAggregates['hours_worked'] ?? 0,
                'inspections' => $kpiAggregates['inspections_completed'] ?? 0,
                'heures_formation' => $kpiAggregates['training_hours'] ?? 0,
                'permis_travail' => $kpiAggregates['work_permits'] ?? 0,
                'mesures_disciplinaires' => $kpiAggregates['disciplinary_actions'] ?? 0,
                'conformite_hse' => $kpiAggregates['hse_compliance_rate'] ?? 0,
                'conformite_medicale' => $kpiAggregates['medical_compliance_rate'] ?? 0,
            ];
        }

        return $this->success([
            'saved_count' => count($savedEntries),
            'entries' => $savedEntries,
            'aggregates' => $aggregates,
        ], 'Daily KPI entries saved successfully');
    }

    /**
     * Get aggregated KPI values for a week (to fill KPI form).
     */
    public function getWeekAggregates(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020|max:2100',
        ]);

        $kpiAggregates = DailyKpiSnapshot::aggregateForWeek(
            $request->project_id,
            (int) $request->week_number,
            (int) $request->year
        );

        $aggregates = [];
        if (!empty($kpiAggregates)) {
            $aggregates = [
                'effectif' => $kpiAggregates['effectif'] ?? 0,
                'induction' => $kpiAggregates['induction'] ?? 0,
                'releve_ecarts' => $kpiAggregates['releve_ecarts'] ?? 0,
                'sensibilisation' => $kpiAggregates['sensibilisation'] ?? 0,
                'presquaccident' => $kpiAggregates['near_misses'] ?? 0,
                'premiers_soins' => $kpiAggregates['first_aid_cases'] ?? 0,
                'accidents' => $kpiAggregates['accidents'] ?? 0,
                'jours_arret' => $kpiAggregates['lost_workdays'] ?? 0,
                'heures_travaillees' => $kpiAggregates['hours_worked'] ?? 0,
                'inspections' => $kpiAggregates['inspections_completed'] ?? 0,
                'heures_formation' => $kpiAggregates['training_hours'] ?? 0,
                'permis_travail' => $kpiAggregates['work_permits'] ?? 0,
                'mesures_disciplinaires' => $kpiAggregates['disciplinary_actions'] ?? 0,
                'conformite_hse' => $kpiAggregates['hse_compliance_rate'] ?? 0,
                'conformite_medicale' => $kpiAggregates['medical_compliance_rate'] ?? 0,
            ];
        }

        $dailyEntries = DailyKpiSnapshot::forProject($request->project_id)
            ->forWeek($request->week_number, $request->year)
            ->orderBy('entry_date')
            ->get();

        return $this->success([
            'aggregates' => $aggregates,
            'daily_entries' => $dailyEntries,
            'has_data' => !empty($aggregates),
        ]);
    }

    /**
     * Get week dates for daily entry form.
     */
    public function getWeekDates(Request $request)
    {
        $request->validate([
            'week_number' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020|max:2100',
        ]);

        $dates = WeekHelper::getWeekDates($request->week_number, $request->year);
        $days = [];
        
        for ($i = 0; $i < 7; $i++) {
            $date = $dates['start']->copy()->addDays($i);
            $days[] = [
                'date' => $date->format('Y-m-d'),
                'display' => $date->format('d/m/Y'),
                'day_name' => $date->englishDayOfWeek,
                'day_name_fr' => ['Saturday' => 'Samedi', 'Sunday' => 'Dimanche', 'Monday' => 'Lundi', 'Tuesday' => 'Mardi', 'Wednesday' => 'Mercredi', 'Thursday' => 'Jeudi', 'Friday' => 'Vendredi'][$date->englishDayOfWeek] ?? $date->englishDayOfWeek,
            ];
        }

        return $this->success([
            'week_number' => (int) $request->week_number,
            'year' => (int) $request->year,
            'start_date' => $dates['start']->format('Y-m-d'),
            'end_date' => $dates['end']->format('Y-m-d'),
            'days' => $days,
        ]);
    }

    /**
     * Auto-fetch daily values from system data (SOR, TBM, Training, Work Permits).
     */
    public function getAutoFillValues(Request $request)
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_number' => 'required|integer|min:1|max:52',
            'year' => 'required|integer|min:2020|max:2100',
        ]);

        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $project = Project::findOrFail($request->project_id);
        if (!$user->canAccessProject($project)) {
            return $this->error('You do not have access to this project', 403);
        }

        $projectId = $request->project_id;
        $weekNumber = (int) $request->week_number;
        $year = (int) $request->year;

        $dates = WeekHelper::getWeekDates($weekNumber, $year);
        $startDate = $dates['start'];
        $endDate = $dates['end'];

        $startDateStr = $startDate->format('Y-m-d');
        $endDateStr = $endDate->format('Y-m-d');

        $deviationsByDate = SorReport::query()
            ->where('project_id', $projectId)
            ->whereBetween('observation_date', [$startDateStr, $endDateStr])
            ->selectRaw('DATE(observation_date) as d, COUNT(*) as c')
            ->groupBy('d')
            ->pluck('c', 'd')
            ->toArray();

        $awarenessByDate = AwarenessSession::query()
            ->where('project_id', $projectId)
            ->whereBetween('date', [$startDateStr, $endDateStr])
            ->selectRaw('DATE(date) as d, COUNT(*) as c, COALESCE(SUM(session_hours),0) as h')
            ->groupBy('d')
            ->get()
            ->keyBy('d');

        $trainingByDate = Training::query()
            ->where('project_id', $projectId)
            ->whereBetween('date', [$startDateStr, $endDateStr])
            ->selectRaw('DATE(date) as d, COUNT(*) as c, COALESCE(SUM(training_hours),0) as h')
            ->groupBy('d')
            ->get()
            ->keyBy('d');

        $inspectionsByDate = Inspection::query()
            ->where('project_id', $projectId)
            ->whereBetween('inspection_date', [$startDateStr, $endDateStr])
            ->selectRaw('DATE(inspection_date) as d, COUNT(*) as c')
            ->groupBy('d')
            ->pluck('c', 'd')
            ->toArray();

        $workPermitsByDate = WorkPermit::query()
            ->where('project_id', $projectId)
            ->whereNotNull('commence_date')
            ->whereBetween('commence_date', [$startDateStr, $endDateStr])
            ->selectRaw('DATE(commence_date) as d, COUNT(*) as c')
            ->groupBy('d')
            ->pluck('c', 'd')
            ->toArray();

        $sanctionsByDate = WorkerSanction::query()
            ->where('project_id', $projectId)
            ->whereBetween('sanction_date', [$startDateStr, $endDateStr])
            ->selectRaw('DATE(sanction_date) as d, COUNT(*) as c')
            ->groupBy('d')
            ->pluck('c', 'd')
            ->toArray();

        $events = HseEvent::query()
            ->where('project_id', $projectId)
            ->whereBetween('event_date', [$startDateStr, $endDateStr])
            ->get(['event_date', 'type', 'lost_time', 'lost_days']);

        $accidentTypes = ['work_accident', 'road_accident', 'accident', 'traffic_accident'];
        $nearMissTypes = ['near_miss', 'near_misses', 'presquaccident', 'near-miss'];
        $firstAidTypes = ['first_aid', 'first_aid_case', 'premiers_soins', 'first-aid', 'first_aid_only'];

        $hseByDate = [];
        foreach ($events as $e) {
            $d = Carbon::parse($e->event_date)->format('Y-m-d');
            if (!isset($hseByDate[$d])) {
                $hseByDate[$d] = [
                    'accidents' => 0,
                    'near_misses' => 0,
                    'first_aid_cases' => 0,
                    'lost_workdays' => 0,
                ];
            }

            $t = (string) $e->type;
            if (in_array($t, $accidentTypes, true)) {
                $hseByDate[$d]['accidents']++;
            }
            if (in_array($t, $nearMissTypes, true)) {
                $hseByDate[$d]['near_misses']++;
            }
            if (in_array($t, $firstAidTypes, true)) {
                $hseByDate[$d]['first_aid_cases']++;
            }
            if ($e->lost_time) {
                $hseByDate[$d]['lost_workdays'] += (int) ($e->lost_days ?? 0);
            }
        }

        $medicalComplianceRate = 0.0;
        $totalWorkers = (int) Worker::where('project_id', $projectId)->where('is_active', true)->count();
        if ($totalWorkers > 0) {
            $apte = (int) WorkerMedicalAptitude::join('workers', 'workers.id', '=', 'worker_medical_aptitudes.worker_id')
                ->where('workers.project_id', $projectId)
                ->where('workers.is_active', true)
                ->whereRaw('LOWER(worker_medical_aptitudes.aptitude_status) = ?', ['apte'])
                ->distinct()
                ->count('worker_medical_aptitudes.worker_id');
            $medicalComplianceRate = round(($apte * 100.0) / $totalWorkers, 2);
        }

        $hseComplianceRate = 0.0;
        $latestByCategory = RegulatoryWatchSubmission::query()
            ->where('project_id', $projectId)
            ->where('week_year', $year)
            ->where('week_number', $weekNumber)
            ->whereIn('category', ['sst', 'environment'])
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->get(['category', 'overall_score']);

        $scores = [];
        foreach ($latestByCategory as $row) {
            $cat = (string) $row->category;
            if (!array_key_exists($cat, $scores)) {
                $scores[$cat] = (float) ($row->overall_score ?? 0);
            }
        }
        if (!empty($scores)) {
            $hseComplianceRate = round(array_sum($scores) / max(1, count($scores)), 2);
        }

        $dailyValues = [];

        // Loop through each day of the week
        for ($i = 0; $i < 7; $i++) {
            $currentDate = $startDate->copy()->addDays($i);
            $dateString = $currentDate->format('Y-m-d');

            $effectifEntry = DailyEffectifEntry::query()
                ->where('project_id', $projectId)
                ->where('entry_date', $dateString)
                ->first();

            $effectif = $effectifEntry ? (int) $effectifEntry->effectif : null;

            $awarenessRow = $awarenessByDate->get($dateString);
            $trainingRow = $trainingByDate->get($dateString);
            $hseRow = $hseByDate[$dateString] ?? null;

            $sensibilisation = $awarenessRow ? (int) ($awarenessRow->c ?? 0) : 0;
            $awarenessHours = $awarenessRow ? (float) ($awarenessRow->h ?? 0) : 0.0;
            $trainingHours = $trainingRow ? (float) ($trainingRow->h ?? 0) : 0.0;
            $heuresFormation = $trainingHours + $awarenessHours;

            $releveEcarts = (int) ($deviationsByDate[$dateString] ?? 0);
            $inspections = (int) ($inspectionsByDate[$dateString] ?? 0);
            $permisTravail = (int) ($workPermitsByDate[$dateString] ?? 0);
            $mesuresDisciplinaires = (int) ($sanctionsByDate[$dateString] ?? 0);
            $heuresTravaillees = $effectif !== null ? ((float) $effectif * 10.0) : null;

            $dailyValues[] = [
                'entry_date' => $dateString,
                'day_name' => $currentDate->englishDayOfWeek,
                'auto_values' => [
                    'effectif' => $effectif,
                    'induction' => 0,
                    'releve_ecarts' => $releveEcarts,
                    'sensibilisation' => $sensibilisation,
                    'presquaccident' => (int) ($hseRow['near_misses'] ?? 0),
                    'premiers_soins' => (int) ($hseRow['first_aid_cases'] ?? 0),
                    'accidents' => (int) ($hseRow['accidents'] ?? 0),
                    'jours_arret' => (int) ($hseRow['lost_workdays'] ?? 0),
                    'heures_travaillees' => $heuresTravaillees,
                    'inspections' => $inspections,
                    'heures_formation' => $heuresFormation,
                    'permis_travail' => $permisTravail,
                    'mesures_disciplinaires' => $mesuresDisciplinaires,
                    'conformite_hse' => $hseComplianceRate,
                    'conformite_medicale' => $medicalComplianceRate,
                ],
            ];
        }

        return $this->success([
            'project_id' => $projectId,
            'week_number' => $weekNumber,
            'year' => $year,
            'daily_values' => $dailyValues,
        ]);
    }
}
