<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('waste_exports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->onDelete('cascade');

            $table->date('date');

            $table->string('waste_type');
            $table->string('waste_type_other')->nullable();

            $table->decimal('quantity', 12, 3);
            $table->unsignedInteger('trips_count');

            $table->string('transport_method');
            $table->string('transport_method_other')->nullable();

            $table->string('plate_number', 50);

            $table->string('treatment');
            $table->string('treatment_other')->nullable();

            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');

            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'date']);
            $table->index(['waste_type']);
            $table->index(['plate_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waste_exports');
    }
};
