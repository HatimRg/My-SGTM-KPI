<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddVersioningToMachineInspectionsTable extends Migration
{
    public function up()
    {
        Schema::table('machine_inspections', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('machine_id')->constrained('machine_inspections')->nullOnDelete();
            $table->unsignedInteger('version')->default(1)->after('parent_id');

            $table->index(['machine_id', 'parent_id', 'version']);
        });
    }

    public function down()
    {
        Schema::table('machine_inspections', function (Blueprint $table) {
            $table->dropIndex(['machine_id', 'parent_id', 'version']);
            $table->dropConstrainedForeignId('parent_id');
            $table->dropColumn('version');
        });
    }
}
