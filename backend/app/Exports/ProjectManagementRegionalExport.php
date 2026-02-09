<?php

namespace App\Exports;

use App\Exports\Sheets\ProjectManagementProjectsSheet;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ProjectManagementRegionalExport implements WithMultipleSheets
{
    protected int $year;
    protected string $lang;
    protected string $pole;

    public function __construct(int $year, string $lang, string $pole)
    {
        $this->year = $year;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
        $this->pole = trim($pole);
    }

    public function sheets(): array
    {
        return [
            new ProjectManagementProjectsSheet($this->year, $this->lang, $this->pole),
        ];
    }
}
