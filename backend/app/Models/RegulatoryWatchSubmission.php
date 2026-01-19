<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Project;
use App\Models\User;

class RegulatoryWatchSubmission extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'project_id',
        'submitted_by',
        'submitted_at',
        'week_year',
        'week_number',
        'schema_version',
        'answers',
        'section_scores',
        'overall_score',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'week_year' => 'integer',
        'week_number' => 'integer',
        'answers' => 'array',
        'section_scores' => 'array',
        'overall_score' => 'decimal:2',
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
