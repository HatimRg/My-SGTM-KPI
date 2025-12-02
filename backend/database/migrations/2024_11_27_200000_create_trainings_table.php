<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('trainings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            $table->foreignId('submitted_by')->constrained('users')->onDelete('cascade');
            $table->date('date');
            $table->unsignedSmallInteger('week_number');
            $table->unsignedSmallInteger('week_year');
            $table->boolean('by_internal')->default(true);
            $table->string('by_name')->nullable();
            $table->string('external_company')->nullable();
            $table->string('theme');
            $table->string('duration_label');
            $table->decimal('duration_hours', 5, 2);
            $table->unsignedInteger('participants');
            $table->decimal('training_hours', 8, 2);
            $table->string('photo_path')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Indexes for filtering
            $table->index(['project_id', 'week_number', 'week_year']);
            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trainings');
    }
};
