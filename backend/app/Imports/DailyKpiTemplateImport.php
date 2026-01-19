<?php

namespace App\Imports;

use Carbon\Carbon;

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
            $dataStartRow + 2 => 'releve_ecarts',
            $dataStartRow + 3 => 'sensibilisation',
            $dataStartRow + 4 => 'presquaccident',
            $dataStartRow + 5 => 'premiers_soins',
            $dataStartRow + 6 => 'accidents',
            $dataStartRow + 7 => 'jours_arret',
            $dataStartRow + 8 => 'heures_travaillees',
            $dataStartRow + 9 => 'inspections',
            $dataStartRow + 10 => 'heures_formation',
            $dataStartRow + 11 => 'permis_travail',
            $dataStartRow + 12 => 'mesures_disciplinaires',
            $dataStartRow + 13 => 'conformite_hse',
            $dataStartRow + 14 => 'conformite_medicale',
        ];

        // Extract daily values
        $dailyData = [];
        foreach ($dates as $colIndex => $dateStr) {
            try {
                $date = Carbon::parse($dateStr);
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
            'releve_ecarts' => (int) $collect->sum('releve_ecarts'),
            'sensibilisation' => (int) $collect->sum('sensibilisation'),
            'presquaccident' => (int) $collect->sum('presquaccident'),
            'premiers_soins' => (int) $collect->sum('premiers_soins'),
            'accidents' => (int) $collect->sum('accidents'),
            'jours_arret' => (int) $collect->sum('jours_arret'),
            'heures_travaillees' => (float) $collect->sum('heures_travaillees'),
            'inspections' => (int) $collect->sum('inspections'),
            'heures_formation' => (float) $collect->sum('heures_formation'),
            'permis_travail' => (int) $collect->sum('permis_travail'),
            'mesures_disciplinaires' => (int) $collect->sum('mesures_disciplinaires'),
            
            // AVG
            'conformite_hse' => round($collect->whereNotNull('conformite_hse')->avg('conformite_hse') ?? 0, 2),
            'conformite_medicale' => round($collect->whereNotNull('conformite_medicale')->avg('conformite_medicale') ?? 0, 2),
        ];
    }
}
