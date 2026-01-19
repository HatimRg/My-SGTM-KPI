<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hse_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            $table->foreignId('entered_by')->constrained('users')->onDelete('cascade');

            $table->date('event_date');
            $table->unsignedSmallInteger('event_year');
            $table->unsignedTinyInteger('event_month');
            $table->unsignedTinyInteger('week_number');
            $table->unsignedSmallInteger('week_year');

            $table->string('pole')->nullable();
            $table->string('type', 50);
            $table->text('description')->nullable();

            $table->string('severity', 30)->nullable();
            $table->boolean('lost_time')->default(false);
            $table->unsignedInteger('lost_days')->default(0);

            $table->string('location')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'event_year']);
            $table->index(['project_id', 'week_year', 'week_number']);
            $table->index(['type']);
            $table->index(['event_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hse_events');
    }
};
