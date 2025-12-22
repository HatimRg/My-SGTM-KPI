<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Project;
use App\Models\User;
use App\Models\Training;
use App\Models\AwarenessSession;
use App\Models\SorReport;
use App\Models\WorkPermit;
use Carbon\Carbon;
use Faker\Factory as Faker;

class MockDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        $faker = Faker::create();
        
        // Get all projects
        $projects = Project::all();
        if ($projects->isEmpty()) {
            $this->command->error('No projects found. Please create projects first.');
            return;
        }
        
        // Get users for assignments
        $users = User::all();
        if ($users->isEmpty()) {
            $this->command->error('No users found. Please create users first.');
            return;
        }
        
        $userIds = $users->pluck('id')->toArray();
        
        $this->command->info('Creating mock data...');
        
        // Current year and week 49 (current), going back to week 34
        $currentYear = 2025;
        $currentWeek = 49;
        $startWeek = 34;
        
        // ============================================
        // AWARENESS SESSIONS (40 entries)
        // ============================================
        $this->command->info('Creating 40 awareness sessions...');
        
        $awarenessTopics = [
            'Fire Safety Awareness',
            'PPE Usage and Maintenance',
            'Chemical Handling Safety',
            'Electrical Safety Basics',
            'Working at Heights',
            'Confined Space Entry',
            'Emergency Evacuation Procedures',
            'First Aid Basics',
            'Heat Stress Prevention',
            'Slip, Trip and Fall Prevention',
            'Machine Guarding',
            'Lockout/Tagout Procedures',
            'Hazard Communication',
            'Ergonomics in the Workplace',
            'Noise Exposure and Hearing Protection',
            'Respiratory Protection',
            'Hand and Power Tool Safety',
            'Ladder Safety',
            'Scaffolding Safety',
            'Crane and Rigging Safety',
        ];
        
        $conductors = ['Ahmed Hassan', 'Mohamed Ali', 'Youssef Karim', 'Omar Mansour', 'Khalid Ibrahim'];
        $durationLabels = ['15 min', '30 min', '45 min', '1 hour', '1h30'];
        
        for ($i = 0; $i < 40; $i++) {
            $weekOffset = rand(0, $currentWeek - $startWeek);
            $sessionWeek = $currentWeek - $weekOffset;
            $sessionDate = Carbon::now()->setISODate($currentYear, $sessionWeek)->addDays(rand(0, 5));
            $durationMinutes = $faker->randomElement([15, 30, 45, 60, 90]);
            $participants = rand(5, 50);
            
            AwarenessSession::create([
                'project_id' => $projects->random()->id,
                'submitted_by' => $faker->randomElement($userIds),
                'date' => $sessionDate->format('Y-m-d'),
                'week_number' => $sessionWeek,
                'week_year' => $currentYear,
                'by_name' => $faker->randomElement($conductors),
                'theme' => $faker->randomElement($awarenessTopics),
                'duration_minutes' => $durationMinutes,
                'participants' => $participants,
                'session_hours' => round(($durationMinutes / 60) * $participants, 2),
            ]);
        }
        
        // ============================================
        // TRAININGS (40 entries)
        // ============================================
        $this->command->info('Creating 40 trainings...');
        
        $trainingThemes = [
            'HSE Induction Training',
            'Permit to Work System',
            'Risk Assessment Workshop',
            'Incident Investigation',
            'Emergency Response Training',
            'Fire Fighting Training',
            'First Aid Certification',
            'Working at Heights Certification',
            'Confined Space Entry Training',
            'Scaffolding Competency',
            'Crane Operator Training',
            'Forklift Operator Certification',
            'Defensive Driving Course',
            'Environmental Awareness',
            'Waste Management Training',
            'Chemical Safety Training',
            'Electrical Safety Training',
            'Manual Handling Training',
            'Leadership Safety Training',
            'Contractor Safety Orientation',
        ];
        
        $trainers = ['Dr. Ahmed Nabil', 'Eng. Sara Ahmed', 'Prof. Karim Hassan', 'Trainer Mohamed', 'Expert Youssef'];
        $externalCompanies = ['SafetyFirst Co.', 'HSE Solutions', 'Training Plus', 'Industrial Safety Ltd.', null];
        
        // Valid duration labels from frontend dropdown
        $durationOptions = [
            ['label' => '30min', 'hours' => 0.5],
            ['label' => '1h', 'hours' => 1],
            ['label' => '1h30', 'hours' => 1.5],
            ['label' => '2h', 'hours' => 2],
            ['label' => '3h', 'hours' => 3],
            ['label' => 'halfDay', 'hours' => 4],
            ['label' => '1day', 'hours' => 8],
            ['label' => '2days', 'hours' => 16],
            ['label' => '3days', 'hours' => 24],
        ];
        
        for ($i = 0; $i < 40; $i++) {
            $weekOffset = rand(0, $currentWeek - $startWeek);
            $trainingWeek = $currentWeek - $weekOffset;
            $trainingDate = Carbon::now()->setISODate($currentYear, $trainingWeek)->addDays(rand(0, 5));
            $byInternal = $faker->boolean(60);
            $duration = $faker->randomElement($durationOptions);
            $participants = rand(5, 30);
            
            Training::create([
                'project_id' => $projects->random()->id,
                'submitted_by' => $faker->randomElement($userIds),
                'date' => $trainingDate->format('Y-m-d'),
                'week_number' => $trainingWeek,
                'week_year' => $currentYear,
                'by_internal' => $byInternal,
                'by_name' => $faker->randomElement($trainers),
                'external_company' => $byInternal ? null : $faker->randomElement($externalCompanies),
                'theme' => $faker->randomElement($trainingThemes),
                'duration_label' => $duration['label'],
                'duration_hours' => $duration['hours'],
                'participants' => $participants,
                'training_hours' => $duration['hours'] * $participants,
            ]);
        }
        
        // ============================================
        // SOR REPORTS (300 entries)
        // ============================================
        $this->command->info('Creating 300 SOR reports...');
        
        $sorCategories = array_keys(SorReport::CATEGORIES);
        $sorStatuses = [SorReport::STATUS_OPEN, SorReport::STATUS_IN_PROGRESS, SorReport::STATUS_CLOSED];
        
        $nonConformities = [
            'Travailleur sans lunettes de sécurité dans la zone désignée',
            'Câble électrique exposé près d\'une source d\'eau',
            'Presque accident - chute d\'objet depuis l\'échafaudage',
            'Excellent rangement observé dans l\'atelier',
            'Déversement d\'huile détecté près du système de drainage',
            'Garde-corps manquant sur la plateforme élevée',
            'Travailleur utilisant des EPI endommagés',
            'Stockage inapproprié de matériaux inflammables',
            'Bonne mise en place de la signalisation de sécurité',
            'Sortie de secours bloquée',
            'Équipement utilisé sans autorisation appropriée',
            'Comportement positif - arrêt du travail pour un problème de sécurité',
            'Éclairage inadéquat dans la zone de travail',
            'Conteneurs chimiques non étiquetés correctement',
            'Travailleur contournant le verrouillage de sécurité',
            'Excellente participation au toolbox talk',
            'Risque de trébuchement avec des câbles lâches',
            'Extincteur bloqué par l\'équipement',
            'Travailleur aidant un collègue à soulever une charge lourde',
            'Accumulation de poussière dans le système de ventilation',
        ];
        
        $zones = ['Zone A', 'Zone B', 'Zone C', 'Atelier', 'Entrepôt', 'Bureau', 'Quai de chargement', 'Zone de stockage'];
        $companies = ['SGTM', 'Contractor A', 'Contractor B', 'Subcontractor X', 'Maintenance Co.'];
        $supervisors = ['Sup. Ahmed', 'Sup. Mohamed', 'Sup. Hassan', 'Sup. Karim', 'Sup. Omar'];
        $responsiblePersons = ['M. Ahmed', 'M. Hassan', 'M. Karim', 'Mme. Sara', 'M. Omar'];
        
        for ($i = 0; $i < 300; $i++) {
            $weekOffset = rand(0, $currentWeek - $startWeek);
            $reportWeek = $currentWeek - $weekOffset;
            $reportDate = Carbon::now()->setISODate($currentYear, $reportWeek)->addDays(rand(0, 6));
            $reportTime = sprintf('%02d:%02d', rand(6, 18), rand(0, 59));
            
            $status = $faker->randomElement($sorStatuses);
            $closedAt = $status === SorReport::STATUS_CLOSED ? (clone $reportDate)->addDays(rand(1, 14)) : null;
            $closedBy = $closedAt ? $faker->randomElement($userIds) : null;
            
            $deadline = (clone $reportDate)->addDays(rand(3, 14));
            
            $correctiveAction = null;
            $correctiveActionDate = null;
            $correctiveActionTime = null;
            if ($status !== SorReport::STATUS_OPEN) {
                $correctiveAction = $faker->sentence(8);
                $correctiveActionDate = (clone $reportDate)->addDays(rand(1, 7))->format('Y-m-d');
                $correctiveActionTime = sprintf('%02d:%02d', rand(6, 18), rand(0, 59));
            }
            
            SorReport::create([
                'project_id' => $projects->random()->id,
                'submitted_by' => $faker->randomElement($userIds),
                'company' => $faker->randomElement($companies),
                'observation_date' => $reportDate->format('Y-m-d'),
                'observation_time' => $reportTime,
                'zone' => $faker->randomElement($zones),
                'supervisor' => $faker->randomElement($supervisors),
                'non_conformity' => $faker->randomElement($nonConformities),
                'category' => $faker->randomElement($sorCategories),
                'responsible_person' => $faker->randomElement($responsiblePersons),
                'deadline' => $deadline->format('Y-m-d'),
                'corrective_action' => $correctiveAction,
                'corrective_action_date' => $correctiveActionDate,
                'corrective_action_time' => $correctiveActionTime,
                'status' => $status,
                'is_pinned' => $faker->boolean(5),
                'closed_at' => $closedAt,
                'closed_by' => $closedBy,
                'notes' => $faker->optional(0.3)->sentence(6),
            ]);
        }
        
        // ============================================
        // WORK PERMITS (30 per week per project, weeks 34-49)
        // ============================================
        $this->command->info('Creating work permits (30 per week per project, weeks 34-49)...');
        
        $permitDescriptions = [
            'Welding work on structural steel',
            'Electrical panel maintenance',
            'Pipe fitting and installation',
            'Roof repair and waterproofing',
            'Tank cleaning and inspection',
            'Painting and coating application',
            'Scaffolding erection',
            'Cable tray installation',
            'HVAC duct work',
            'Foundation excavation',
            'Concrete pouring',
            'Equipment installation',
            'Valve replacement',
            'Insulation work',
            'Fire alarm system testing',
            'Generator maintenance',
            'Pump overhaul',
            'Crane operations',
            'Rigging and lifting',
            'Grinding and cutting operations',
        ];
        
        $permitUsers = [
            'Ahmed Hassan', 'Mohamed Ali', 'Youssef Karim', 'Omar Mansour',
            'Khalid Ibrahim', 'Samir Nabil', 'Tarek Farouk', 'Hassan Mahmoud',
            'Amir Salah', 'Fadi Rashid', 'Nasser Hamid', 'Walid Adel',
        ];
        
        $enterprises = ['SGTM', 'Contractor A', 'Contractor B', 'Subcontractor X', 'Maintenance Co.'];
        $areas = ['R14', 'R15', 'R16', 'Building A', 'Building B', 'Workshop', 'Storage', 'Utilities'];
        $statuses = [WorkPermit::STATUS_DRAFT, WorkPermit::STATUS_ACTIVE, WorkPermit::STATUS_CLOSED];
        
        foreach ($projects as $project) {
            $this->command->info("  Creating permits for project: {$project->name}");
            
            for ($week = $startWeek; $week <= $currentWeek; $week++) {
                $weekDates = WorkPermit::getWeekDates($week, $currentYear);
                
                for ($permit = 1; $permit <= 30; $permit++) {
                    $permitNumber = WorkPermit::generatePermitNumber($project->code, $week, $permit);
                    
                    // Skip if permit number already exists
                    if (WorkPermit::where('permit_number', $permitNumber)->exists()) {
                        continue;
                    }
                    
                    // Older weeks are mostly closed, current week is mostly draft/active
                    if ($week < $currentWeek - 2) {
                        $status = $faker->randomElement([WorkPermit::STATUS_CLOSED, WorkPermit::STATUS_CLOSED, WorkPermit::STATUS_ACTIVE]);
                    } elseif ($week < $currentWeek) {
                        $status = $faker->randomElement([WorkPermit::STATUS_ACTIVE, WorkPermit::STATUS_CLOSED, WorkPermit::STATUS_DRAFT]);
                    } else {
                        $status = $faker->randomElement([WorkPermit::STATUS_DRAFT, WorkPermit::STATUS_ACTIVE, WorkPermit::STATUS_DRAFT]);
                    }
                    
                    WorkPermit::create([
                        'project_id' => $project->id,
                        'week_number' => $week,
                        'year' => $currentYear,
                        'is_prolongation' => $faker->boolean(10), // 10% are Sunday prolongations
                        'permit_number' => $permitNumber,
                        'serial_number' => $permit,
                        'type_cold' => true, // Always true
                        'type_work_at_height' => $faker->boolean(30),
                        'type_hot_work' => $faker->boolean(40),
                        'type_confined_spaces' => $faker->boolean(20),
                        'type_electrical_isolation' => $faker->boolean(25),
                        'type_energized_work' => $faker->boolean(15),
                        'type_excavation' => $faker->boolean(20),
                        'type_mechanical_isolation' => $faker->boolean(30),
                        'type_7inch_grinder' => $faker->boolean(25),
                        'description' => $faker->randomElement($permitDescriptions),
                        'area' => $faker->randomElement($areas),
                        'permit_user' => $faker->randomElement($permitUsers),
                        'commence_date' => $weekDates['start'],
                        'end_date' => $weekDates['end'],
                        'enterprise' => $faker->randomElement($enterprises),
                        'status' => $status,
                        'created_by' => $faker->randomElement($userIds),
                    ]);
                }
            }
        }
        
        $this->command->info('Mock data created successfully!');
        $this->command->info('Summary:');
        $this->command->info('  - Awareness Sessions: ' . AwarenessSession::count());
        $this->command->info('  - Trainings: ' . Training::count());
        $this->command->info('  - SOR Reports: ' . SorReport::count());
        $this->command->info('  - Work Permits: ' . WorkPermit::count());
    }
}
