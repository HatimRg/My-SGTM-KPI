<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMachineWorkerTable extends Migration
{
    public function up()
    {
        Schema::create('machine_worker', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained('machines')->cascadeOnDelete();
            $table->foreignId('worker_id')->constrained('workers')->cascadeOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['machine_id', 'worker_id']);
            $table->index('worker_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('machine_worker');
    }
}
