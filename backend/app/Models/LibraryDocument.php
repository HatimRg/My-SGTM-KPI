<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LibraryDocument extends Model
{
    use HasFactory;

    public const STATUS_PROCESSING = 'processing';
    public const STATUS_INDEXED = 'indexed';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'is_sds',
        'sds_public_token',
        'sds_pictograms',
        'sds_qr_pdf_path',
        'sds_tag_pdf_path',
        'folder_id',
        'title',
        'original_name',
        'file_path',
        'thumbnail_path',
        'file_type',
        'mime_type',
        'size_bytes',
        'uploaded_by',
        'status',
        'language',
        'error_message',
    ];

    public function folder()
    {
        return $this->belongsTo(LibraryFolder::class, 'folder_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function keywords()
    {
        return $this->hasMany(LibraryDocumentKeyword::class, 'document_id');
    }
}
