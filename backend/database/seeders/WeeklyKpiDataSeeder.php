<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Project;
use App\Models\KpiReport;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

class WeeklyKpiDataSeeder extends Seeder
{
    /**
     * Seed weekly KPI data from week 32 to week 48 for all projects
     * with realistic HSE data
     */
    public function run(): void
    {
        $admin = User::where('role', 'admin')->first();
        $projects = Project::with('users')->get();
        
        if ($projects->isEmpty()) {
            $this->command->error('No projects found! Please run DatabaseSeeder first.');
            return;
        }

        $year = 2025;
        $startWeek = 32;
        $endWeek = 48;

        // Project-specific base values (different scales for different projects)
        $projectProfiles = [
            1 => ['name' => 'SGTM Casablanca', 'workforce' => 150, 'risk' => 'medium'],
            2 => ['name' => 'Tanger Port', 'workforce' => 200, 'risk' => 'high'],
            3 => ['name' => 'Rabat Highway', 'workforce' => 180, 'risk' => 'high'],
            4 => ['name' => 'Marrakech Industrial', 'workforce' => 120, 'risk' => 'medium'],
            5 => ['name' => 'UM6P Phase 3B', 'workforce' => 250, 'risk' => 'medium'],
        ];

        $this->command->info("Seeding weekly KPI data for weeks {$startWeek}-{$endWeek} of {$year}...");

        foreach ($projects as $project) {
            $profile = $projectProfiles[$project->id] ?? [
                'name' => $project->name,
                'workforce' => 100,
                'risk' => 'medium'
            ];
            
            $submitter = $project->users->first() ?? $admin;
            
            for ($week = $startWeek; $week <= $endWeek; $week++) {
                // Calculate week dates (Saturday to Friday)
                $dates = $this->getWeekDates($week, $year);
                
                // Check if report already exists
                $exists = KpiReport::where('project_id', $project->id)
                    ->where('week_number', $week)
                    ->where('report_year', $year)
                    ->exists();
                    
                if ($exists) {
                    continue;
                }

                // Generate realistic data based on project profile
                $data = $this->generateWeeklyData($profile, $week);
                
                KpiReport::create([
                    'project_id' => $project->id,
                    'submitted_by' => $submitter->id,
                    'report_date' => $dates['start'],
                    'report_month' => $dates['start']->month,
                    'report_year' => $year,
                    'week_number' => $week,
                    'start_date' => $dates['start']->format('Y-m-d'),
                    'end_date' => $dates['end']->format('Y-m-d'),
                    
                    // Accident metrics
                    'accidents' => $data['accidents'],
                    'accidents_fatal' => $data['accidents_fatal'],
                    'accidents_serious' => $data['accidents_serious'],
                    'accidents_minor' => $data['accidents_minor'],
                    'near_misses' => $data['near_misses'],
                    'first_aid_cases' => $data['first_aid_cases'],
                    
                    // Training metrics
                    'trainings_conducted' => $data['trainings_conducted'],
                    'trainings_planned' => $data['trainings_planned'],
                    'employees_trained' => $data['employees_trained'],
                    'training_hours' => $data['training_hours'],
                    'toolbox_talks' => $data['toolbox_talks'],
                    
                    // Inspection metrics
                    'inspections_completed' => $data['inspections_completed'],
                    'inspections_planned' => $data['inspections_planned'],
                    'findings_open' => $data['findings_open'],
                    'findings_closed' => $data['findings_closed'],
                    'corrective_actions' => $data['corrective_actions'],
                    
                    // Work hours and rates
                    'hours_worked' => $data['hours_worked'],
                    'lost_workdays' => $data['lost_workdays'],
                    'tf_value' => $data['tf_value'],
                    'tg_value' => $data['tg_value'],
                    
                    // Safety observations
                    'unsafe_acts_reported' => $data['unsafe_acts_reported'],
                    'unsafe_conditions_reported' => $data['unsafe_conditions_reported'],
                    'emergency_drills' => $data['emergency_drills'],
                    
                    // Compliance rates
                    'medical_compliance_rate' => $data['medical_compliance_rate'],
                    'hse_compliance_rate' => $data['hse_compliance_rate'],
                    
                    // Resource consumption
                    'noise_monitoring' => $data['noise_monitoring'],
                    'water_consumption' => $data['water_consumption'],
                    'electricity_consumption' => $data['electricity_consumption'],
                    'work_permits' => $data['work_permits'],
                    
                    'status' => 'approved',
                    'approved_by' => $admin->id,
                    'approved_at' => $dates['end'],
                    'submission_count' => 1,
                    'last_submitted_at' => $dates['end'],
                ]);
            }
            
            $this->command->info("  ✓ {$project->name}: " . ($endWeek - $startWeek + 1) . " weeks of data added");
        }

        $this->command->info('Weekly KPI data seeding completed!');
    }

