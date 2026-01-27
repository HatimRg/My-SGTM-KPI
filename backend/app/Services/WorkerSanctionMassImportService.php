<?php

namespace App\Services;

use App\Exports\WorkerSanctionsMassFailedRowsExport;
use App\Imports\WorkerSanctionsMassImport;
use App\Models\Project;
use App\Models\User;
use App\Models\Worker;
use App\Models\WorkerSanction;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use ZipArchive;

class WorkerSanctionMassImportService
{
    private const ALLOWED_SANCTION_TYPES = ['mise_a_pied', 'avertissement', 'rappel_a_lordre', 'blame'];

    public function handle(User $user, UploadedFile $excelFile, UploadedFile $zipFile, ?string $progressId = null): array
    {
        if (!class_exists(ZipArchive::class) || !extension_loaded('zip')) {
            throw new \RuntimeException('ZipArchive extension is required for ZIP imports');
        }

        $zip = new ZipArchive();
        $opened = $zip->open($zipFile->getRealPath());
        if ($opened !== true) {
            throw new \RuntimeException('Invalid ZIP file');
        }

        $pdfByCin = [];
        $zipErrors = [];
        $failedRows = [];
        $importedCount = 0;
        $usedPdfCins = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $stat = $zip->statIndex($i);
            $name = $stat['name'] ?? null;
            if (!$name || str_ends_with($name, '/')) {
                continue;
            }

            // Ignore macOS metadata entries
            if (str_starts_with($name, '__MACOSX/')) {
                continue;
            }

            $zipBaseName = basename($name);
            if (str_starts_with($zipBaseName, '._')) {
                continue;
            }

            $ext = strtolower(pathinfo($zipBaseName, PATHINFO_EXTENSION));
            if ($ext !== 'pdf') {
                $zipErrors[] = ['file' => $name, 'error' => 'Non-PDF file in ZIP (ignored)'];
                continue;
            }

            $base = pathinfo($zipBaseName, PATHINFO_FILENAME);
            $cin = $this->normalizeCin($base);
            if (!$cin) {
                $zipErrors[] = ['file' => $name, 'error' => 'Invalid CIN filename'];
                continue;
            }

            if (isset($pdfByCin[$cin])) {
                $zipErrors[] = ['file' => $name, 'error' => 'Duplicate PDF for CIN'];
                continue;
            }

            $pdfByCin[$cin] = $name;
        }

        $import = new WorkerSanctionsMassImport();
        Excel::import($import, $excelFile);
        $rows = $import->getRows();

        $excelCins = [];
        foreach ($rows as $rowForCin) {
            $rowForCin = array_change_key_case($rowForCin, CASE_LOWER);
            if ($this->isRowEmpty($rowForCin)) {
                continue;
            }
            $cinForCinSet = $this->normalizeCin($this->getColumnValue($rowForCin, ['cin', 'cni', 'numero_cin', 'id']));
            if ($cinForCinSet) {
                $excelCins[$cinForCinSet] = true;
            }
        }

        $progress = null;
        $processed = 0;
        $failedCount = 0;
        if ($progressId) {
            $progress = new MassImportProgressService();
            if (!$progress->get($progressId)) {
                $progress->init($progressId);
            }

            $total = 0;
            foreach ($rows as $rowForCount) {
                $rowForCount = array_change_key_case($rowForCount, CASE_LOWER);
                if ($this->isRowEmpty($rowForCount)) {
                    continue;
                }
                $total++;
            }

            $progress->update($progressId, [
                'status' => 'running',
                'processed' => 0,
                'total' => $total,
                'failed' => 0,
                'imported' => 0,
                'updated' => 0,
            ]);
        }

