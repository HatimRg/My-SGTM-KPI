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
        Schema::create('bug_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            $table->string('role', 50)->nullable();
            $table->json('projects')->nullable();

            $table->text('comment');
            $table->string('severity', 20)->nullable();
            $table->string('impact', 20)->nullable();
            $table->string('reproducibility', 20)->nullable();
            $table->text('extra_notes')->nullable();

            $table->dateTime('started_at')->nullable();
            $table->dateTime('ended_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();

            $table->json('console_logs')->nullable();
            $table->json('network_logs')->nullable();
            $table->json('route_logs')->nullable();
            $table->json('metadata')->nullable();

            $table->timestamps();

            $table->index('user_id');
            $table->index('severity');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bug_reports');
    }
};
