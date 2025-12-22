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
        Schema::create('awareness_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            $table->foreignId('submitted_by')->constrained('users')->onDelete('cascade');
            $table->date('date');
            $table->unsignedSmallInteger('week_number');
            $table->unsignedSmallInteger('week_year');
            $table->string('by_name');
            $table->string('theme', 500);
            $table->unsignedSmallInteger('duration_minutes');
            $table->unsignedInteger('participants');
            $table->decimal('session_hours', 8, 2);
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
        Schema::dropIfExists('awareness_sessions');
    }
};
