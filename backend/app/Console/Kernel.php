<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('worker-trainings:check-expiry')->dailyAt('06:00');

        $schedule->command('library:index')
            ->everyFiveMinutes()
            ->timezone('Africa/Casablanca');

        $schedule->command('community-feed:feature-post-of-month')
            ->monthlyOn(1, '00:10')
            ->timezone('Africa/Casablanca');

        $schedule->command('daily-effectif:check-missing')
            ->dailyAt('00:30')
            ->timezone('Africa/Casablanca');

        $schedule->command('backup:full')
            ->hourly()
            ->timezone('Africa/Casablanca');
    }

    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');
        require base_path('routes/console.php');
    }
}
