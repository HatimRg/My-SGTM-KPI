<?php

namespace App\Exports;

use App\Models\PpeItem;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class PpeIssuesMassTemplateExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    private int $dataRows;
    private string $lang;

    public function __construct(int $dataRows = 200, string $lang = 'fr')
    {
        $this->dataRows = max(10, $dataRows);
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    public function title(): string
    {
        return $this->tr('EPI', 'PPE');
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18,
            'B' => 34,
            'C' => 12,
            'D' => 16,
        ];
    }

    public function array(): array
    {
        $rows = [];
        $rows[] = [$this->tr("SGTM - MODÈLE D'IMPORT DISTRIBUTION EPI", 'SGTM - PPE ISSUANCE IMPORT TEMPLATE')];
        $rows[] = [$this->tr(
            "Instructions: 1 ligne par distribution. CIN*, EPI*, Quantité* et Date* obligatoires. La distribution diminue le stock du projet du travailleur. Si l'EPI n'existe pas, il sera créé.",
            'Instructions: 1 row per issuance. CIN*, PPE_NAME*, QUANTITY* and RECEIVED_AT* are required. Issuance decreases stock for the worker project. If PPE does not exist, it will be created.'
        )];
        $rows[] = $this->lang === 'en'
            ? ['CIN*', 'PPE_NAME*', 'QUANTITY*', 'RECEIVED_AT*']
            : ['CIN*', 'EPI*', 'Quantité*', 'Date*'];

        for ($i = 0; $i < $this->dataRows; $i++) {
            $rows[] = ['', '', '', ''];
        }

        return $rows;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                $spreadsheet = $sheet->getParent();
                $listsSheet = new Worksheet($spreadsheet, 'Lists');
                $spreadsheet->addSheet($listsSheet);
                $listsSheet->setSheetState(Worksheet::SHEETSTATE_HIDDEN);

                $items = PpeItem::query()->orderBy('name')->pluck('name')->toArray();
                $rowIndex = 1;
                foreach ($items as $name) {
                    $listsSheet->setCellValue('A' . $rowIndex, $name);
                    $rowIndex++;
                }
                $itemsLastRow = max(1, count($items));

                $dataStartRow = 4;
                $lastRow = $dataStartRow + $this->dataRows - 1;

                $primaryOrange = 'F97316';
                $darkOrange = 'EA580C';
                $lightOrange = 'FED7AA';
                $black = '1F2937';
                $white = 'FFFFFF';
                $grayLight = 'F9FAFB';
                $grayBorder = '9CA3AF';

                $sheet->mergeCells('A1:D1');
                $sheet->getStyle('A1:D1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 18, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $black]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                ]);
                $sheet->getRowDimension(1)->setRowHeight(40);

                $sheet->mergeCells('A2:D2');
                $sheet->getStyle('A2:D2')->applyFromArray([
                    'font' => ['size' => 11, 'italic' => true, 'color' => ['rgb' => $black]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $lightOrange]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_LEFT,
                        'vertical' => Alignment::VERTICAL_CENTER,
                        'wrapText' => true,
                    ],
                    'borders' => [
                        'bottom' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['rgb' => $primaryOrange]],
                    ],
                ]);
                $sheet->getRowDimension(2)->setRowHeight(46);

                $headers = $this->lang === 'en'
                    ? ['CIN*', 'PPE_NAME*', 'QUANTITY*', 'RECEIVED_AT*']
                    : ['CIN*', 'EPI*', 'Quantité*', 'Date*'];
                $col = 'A';
                foreach ($headers as $header) {
                    $sheet->setCellValue($col . '3', $header);
                    $col++;
                }

                $sheet->getStyle('A3:D3')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => $white]],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $primaryOrange]],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                        'wrapText' => true,
                    ],
                    'borders' => [
                        'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $darkOrange]],
                    ],
                ]);
                $sheet->getRowDimension(3)->setRowHeight(34);

                $sheet->setAutoFilter('A3:D3');

                for ($row = $dataStartRow; $row <= $lastRow; $row++) {
                    $bgColor = ($row % 2 == 0) ? $grayLight : $white;
                    $sheet->getStyle("A{$row}:D{$row}")->applyFromArray([
                        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $bgColor]],
                        'borders' => [
                            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $grayBorder]],
                        ],
                        'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
                    ]);
                    $sheet->getRowDimension($row)->setRowHeight(22);

                    $itemValidation = $sheet->getCell("B{$row}")->getDataValidation();
                    $itemValidation->setType(DataValidation::TYPE_LIST);
                    $itemValidation->setErrorStyle(DataValidation::STYLE_STOP);
                    $itemValidation->setAllowBlank(false);
                    $itemValidation->setShowDropDown(true);
                    $itemValidation->setShowErrorMessage(true);
                    $itemValidation->setFormula1("='Lists'!\$A\$1:\$A\$" . $itemsLastRow);

                    $qtyValidation = $sheet->getCell("C{$row}")->getDataValidation();
                    $qtyValidation->setType(DataValidation::TYPE_WHOLE);
                    $qtyValidation->setOperator(DataValidation::OPERATOR_GREATERTHAN);
                    $qtyValidation->setFormula1('0');
                    $qtyValidation->setAllowBlank(false);
                    $qtyValidation->setShowErrorMessage(true);
                }

                $sheet->getStyle("D{$dataStartRow}:D{$lastRow}")->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_DATE_DDMMYYYY);

                $sheet->freezePane('A4');
                $spreadsheet->setActiveSheetIndex(0);
            },
        ];
    }
}
