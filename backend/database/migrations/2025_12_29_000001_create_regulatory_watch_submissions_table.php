<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('regulatory_watch_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->string('schema_version', 50);
            $table->json('answers');
            $table->json('section_scores');
            $table->decimal('overall_score', 5, 2)->nullable();
            $table->timestamps();

            $table->index(['project_id', 'submitted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('regulatory_watch_submissions');
    }
};
