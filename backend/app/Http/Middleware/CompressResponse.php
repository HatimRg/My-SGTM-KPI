<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CompressResponse
{
    /**
     * Handle an incoming request and compress the response if supported.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        
        // Skip compression for file downloads, images, or already compressed content
        $contentType = $response->headers->get('Content-Type', '');
        if (
            str_contains($contentType, 'image/') ||
            str_contains($contentType, 'application/octet-stream') ||
            str_contains($contentType, 'application/zip') ||
            str_contains($contentType, 'application/pdf') ||
            $response->headers->has('Content-Encoding')
        ) {
            return $response;
        }
        
        // Check if client accepts gzip
        $acceptEncoding = $request->header('Accept-Encoding', '');
        if (!str_contains($acceptEncoding, 'gzip')) {
            return $response;
        }
        
        // Get content
        $content = $response->getContent();
        
        // Only compress if content is large enough (> 1KB)
        if (strlen($content) < 1024) {
            return $response;
        }
        
        // Compress content
        $compressed = gzencode($content, 6);
        
        if ($compressed !== false && strlen($compressed) < strlen($content)) {
            $response->setContent($compressed);
            $response->headers->set('Content-Encoding', 'gzip');
            $response->headers->set('Content-Length', strlen($compressed));
            $response->headers->set('Vary', 'Accept-Encoding');
        }
        
        return $response;
    }
}
