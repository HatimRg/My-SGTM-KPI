<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AttachBearerTokenFromCookie
{
    public function handle(Request $request, Closure $next): Response
    {
        $hasBearer = (string) $request->bearerToken() !== '';
        if (!$hasBearer) {
            $token = (string) $request->cookie('auth_token', '');
            if ($token !== '') {
                $request->headers->set('Authorization', 'Bearer ' . $token);
            }
        }

        return $next($request);
    }
}