    /**
     * Get Saturday-Friday week dates
     */
    private function getWeekDates(int $week, int $year): array
    {
        // Find the first Saturday of the year
        $firstDay = Carbon::createFromDate($year, 1, 1);
        $firstSaturday = $firstDay->copy();
        
        while ($firstSaturday->dayOfWeek !== Carbon::SATURDAY) {
            $firstSaturday->addDay();
        }
        
        // Calculate the start date (Saturday) for the given week
        $start = $firstSaturday->copy()->addWeeks($week - 1);
        $end = $start->copy()->addDays(6); // Friday
        
        return [
            'start' => $start,
            'end' => $end,
        ];
    }

    /**
     * Generate realistic weekly HSE data based on project profile
     */
    private function generateWeeklyData(array $profile, int $week): array
    {
        $workforce = $profile['workforce'];
        $riskLevel = $profile['risk'];
        
        // Base hours worked (48 hours/week * workforce * attendance rate ~85%)
        $hoursWorked = $workforce * 48 * 0.85 * (rand(90, 110) / 100);
        
        // Accidents - higher risk projects have slightly higher rates
        $accidentChance = $riskLevel === 'high' ? 0.15 : 0.08;
        $accidents = rand(0, 100) < ($accidentChance * 100) ? rand(1, 2) : 0;
        $accidentsFatal = 0; // Very rare
        $accidentsSerious = $accidents > 0 && rand(0, 10) < 2 ? 1 : 0;
        $accidentsMinor = max(0, $accidents - $accidentsSerious);
        
        // Near misses and first aid (more common)
        $nearMisses = rand(3, 12);
        $firstAidCases = rand(1, 6);
        
        // Lost workdays (only if accidents occurred)
        $lostWorkdays = $accidentsSerious > 0 ? rand(3, 8) : ($accidentsMinor > 0 ? rand(0, 2) : 0);
        
        // Calculate TF and TG rates
        // TF = (accidents * 1,000,000) / hours_worked
        $tfValue = $hoursWorked > 0 ? ($accidents * 1000000) / $hoursWorked : 0;
        // TG = (lost_workdays * 1,000) / hours_worked  
        $tgValue = $hoursWorked > 0 ? ($lostWorkdays * 1000) / $hoursWorked : 0;
        
        // Training metrics
        $trainingsPlanned = rand(4, 8);
        $trainingsConducted = rand(max(2, $trainingsPlanned - 2), $trainingsPlanned);
        $employeesTrained = rand(intval($workforce * 0.15), intval($workforce * 0.4));
        $trainingHours = $employeesTrained * rand(2, 4);
        $toolboxTalks = rand(5, 7); // Daily talks
        
        // Inspection metrics
        $inspectionsPlanned = rand(10, 20);
        $inspectionsCompleted = rand(max(8, $inspectionsPlanned - 3), $inspectionsPlanned);
        $findingsOpen = rand(3, 12);
        $findingsClosed = rand(5, 15);
        $correctiveActions = rand(2, 8);
        
        // Safety observations
        $unsafeActs = rand(3, 15);
        $unsafeConditions = rand(2, 10);
        $emergencyDrills = rand(0, 1);
        
        // Compliance rates (generally good, 90-99%)
        $hseCompliance = rand(92, 99);
        $medicalCompliance = rand(88, 98);
        
        // Resource consumption (scaled by workforce)
        $noiseMonitoring = rand(65, 85); // dB level
        $waterConsumption = $workforce * rand(2, 5); // m³
        $electricityConsumption = $workforce * rand(100, 300); // kWh
        $workPermits = rand(8, 25);
        
        return [
            'hours_worked' => round($hoursWorked, 2),
            'accidents' => $accidents,
            'accidents_fatal' => $accidentsFatal,
            'accidents_serious' => $accidentsSerious,
            'accidents_minor' => $accidentsMinor,
            'near_misses' => $nearMisses,
            'first_aid_cases' => $firstAidCases,
            'lost_workdays' => $lostWorkdays,
            'tf_value' => round($tfValue, 4),
            'tg_value' => round($tgValue, 4),
            'trainings_conducted' => $trainingsConducted,
            'trainings_planned' => $trainingsPlanned,
            'employees_trained' => $employeesTrained,
            'training_hours' => $trainingHours,
            'toolbox_talks' => $toolboxTalks,
            'inspections_completed' => $inspectionsCompleted,
            'inspections_planned' => $inspectionsPlanned,
            'findings_open' => $findingsOpen,
            'findings_closed' => $findingsClosed,
            'corrective_actions' => $correctiveActions,
            'unsafe_acts_reported' => $unsafeActs,
            'unsafe_conditions_reported' => $unsafeConditions,
            'emergency_drills' => $emergencyDrills,
            'medical_compliance_rate' => $medicalCompliance,
            'hse_compliance_rate' => $hseCompliance,
            'noise_monitoring' => $noiseMonitoring,
            'water_consumption' => $waterConsumption,
            'electricity_consumption' => $electricityConsumption,
            'work_permits' => $workPermits,
        ];
    }
}
