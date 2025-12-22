<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sor_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnDelete();
            
            // SOR Fields
            $table->string('company')->nullable();
            $table->date('observation_date');
            $table->time('observation_time')->nullable();
            $table->string('zone')->nullable();
            $table->string('supervisor')->nullable();
            
            // Non-conformity details
            $table->text('non_conformity');
            $table->string('photo_path')->nullable();
            $table->string('category'); // Catégorie de l'écart
            $table->string('responsible_person')->nullable(); // Responsable concerné
            $table->date('deadline')->nullable(); // Date butoir
            $table->text('corrective_action')->nullable(); // Action de maîtrise
            
            // Status tracking
            $table->enum('status', ['open', 'in_progress', 'closed'])->default('open');
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index(['project_id', 'observation_date']);
            $table->index('status');
            $table->index('category');
            $table->index('submitted_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sor_reports');
    }
};
