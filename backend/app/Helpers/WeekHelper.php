<?php

namespace App\Helpers;

use Carbon\Carbon;

/**
 * Week Helper for SGTM KPI System
 * Weeks run Saturday to Friday, 52 weeks per year
 * Reference: Week 48/2025 = Sat 22/11/2025 to Fri 28/11/2025
 */
class WeekHelper
{
    /**
     * Get the start date (Saturday) of Week 1 for a given year
     * Week 1 starts on the last Saturday of the previous December
     */
    public static function getWeek1Start(int $year): Carbon
    {
        // Find December 31 of the previous year
        $dec31 = Carbon::create($year - 1, 12, 31);
        
        // Find the Saturday on or before Dec 31
        // In Carbon: Saturday = 6 (0=Sunday, 6=Saturday)
        $dayOfWeek = $dec31->dayOfWeek;
        
        // If Dec 31 is Saturday (6), that's Week 1 start
        // Otherwise, go back to the previous Saturday
        if ($dayOfWeek === Carbon::SATURDAY) {
            return $dec31->copy();
        }
        
        // Calculate days to go back to reach Saturday
        // dayOfWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        $daysBack = ($dayOfWeek + 1) % 7; // Days since last Saturday
        return $dec31->copy()->subDays($daysBack);
    }

    /**
     * Get the start and end dates for a specific week of a year
     * @return array ['start' => Carbon, 'end' => Carbon]
     */
    public static function getWeekDates(int $weekNumber, int $year): array
    {
        if ($weekNumber < 1 || $weekNumber > 52) {
            throw new \InvalidArgumentException('Week number must be between 1 and 52');
        }

        $week1Start = self::getWeek1Start($year);
        
        // Add (weekNumber - 1) * 7 days to get to the desired week
        $weekStart = $week1Start->copy()->addDays(($weekNumber - 1) * 7);
        $weekEnd = $weekStart->copy()->addDays(6); // Friday

        return [
            'start' => $weekStart,
            'end' => $weekEnd,
        ];
    }

    /**
     * Get the week number for a given date
     * @return array ['week' => int, 'year' => int]
     */
    public static function getWeekFromDate(Carbon $date): array
    {
        $year = $date->year;
        
        // Check if the date falls in the current year's weeks
        $week1Start = self::getWeek1Start($year);
        $week52End = $week1Start->copy()->addDays(52 * 7 - 1);
        
        // If date is before Week 1 of this year, it belongs to previous year
        if ($date->lt($week1Start)) {
            $year = $year - 1;
            $week1Start = self::getWeek1Start($year);
        }
        // If date is after Week 52 of this year, it belongs to next year
        elseif ($date->gt($week52End)) {
            $year = $year + 1;
            $week1Start = self::getWeek1Start($year);
        }

        // Calculate week number
        $daysDiff = $week1Start->diffInDays($date);
        $weekNumber = (int) floor($daysDiff / 7) + 1;

        // Ensure week number is within bounds
        $weekNumber = max(1, min(52, $weekNumber));

        return [
            'week' => $weekNumber,
            'year' => $year,
        ];
    }

    /**
     * Get the current week number and year
     */
    public static function getCurrentWeek(): array
    {
        return self::getWeekFromDate(Carbon::now());
    }

    /**
     * Get all 52 weeks for a year with their date ranges
     */
    public static function getAllWeeksForYear(int $year): array
    {
        $weeks = [];
        for ($w = 1; $w <= 52; $w++) {
            $dates = self::getWeekDates($w, $year);
            $weeks[] = [
                'week' => $w,
                'year' => $year,
                'start_date' => $dates['start']->format('Y-m-d'),
                'end_date' => $dates['end']->format('Y-m-d'),
                'label' => "Semaine {$w} ({$dates['start']->format('d/m')} - {$dates['end']->format('d/m')})",
            ];
        }
        return $weeks;
    }

    /**
     * Format week for display
     */
    public static function formatWeek(int $weekNumber, int $year): string
    {
        $dates = self::getWeekDates($weekNumber, $year);
        return "Semaine {$weekNumber} ({$dates['start']->format('d/m/Y')} - {$dates['end']->format('d/m/Y')})";
    }
}
