<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\WeekHelper;
use App\Models\DailyEffectifEntry;
use App\Models\DailyKpiSnapshot;
use App\Models\Project;
use App\Models\Training;
use App\Models\AwarenessSession;
use App\Models\RegulatoryWatchSubmission;
use App\Models\WorkerSanction;
use App\Exports\DailyKpiTemplateExport;
use App\Imports\DailyKpiTemplateImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;
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

        if (!$user->isAdminLike() && $dailyKpiSnapshot->submitted_by !== $user->id) {
            return $this->error('You can only edit your own daily KPI entries', 403);
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

        if (!$user->isAdminLike() && $dailyKpiSnapshot->submitted_by !== $user->id) {
            return $this->error('You can only delete your own daily KPI entries', 403);
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
        
        // Fetch auto-fill values from system data
        $dates = WeekHelper::getWeekDates($weekNumber, $year);
        $startDate = $dates['start'];
        $regulatoryScore = RegulatoryWatchSubmission::query()
            ->where('project_id', $projectId)
            ->where('week_year', $year)
            ->where('week_number', $weekNumber)
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->value('overall_score');
        $autoFillValues = [];

        for ($i = 0; $i < 7; $i++) {
            $currentDate = $startDate->copy()->addDays($i);
            $dateString = $currentDate->format('Y-m-d');

            // Deviations (SOR Reports) - count returns 0 if no records
            $deviations = \App\Models\SorReport::where('project_id', $projectId)
                ->whereDate('observation_date', $dateString)
                ->count();

            // TBM/Sensibilisation - count returns 0 if no records
            $tbmCount = \App\Models\AwarenessSession::where('project_id', $projectId)
                ->whereDate('date', $dateString)
                ->count();

            $tbmHours = (float) (\App\Models\AwarenessSession::where('project_id', $projectId)
                ->whereDate('date', $dateString)
                ->sum('session_hours') ?? 0);

            // Training hours - sum can return NULL, so default to 0
            $trainingHours = \App\Models\Training::where('project_id', $projectId)
                ->whereDate('date', $dateString)
                ->sum('training_hours') ?? 0;

            // Work permits - count returns 0 if no records
            $workPermits = \App\Models\WorkPermit::where('project_id', $projectId)
                ->whereDate('commence_date', $dateString)
                ->count();

            // Inspections - count returns 0 if no records
            $inspections = \App\Models\Inspection::where('project_id', $projectId)
                ->whereDate('inspection_date', $dateString)
                ->count();

            $sanctions = WorkerSanction::query()
                ->where('project_id', $projectId)
                ->where('sanction_date', $dateString)
                ->count();

            // All values must be 0 if no data, never null or empty
            $autoFillValues[] = [
                'entry_date' => $dateString,
                'auto_values' => [
                    'releve_ecarts' => (int) $deviations,
                    'sensibilisation' => (int) $tbmCount,
                    'heures_formation' => (float) ($trainingHours ?? 0) + $tbmHours,
                    'permis_travail' => (int) $workPermits,
                    'inspections' => (int) $inspections,
                    'mesures_disciplinaires' => (int) $sanctions,
                    'conformite_hse' => $regulatoryScore !== null ? (float) $regulatoryScore : null,
                ],
            ];
        }
        
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

            // Map all KPI fields
            $fields = [
                'effectif', 'induction', 'releve_ecarts', 'sensibilisation',
                'presquaccident', 'premiers_soins', 'accidents', 'jours_arret',
                'heures_travaillees', 'inspections', 'heures_formation', 'permis_travail',
                'mesures_disciplinaires', 'conformite_hse', 'conformite_medicale'
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

        $regulatoryScore = RegulatoryWatchSubmission::query()
            ->where('project_id', $projectId)
            ->where('week_year', $year)
            ->where('week_number', $weekNumber)
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->value('overall_score');

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
            $workHours = $effectif !== null ? (float) ($effectif * 10) : null;

            // 1. Deviations (SOR Reports) per day
            $deviations = \App\Models\SorReport::where('project_id', $projectId)
                ->whereDate('observation_date', $dateString)
                ->count();

            // 2. TBM/Sensibilisation entries per day
            $tbmCount = \App\Models\AwarenessSession::where('project_id', $projectId)
                ->whereDate('date', $dateString)
                ->count();

            $tbmHours = \App\Models\AwarenessSession::where('project_id', $projectId)
                ->whereDate('date', $dateString)
                ->sum('session_hours');

            // 3. Training hours for the day
            $trainingHours = \App\Models\Training::where('project_id', $projectId)
                ->whereDate('date', $dateString)
                ->sum('training_hours');

            $totalTrainingHours = (float) $trainingHours + (float) $tbmHours;

            // 3b. Inspections per day
            $inspections = \App\Models\Inspection::where('project_id', $projectId)
                ->whereDate('inspection_date', $dateString)
                ->count();

            // 4. Work permits - count by commence_date
            $workPermits = \App\Models\WorkPermit::where('project_id', $projectId)
                ->whereDate('commence_date', $dateString)
                ->count();

            $sanctions = WorkerSanction::query()
                ->where('project_id', $projectId)
                ->where('sanction_date', $dateString)
                ->count();

            $dailyValues[] = [
                'entry_date' => $dateString,
                'day_name' => $currentDate->englishDayOfWeek,
                'auto_values' => [
                    'effectif' => $effectif,
                    'heures_travaillees' => $workHours,
                    'releve_ecarts' => $deviations,        // Deviation tracking
                    'sensibilisation' => $tbmCount,        // TBM/TBT count
                    'heures_formation' => (float) $totalTrainingHours,  // Training hours
                    'permis_travail' => $workPermits,      // Work permits
                    'inspections' => (int) $inspections,    // Inspections
                    'mesures_disciplinaires' => (int) $sanctions,
                    'conformite_hse' => $regulatoryScore !== null ? (float) $regulatoryScore : null,
                ],
            ];
        }

        // Get total work permits for the week (alternative calculation by week number)
        $weeklyWorkPermits = \App\Models\WorkPermit::where('project_id', $projectId)
            ->where('week_number', $weekNumber)
            ->where('year', $year)
            ->count();

        return $this->success([
            'project_id' => $projectId,
            'week_number' => $weekNumber,
            'year' => $year,
            'daily_values' => $dailyValues,
            'weekly_totals' => [
                'work_permits' => $weeklyWorkPermits,
            ],
            'formulas' => [
                'heures_travaillees' => 'effectif × 10',  // Work hours = workforce × 10
            ],
        ]);
    }
}
