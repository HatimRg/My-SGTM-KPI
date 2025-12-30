<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkerPpeIssue extends Model
{
    use HasFactory;

    protected $table = 'worker_ppe_issues';

    protected $fillable = [
        'worker_id',
        'project_id',
        'ppe_item_id',
        'quantity',
        'received_at',
        'issued_by',
    ];

    protected $casts = [
        'received_at' => 'date',
        'quantity' => 'integer',
    ];

    public function worker()
    {
        return $this->belongsTo(Worker::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function ppeItem()
    {
        return $this->belongsTo(PpeItem::class, 'ppe_item_id');
    }

    public function issuer()
    {
        return $this->belongsTo(User::class, 'issued_by');
    }
}
