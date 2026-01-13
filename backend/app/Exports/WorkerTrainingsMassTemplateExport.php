<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;

class WorkerTrainingsMassTemplateExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    private int $dataRows;

    private string $trainingTypesCsv = 'bypassing_safety_controls,formation_coactivite,formation_coffrage_decoffrage,formation_conduite_defensive,formation_analyse_des_risques,formation_elingage_manutention,formation_ergonomie,formation_excavations,formation_outils_electroportatifs,formation_epi,formation_environnement,formation_espaces_confines,formation_flagman,formation_jha,formation_line_of_fire,formation_manutention_manuelle,formation_manutention_mecanique,formation_point_chaud,formation_produits_chimiques,formation_risques_electriques,induction_hse,travail_en_hauteur';

    public function __construct(int $dataRows = 200)
    {
        $this->dataRows = max(10, $dataRows);
    }

    public function title(): string
    {
        return 'Formations';
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18,
            'B' => 24,
            'C' => 16,
            'D' => 16,
        ];
    }

    public function array(): array
    {
        $rows = [];
        $rows[] = ["SGTM - MODELE D'IMPORT FORMATIONS (MASS)"];
        $rows[] = ['Instructions: 1 ligne par CIN. PDF dans le ZIP: CIN.pdf'];
        $rows[] = ['CIN', 'TYPE_FORMATION', 'DATE_FORMATION', 'DATE_EXPIRATION'];

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

                $dataStartRow = 4;
                $lastRow = $dataStartRow + $this->dataRows - 1;

                $sheet->mergeCells('A1:D1');
                $sheet->freezePane('A4');
                $sheet->setAutoFilter('A3:D3');

                $sheet->getStyle('A1')->getFont()->setBold(true);
                $sheet->getStyle('A3:D3')->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                    'fill' => [
                        'fillType' => 'solid',
                        'color' => ['rgb' => '0F766E'],
                    ],
                    'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
                ]);

                $sheet->getRowDimension(1)->setRowHeight(26);
                $sheet->getRowDimension(2)->setRowHeight(18);
                $sheet->getRowDimension(3)->setRowHeight(20);

                // Put training type list in hidden column F and use it as validation source
                $types = array_values(array_filter(array_map('trim', explode(',', $this->trainingTypesCsv))));
                foreach ($types as $i => $type) {
                    $sheet->setCellValueByColumnAndRow(6, 1 + $i, $type); // F1..Fn
                }
                $sheet->getColumnDimension('F')->setVisible(false);

                $listEndRow = count($types) > 0 ? count($types) : 1;
                $formula = '=\$F\$1:\$F\$' . $listEndRow;

                $validation = new DataValidation();
                $validation->setType(DataValidation::TYPE_LIST);
                $validation->setAllowBlank(true);
                $validation->setShowDropDown(true);
                $validation->setFormula1($formula);

                for ($r = $dataStartRow; $r <= $lastRow; $r++) {
                    $sheet->getCell("B{$r}")->setDataValidation(clone $validation);
                }
            },
        ];
    }
}
