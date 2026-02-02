<?php

namespace App\Exports\Sheets;

use App\Models\User;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class NeverAccessedUsersSheet implements FromCollection, WithHeadings, WithMapping, WithTitle, WithStyles, ShouldAutoSize
{
    protected string $lang;

    public function __construct(string $lang = 'fr')
    {
        $lang = strtolower(trim($lang));
        $this->lang = in_array($lang, ['en', 'fr'], true) ? $lang : 'fr';
    }

    private function tr(string $fr, string $en): string
    {
        return $this->lang === 'en' ? $en : $fr;
    }

    public function collection()
    {
        return User::query()
            ->where('must_change_password', true)
            ->where('is_active', true)
            ->with([
                'projects:id,name,code',
                'teamProjects:id,name,code',
            ])
            ->orderBy('name')
            ->get();
    }

    public function headings(): array
    {
        return [
            $this->tr('Nom', 'Name'),
            $this->tr('Email', 'Email'),
            $this->tr('Rôle', 'Role'),
            $this->tr('Projets assignés', 'Assigned projects'),
            $this->tr('Périmètre', 'Scope'),
        ];
    }

    private function assignedProjectsLabel(User $user): string
    {
        $projects = (new Collection($user->projects ?? []))
            ->merge($user->teamProjects ?? [])
            ->unique('id')
            ->sortBy(fn ($p) => (string) ($p->name ?? ''))
            ->values();

        if ($projects->count() === 0) {
            return '';
        }

        return $projects
            ->map(function ($p) {
                $code = (string) ($p->code ?? '');
                $name = (string) ($p->name ?? '');
                if ($code !== '' && $name !== '') {
                    return $code . ' - ' . $name;
                }
                return $name !== '' ? $name : $code;
            })
            ->filter(fn ($v) => $v !== '')
            ->implode(', ');
    }

    private function scopeLabel(User $user): string
    {
        $scope = $user->getProjectScopeType();
        if ($scope === 'all') {
            return $this->tr('Tous', 'All');
        }

        if ($scope === 'pole') {
            return (string) ($user->pole ?? '');
        }

        return $this->tr('Assignés', 'Assigned');
    }

    public function map($user): array
    {
        return [
            $user->name,
            $user->email,
            $user->role,
            $this->assignedProjectsLabel($user),
            $this->scopeLabel($user),
        ];
    }

    public function title(): string
    {
        return $this->tr('Utilisateurs non connectés', 'Users never accessed');
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '7C3AED'],
                ],
            ],
        ];
    }
}
