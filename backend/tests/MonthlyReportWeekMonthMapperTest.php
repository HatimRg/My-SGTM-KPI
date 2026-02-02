<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use App\Services\MonthlyReportWeekMonthMapper;

final class MonthlyReportWeekMonthMapperTest extends TestCase
{
    public function test_week_to_month_key_same_month(): void
    {
        $this->assertSame('2026-01', MonthlyReportWeekMonthMapper::weekToMonthKey('2026-01-03', '2026-01-09'));
    }

    public function test_week_split_assigns_to_month_with_more_days(): void
    {
        // 3 days in Jan (29-31) + 4 days in Feb (1-4) => Feb
        $this->assertSame('2026-02', MonthlyReportWeekMonthMapper::weekToMonthKey('2026-01-29', '2026-02-04'));
    }

    public function test_week_split_tie_breaks_by_week_end_month(): void
    {
        // 3 days Jan (30-31)?? Need 3 vs 3; use a 6-day range to force tie
        // Jan 30-31 (2 days) + Feb 1-2 (2 days) => tie, end is Feb
        $this->assertSame('2026-02', MonthlyReportWeekMonthMapper::weekToMonthKey('2026-01-30', '2026-02-02'));
    }

    public function test_week_to_month_key_swaps_if_inverted_range(): void
    {
        $this->assertSame('2026-02', MonthlyReportWeekMonthMapper::weekToMonthKey('2026-02-04', '2026-01-29'));
    }
}
