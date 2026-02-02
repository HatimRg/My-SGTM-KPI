<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectCodeAlias extends Model
{
    protected $fillable = [
        'project_id',
        'code',
        'created_by',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
