<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateWorkerTrainingsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('worker_trainings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worker_id')->constrained('workers')->onDelete('cascade');
            $table->string('training_type', 100); // e.g. induction_hse, travail_en_hauteur, other
            $table->string('training_label')->nullable(); // Custom label when type = other
            $table->date('training_date');
            $table->date('expiry_date')->nullable();
            $table->string('certificate_path')->nullable(); // Stored PDF path
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('expiring_notified_at')->nullable();
            $table->timestamp('expired_notified_at')->nullable();
            $table->timestamps();

            $table->index('training_type');
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
        Schema::dropIfExists('worker_trainings');
    }
}
