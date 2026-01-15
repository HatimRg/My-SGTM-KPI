<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;

class WorkerTrainingsMassImport implements ToCollection, WithHeadingRow, SkipsEmptyRows
{
    protected array $rows = [];

    public function collection(Collection $rows)
    {
        $this->rows = $rows->toArray();
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
