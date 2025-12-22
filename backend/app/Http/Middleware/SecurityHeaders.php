<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        // Core security headers
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('X-XSS-Protection', '0'); // deprecated but explicitly disabled
        $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        // Cross-Origin policies only for HTTPS
        if ($request->isSecure()) {
            $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');
            $response->headers->set('Cross-Origin-Resource-Policy', 'same-origin');
        }

        // Content Security Policy tuned for this SPA
        if (!$response->headers->has('Content-Security-Policy')) {
            $csp = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com data:",
                "img-src 'self' data: blob:",
                "connect-src 'self'",
                "frame-src 'self' blob:",
                "frame-ancestors 'none'",
            ];

            $response->headers->set('Content-Security-Policy', implode('; ', $csp));
        }

        // HSTS only when serving over HTTPS (so it does not interfere with HTTP dev/test)
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }

        // Long-lived caching for versioned static assets when they are served through Laravel
        if ($request->is('assets/*')) {
            $response->headers->set('Cache-Control', 'public, max-age=31536000, immutable');
        }

        return $response;
    }
}
