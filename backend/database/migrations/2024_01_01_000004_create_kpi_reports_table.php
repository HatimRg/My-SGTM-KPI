<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kpi_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnDelete();
            $table->date('report_date');
            $table->unsignedTinyInteger('report_month');
            $table->unsignedSmallInteger('report_year');
            
            // Accident metrics
            $table->unsignedInteger('accidents')->default(0);
            $table->unsignedInteger('accidents_fatal')->default(0);
            $table->unsignedInteger('accidents_serious')->default(0);
            $table->unsignedInteger('accidents_minor')->default(0);
            $table->unsignedInteger('near_misses')->default(0);
            $table->unsignedInteger('first_aid_cases')->default(0);
            
            // Training metrics
            $table->unsignedInteger('trainings_conducted')->default(0);
            $table->unsignedInteger('trainings_planned')->default(0);
            $table->unsignedInteger('employees_trained')->default(0);
            $table->decimal('training_hours', 10, 2)->default(0);
            $table->unsignedInteger('toolbox_talks')->default(0);
            
            // Inspection metrics
            $table->unsignedInteger('inspections_completed')->default(0);
            $table->unsignedInteger('inspections_planned')->default(0);
            $table->unsignedInteger('findings_open')->default(0);
            $table->unsignedInteger('findings_closed')->default(0);
            $table->unsignedInteger('corrective_actions')->default(0);
            
            // TG (Taux de Gravité) - Severity Rate
            $table->decimal('tg_value', 10, 4)->default(0);
            $table->unsignedInteger('lost_workdays')->default(0);
            
            // TF (Taux de Fréquence) - Frequency Rate
            $table->decimal('tf_value', 10, 4)->default(0);
            $table->decimal('hours_worked', 15, 2)->default(0);
            
            // Additional metrics
            $table->unsignedInteger('unsafe_acts_reported')->default(0);
            $table->unsignedInteger('unsafe_conditions_reported')->default(0);
            $table->unsignedInteger('emergency_drills')->default(0);
            $table->decimal('hse_compliance_rate', 5, 2)->default(0);
            
            // Notes and status
            $table->text('notes')->nullable();
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected'])->default('draft');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes for performance
            $table->index(['project_id', 'report_year', 'report_month']);
            $table->index('report_date');
            $table->index('status');
            $table->index('submitted_by');
            $table->unique(['project_id', 'report_month', 'report_year'], 'unique_monthly_report');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kpi_reports');
    }
};
