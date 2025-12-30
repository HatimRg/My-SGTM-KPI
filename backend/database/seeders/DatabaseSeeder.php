<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Project;
use App\Models\KpiReport;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(DevUserSeeder::class);
        $this->call(MachineDocumentKeySeeder::class);

        // Create Admin User
        $admin = User::where('email', 'admin@test.com')->first();

        if (!$admin) {
            $admin = User::where('email', 'admin@hse-kpi.com')->first();
        }

        if ($admin) {
            $admin->update([
                'name' => 'Admin HSE',
                'email' => 'admin@test.com',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'phone' => '+212 600 000 000',
                'is_active' => true,
            ]);
        } else {
            $admin = User::create([
                'name' => 'Admin HSE',
                'email' => 'admin@test.com',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'phone' => '+212 600 000 000',
                'is_active' => true,
            ]);
        }

        // Create Responsable Users
        $users = [];
        $usersData = [
            ['name' => 'Mohammed Alami', 'email' => 'mohammed.alami@hse-kpi.com'],
            ['name' => 'Fatima Bennani', 'email' => 'fatima.bennani@hse-kpi.com'],
            ['name' => 'Ahmed Tazi', 'email' => 'ahmed.tazi@hse-kpi.com'],
            ['name' => 'Sara Idrissi', 'email' => 'sara.idrissi@hse-kpi.com'],
        ];

        foreach ($usersData as $userData) {
            $users[] = User::updateOrCreate(
                ['email' => $userData['email']],
                [
                    'name' => $userData['name'],
                    'password' => Hash::make('password123'),
                    'role' => 'responsable',
                    'is_active' => true,
                ]
            );
        }

        // Create Projects
        $projects = [];
        $projectsData = [
            [
                'name' => 'SGTM Casablanca Plant',
                'code' => 'SGTM-CASA',
                'description' => 'Main manufacturing plant in Casablanca',
                'location' => 'Casablanca, Morocco',
                'status' => 'active',
                'client_name' => 'SGTM Internal',
            ],
            [
                'name' => 'Tanger Port Expansion',
                'code' => 'TPE-2024',
                'description' => 'Port infrastructure expansion project',
                'location' => 'Tanger Med, Morocco',
                'status' => 'active',
                'client_name' => 'Tanger Med Port Authority',
            ],
            [
                'name' => 'Rabat Highway Construction',
                'code' => 'RHC-2024',
                'description' => 'Highway construction between Rabat and Kenitra',
                'location' => 'Rabat-Kenitra, Morocco',
                'status' => 'active',
                'client_name' => 'ADM',
            ],
            [
                'name' => 'Marrakech Industrial Zone',
                'code' => 'MIZ-2024',
                'description' => 'New industrial zone development',
                'location' => 'Marrakech, Morocco',
                'status' => 'active',
                'client_name' => 'Regional Investment Center',
            ],
        ];

        foreach ($projectsData as $projectData) {
            $projects[] = Project::updateOrCreate(
                ['code' => $projectData['code']],
                array_merge($projectData, [
                    'start_date' => now()->subMonths(6),
                    'end_date' => now()->addYear(),
                    'created_by' => $admin->id,
                ])
            );
        }

        // Assign users to projects
        $projects[0]->users()->syncWithoutDetaching([$users[0]->id, $users[1]->id]);
        $projects[1]->users()->syncWithoutDetaching([$users[1]->id, $users[2]->id]);
        $projects[2]->users()->syncWithoutDetaching([$users[2]->id, $users[3]->id]);
        $projects[3]->users()->syncWithoutDetaching([$users[0]->id, $users[3]->id]);

        // Create sample KPI reports for the past 6 months
        foreach ($projects as $project) {
            for ($i = 5; $i >= 0; $i--) {
                $date = now()->subMonths($i);
                
                KpiReport::updateOrCreate(
                    [
                        'project_id' => $project->id,
                        'report_month' => $date->month,
                        'report_year' => $date->year,
                    ],
                    [
                        'submitted_by' => $project->users()->first()?->id ?? $admin->id,
                        'report_date' => $date->endOfMonth(),

                        // Accident metrics (random but realistic)
                        'accidents' => rand(0, 3),
                        'accidents_fatal' => 0,
                        'accidents_serious' => rand(0, 1),
                        'accidents_minor' => rand(0, 2),
                        'near_misses' => rand(2, 10),
                        'first_aid_cases' => rand(1, 5),

                        // Training metrics
                        'trainings_conducted' => rand(3, 8),
                        'trainings_planned' => rand(5, 10),
                        'employees_trained' => rand(20, 100),
                        'training_hours' => rand(20, 80),
                        'toolbox_talks' => rand(15, 25),

                        // Inspection metrics
                        'inspections_completed' => rand(10, 30),
                        'inspections_planned' => rand(15, 35),
                        'findings_open' => rand(5, 20),
                        'findings_closed' => rand(10, 25),
                        'corrective_actions' => rand(5, 15),

                        // Work hours and lost days
                        'hours_worked' => rand(50000, 150000),
                        'lost_workdays' => rand(0, 10),

                        // Additional metrics
                        'unsafe_acts_reported' => rand(5, 20),
                        'unsafe_conditions_reported' => rand(3, 15),
                        'emergency_drills' => rand(0, 2),
                        'hse_compliance_rate' => rand(85, 99),

                        'status' => 'approved',
                        'approved_by' => $admin->id,
                        'approved_at' => $date->endOfMonth(),
                    ]
                );
            }
        }

        $this->command->info('Database seeded successfully!');
        $this->command->info('Admin login: admin@test.com / admin123');
    }
}
