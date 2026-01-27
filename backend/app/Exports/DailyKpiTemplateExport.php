<?php

namespace App\Exports;

use App\Helpers\WeekHelper;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithDrawings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

class DailyKpiTemplateExport implements FromArray, WithStyles, WithColumnWidths, WithTitle, WithDrawings, WithEvents
{
    protected $projectName;
    protected $projectCode;
    protected $weekNumber;
    protected $year;
    protected $weekDates;
    protected $autoFillValues;
    protected string $lang;

    public function __construct(string $projectName, string $projectCode, int $weekNumber, int $year, array $autoFillValues = [], string $lang = 'fr')
    {
        $this->projectName = $projectName;
        $this->projectCode = $projectCode;
        $this->weekNumber = $weekNumber;
        $this->year = $year;
        $this->weekDates = WeekHelper::getWeekDates($weekNumber, $year);
        $this->autoFillValues = $autoFillValues;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    public function title(): string
    {
        return $this->tr('KPI HSE Journalier', 'Daily HSE KPI');
    }

    public function drawings()
    {
        $drawing = new Drawing();
        $logoPath = public_path('images/sgtm-logo.jpg');
        
        if (file_exists($logoPath)) {
            $drawing->setName('SGTM Logo');
            $drawing->setDescription('SGTM Logo');
            $drawing->setPath($logoPath);
            $drawing->setHeight(68);
            $drawing->setCoordinates('A1');
            $drawing->setOffsetX(10);
            $drawing->setOffsetY(5);
            return [$drawing];
        }
        
        return [];
    }

    public function array(): array
    {
        $startDate = $this->weekDates['start'];
        $days = [];
        $dayNames = $this->lang === 'en'
            ? ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            : ['Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
        
        // Generate 7 days (Saturday to Friday)
        for ($i = 0; $i < 7; $i++) {
            $date = $startDate->copy()->addDays($i);
            $days[] = [
                'name' => $dayNames[$i],
                'date' => $date->format('d/m/Y'),
                'iso' => $date->format('Y-m-d'),
            ];
        }

        $rows = [];

        // Row 1: Title with space for logo
        $rows[] = ['', '', $this->tr('SUIVI JOURNALIER HSE', 'DAILY HSE TRACKING'), '', '', '', '', ''];
        
        // Row 2: Empty separator
        $rows[] = [''];
        
        // Rows 3-5: Project info in a professional card style
        $rows[] = [$this->tr('PROJET', 'PROJECT'), $this->projectName, '', '', 'CODE', $this->projectCode, '', ''];
        $rows[] = [$this->tr('SEMAINE', 'WEEK'), "S{$this->weekNumber}", '', '', $this->tr('ANNÉE', 'YEAR'), $this->year, '', ''];
        $rows[] = [$this->tr('PÉRIODE', 'PERIOD'), $this->weekDates['start']->format('d/m/Y') . $this->tr(' au ', ' to ') . $this->weekDates['end']->format('d/m/Y'), '', '', '', '', '', ''];
        
        // Row 6: Empty separator
        $rows[] = [''];
        
        // Row 7: Column headers (only 8 columns now: Indicator + 7 days)
        $headerRow = [$this->tr('INDICATEUR', 'INDICATOR')];
        foreach ($days as $day) {
            $headerRow[] = $day['name'] . "\n" . $day['date'];
        }
        $rows[] = $headerRow;

        // Row 8: Hidden date row for import parsing
        $dateRow = ['_DATES_'];
        foreach ($days as $day) {
            $dateRow[] = $day['date'];
        }
        $rows[] = $dateRow;

        // KPI rows (18 indicators) with field keys for auto-fill
        // Fields that should show 0 when no data (auto-filled from system)
        $autoFillFields = ['releve_ecarts', 'sensibilisation', 'heures_formation', 'permis_travail', 'inspections', 'mesures_disciplinaires'];
        
        $kpiFields = [
            ['label' => $this->tr('Effectif', 'Workforce'), 'key' => 'effectif'],
            ['label' => $this->tr('Induction', 'Induction'), 'key' => 'induction'],
            ['label' => $this->tr('Relevé des écarts', 'Deviations'), 'key' => 'releve_ecarts'],
            ['label' => $this->tr('Nombre de Sensibilisation', 'Awareness sessions'), 'key' => 'sensibilisation'],
            ['label' => $this->tr('Presqu\'accident', 'Near miss'), 'key' => 'presquaccident'],
            ['label' => $this->tr('Premiers soins', 'First aid'), 'key' => 'premiers_soins'],
            ['label' => $this->tr('Accident', 'Accident'), 'key' => 'accidents'],
            ['label' => $this->tr('Nombre de jours d\'arrêt', 'Lost days'), 'key' => 'jours_arret'],
            ['label' => $this->tr('Heures travaillées', 'Hours worked'), 'key' => 'heures_travaillees'],
            ['label' => $this->tr('Nombre d\'Inspections', 'Inspections'), 'key' => 'inspections'],
            ['label' => $this->tr('Heures de formation', 'Training hours'), 'key' => 'heures_formation'],
            ['label' => $this->tr('Permis de travail', 'Work permits'), 'key' => 'permis_travail'],
            ['label' => $this->tr('Mesures disciplinaires', 'Disciplinary measures'), 'key' => 'mesures_disciplinaires'],
            ['label' => $this->tr('Taux de conformité HSE (%)', 'HSE compliance rate (%)'), 'key' => 'conformite_hse'],
            ['label' => $this->tr('Taux de conformité Médicale (%)', 'Medical compliance rate (%)'), 'key' => 'conformite_medicale'],
        ];

        foreach ($kpiFields as $field) {
            $row = [$field['label']];
            $isAutoFillField = in_array($field['key'], $autoFillFields);
            
            // Fill each of the 7 days (Saturday to Friday)
            for ($i = 0; $i < 7; $i++) {
                $value = '';
                
                // For auto-fill fields: ALWAYS show a number (0 if no data)
                if ($isAutoFillField) {
                    // Default to 0
                    $value = 0;
                    
                    // Get value from autoFillValues if available
                    if (isset($this->autoFillValues[$i]['auto_values'][$field['key']])) {
                        $dbValue = $this->autoFillValues[$i]['auto_values'][$field['key']];
                        if (is_numeric($dbValue)) {
                            $value = $field['key'] === 'heures_formation' ? (float) $dbValue : (int) $dbValue;
                        } else {
                            $value = 0;
                        }
                    }
                    
                    // IMPORTANT: Keep 0 as integer 0, don't let it become empty
                    // Value is guaranteed to be an integer here
                }

                if (!$isAutoFillField && $field['key'] === 'conformite_hse') {
                    if (
                        isset($this->autoFillValues[$i]['auto_values'][$field['key']]) &&
                        $this->autoFillValues[$i]['auto_values'][$field['key']] !== null &&
                        $this->autoFillValues[$i]['auto_values'][$field['key']] !== ''
                    ) {
                        $dbValue = $this->autoFillValues[$i]['auto_values'][$field['key']];
                        $value = is_numeric($dbValue) ? (float) $dbValue : '';
                    }
                }
                
                $row[] = $value;
            }
            $rows[] = $row;
        }

        // Footer instructions
        $rows[] = [''];
        $rows[] = [$this->tr('Instructions:', 'Instructions:')];
        $rows[] = [$this->tr('• Remplissez les valeurs journalières dans les colonnes correspondantes', '• Fill in the daily values in the corresponding columns')];
        $rows[] = [$this->tr('• Les totaux seront calculés automatiquement lors de l\'import', '• Totals will be calculated automatically during import')];
        $rows[] = [$this->tr('• Ne modifiez pas la structure du fichier (lignes/colonnes)', '• Do not modify the file structure (rows/columns)')];

        return $rows;
    }

    public function columnWidths(): array
    {
        return [
            'A' => 30,
            'B' => 13,
            'C' => 13,
            'D' => 13,
            'E' => 13,
            'F' => 13,
            'G' => 13,
            'H' => 13,
        ];
    }

    public function styles(Worksheet $sheet)
    {
        // SafeKPI Dark/Amber theme colors (matching app UI)
        $darkBg = '1F2937';           // Dark background (gray-800)
        $darkerBg = '111827';         // Darker background (gray-900)
        $primaryAmber = 'F59E0B';     // Amber-500 (primary accent)
        $darkAmber = 'D97706';        // Amber-600
        $lightAmber = 'FEF3C7';       // Amber-100
        $paleAmber = 'FFFBEB';        // Amber-50
        $textLight = 'F9FAFB';        // Light text
        $textMuted = '9CA3AF';        // Muted text (gray-400)

        // Row 1: Title styling
        $sheet->mergeCells('C1:F1');
        $sheet->getStyle('C1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => $primaryAmber]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(55);

        // Rows 3-5: Professional info card styling
        $sheet->mergeCells('B3:D3');
        $sheet->mergeCells('B4:D4');
        $sheet->mergeCells('B5:H5');
        
        // Info labels (A column) - Dark with amber accent
        $sheet->getStyle('A3:A5')->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $darkBg]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $primaryAmber]]],
        ]);
        
        // Info values (B column) - Light amber background
        $sheet->getStyle('B3:D5')->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => $darkBg]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $lightAmber]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER, 'indent' => 1],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $primaryAmber]]],
        ]);
        
        // Secondary labels (E column) - Amber accent
        $sheet->getStyle('E3:E4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => $darkerBg]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $primaryAmber]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $darkAmber]]],
        ]);
        
        // Secondary values (F column) - Pale amber background
        $sheet->getStyle('F3:H4')->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => $darkAmber]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $paleAmber]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER, 'indent' => 1],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $primaryAmber]]],
        ]);
        
        $sheet->getRowDimension(3)->setRowHeight(25);
        $sheet->getRowDimension(4)->setRowHeight(25);
        $sheet->getRowDimension(5)->setRowHeight(25);

        // Row 7: Header row styling - Dark background with amber text
        $sheet->getStyle('A7:H7')->applyFromArray([
            'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => $textLight]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $darkBg]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['rgb' => $primaryAmber]]],
        ]);
        $sheet->getRowDimension(7)->setRowHeight(40);

        // Hide date reference row (row 8)
        $sheet->getRowDimension(8)->setVisible(false);

        // Data entry area styling (rows 9-23)
        $lastDataRow = 23;
        
        // KPI labels column - Amber tinted with dark text
        $sheet->getStyle("A9:A{$lastDataRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => '1F2937']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEF3C7']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER, 'indent' => 1],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $primaryAmber]]],
        ]);

        // Data entry cells - Light amber background with dark text for contrast
        $sheet->getStyle("B9:H{$lastDataRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => '1F2937']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FFFBEB']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $primaryAmber]]],
            'numberFormat' => ['formatCode' => '0'],
        ]);

        // Allow decimals for hours and compliance rates
        $sheet->getStyle('B17:H17')->getNumberFormat()->setFormatCode('0.00');
        $sheet->getStyle('B19:H19')->getNumberFormat()->setFormatCode('0.00');
        $sheet->getStyle('B22:H22')->getNumberFormat()->setFormatCode('0.00');
        $sheet->getStyle('B23:H23')->getNumberFormat()->setFormatCode('0.00');

        // Alternate row colors for better readability
        for ($i = 9; $i <= $lastDataRow; $i++) {
            if ($i % 2 == 0) {
                $sheet->getStyle("B{$i}:H{$i}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEF3C7']],
                ]);
            }
            $sheet->getRowDimension($i)->setRowHeight(24);
        }

        // Instructions styling - Amber accent
        $instructionRow = $lastDataRow + 2;
        $sheet->getStyle("A{$instructionRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => $darkAmber]],
        ]);
        
        for ($i = $instructionRow + 1; $i <= $instructionRow + 3; $i++) {
            $sheet->getStyle("A{$i}")->applyFromArray([
                'font' => ['size' => 9, 'color' => ['rgb' => '6B7280']],
            ]);
        }

        return [];
    }

    /**
     * Register events to explicitly write auto-fill values (including 0)
     */
    public function registerEvents(): array
    {
        $autoFillValues = $this->autoFillValues;
        
        return [
            AfterSheet::class => function(AfterSheet $event) use ($autoFillValues) {
                $sheet = $event->sheet->getDelegate();
                
                // Auto-fill field rows (1-indexed, after header rows)
                // Row 9 = Effectif, Row 11 = Relevé des écarts, Row 12 = Sensibilisation
                // Row 19 = Heures de formation, Row 20 = Permis de travail
                $autoFillRows = [
                    11 => 'releve_ecarts',      // Relevé des écarts
                    12 => 'sensibilisation',    // Nombre de Sensibilisation
                    18 => 'inspections',        // Nombre d'Inspections
                    19 => 'heures_formation',   // Heures de formation
                    20 => 'permis_travail',     // Permis de travail
                    21 => 'mesures_disciplinaires', // Mesures disciplinaires
                ];
                
                $columns = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
                
                foreach ($autoFillRows as $row => $fieldKey) {
                    foreach ($columns as $colIndex => $col) {
                        // Get value from autoFillValues, default to 0
                        $value = 0;
                        if (isset($autoFillValues[$colIndex]['auto_values'][$fieldKey])) {
                            $dbValue = $autoFillValues[$colIndex]['auto_values'][$fieldKey];
                            if (is_numeric($dbValue)) {
                                $value = $fieldKey === 'heures_formation' ? (float) $dbValue : (int) $dbValue;
                            }
                        }
                        
                        // Explicitly set the cell value
                        $cell = $col . $row;
                        $sheet->setCellValue($cell, $value);
                    }
                }
            },
        ];
    }
}
