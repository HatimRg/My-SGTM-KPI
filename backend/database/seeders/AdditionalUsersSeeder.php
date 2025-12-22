<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdditionalUsersSeeder extends Seeder
{
    public function run()
    {
        // Create sor user (Safety Officer)
        $sor = User::create([
            'name' => 'Safety Officer',
            'email' => 'officer@test.com',
            'password' => 'password123', // Will be hashed by model mutator
            'role' => 'sor',
            'is_active' => true,
        ]);

        // Create animateur user  
        $animateur = User::create([
            'name' => 'Animateur',
            'email' => 'animateur@test.com',
            'password' => 'password123', // Will be hashed by model mutator
            'role' => 'animateur',
            'is_active' => true,
        ]);

        // Create HR user
        $hr = User::create([
            'name' => 'HR Manager',
            'email' => 'hr@test.com',
            'password' => 'password123', // Will be hashed by model mutator
            'role' => 'hr',
            'is_active' => true,
        ]);

        echo "Additional users created:\n";
        echo "- officer@test.com (sor)\n";
        echo "- animateur@test.com (animateur)\n";
        echo "- hr@test.com (hr)\n";
        echo "All with password: password123\n";
    }
}
