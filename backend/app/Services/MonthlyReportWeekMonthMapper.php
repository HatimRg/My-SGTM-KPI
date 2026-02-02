<?php

namespace App\Services;

use Carbon\Carbon;

class MonthlyReportWeekMonthMapper
{
    /**
     * Decide the month key (YYYY-MM) to which the whole week belongs.
     *
     * Rule:
     * - If week spans 2 months, assign to the month containing more days.
     * - If equal days, assign to the month that contains the week end date.
     */
    public static function weekToMonthKey($weekStart, $weekEnd): string
    {
        $start = $weekStart instanceof Carbon ? $weekStart->copy()->startOfDay() : Carbon::parse($weekStart)->startOfDay();
        $end = $weekEnd instanceof Carbon ? $weekEnd->copy()->startOfDay() : Carbon::parse($weekEnd)->startOfDay();

        if ($end->lt($start)) {
            [$start, $end] = [$end, $start];
        }

        $startKey = $start->format('Y-m');
        $endKey = $end->format('Y-m');

        if ($startKey === $endKey) {
            return $startKey;
        }

        // Count days per month across the inclusive date range.
        $cursor = $start->copy();
        $counts = [];
        while ($cursor->lte($end)) {
            $k = $cursor->format('Y-m');
            $counts[$k] = ($counts[$k] ?? 0) + 1;
            $cursor->addDay();
        }

        arsort($counts); // highest count first
        $topKeys = array_keys($counts);
        $top = $topKeys[0] ?? $endKey;

        // Handle tie: if the top 2 have the same day count, choose end date's month.
        if (count($topKeys) >= 2) {
            $firstCount = $counts[$topKeys[0]];
            $secondCount = $counts[$topKeys[1]];
            if ($firstCount === $secondCount) {
                return $endKey;
            }
        }

        return $top;
    }
}
