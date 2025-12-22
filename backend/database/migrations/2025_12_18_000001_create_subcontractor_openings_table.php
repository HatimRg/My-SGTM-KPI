<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSubcontractorOpeningsTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('subcontractor_openings')) {
            return;
        }

        Schema::create('subcontractor_openings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects');
            $table->string('contractor_name');
            $table->date('contractor_start_date')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->foreignId('updated_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index(['project_id', 'contractor_name']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('subcontractor_openings');
    }
}
