<?php

namespace App\Console\Commands;

use App\Models\DailyEffectifEntry;
use App\Models\Notification;
use App\Models\Project;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckDailyEffectifMissing extends Command
{
    protected $signature = 'daily-effectif:check-missing {--date=}';

    protected $description = 'Send notifications for missing daily effectif entries';

    public function handle(): int
    {
        $today = $this->option('date') ? Carbon::parse($this->option('date'))->startOfDay() : now()->startOfDay();
        $yesterday = $today->copy()->subDay();

        // Do not start notifying for projects with 0 entries.
        $projectFirstDates = DailyEffectifEntry::query()
            ->select('project_id', DB::raw('MIN(entry_date) as first_date'))
            ->groupBy('project_id')
            ->get();

        foreach ($projectFirstDates as $row) {
            $this->processProjectRow($row, $today, $yesterday);
        }

        return Command::SUCCESS;
    }

    private function processProjectRow($row, Carbon $today, Carbon $yesterday): void
    {
        $projectId = (int) ($row->project_id ?? 0);
        $firstDateRaw = $row->first_date ?? null;
        if (!$projectId || !$firstDateRaw) {
            return;
        }

        $firstDate = Carbon::parse($firstDateRaw)->startOfDay();
        if ($firstDate->greaterThan($yesterday)) {
            return;
        }

        $project = Project::find($projectId);
        if (!$project) {
            return;
        }

        $recipientIds = $this->recipientIdsForProject($project);
        if (empty($recipientIds)) {
            return;
        }

        $this->notifyForMissingDays($project, $firstDate, $today, $yesterday, $recipientIds);
    }

    private function recipientIdsForProject(Project $project): array
    {
        $ids = [];

        // Always notify global roles (all-project scope)
        $global = User::query()
            ->active()
            ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_DEV, User::ROLE_HR_DIRECTOR])
            ->pluck('id')
            ->all();
        $ids = array_merge($ids, $global);

        // Notify project-assigned HR/HSE Manager/Responsable
        $assigned = $project->users()
            ->whereIn('role', [User::ROLE_HR, User::ROLE_HSE_MANAGER, User::ROLE_REGIONAL_HSE_MANAGER, User::ROLE_RESPONSABLE])
            ->where('is_active', true)
            ->pluck('users.id')
            ->all();

        $ids = array_merge($ids, $assigned);

        $ids = array_values(array_unique(array_map('intval', $ids)));
        return $ids;
    }

    private function actionUrlForUser(User $user): ?string
    {
        if ($user->role === User::ROLE_HR) {
            return '/hr/effectif';
        }

        if (in_array($user->role, [User::ROLE_ADMIN, User::ROLE_DEV, User::ROLE_HR_DIRECTOR], true)) {
            return '/admin/effectif';
        }

        return '/notifications';
    }

    private function notifyForMissingDays(Project $project, Carbon $firstDate, Carbon $today, Carbon $yesterday, array $recipientIds): void
    {
        $projectId = (int) $project->id;

        $existingDates = DailyEffectifEntry::query()
            ->where('project_id', $projectId)
            ->whereDate('entry_date', '>=', $firstDate->toDateString())
            ->whereDate('entry_date', '<=', $yesterday->toDateString())
            ->pluck('entry_date')
            ->map(fn ($d) => Carbon::parse($d)->toDateString())
            ->all();

        $existingSet = array_fill_keys($existingDates, true);

        $alreadySentToday = Notification::query()
            ->where('type', Notification::TYPE_EFFECTIF_MISSING)
            ->where('project_id', $projectId)
            ->whereDate('created_at', $today->toDateString())
            ->whereIn('user_id', $recipientIds)
            ->get(['user_id', 'data'])
            ->groupBy('user_id')
            ->map(function ($items) {
                $set = [];
                foreach ($items as $n) {
                    $entryDate = $n->data['entry_date'] ?? null;
                    if ($entryDate) {
                        $set[(string) $entryDate] = true;
                    }
                }
                return $set;
            })
            ->all();

        for ($d = $firstDate->copy(); $d->lessThanOrEqualTo($yesterday); $d->addDay()) {
            $missingDate = $d->toDateString();
            if (isset($existingSet[$missingDate])) {
                continue;
            }

            $ddmmyyyy = $d->format('d/m/Y');

            foreach ($recipientIds as $userId) {
                $userId = (int) $userId;

                $sent = $alreadySentToday[$userId] ?? [];
                if (isset($sent[$missingDate])) {
                    continue;
                }

                $user = User::find($userId);
                if (!$user || !$user->is_active) {
                    continue;
                }

                NotificationService::sendToUser(
                    $user,
                    Notification::TYPE_EFFECTIF_MISSING,
                    'Effectif manquant',
                    "Aucun effectif n'a été soumis pour {$project->name} le {$ddmmyyyy}.",
                    [
                        'project_id' => $projectId,
                        'icon' => 'users',
                        'action_url' => $this->actionUrlForUser($user),
                        'data' => [
                            'project_id' => $projectId,
                            'project_name' => $project->name,
                            'entry_date' => $missingDate,
                        ],
                    ],
                );

                $alreadySentToday[$userId] = $alreadySentToday[$userId] ?? [];
                $alreadySentToday[$userId][$missingDate] = true;
            }
        }
    }
}
