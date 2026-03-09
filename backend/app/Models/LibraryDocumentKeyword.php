<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LibraryDocumentKeyword extends Model
{
    use HasFactory;

    protected $fillable = [
        'document_id',
        'keyword',
    ];

    public function document()
    {
        return $this->belongsTo(LibraryDocument::class, 'document_id');
    }
}
