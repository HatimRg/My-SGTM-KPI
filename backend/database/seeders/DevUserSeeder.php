<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DevUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'dev@mysafekpi.com'],
            [
                'name' => 'Hatim Raghib',
                'password' => '010203..',
                'role' => User::ROLE_DEV,
                'is_active' => true,
            ]
        );

        $this->command?->info('Dev user ensured: dev@mysafekpi.com (role=dev)');
    }
}
