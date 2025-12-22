<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateWorkPermitsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('work_permits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            
            // Week info (S01-S52, Monday to Saturday)
            $table->unsignedTinyInteger('week_number'); // 1-52
            $table->year('year');
            $table->boolean('is_prolongation')->default(false); // Sunday permits
            
            // Permit number: SGTM-{project_code}-S{week}-{serial}
            $table->string('permit_number')->unique();
            $table->unsignedInteger('serial_number'); // Serial within week/project
            
            // Permit types (checkboxes - multiple can apply)
            $table->boolean('type_cold')->default(true); // Always checked
            $table->boolean('type_work_at_height')->default(false);
            $table->boolean('type_hot_work')->default(false);
            $table->boolean('type_confined_spaces')->default(false);
            $table->boolean('type_electrical_isolation')->default(false);
            $table->boolean('type_energized_work')->default(false);
            $table->boolean('type_excavation')->default(false);
            $table->boolean('type_mechanical_isolation')->default(false);
            $table->boolean('type_7inch_grinder')->default(false);
            
            // Permit details
            $table->text('description')->nullable();
            $table->string('area')->nullable();
            $table->string('permit_user'); // Person using the permit
            $table->date('commence_date');
            $table->date('end_date');
            $table->string('enterprise')->nullable(); // Company/Enterprise
            
            // Status
            $table->enum('status', ['draft', 'active', 'closed', 'cancelled'])->default('draft');
            
            // Audit
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index(['project_id', 'week_number', 'year']);
            $table->index(['project_id', 'year']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('work_permits');
    }
}
