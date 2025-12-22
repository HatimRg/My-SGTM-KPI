<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DemoUsersSeeder extends Seeder
{
    public function run()
    {
        // Clear existing demo users
        User::where('email', 'like', '%test.com')->delete();
        
        // Create demo users
        $users = [
            [
                'name' => 'Admin User',
                'email' => 'admin@test.com',
                'password' => 'admin123',
                'role' => 'admin',
            ],
            [
                'name' => 'Responsible Manager',
                'email' => 'resposable@test.com',
                'password' => 'password123',
                'role' => 'manager',
            ],
            [
                'name' => 'Supervisor',
                'email' => 'supervisor@test.com',
                'password' => 'password123',
                'role' => 'supervisor',
            ],
            [
                'name' => 'Safety Officer',
                'email' => 'officer@test.com',
                'password' => 'password123',
                'role' => 'officer',
            ],
            [
                'name' => 'HR Manager',
                'email' => 'hr@test.com',
                'password' => 'password',
                'role' => 'hr',
            ],
        ];
        
        foreach ($users as $user) {
            User::create($user);
            echo "Created user: {$user['email']}\n";
        }
        
        echo "Demo users created successfully!\n";
    }
}
