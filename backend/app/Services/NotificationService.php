<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use App\Models\Project;
use App\Models\WorkerTraining;
use Illuminate\Support\Facades\Schema;

class NotificationService
{
    private static function notificationTableSupports(): array
    {
        static $supports = null;
        if ($supports !== null) {
            return $supports;
        }

        $supports = [
            'project_id' => Schema::hasColumn('notifications', 'project_id'),
            'icon' => Schema::hasColumn('notifications', 'icon'),
            'action_url' => Schema::hasColumn('notifications', 'action_url'),
            'sent_by' => Schema::hasColumn('notifications', 'sent_by'),
            'urgency' => Schema::hasColumn('notifications', 'urgency'),
            'dedupe_key' => Schema::hasColumn('notifications', 'dedupe_key'),
        ];

        return $supports;
    }

    private static function addUrgentFieldsToPayload(array $payload, array $options, array $supports): array
    {
        if ($supports['sent_by']) {
            $payload['sent_by'] = $options['sent_by'] ?? null;
        }
        if ($supports['urgency']) {
            $payload['urgency'] = $options['urgency'] ?? null;
        }
        if ($supports['dedupe_key']) {
            $payload['dedupe_key'] = $options['dedupe_key'] ?? null;
        }

        return $payload;
    }

    /**
     * Send notification to a specific user
     */
    public static function sendToUser(User $user, string $type, string $title, string $message, array $options = []): Notification
    {
        $supports = self::notificationTableSupports();

        $payload = [
            'user_id' => $user->id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $options['data'] ?? null,
        ];

        if ($supports['project_id']) {
            $payload['project_id'] = $options['project_id'] ?? null;
        }
        if ($supports['icon']) {
            $payload['icon'] = $options['icon'] ?? null;
        }
        if ($supports['action_url']) {
            $payload['action_url'] = $options['action_url'] ?? null;
        }

        $payload = self::addUrgentFieldsToPayload($payload, $options, $supports);

        return Notification::create($payload);
    }

    /**
     * Send notification to multiple users
     */
    public static function sendToUsers(array $userIds, string $type, string $title, string $message, array $options = []): void
    {
        $supports = self::notificationTableSupports();
        foreach ($userIds as $userId) {
            $payload = [
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'data' => $options['data'] ?? null,
            ];

            if ($supports['project_id']) {
                $payload['project_id'] = $options['project_id'] ?? null;
            }
            if ($supports['icon']) {
                $payload['icon'] = $options['icon'] ?? null;
            }
            if ($supports['action_url']) {
                $payload['action_url'] = $options['action_url'] ?? null;
            }

            $payload = self::addUrgentFieldsToPayload($payload, $options, $supports);

            Notification::create($payload);
        }
    }

    /**
     * Send an urgent (blocking) notification with dedupe.
     *
     * - Uses Notification::TYPE_URGENT
     * - Persists audit fields: sent_by, urgency
     * - Uses per-recipient dedupe via notifications(user_id, dedupe_key) unique constraint.
     */
    public static function sendUrgentToUsers(array $userIds, string $message, string $urgency, int $sentByUserId, array $options = []): void
    {
        $urgency = strtolower(trim((string) $urgency));
        if (!in_array($urgency, ['low', 'medium', 'high'], true)) {
            $urgency = 'medium';
        }

        $title = $options['title'] ?? 'Urgent notification';

        $dedupeKey = $options['dedupe_key'] ?? hash('sha256', implode('|', [
            (string) $sentByUserId,
            $urgency,
            trim((string) $title),
            trim((string) $message),
            now()->format('Y-m-d H:i'),
        ]));

        $supports = self::notificationTableSupports();

        $baseOptions = $options;
        $baseOptions['sent_by'] = $sentByUserId;
        $baseOptions['urgency'] = $urgency;
        $baseOptions['dedupe_key'] = $dedupeKey;
        $baseOptions['data'] = array_merge($options['data'] ?? [], [
            'urgent' => true,
            'urgency' => $urgency,
        ]);

        foreach ($userIds as $userId) {
            $payload = [
                'user_id' => $userId,
                'type' => Notification::TYPE_URGENT,
                'title' => $title,
                'message' => $message,
                'data' => $baseOptions['data'],
            ];

            if ($supports['project_id']) {
                $payload['project_id'] = $baseOptions['project_id'] ?? null;
            }
            if ($supports['icon']) {
                $payload['icon'] = $baseOptions['icon'] ?? null;
            }
            if ($supports['action_url']) {
                $payload['action_url'] = $baseOptions['action_url'] ?? null;
            }

            $payload = self::addUrgentFieldsToPayload($payload, $baseOptions, $supports);

            // Dedupe: rely on unique(user_id, dedupe_key). If it already exists, skip.
            try {
                Notification::create($payload);
            } catch (\Illuminate\Database\QueryException $e) {
                // Intentionally swallow duplicate inserts (race / retry)
                $sqlState = $e->errorInfo[0] ?? null;
                $driverCode = (string) ($e->errorInfo[1] ?? '');

                $isDuplicate = false;
                // MySQL: SQLSTATE 23000, error 1062
                if ($sqlState === '23000' && $driverCode === '1062') {
                    $isDuplicate = true;
                }
                // Postgres: SQLSTATE 23505
                if ($sqlState === '23505') {
                    $isDuplicate = true;
                }
                // SQLite: SQLSTATE 23000 (driver codes vary; treat as duplicate only if message indicates it)
                if ($sqlState === '23000' && str_contains(strtolower($e->getMessage()), 'unique')) {
                    $isDuplicate = true;
                }

                if (!$isDuplicate) {
                    throw $e;
                }
            }
        }
    }

