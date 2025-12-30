<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMachinesTable extends Migration
{
    public function up()
    {
        Schema::create('machines', function (Blueprint $table) {
            $table->id();
            $table->string('serial_number')->unique();
            $table->string('internal_code')->nullable();
            $table->string('machine_type');
            $table->string('brand');
            $table->string('model')->nullable();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->string('image_path')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('serial_number');
            $table->index('internal_code');
            $table->index('project_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('machines');
    }
}
