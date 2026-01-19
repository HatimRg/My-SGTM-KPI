<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monthly_kpi_measurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            $table->foreignId('entered_by')->constrained('users')->onDelete('cascade');

            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->string('indicator', 50);
            $table->decimal('value', 12, 2);
            $table->string('method')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->unique(['project_id', 'year', 'month', 'indicator'], 'monthly_kpi_unique');
            $table->index(['project_id', 'year', 'month']);
            $table->index(['indicator']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_kpi_measurements');
    }
};
