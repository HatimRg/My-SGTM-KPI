<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddWorkTypeToSubcontractorOpeningsTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('subcontractor_openings')) {
            return;
        }

        if (Schema::hasColumn('subcontractor_openings', 'work_type')) {
            return;
        }

        Schema::table('subcontractor_openings', function (Blueprint $table) {
            $table->string('work_type')->nullable()->after('contractor_name');
        });
    }

    public function down()
    {
        if (!Schema::hasTable('subcontractor_openings')) {
            return;
        }

        if (!Schema::hasColumn('subcontractor_openings', 'work_type')) {
            return;
        }

        Schema::table('subcontractor_openings', function (Blueprint $table) {
            $table->dropColumn('work_type');
        });
    }
}
