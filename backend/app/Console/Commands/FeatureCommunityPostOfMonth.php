<?php

namespace App\Console\Commands;

use App\Models\CommunityPost;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FeatureCommunityPostOfMonth extends Command
{
    protected $signature = 'community-feed:feature-post-of-month {--month=} {--year=} {--dry-run}';

    protected $description = 'Features the top-liked community post from the previous month for the first week of the current month.';

    public function handle(): int
    {
        $now = now();

        $yearOpt = $this->option('year');
        $monthOpt = $this->option('month');

        if ($yearOpt !== null && $monthOpt !== null) {
            $year = (int) $yearOpt;
            $month = (int) $monthOpt;
            $targetMonthStart = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        } else {
            $targetMonthStart = $now->copy()->startOfMonth();
        }

        $prevMonthStart = $targetMonthStart->copy()->subMonthNoOverflow()->startOfMonth();
        $prevMonthEnd = $prevMonthStart->copy()->endOfMonth();

        $featureFrom = $targetMonthStart->copy()->startOfDay();
        $featureUntil = $targetMonthStart->copy()->addDays(6)->endOfDay();

        $this->info("Computing post of the month for {$prevMonthStart->toDateString()}..{$prevMonthEnd->toDateString()} (feature window {$featureFrom->toDateString()}..{$featureUntil->toDateString()})");

        $top = CommunityPost::query()
            ->select('community_posts.*')
            ->join('community_post_reactions', 'community_post_reactions.post_id', '=', 'community_posts.id')
            ->where('community_posts.status', 'published')
            ->whereNull('community_posts.deleted_at')
            ->where('community_post_reactions.reaction_type', 'like')
            ->whereBetween('community_post_reactions.created_at', [$prevMonthStart, $prevMonthEnd])
            ->groupBy('community_posts.id')
            ->orderByRaw('COUNT(community_post_reactions.id) DESC')
            ->orderBy('community_posts.created_at', 'DESC')
            ->first();

        if (!$top) {
            $this->warn('No eligible post found for previous month.');
            return self::SUCCESS;
        }

        $dryRun = (bool) $this->option('dry-run');
        $this->info("Selected post_id={$top->id}");

        if ($dryRun) {
            $this->info('Dry-run mode: no changes applied.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($top, $featureFrom, $featureUntil) {
            CommunityPost::query()
                ->where('is_featured', true)
                ->update([
                    'is_featured' => false,
                    'featured_from' => null,
                    'featured_until' => null,
                ]);

            CommunityPost::query()
                ->where('id', $top->id)
                ->update([
                    'is_featured' => true,
                    'featured_from' => $featureFrom,
                    'featured_until' => $featureUntil,
                ]);
        });

        $this->info('Featured post updated successfully.');

        return self::SUCCESS;
    }
}
