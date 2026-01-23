<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BugReport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class BugReportController extends Controller
{
    private const MAX_LOG_ENTRIES = 200;
    private const MAX_STRING_LENGTH = 2000;

    private const REDACT_KEYS = [
        'password',
        'pass',
        'pwd',
        'token',
        'access_token',
        'refresh_token',
        'authorization',
        'auth',
        'secret',
        'api_key',
        'apikey',
        'cookie',
        'cookies',
        'set-cookie',
    ];

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            abort(401);
        }

        $validated = $request->validate([
            'comment' => 'required|string|max:2000',
            'severity' => 'nullable|in:low,medium,high,critical',
            'impact' => 'nullable|in:minor,major,blocking',
            'reproducibility' => 'nullable|in:once,sometimes,often,always',
            'extra_notes' => 'nullable|string|max:5000',

            'started_at' => 'nullable|date',
            'ended_at' => 'nullable|date',
            'duration_seconds' => 'nullable|integer|min:0|max:600',

            // These can be arrays (application/json) OR JSON strings (multipart/form-data)
            'console_logs' => 'nullable',
            'network_logs' => 'nullable',
            'route_logs' => 'nullable',
            'metadata' => 'nullable',

            'attachment' => 'nullable|file|max:20480|mimes:xlsx,xls,csv,zip,pdf,png,jpg,jpeg,webp,txt,log',
        ]);

        $projects = $user->projects()->select(['projects.id', 'projects.name', 'projects.code'])->get()->toArray();
        $teamProjects = $user->teamProjects()->select(['projects.id', 'projects.name', 'projects.code'])->get()->toArray();
        $projects = collect(array_merge($projects, $teamProjects))
            ->unique('id')
            ->values()
            ->toArray();

        $consoleLogsRaw = $this->normalizeJsonField($validated['console_logs'] ?? null);
        $networkLogsRaw = $this->normalizeJsonField($validated['network_logs'] ?? null);
        $routeLogsRaw = $this->normalizeJsonField($validated['route_logs'] ?? null);
        $metadataRaw = $this->normalizeJsonField($validated['metadata'] ?? null);

        $consoleLogs = $this->sanitizeLogArray($consoleLogsRaw ?? []);
        $networkLogs = $this->sanitizeLogArray($networkLogsRaw ?? []);
        $routeLogs = $this->sanitizeLogArray($routeLogsRaw ?? []);
        $metadata = $this->sanitizeValue($metadataRaw ?? []);

        $report = BugReport::create([
            'user_id' => $user->id,
            'role' => $user->role,
            'projects' => $projects,
            'comment' => $validated['comment'],
            'severity' => $validated['severity'] ?? null,
            'impact' => $validated['impact'] ?? null,
            'reproducibility' => $validated['reproducibility'] ?? null,
            'extra_notes' => $validated['extra_notes'] ?? null,
            'started_at' => $validated['started_at'] ?? null,
            'ended_at' => $validated['ended_at'] ?? null,
            'duration_seconds' => $validated['duration_seconds'] ?? null,
            'console_logs' => $consoleLogs,
            'network_logs' => $networkLogs,
            'route_logs' => $routeLogs,
            'metadata' => $metadata,
        ]);

        if ($request->hasFile('attachment')) {
            try {
                $file = $request->file('attachment');
                $originalName = $file ? $file->getClientOriginalName() : null;
                $mime = $file ? $file->getClientMimeType() : null;
                $size = $file ? $file->getSize() : null;

                $safeOriginal = $originalName ? basename(str_replace(['\\', '/'], DIRECTORY_SEPARATOR, $originalName)) : 'attachment';
                $safeOriginal = preg_replace('/[^A-Za-z0-9._-]+/', '_', $safeOriginal) ?: 'attachment';
                $filename = date('Ymd_His') . '_' . $safeOriginal;

                $path = $file->storeAs('bug-reports/' . $report->id, $filename, 'public');

                $report->update([
                    'attachment_path' => $path,
                    'attachment_original_name' => $originalName,
                    'attachment_mime' => $mime,
                    'attachment_size' => $size,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Bug report attachment upload failed', ['error' => $e->getMessage()]);
            }
        }

        $report->load('user:id,name,email,role');

        return $this->success($report, 'Bug report submitted', 201);
    }

    public function index(Request $request)
    {
        $query = BugReport::query()
            ->with('user:id,name,role')
            ->orderBy('created_at', 'desc');

        $perPage = (int) $request->get('per_page', 25);
        $perPage = max(5, min(100, $perPage));

        return $this->paginated($query->paginate($perPage));
    }

    public function show(BugReport $bugReport)
    {
        $bugReport->load('user:id,name,email,role');
        return $this->success($bugReport);
    }

    public function downloadAttachment(BugReport $bugReport)
    {
        if (!$bugReport->attachment_path || !Storage::disk('public')->exists($bugReport->attachment_path)) {
            abort(404, 'File not found');
        }

        $path = $bugReport->attachment_path;
        $filename = $bugReport->attachment_original_name ?: basename($path);
        $mime = $bugReport->attachment_mime ?: 'application/octet-stream';

        return response()->streamDownload(function () use ($path) {
            $stream = Storage::disk('public')->readStream($path);
            if ($stream === false) {
                return;
            }
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, $filename, [
            'Content-Type' => $mime,
        ]);
    }

    private function normalizeJsonField($value)
    {
        if ($value === null) {
            return null;
        }

        if (is_array($value)) {
            return $value;
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return null;
            }
            try {
                $decoded = json_decode($trimmed, true);
                return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
            } catch (\Throwable $e) {
                return null;
            }
        }

        if (is_object($value)) {
            return (array) $value;
        }

        return null;
    }

    private function sanitizeLogArray($value): array
    {
        if (!is_array($value)) {
            return [];
        }

        // Keep last N entries (ring buffer style)
        if (count($value) > self::MAX_LOG_ENTRIES) {
            $value = array_slice($value, -self::MAX_LOG_ENTRIES);
        }

        $out = [];
        foreach ($value as $entry) {
            $out[] = $this->sanitizeValue($entry);
        }

        return $out;
    }

    private function sanitizeValue($value)
    {
        try {
            if (is_string($value)) {
                if (mb_strlen($value) > self::MAX_STRING_LENGTH) {
                    return mb_substr($value, 0, self::MAX_STRING_LENGTH) . '…';
                }
                return $value;
            }

            if (is_numeric($value) || is_bool($value) || $value === null) {
                return $value;
            }

            if ($value instanceof \DateTimeInterface) {
                return $value->format(DATE_ATOM);
            }

            if (is_array($value)) {
                $out = [];
                foreach ($value as $k => $v) {
                    $key = is_string($k) ? strtolower($k) : $k;
                    if (is_string($key) && $this->shouldRedactKey($key)) {
                        $out[$k] = '[REDACTED]';
                        continue;
                    }
                    $out[$k] = $this->sanitizeValue($v);
                }

                // Prevent unbounded nested arrays
                if (count($out) > 500) {
                    $out = array_slice($out, 0, 500, true);
                    $out['__truncated__'] = true;
                }

                return $out;
            }

            if (is_object($value)) {
                return $this->sanitizeValue((array) $value);
            }

            return '[UNSUPPORTED]';
        } catch (\Throwable $e) {
            Log::warning('Bug report sanitize failed', ['error' => $e->getMessage()]);
            return '[SANITIZE_ERROR]';
        }
    }

    private function shouldRedactKey(string $key): bool
    {
        foreach (self::REDACT_KEYS as $needle) {
            if ($key === $needle || str_contains($key, $needle)) {
                return true;
            }
        }
        return false;
    }
}