    /**
     * Send notification to all users of a project
     */
    public static function sendToProject(Project $project, string $type, string $title, string $message, array $options = [], ?int $excludeUserId = null): void
    {
        $userIds = $project->users()->pluck('users.id')->toArray();
        
        if ($excludeUserId) {
            $userIds = array_filter($userIds, fn($id) => $id !== $excludeUserId);
        }

        $options['project_id'] = $project->id;
        self::sendToUsers($userIds, $type, $title, $message, $options);
    }

    /**
     * Send notification to all admins
     */
    public static function sendToAdmins(string $type, string $title, string $message, array $options = []): void
    {
        $adminIds = User::whereIn('role', ['admin', 'consultation'])->where('is_active', true)->pluck('id')->toArray();
        self::sendToUsers($adminIds, $type, $title, $message, $options);
    }

    /**
     * Send notification to all users (broadcast)
     */
    public static function broadcast(string $type, string $title, string $message, array $options = []): void
    {
        $userIds = User::where('is_active', true)->pluck('id')->toArray();
        self::sendToUsers($userIds, $type, $title, $message, $options);
    }

    // ========== Specific Notification Types ==========

    /**
     * KPI Report submitted - notify admins
     */
    public static function kpiSubmitted($kpiReport): void
    {
        $project = $kpiReport->project;
        $submitter = $kpiReport->submitter;

        $options = [
            'project_id' => $project->id,
            'icon' => 'clipboard-check',
            'action_url' => "/admin/kpi?report={$kpiReport->id}",
            'data' => [
                'kpi_report_id' => $kpiReport->id,
                'project_name' => $project->name,
                'week' => $kpiReport->week_number,
            ],
        ];

        self::sendToAdmins(
            Notification::TYPE_KPI_SUBMITTED,
            'Nouveau rapport KPI soumis',
            "{$submitter->name} a soumis un rapport KPI pour {$project->name} (Semaine {$kpiReport->week_number})",
            $options
        );

        $hseManagerIds = $project
            ->users()
            ->whereIn('role', [User::ROLE_HSE_MANAGER, User::ROLE_REGIONAL_HSE_MANAGER])
            ->where('is_active', true)
            ->pluck('users.id')
            ->toArray();

        if (!empty($hseManagerIds)) {
            self::sendToUsers(
                $hseManagerIds,
                Notification::TYPE_KPI_SUBMITTED,
                'Nouveau rapport KPI à valider',
                "{$submitter->name} a soumis un rapport KPI pour {$project->name} (Semaine {$kpiReport->week_number})",
                $options
            );
        }
    }

    /**
     * KPI Report approved - notify submitter
     */
    public static function kpiApproved($kpiReport): void
    {
        $project = $kpiReport->project;

        self::sendToUser(
            $kpiReport->submitter,
            Notification::TYPE_KPI_APPROVED,
            'Rapport KPI approuvé',
            "Votre rapport KPI pour {$project->name} (Semaine {$kpiReport->week_number}) a été approuvé",
            [
                'project_id' => $project->id,
                'icon' => 'check-circle',
                'action_url' => "/kpi/history",
                'data' => [
                    'kpi_report_id' => $kpiReport->id,
                    'project_name' => $project->name,
                ],
            ]
        );
    }

