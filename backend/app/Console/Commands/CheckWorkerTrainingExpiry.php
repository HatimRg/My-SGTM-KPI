<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\WorkerTraining;
use App\Services\NotificationService;

class CheckWorkerTrainingExpiry extends Command
{
    protected $signature = 'worker-trainings:check-expiry';

    protected $description = 'Send notifications for expiring and expired worker trainings';

    public function handle(): int
    {
        $this->info('Checking worker trainings for expiry...');

        $today = now()->startOfDay();
        $expiringLimit = now()->addDays(30)->endOfDay();

        // Expiring soon (within next 30 days), not yet notified
        $expiringTrainings = WorkerTraining::with(['worker.project'])
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '>=', $today)
            ->whereDate('expiry_date', '<=', $expiringLimit)
            ->whereNull('expiring_notified_at')
            ->get();

        foreach ($expiringTrainings as $training) {
            NotificationService::workerTrainingExpiring($training);
            $training->forceFill(['expiring_notified_at' => now()])->save();
        }

        // Already expired, not yet notified
        $expiredTrainings = WorkerTraining::with(['worker.project'])
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', $today)
            ->whereNull('expired_notified_at')
            ->get();

        foreach ($expiredTrainings as $training) {
            NotificationService::workerTrainingExpired($training);
            $training->forceFill(['expired_notified_at' => now()])->save();
        }

        $this->info('Worker training expiry check completed.');

        return Command::SUCCESS;
    }
}
