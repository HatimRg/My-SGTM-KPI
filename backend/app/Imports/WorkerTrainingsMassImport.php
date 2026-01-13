<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class WorkerTrainingsMassImport implements ToCollection, WithHeadingRow
{
    protected array $rows = [];

    public function headingRow(): int
    {
        return 3;
    }

    public function collection(Collection $rows)
    {
        $this->rows = $rows->toArray();
    }

    public function getRows(): array
    {
        return $this->rows;
    }
}