    /**
     * KPI Report rejected - notify submitter
     */
    public static function kpiRejected($kpiReport, string $reason = null): void
    {
        $project = $kpiReport->project;
        $message = "Votre rapport KPI pour {$project->name} (Semaine {$kpiReport->week_number}) a été rejeté";
        if ($reason) {
            $message .= ". Motif: {$reason}";
        }

        self::sendToUser(
            $kpiReport->submitter,
            Notification::TYPE_KPI_REJECTED,
            'Rapport KPI rejeté',
            $message,
            [
                'project_id' => $project->id,
                'icon' => 'x-circle',
                'action_url' => "/kpi/edit/{$kpiReport->id}",
                'data' => [
                    'kpi_report_id' => $kpiReport->id,
                    'project_name' => $project->name,
                    'reason' => $reason,
                ],
            ]
        );
    }

    /**
     * User assigned to project - notify user
     */
    public static function projectAssigned(User $user, Project $project): void
    {
        self::sendToUser(
            $user,
            Notification::TYPE_PROJECT_ASSIGNED,
            'Nouveau projet assigné',
            "Vous avez été assigné au projet: {$project->name}",
            [
                'project_id' => $project->id,
                'icon' => 'folder-plus',
                'action_url' => "/projects/{$project->id}",
                'data' => [
                    'project_name' => $project->name,
                ],
            ]
        );
    }

    /**
     * SOR Report submitted - notify project users and admins
     */
    public static function sorSubmitted($sorReport): void
    {
        $project = $sorReport->project;
        $submitter = $sorReport->submitter;

        // Notify admins
        self::sendToAdmins(
            Notification::TYPE_SOR_SUBMITTED,
            'Nouvelle non-conformité signalée',
            "{$submitter->name} a signalé une non-conformité sur {$project->name}",
            [
                'project_id' => $project->id,
                'icon' => 'alert-triangle',
                'action_url' => "/admin/sor?report={$sorReport->id}",
                'data' => [
                    'sor_report_id' => $sorReport->id,
                    'project_name' => $project->name,
                    'category' => $sorReport->category,
                ],
            ]
        );

        // Notify project responsables (exclude submitter)
        self::sendToProject(
            $project,
            Notification::TYPE_SOR_SUBMITTED,
            'Nouvelle non-conformité sur votre projet',
            "Une non-conformité a été signalée: {$sorReport->non_conformity}",
            [
                'icon' => 'alert-triangle',
                'action_url' => "/sor?report={$sorReport->id}",
                'data' => [
                    'sor_report_id' => $sorReport->id,
                    'category' => $sorReport->category,
                ],
            ],
            $submitter->id
        );
    }

    /**
     * SOR corrective action submitted - notify relevant users
     */
    public static function sorCorrected($sorReport): void
    {
        $project = $sorReport->project;

        // Notify admins
        self::sendToAdmins(
            Notification::TYPE_SOR_CORRECTED,
            'Action corrective soumise',
            "Une action corrective a été soumise pour une non-conformité sur {$project->name}",
            [
                'project_id' => $project->id,
                'icon' => 'check-circle',
                'action_url' => "/admin/sor?report={$sorReport->id}",
                'data' => [
                    'sor_report_id' => $sorReport->id,
                    'project_name' => $project->name,
                ],
            ]
        );
    }

    /**
     * Training submitted - notify admins
     */
    public static function trainingSubmitted($training): void
    {
        $project = $training->project;
        $submitter = $training->submitter;

        self::sendToAdmins(
            Notification::TYPE_TRAINING_SUBMITTED,
            'Nouvelle formation enregistrée',
            "{$submitter->name} a enregistré une formation sur {$project->name}: {$training->theme}",
            [
                'project_id' => $project->id,
                'icon' => 'book-open',
                'action_url' => "/admin/trainings",
                'data' => [
                    'training_id' => $training->id,
                    'project_name' => $project->name,
                    'theme' => $training->theme,
                    'participants' => $training->participants,
                ],
            ]
        );
    }