        $seenCins = [];
        foreach ($rows as $row) {
            $row = array_change_key_case($row, CASE_LOWER);
            if ($this->isRowEmpty($row)) {
                continue;
            }

            $processed++;
            $rowFailed = false;

            $cin = null;
            $sanctionDate = null;
            $sanctionType = null;
            $sanctionTypeRaw = null;
            $miseAPiedDays = null;
            $reason = null;

            try {
                $cin = $this->normalizeCin($this->getColumnValue($row, ['cin', 'cni', 'numero_cin', 'id']));
                $sanctionDate = $this->parseDate($this->getColumnValue($row, ['date_sanction', 'sanction_date', 'date']));
                $sanctionType = $this->getColumnValue($row, ['type_sanction', 'sanction_type', 'type']);
                $miseAPiedDays = $this->getColumnValue($row, ['mise_a_pied_days', 'mise_a_pied_jours', 'jours_mise_a_pied', 'jours_mise_à_pied', 'days']);
                $reason = $this->getColumnValue($row, ['reason', 'motif']);

                $sanctionTypeRaw = $sanctionType !== null ? trim((string) $sanctionType) : null;
                $sanctionType = $this->normalizeSanctionType($sanctionTypeRaw);
                $reason = $reason !== null ? trim((string) $reason) : null;

                $miseAPiedDays = $miseAPiedDays !== null ? (int) $miseAPiedDays : null;

                if (!$cin) {
                    $failedRows[] = $this->failRow(null, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Missing CIN');
                    $rowFailed = true;
                    continue;
                }

                if (isset($seenCins[$cin])) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Duplicate CIN in Excel');
                    $rowFailed = true;
                    continue;
                }
                $seenCins[$cin] = true;

                if (!$sanctionDate) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Invalid or missing sanction_date');
                    $rowFailed = true;
                    continue;
                }

                if (!$sanctionType) {
                    $error = ($sanctionTypeRaw === null || $sanctionTypeRaw === '')
                        ? 'Missing sanction_type'
                        : 'Invalid sanction_type';
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionTypeRaw, $miseAPiedDays, $reason, $error);
                    $rowFailed = true;
                    continue;
                }

