<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateWorkerMedicalAptitudesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('worker_medical_aptitudes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worker_id')->constrained('workers')->onDelete('cascade');
            $table->string('aptitude_status', 20); // apte / inapte
            $table->string('exam_nature', 100);
            $table->json('able_to')->nullable();
            $table->date('exam_date');
            $table->date('expiry_date')->nullable();
            $table->string('certificate_path')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('aptitude_status');
            $table->index('exam_nature');
            $table->index('expiry_date');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('worker_medical_aptitudes');
    }
}
