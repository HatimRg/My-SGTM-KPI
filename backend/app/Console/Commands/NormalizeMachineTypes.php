<?php

namespace App\Console\Commands;

use App\Support\MachineTypeCatalog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class NormalizeMachineTypes extends Command
{
    protected $signature = 'machines:normalize-machine-types
        {--dry-run : Show what would change without writing to the database}
        {--mapping= : Optional JSON file path or JSON string mapping legacy values to canonical keys}
        {--chunk=500 : Chunk size for DB updates}
        {--only-null : Only normalize rows where machine_type is null/empty}';

    protected $description = 'Normalize machines.machine_type values to canonical keys defined in MachineTypeCatalog.';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $onlyNull = (bool) $this->option('only-null');
        $chunkSize = (int) ($this->option('chunk') ?: 500);
        if ($chunkSize < 1) {
            $chunkSize = 500;
        }

        $mapping = $this->loadMapping($this->option('mapping'));

        $query = DB::table('machines')->select(['id', 'machine_type']);
        if ($onlyNull) {
            $query->where(function ($q) {
                $q->whereNull('machine_type')->orWhere('machine_type', '=','');
            });
        }

        $total = (clone $query)->count();
        $this->info('Scanning machines.machine_type...');
        $this->info('Rows considered: '.$total);

        $stats = [
            'already_ok' => 0,
            'updated' => 0,
            'to_other' => 0,
            'skipped_empty' => 0,
            'unknown' => 0,
        ];

        $examples = [];

        $query->orderBy('id')->chunkById($chunkSize, function ($rows) use ($dryRun, $mapping, &$stats, &$examples) {
            foreach ($rows as $row) {
                $id = $row->id;
                $raw = $row->machine_type;

                $rawStr = $raw === null ? '' : trim((string) $raw);
                if ($raw === null || $rawStr === '') {
                    $stats['skipped_empty']++;
                    continue;
                }

                $canonical = $this->canonicalFromRaw($rawStr, $mapping);

                if ($canonical === null || $canonical === '') {
                    $canonical = 'other';
                    $stats['to_other']++;
                }

                if ($canonical === $rawStr) {
                    if (in_array($canonical, MachineTypeCatalog::keys(), true)) {
                        $stats['already_ok']++;
                    } else {
                        $stats['unknown']++;
                    }
                    continue;
                }

                if (!isset($examples[$rawStr])) {
                    $examples[$rawStr] = $canonical;
                }

                $stats['updated']++;

                if ($dryRun) {
                    continue;
                }

                DB::table('machines')->where('id', $id)->update([
                    'machine_type' => $canonical,
                ]);
            }
        });

        $this->newLine();
        $this->info('Done.');
        $this->line('Dry run: '.($dryRun ? 'yes' : 'no'));

        foreach ($stats as $k => $v) {
            $this->line($k.': '.$v);
        }

        if (!empty($examples)) {
            $this->newLine();
            $this->info('Examples (raw => canonical):');
            $i = 0;
            foreach ($examples as $raw => $canon) {
                $this->line(' - '.$raw.' => '.$canon);
                $i++;
                if ($i >= 25) {
                    $this->line(' ...');
                    break;
                }
            }
        }

        return self::SUCCESS;
    }

    private function canonicalFromRaw(string $raw, array $mapping): ?string
    {
        $rawTrim = trim($raw);
        if ($rawTrim === '') {
            return null;
        }

        if (!empty($mapping)) {
            $mapped = $mapping[$rawTrim] ?? null;
            if (is_string($mapped) && trim($mapped) !== '') {
                $mappedTrim = trim($mapped);
                if (in_array($mappedTrim, MachineTypeCatalog::keys(), true)) {
                    return $mappedTrim;
                }

                $key = MachineTypeCatalog::keyFromInput($mappedTrim);
                if ($key !== null && in_array($key, MachineTypeCatalog::keys(), true)) {
                    return $key;
                }
            }

            $lower = mb_strtolower($rawTrim);
            foreach ($mapping as $k => $v) {
                if (mb_strtolower((string) $k) === $lower) {
                    if (is_string($v) && trim($v) !== '') {
                        $vTrim = trim($v);
                        if (in_array($vTrim, MachineTypeCatalog::keys(), true)) {
                            return $vTrim;
                        }

                        $key = MachineTypeCatalog::keyFromInput($vTrim);
                        if ($key !== null && in_array($key, MachineTypeCatalog::keys(), true)) {
                            return $key;
                        }
                    }
                }
            }
        }

        $key = MachineTypeCatalog::keyFromInput($rawTrim);
        if ($key !== null && in_array($key, MachineTypeCatalog::keys(), true)) {
            return $key;
        }

        return null;
    }

    private function loadMapping($mappingOption): array
    {
        if ($mappingOption === null) {
            return [];
        }

        $raw = trim((string) $mappingOption);
        if ($raw === '') {
            return [];
        }

        $json = null;

        if (File::exists($raw)) {
            $json = File::get($raw);
        } else {
            $json = $raw;
        }

        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            $this->warn('Invalid mapping JSON provided; ignoring. Expecting an object {"legacy":"canonical"}');
            return [];
        }

        $mapping = [];
        foreach ($decoded as $k => $v) {
            $kk = trim((string) $k);
            $vv = trim((string) $v);
            if ($kk === '' || $vv === '') {
                continue;
            }
            $mapping[$kk] = $vv;
        }

        return $mapping;
    }
}
