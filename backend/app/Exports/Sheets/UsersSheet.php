<?php

namespace App\Exports\Sheets;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class UsersSheet implements FromCollection, WithTitle, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    public function collection()
    {
        return User::with('projects')
            ->withCount('kpiReports')
            ->orderBy('name')
            ->get();
    }

    public function headings(): array
    {
        return [
            'ID',
            'Name',
            'Email',
            'Phone',
            'Role',
            'Status',
            'Assigned Projects',
            'Reports Submitted',
            'Created At',
            'Last Login',
        ];
    }

    public function map($user): array
    {
        return [
            $user->id,
            $user->name,
            $user->email,
            $user->phone,
            ucfirst($user->role),
            $user->is_active ? 'Active' : 'Inactive',
            $user->projects->pluck('name')->implode(', '),
            $user->kpi_reports_count,
            $user->created_at?->format('Y-m-d H:i'),
            $user->last_login_at?->format('Y-m-d H:i') ?? 'Never',
        ];
    }

    public function title(): string
    {
        return 'Users';
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '7C3AED']
                ]
            ],
        ];
    }
}
