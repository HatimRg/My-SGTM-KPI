<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class AddSupervisorRoleToUsers extends Migration
{
    /**
     * Run the migrations.
     * Adds 'supervisor' role for Sup.USER
     */
    public function up()
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'user', 'supervisor') DEFAULT 'responsable'");
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        // Note: This will fail if any user has 'supervisor' role
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'user') DEFAULT 'responsable'");
    }
}