                if (!in_array($sanctionType, self::ALLOWED_SANCTION_TYPES, true)) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionTypeRaw, $miseAPiedDays, $reason, 'Invalid sanction_type');
                    $rowFailed = true;
                    continue;
                }

                if (!$reason) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Missing reason');
                    $rowFailed = true;
                    continue;
                }

                if ($sanctionType === 'mise_a_pied' && (!$miseAPiedDays || $miseAPiedDays < 1 || $miseAPiedDays > 365)) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Days are required for mise a pied');
                    $rowFailed = true;
                    continue;
                }

                if (!isset($pdfByCin[$cin])) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Missing PDF in ZIP for CIN');
                    $rowFailed = true;
                    continue;
                }

                $usedPdfCins[$cin] = true;

                $worker = Worker::query()->where('cin', $cin)->first();
                if (!$worker) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Worker not found');
                    $rowFailed = true;
                    continue;
                }

                if ($worker->project_id) {
                    $project = Project::find($worker->project_id);
                    if ($project && !$user->canAccessProject($project)) {
                        $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Access denied');
                        $rowFailed = true;
                        continue;
                    }
                } elseif (!$user->hasGlobalProjectScope()) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Access denied');
                    $rowFailed = true;
                    continue;
                }

                $exists = WorkerSanction::query()
                    ->where('worker_id', $worker->id)
                    ->where('sanction_type', $sanctionType)
                    ->whereDate('sanction_date', $sanctionDate)
                    ->where('reason', $reason)
                    ->exists();
                if ($exists) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Duplicate sanction');
                    $rowFailed = true;
                    continue;
                }

                $zipEntry = $pdfByCin[$cin];
                $pdfContent = $zip->getFromName($zipEntry);
                if ($pdfContent === false) {
                    $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Failed to read PDF from ZIP');
                    $rowFailed = true;
                    continue;
                }

                $safeCin = preg_replace('/[^A-Za-z0-9_-]/', '_', $cin);
                $uuid = (string) Str::uuid();
                $storedPath = "worker_sanctions/mass_sanctions/{$safeCin}_{$uuid}.pdf";
                Storage::disk('public')->put($storedPath, $pdfContent);

                $data = [
                    'worker_id' => $worker->id,
                    'project_id' => $worker->project_id ? (int) $worker->project_id : null,
                    'sanction_date' => $sanctionDate,
                    'reason' => $reason,
                    'sanction_type' => $sanctionType,
                    'mise_a_pied_days' => $sanctionType === 'mise_a_pied' ? $miseAPiedDays : null,
                    'document_path' => $storedPath,
                    'created_by' => $user->id,
                ];

                WorkerSanction::create($data);

                $importedCount++;
            } catch (\Throwable $e) {
                $failedRows[] = $this->failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, 'Unexpected error: ' . ($e->getMessage() ?: 'Import failed'));
                $rowFailed = true;
                continue;
            } finally {
                if ($rowFailed) {
                    $failedCount++;
                }

                if ($progress && $progressId) {
                    $progress->update($progressId, [
                        'processed' => $processed,
                        'failed' => $failedCount,
                        'imported' => $importedCount,
                    ]);
                }
            }
        }

        $zip->close();

        $unusedPdfs = [];
        foreach ($pdfByCin as $cin => $entryName) {
            if (!isset($usedPdfCins[$cin])) {
                $unusedPdfs[] = ['cin' => $cin, 'file' => $entryName];
            }
        }

        foreach ($zipErrors as $e) {
            $file = $e['file'] ?? null;
            $msg = $e['error'] ?? 'ZIP error';
            $failedRows[] = $this->failRow(null, null, null, null, null, 'ZIP: ' . ($file ? ($file . ' - ') : '') . $msg);
        }

        foreach ($unusedPdfs as $u) {
            $uCin = $u['cin'] ?? null;
            $file = $u['file'] ?? '-';
            if ($uCin && isset($excelCins[$uCin])) {
                $failedRows[] = $this->failRow($uCin, null, null, null, null, 'PDF in ZIP not used (matching Excel row exists but row failed/was skipped) (file: ' . $file . ')');
            } else {
                $failedRows[] = $this->failRow($uCin, null, null, null, null, 'PDF in ZIP has no matching Excel row (file: ' . $file . ')');
            }
        }

        if ($progress && $progressId) {
            $progress->update($progressId, [
                'processed' => $processed,
                'failed' => count($failedRows),
                'imported' => $importedCount,
            ]);
        }

        $failedRowsUrl = null;
        if (!empty($failedRows)) {
            $filename = 'worker_sanctions_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
            $path = 'imports/failed_rows/' . $filename;
            $contents = Excel::raw(new WorkerSanctionsMassFailedRowsExport($failedRows), ExcelFormat::XLSX);
            Storage::disk('public')->put($path, $contents);
            $failedRowsUrl = '/api/imports/failed-rows/' . $filename;
        }

        return [
            'imported' => $importedCount,
            'failed_count' => count($failedRows),
            'failed_rows_url' => $failedRowsUrl,
            'zip_errors' => $zipErrors,
            'unused_pdfs' => $unusedPdfs,
            'errors' => $failedRows,
        ];
    }

    private function normalizeCin($value): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            $value = trim(str_replace("\u{00A0}", ' ', $value));
            if ($value === '') {
                return null;
            }

            if (preg_match('/\.pdf$/i', $value)) {
                $value = preg_replace('/\.pdf$/i', '', $value);
                $value = trim($value);
                if ($value === '') {
                    return null;
                }
            }

            if (preg_match('/^[0-9]+\.0+$/', $value)) {
                $value = preg_replace('/\.0+$/', '', $value);
            }

            if (stripos($value, 'e') !== false && is_numeric($value)) {
                $value = sprintf('%.0f', (float) $value);
            }

            $value = preg_replace('/\s+/u', '', $value);
            $value = preg_replace('/[^A-Za-z0-9]/', '', $value);
            $value = trim($value);
            return $value === '' ? null : strtoupper($value);
        }

        if (is_int($value)) {
            return (string) $value;
        }

        if (is_float($value)) {
            return sprintf('%.0f', $value);
        }

        $v = trim(str_replace("\u{00A0}", ' ', (string) $value));
        $v = preg_replace('/\s+/u', '', $v);
        $v = preg_replace('/[^A-Za-z0-9]/', '', $v);
        $v = trim($v);
        return $v === '' ? null : strtoupper($v);
    }

    private function parseDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if ($value instanceof \DateTime) {
                return $value->format('Y-m-d');
            }

            if (is_numeric($value)) {
                return Carbon::instance(ExcelDate::excelToDateTimeObject($value))->format('Y-m-d');
            }

            $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'd.m.Y', 'm/d/Y'];
            foreach ($formats as $format) {
                try {
                    return Carbon::createFromFormat($format, trim((string) $value))->format('Y-m-d');
                } catch (\Exception $e) {
                }
            }

            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }

    private function isRowEmpty(array $row): bool
    {
        foreach ($row as $v) {
            if ($v === null) {
                continue;
            }

            if (is_numeric($v) && (float) $v === 0.0) {
                continue;
            }

            $s = trim(str_replace("\u{00A0}", ' ', (string) $v));
            if ($s !== '') {
                return false;
            }
        }
        return true;
    }

    private function getColumnValue(array $row, array $possibleNames)
    {
        foreach ($possibleNames as $name) {
            if (isset($row[$name]) && $row[$name] !== null && $row[$name] !== '') {
                return $row[$name];
            }
            $spaceName = str_replace('_', ' ', $name);
            if (isset($row[$spaceName]) && $row[$spaceName] !== null && $row[$spaceName] !== '') {
                return $row[$spaceName];
            }
        }

        if (in_array('cin', $possibleNames, true) || in_array('cni', $possibleNames, true) || in_array('numero_cin', $possibleNames, true)) {
            if (isset($row['col_0']) && $row['col_0'] !== null && $row['col_0'] !== '') {
                return $row['col_0'];
            }
        }
        if (in_array('date_sanction', $possibleNames, true) || in_array('sanction_date', $possibleNames, true) || in_array('date', $possibleNames, true)) {
            if (isset($row['col_1']) && $row['col_1'] !== null && $row['col_1'] !== '') {
                return $row['col_1'];
            }
        }
        if (in_array('type_sanction', $possibleNames, true) || in_array('sanction_type', $possibleNames, true) || in_array('type', $possibleNames, true)) {
            if (isset($row['col_2']) && $row['col_2'] !== null && $row['col_2'] !== '') {
                return $row['col_2'];
            }
        }
        if (
            in_array('mise_a_pied_days', $possibleNames, true) ||
            in_array('mise_a_pied_jours', $possibleNames, true) ||
            in_array('jours_mise_a_pied', $possibleNames, true) ||
            in_array('jours_mise_à_pied', $possibleNames, true) ||
            in_array('mise_a_pied', $possibleNames, true) ||
            in_array('days', $possibleNames, true)
        ) {
            if (isset($row['col_3']) && $row['col_3'] !== null && $row['col_3'] !== '') {
                return $row['col_3'];
            }
        }
        if (in_array('reason', $possibleNames, true) || in_array('motif', $possibleNames, true)) {
            if (isset($row['col_4']) && $row['col_4'] !== null && $row['col_4'] !== '') {
                return $row['col_4'];
            }
        }

        foreach ($possibleNames as $name) {
            $needle = strtolower(trim((string) $name));
            $needle = str_replace(' ', '_', $needle);
            $needle = preg_replace('/[^a-z0-9_]/', '', $needle);
            if ($needle === '' || $needle === 'id') {
                continue;
            }

            foreach ($row as $k => $v) {
                if (!is_string($k) || $v === null || $v === '') {
                    continue;
                }

                $key = strtolower($k);
                if (
                    $key === $needle ||
                    str_starts_with($key, $needle . '_') ||
                    str_ends_with($key, '_' . $needle) ||
                    str_contains($key, '_' . $needle . '_')
                ) {
                    return $v;
                }
            }
        }

        return null;
    }

    private function failRow($cin, $sanctionDate, $sanctionType, $miseAPiedDays, $reason, $error): array
    {
        return [
            'cin' => $cin,
            'sanction_date' => $sanctionDate,
            'sanction_type' => $sanctionType,
            'mise_a_pied_days' => $miseAPiedDays,
            'reason' => $reason,
            'error' => (string) $error,
        ];
    }

    private function normalizeSanctionType(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $v = trim(str_replace("\u{00A0}", ' ', $value));
        if ($v === '') {
            return null;
        }

        $key = $this->normalizeSanctionTypeKey($v);
        return in_array($key, self::ALLOWED_SANCTION_TYPES, true) ? $key : null;
    }

    private function normalizeSanctionTypeKey(string $value): string
    {
        $s = trim(str_replace("\u{00A0}", ' ', $value));
        $s = preg_replace('/\s+/u', ' ', $s);

        // Accept labelized values coming from Excel dropdowns (e.g. "Mise à pied")
        // by mapping spaces/dashes/apostrophes back to underscore keys.
        $s = str_replace(['’', "'", '-', ' '], '_', $s);
        $s = preg_replace('/_+/', '_', $s);

        if (function_exists('iconv')) {
            $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
            if (is_string($ascii) && $ascii !== '') {
                $s = $ascii;
            }
        }

        $s = strtolower($s);
        $s = preg_replace('/[^a-z0-9]+/', '_', $s);
        $s = preg_replace('/_+/', '_', $s);
        $s = trim($s, '_');

        return $s;
    }
}
