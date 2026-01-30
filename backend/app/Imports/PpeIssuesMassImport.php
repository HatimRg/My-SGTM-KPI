<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class PpeIssuesMassImport implements ToCollection, WithHeadingRow, WithMultipleSheets, SkipsEmptyRows
{
    protected array $rows = [];

    public function collection(Collection $rows)
    {
        $this->rows = $rows->toArray();
    }

    public function sheets(): array
    {
        return [
            0 => $this,
        ];
    }

    public function headingRow(): int
    {
        return 3;
    }

    public function getRows(): array
    {
        return $this->rows;
    }
}
