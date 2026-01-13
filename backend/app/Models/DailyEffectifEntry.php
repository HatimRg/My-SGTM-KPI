<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DailyEffectifEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'entry_date',
        'effectif',
        'submitted_by',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'effectif' => 'integer',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
