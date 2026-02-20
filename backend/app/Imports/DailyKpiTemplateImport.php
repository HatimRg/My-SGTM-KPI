<?php

namespace App\Imports;

use Carbon\Carbon;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class DailyKpiTemplateImport
{
    /**
     * Parse uploaded Excel file and extract daily KPI data
     */
    public static function parse($file): array
    {
        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getPathname());
        $sheet = $spreadsheet->getActiveSheet();
        $data = $sheet->toArray();

        // Find the _DATES_ row (should be row 8, index 7)
        $dateRowIndex = null;
        foreach ($data as $index => $row) {
            if (isset($row[0]) && $row[0] === '_DATES_') {
                $dateRowIndex = $index;
                break;
            }
        }

        if ($dateRowIndex === null) {
            throw new \Exception('Invalid template format: _DATES_ row not found');
        }

        // Extract dates from the date row
        $dateRow = $data[$dateRowIndex] ?? [];
        $dates = [];
        for ($i = 1; $i <= 7; $i++) {
            if (!empty($dateRow[$i])) {
                $dates[$i] = $dateRow[$i];
            }
        }

        // KPI fields start after the date row
        $dataStartRow = $dateRowIndex + 1;
        
        // Map KPI field names to row indices
        $fieldMap = [
            $dataStartRow + 0 => 'effectif',
            $dataStartRow + 1 => 'induction',
        ];

        // Extract daily values
        $dailyData = [];
        foreach ($dates as $colIndex => $dateStr) {
            try {
                $date = self::parseTemplateDate($dateStr);
                if (!$date) {
                    continue;
                }
                $dayData = [
                    'entry_date' => $date->format('Y-m-d'),
                    'day_name' => $date->englishDayOfWeek,
                ];

                foreach ($fieldMap as $rowIndex => $fieldName) {
                    $value = $data[$rowIndex][$colIndex] ?? null;
                    $dayData[$fieldName] = self::normalizeNumeric($value);
                }

                $dailyData[] = $dayData;
            } catch (\Exception $e) {
                continue;
            }
        }

        return $dailyData;
    }

    private static function parseTemplateDate($value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if ($value instanceof \DateTimeInterface) {
                return Carbon::instance($value);
            }

            if (is_numeric($value)) {
                return Carbon::instance(ExcelDate::excelToDateTimeObject((float) $value));
            }

            $raw = trim((string) $value);
            if ($raw === '') {
                return null;
            }

            $formats = ['d/m/Y', 'd-m-Y', 'd.m.Y', 'Y-m-d', 'm/d/Y'];
            foreach ($formats as $format) {
                try {
                    return Carbon::createFromFormat($format, $raw);
                } catch (\Throwable $e) {
                }
            }

            return Carbon::parse($raw);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function normalizeNumeric($value): ?float
    {
        if ($value === '' || $value === null) {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        if (is_string($value)) {
            $v = trim($value);
            if ($v === '') {
                return null;
            }

            $v = str_replace(['%', ' ', "\u{00A0}", ','], ['', '', '', '.'], $v);
            return is_numeric($v) ? (float) $v : null;
        }

        return null;
    }

    /**
     * Calculate aggregated values from daily data using the formulas
     */
    public static function calculateAggregates(array $dailyData): array
    {
        if (empty($dailyData)) {
            return [];
        }

        $collect = collect($dailyData);

        return [
            // MAX
            'effectif' => (int) $collect->max('effectif'),
            
            // SUM
            'induction' => (int) $collect->sum('induction'),
        ];
    }
}
