<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateWorkerSanctionsTable extends Migration
{
    public function up()
    {
        Schema::create('worker_sanctions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worker_id')->constrained('workers')->onDelete('cascade');
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->date('sanction_date');
            $table->text('reason');
            $table->string('sanction_type', 50);
            $table->unsignedInteger('mise_a_pied_days')->nullable();
            $table->string('document_path')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('worker_id');
            $table->index('sanction_date');
            $table->index('sanction_type');
        });
    }

    public function down()
    {
        Schema::dropIfExists('worker_sanctions');
    }
}
