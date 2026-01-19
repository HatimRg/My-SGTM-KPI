<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lighting_measurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            $table->foreignId('entered_by')->constrained('users')->onDelete('cascade');

            $table->date('measured_at');
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');

            $table->string('location');
            $table->decimal('lux_value', 10, 2);
            $table->decimal('threshold', 10, 2)->nullable();
            $table->boolean('is_compliant')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'year', 'month']);
            $table->index(['measured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lighting_measurements');
    }
};
