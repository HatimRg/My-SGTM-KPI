<?php

namespace App\Exports;

use App\Exports\Sheets\NeverAccessedUsersSheet;
use App\Exports\Sheets\ProjectManagementProjectsSheet;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ProjectManagementExport implements WithMultipleSheets
{
    protected int $year;
    protected string $lang;

    public function __construct(int $year, string $lang = 'fr')
    {
        $this->year = $year;
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
    }

    public function sheets(): array
    {
        return [
            new ProjectManagementProjectsSheet($this->year, $this->lang),
            new NeverAccessedUsersSheet($this->lang),
        ];
    }
}