    /**
     * Awareness session submitted - notify admins
     */
    public static function awarenessSubmitted($session): void
    {
        $project = $session->project;
        $submitter = $session->submitter;

        self::sendToAdmins(
            Notification::TYPE_AWARENESS_SUBMITTED,
            'Nouvelle sensibilisation enregistrée',
            "{$submitter->name} a enregistré une sensibilisation TBM/TBT sur {$project->name}",
            [
                'project_id' => $project->id,
                'icon' => 'users',
                'action_url' => "/admin/awareness",
                'data' => [
                    'session_id' => $session->id,
                    'project_name' => $project->name,
                    'theme' => $session->theme,
                    'participants' => $session->participants,
                ],
            ]
        );
    }

    /**
     * Weekly reminder for KPI submission
     */
    public static function kpiReminder(User $user, Project $project, int $week): void
    {
        self::sendToUser(
            $user,
            Notification::TYPE_REMINDER,
            'Rappel: Rapport KPI en attente',
            "N'oubliez pas de soumettre votre rapport KPI pour {$project->name} (Semaine {$week})",
            [
                'project_id' => $project->id,
                'icon' => 'clock',
                'action_url' => "/kpi/submit/{$project->id}",
                'data' => [
                    'project_name' => $project->name,
                    'week' => $week,
                ],
            ]
        );
    }

    /**
     * System announcement to all users
     */
    public static function systemAnnouncement(string $title, string $message): void
    {
        self::broadcast(
            Notification::TYPE_SYSTEM,
            $title,
            $message,
            [
                'icon' => 'megaphone',
            ]
        );
    }

    public static function workerTrainingExpiring(WorkerTraining $training): void
    {
        $worker = $training->worker;

        if (!$worker || !$worker->project) {
            return;
        }

        $project = $worker->project;

        $recipients = $project->users()
            ->whereIn('role', [User::ROLE_RESPONSABLE, User::ROLE_SUPERVISOR])
            ->active()
            ->get();

        if ($recipients->isEmpty()) {
            return;
        }

        $label = $training->training_label ?: $training->training_type;
        $expiryDate = $training->expiry_date ? $training->expiry_date->format('d/m/Y') : null;

        foreach ($recipients as $user) {
            self::sendToUser(
                $user,
                Notification::TYPE_WORKER_TRAINING_EXPIRING,
                'Formation du personnel bientôt expirée',
                "La formation {$label} pour {$worker->full_name} (CIN {$worker->cin}) sur le projet {$project->name} va expirer le {$expiryDate}.",
                [
                    'project_id' => $project->id,
                    'icon' => 'hard-hat',
                    'action_url' => "/qualified-personnel?project_id={$project->id}&worker_id={$worker->id}",
                    'data' => [
                        'worker_training_id' => $training->id,
                        'worker_id' => $worker->id,
                        'worker_cin' => $worker->cin,
                        'project_id' => $project->id,
                        'expiry_date' => $training->expiry_date ? $training->expiry_date->toDateString() : null,
                    ],
                ]
            );
        }
    }

    public static function workerTrainingExpired(WorkerTraining $training): void
    {
        $worker = $training->worker;

        if (!$worker || !$worker->project) {
            return;
        }

        $project = $worker->project;

        $recipients = $project->users()
            ->whereIn('role', [User::ROLE_RESPONSABLE, User::ROLE_SUPERVISOR])
            ->active()
            ->get();

        if ($recipients->isEmpty()) {
            return;
        }

        $label = $training->training_label ?: $training->training_type;
        $expiryDate = $training->expiry_date ? $training->expiry_date->format('d/m/Y') : null;

        foreach ($recipients as $user) {
            self::sendToUser(
                $user,
                Notification::TYPE_WORKER_TRAINING_EXPIRED,
                'Formation du personnel expirée',
                "La formation {$label} pour {$worker->full_name} (CIN {$worker->cin}) sur le projet {$project->name} est expirée depuis le {$expiryDate}.",
                [
                    'project_id' => $project->id,
                    'icon' => 'hard-hat',
                    'action_url' => "/qualified-personnel?project_id={$project->id}&worker_id={$worker->id}",
                    'data' => [
                        'worker_training_id' => $training->id,
                        'worker_id' => $worker->id,
                        'worker_cin' => $worker->cin,
                        'project_id' => $project->id,
                        'expiry_date' => $training->expiry_date ? $training->expiry_date->toDateString() : null,
                    ],
                ]
            );
        }
    }
}
