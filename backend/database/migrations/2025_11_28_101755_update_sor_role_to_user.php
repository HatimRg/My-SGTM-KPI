<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class UpdateSorRoleToUser extends Migration
{
    /**
     * Run the migrations.
     * Updates 'sor' role to 'user' for HSE Officer role rename
     *
     * @return void
     */
    public function up()
    {
        // First, modify the enum to include 'user'
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'sor', 'user') DEFAULT 'responsable'");
        
        // Update existing 'sor' users to 'user'
        DB::table('users')
            ->where('role', 'sor')
            ->update(['role' => 'user']);
        
        // Remove 'sor' from enum
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'user') DEFAULT 'responsable'");
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        // Add 'sor' back to enum
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'user', 'sor') DEFAULT 'responsable'");
        
        // Update 'user' back to 'sor'
        DB::table('users')
            ->where('role', 'user')
            ->update(['role' => 'sor']);
        
        // Remove 'user' from enum
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'responsable', 'sor') DEFAULT 'responsable'");
    }
}
