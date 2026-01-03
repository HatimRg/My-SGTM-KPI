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
        ];

        return $supports;
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

            Notification::create($payload);
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
        $adminIds = User::where('role', 'admin')->where('is_active', true)->pluck('id')->toArray();
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

        self::sendToAdmins(
            Notification::TYPE_KPI_SUBMITTED,
            'Nouveau rapport KPI soumis',
            "{$submitter->name} a soumis un rapport KPI pour {$project->name} (Semaine {$kpiReport->week_number})",
            [
                'project_id' => $project->id,
                'icon' => 'clipboard-check',
                'action_url' => "/admin/kpi?report={$kpiReport->id}",
                'data' => [
                    'kpi_report_id' => $kpiReport->id,
                    'project_name' => $project->name,
                    'week' => $kpiReport->week_number,
                ],
            ]
        );
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
