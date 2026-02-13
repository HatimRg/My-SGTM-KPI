<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(DevUserSeeder::class);
        $this->call(MachineDocumentKeySeeder::class);

        User::updateOrCreate(
            ['email' => 'admin@test.com'],
            [
                'name' => 'Admin HSE',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'phone' => '+212 600 000 000',
                'is_active' => true,
            ]
        );

        $this->command?->info('Database seeded successfully!');
        $this->command?->info('Admin login: admin@test.com / admin123');
    }
}
