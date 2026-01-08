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

    public function __construct(string $projectName, string $projectCode, int $weekNumber, int $year, array $autoFillValues = [])
    {
        $this->projectName = $projectName;
        $this->projectCode = $projectCode;
        $this->weekNumber = $weekNumber;
        $this->year = $year;
        $this->weekDates = WeekHelper::getWeekDates($weekNumber, $year);
        $this->autoFillValues = $autoFillValues;
    }

    public function title(): string
    {
        return 'Daily HSE KPI';
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
        $dayNames = ['Samedi', 'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
        
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
        $rows[] = ['', '', 'SUIVI JOURNALIER HSE', '', '', '', '', ''];
        
        // Row 2: Empty separator
        $rows[] = [''];
        
        // Rows 3-5: Project info in a professional card style
        $rows[] = ['PROJET', $this->projectName, '', '', 'CODE', $this->projectCode, '', ''];
        $rows[] = ['SEMAINE', "S{$this->weekNumber}", '', '', 'ANNÉE', $this->year, '', ''];
        $rows[] = ['PÉRIODE', $this->weekDates['start']->format('d/m/Y') . ' au ' . $this->weekDates['end']->format('d/m/Y'), '', '', '', '', '', ''];
        
        // Row 6: Empty separator
        $rows[] = [''];
        
        // Row 7: Column headers (only 8 columns now: Indicator + 7 days)
        $headerRow = ['INDICATEUR'];
        foreach ($days as $day) {
            $headerRow[] = $day['name'] . "\n" . $day['date'];
        }
        $rows[] = $headerRow;

        // Row 8: Hidden date row for import parsing
        $dateRow = ['_DATES_'];
        foreach ($days as $day) {
            $dateRow[] = $day['iso'];
        }
        $rows[] = $dateRow;

        // KPI rows (18 indicators) with field keys for auto-fill
        // Fields that should show 0 when no data (auto-filled from system)
        $autoFillFields = ['releve_ecarts', 'sensibilisation', 'heures_formation', 'permis_travail', 'inspections', 'mesures_disciplinaires'];
        
        $kpiFields = [
            ['label' => 'Effectif', 'key' => 'effectif'],
            ['label' => 'Induction', 'key' => 'induction'],
            ['label' => 'Relevé des écarts', 'key' => 'releve_ecarts'],
            ['label' => 'Nombre de Sensibilisation', 'key' => 'sensibilisation'],
            ['label' => 'Presqu\'accident', 'key' => 'presquaccident'],
            ['label' => 'Premiers soins', 'key' => 'premiers_soins'],
            ['label' => 'Accident', 'key' => 'accidents'],
            ['label' => 'Nombre de jours d\'arrêt', 'key' => 'jours_arret'],
            ['label' => 'Heures travaillées (=Effectif×10)', 'key' => 'heures_travaillees'],
            ['label' => 'Nombre d\'Inspections', 'key' => 'inspections'],
            ['label' => 'Heures de formation', 'key' => 'heures_formation'],
            ['label' => 'Permis de travail', 'key' => 'permis_travail'],
            ['label' => 'Mesures disciplinaires', 'key' => 'mesures_disciplinaires'],
            ['label' => 'Taux de conformité HSE (%)', 'key' => 'conformite_hse'],
            ['label' => 'Taux de conformité Médicale (%)', 'key' => 'conformite_medicale'],
            ['label' => 'Suivi du bruit (dB)', 'key' => 'suivi_bruit'],
            ['label' => 'Consommation Eau (m³)', 'key' => 'consommation_eau'],
            ['label' => 'Consommation Électricité (kWh)', 'key' => 'consommation_electricite'],
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
                        $value = is_numeric($dbValue) ? (int) $dbValue : 0;
                    }
                    
                    // IMPORTANT: Keep 0 as integer 0, don't let it become empty
                    // Value is guaranteed to be an integer here
                }
                
                $row[] = $value;
            }
            $rows[] = $row;
        }

        // Footer instructions
        $rows[] = [''];
        $rows[] = ['Instructions:'];
        $rows[] = ['• Remplissez les valeurs journalières dans les colonnes correspondantes'];
        $rows[] = ['• Les totaux seront calculés automatiquement lors de l\'import'];
        $rows[] = ['• Ne modifiez pas la structure du fichier (lignes/colonnes)'];

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

        // Data entry area styling (rows 9-26)
        $lastDataRow = 26;
        
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

        // Alternate row colors for better readability
        for ($i = 9; $i <= $lastDataRow; $i++) {
            if ($i % 2 == 0) {
                $sheet->getStyle("B{$i}:H{$i}")->applyFromArray([
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEF3C7']],
                ]);
            }
            $sheet->getRowDimension($i)->setRowHeight(24);
        }

        // Add Excel formulas for "Heures travaillées" (row 17 = Effectif row 9 × 10)
        // Row 17 is "Heures travaillées", Row 9 is "Effectif"
        $workHoursRow = 17;
        $columns = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
        foreach ($columns as $col) {
            $effectifCell = $col . '9';
            $sheet->setCellValue($col . $workHoursRow, "={$effectifCell}*10");
        }
        
        // Style the formula row differently
        $sheet->getStyle("B{$workHoursRow}:H{$workHoursRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => $darkAmber]],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FDE68A']],
        ]);

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
                    19 => 'heures_formation',   // Heures de formation
                    20 => 'permis_travail',     // Permis de travail
                ];
                
                $columns = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
                
                foreach ($autoFillRows as $row => $fieldKey) {
                    foreach ($columns as $colIndex => $col) {
                        // Get value from autoFillValues, default to 0
                        $value = 0;
                        if (isset($autoFillValues[$colIndex]['auto_values'][$fieldKey])) {
                            $value = (int) $autoFillValues[$colIndex]['auto_values'][$fieldKey];
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
