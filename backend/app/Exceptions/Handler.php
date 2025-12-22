<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });

        $this->renderable(function (PostTooLargeException $e, $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Upload is too large. Please reduce file size or increase server upload limits (upload_max_filesize / post_max_size).',
                    'data' => null,
                ], 413);
            }
        });

        $this->renderable(function (HttpException $e, $request) {
            if (($request->expectsJson() || $request->is('api/*')) && $e->getStatusCode() === 413) {
                return response()->json([
                    'success' => false,
                    'message' => 'Upload is too large. Please reduce file size or increase server upload limits.',
                    'data' => null,
                ], 413);
            }
        });
    }

    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
                'data' => null,
            ], 401);
        }

        return redirect()->guest('/');
    }
}
