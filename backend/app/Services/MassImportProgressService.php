<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class MassImportProgressService
{
    private const TTL_SECONDS = 3600;

    private function cacheKey(string $progressId): string
    {
        return 'mass_import_progress:' . $progressId;
    }

    public function init(string $progressId, array $data = []): void
    {
        $now = now()->toISOString();

        $base = [
            'id' => $progressId,
            'status' => 'running',
            'processed' => 0,
            'total' => 0,
            'failed' => 0,
            'imported' => 0,
            'updated' => 0,
            'error' => null,
            'started_at' => $now,
            'updated_at' => $now,
            'finished_at' => null,
        ];

        $payload = array_merge($base, $data);
        Cache::put($this->cacheKey($progressId), $payload, self::TTL_SECONDS);
    }

    public function get(string $progressId): ?array
    {
        $value = Cache::get($this->cacheKey($progressId));
        return is_array($value) ? $value : null;
    }

    public function update(string $progressId, array $patch): void
    {
        $existing = $this->get($progressId) ?? [];
        $payload = array_merge($existing, $patch, [
            'updated_at' => now()->toISOString(),
        ]);

        Cache::put($this->cacheKey($progressId), $payload, self::TTL_SECONDS);
    }

    public function complete(string $progressId, array $patch = []): void
    {
        $this->update($progressId, array_merge($patch, [
            'status' => 'completed',
            'finished_at' => now()->toISOString(),
        ]));
    }

    public function fail(string $progressId, string $message): void
    {
        $this->update($progressId, [
            'status' => 'failed',
            'error' => $message,
            'finished_at' => now()->toISOString(),
        ]);
    }
}
