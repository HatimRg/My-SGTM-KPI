<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_effectif_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            $table->date('entry_date');
            $table->unsignedInteger('effectif');
            $table->foreignId('submitted_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['project_id', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_effectif_entries');
    }
};
