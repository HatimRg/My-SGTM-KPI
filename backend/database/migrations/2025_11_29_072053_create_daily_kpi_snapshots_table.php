<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDailyKpiSnapshotsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('daily_kpi_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            $table->foreignId('submitted_by')->constrained('users')->onDelete('cascade');
            
            // Date info
            $table->date('entry_date');
            $table->unsignedTinyInteger('week_number');
            $table->unsignedSmallInteger('year');
            $table->string('day_name', 20)->nullable(); // Monday, Tuesday, etc.
            
            // Workforce - KPI takes MAX of the week
            $table->unsignedInteger('effectif')->default(0)->comment('Daily workforce count');
            
            // Safety inductions - KPI takes SUM of the week
            $table->unsignedInteger('induction')->default(0)->comment('New worker inductions');
            
            // Findings/Deviations - KPI takes SUM
            $table->unsignedInteger('releve_ecarts')->default(0)->comment('Deviations/findings recorded');
            
            // Awareness/Sensibilization - auto-extracted from awareness_sessions table
            $table->unsignedInteger('sensibilisation')->default(0)->comment('TBM/TBT count - auto from awareness table');
            
            // Near misses - KPI takes SUM
            $table->unsignedInteger('presquaccident')->default(0)->comment('Near miss incidents');
            
            // First aid cases - KPI takes SUM
            $table->unsignedInteger('premiers_soins')->default(0)->comment('First aid cases');
            
            // Accidents - KPI takes SUM
            $table->unsignedInteger('accidents')->default(0)->comment('Accidents count');
            
            // Lost workdays - KPI takes SUM (used for TG calculation)
            $table->unsignedInteger('jours_arret')->default(0)->comment('Lost workdays');
            
            // Hours worked - KPI takes SUM (used for TF calculation)
            $table->decimal('heures_travaillees', 10, 2)->default(0)->comment('Hours worked');
            
            // Inspections - KPI takes SUM
            $table->unsignedInteger('inspections')->default(0)->comment('Inspections completed');
            
            // Training hours - auto-extracted from training + awareness tables
            $table->decimal('heures_formation', 8, 2)->default(0)->comment('Training hours - auto from training table');
            
            // Work permits - auto-extracted from work_permits table
            $table->unsignedInteger('permis_travail')->default(0)->comment('Work permits - auto from permits table');
            
            // Disciplinary measures - KPI takes SUM
            $table->unsignedInteger('mesures_disciplinaires')->default(0)->comment('Disciplinary actions');
            
            // HSE Compliance rate (%) - KPI takes AVERAGE
            $table->decimal('conformite_hse', 5, 2)->nullable()->comment('HSE compliance rate %');
            
            // Medical compliance rate (%) - KPI takes AVERAGE
            $table->decimal('conformite_medicale', 5, 2)->nullable()->comment('Medical compliance rate %');
            
            // Noise monitoring - daily value
            $table->decimal('suivi_bruit', 6, 2)->nullable()->comment('Noise level dB');
            
            // Water consumption - KPI takes SUM
            $table->decimal('consommation_eau', 10, 2)->default(0)->comment('Water consumption m³');
            
            // Electricity consumption - KPI takes SUM
            $table->decimal('consommation_electricite', 10, 2)->default(0)->comment('Electricity consumption kWh');
            
            // Status and notes
            $table->enum('status', ['draft', 'submitted'])->default('draft');
            $table->text('notes')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            // Unique constraint: one entry per project per day
            $table->unique(['project_id', 'entry_date'], 'daily_kpi_unique');
            
            // Indexes for common queries
            $table->index(['project_id', 'week_number', 'year']);
            $table->index(['entry_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('daily_kpi_snapshots');
    }
}
