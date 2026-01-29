<?php

namespace App\Services;

use App\Exports\WorkerMedicalAptitudesMassFailedRowsExport;
use App\Imports\WorkerMedicalAptitudesMassImport;
use App\Models\Project;
use App\Models\User;
use App\Models\Worker;
use App\Models\WorkerMedicalAptitude;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use ZipArchive;

class WorkerMedicalAptitudeMassImportService
{
    private array $allowedAptitudeStatuses = ['apte', 'inapte'];
    private const ALLOWED_EXAM_NATURES = [
        'embauche_reintegration',
        'visite_systematique',
        'surveillance_medical_special',
        'visite_de_reprise',
        'visite_spontanee',
    ];

    public function handle(User $user, UploadedFile $excelFile, ?UploadedFile $zipFile, ?string $progressId = null): array
    {
        $zip = null;
        if ($zipFile !== null) {
            if (!class_exists(ZipArchive::class) || !extension_loaded('zip')) {
                throw new \RuntimeException('ZipArchive extension is required for ZIP imports');
            }

            $zip = new ZipArchive();
            $opened = $zip->open($zipFile->getRealPath());
            if ($opened !== true) {
                throw new \RuntimeException('Invalid ZIP file');
            }
        }

        $pdfByCin = [];
        $zipErrors = [];
        $failedRows = [];
        $importedCount = 0;
        $usedPdfCins = [];

        if ($zip !== null) {
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
        }

        $import = new WorkerMedicalAptitudesMassImport();
        Excel::import($import, $excelFile);
        $rows = $import->getRows();

        $firstRow = null;
        foreach ($rows as $r0) {
            $r0 = array_change_key_case((array) $r0, CASE_LOWER);
            if ($this->isRowEmpty($r0)) {
                continue;
            }
            $firstRow = $r0;
            break;
        }

        if ($firstRow === null) {
            $failedRows[] = $this->failRow(null, null, null, null, null, null, 'No data rows found in Excel');
        } else {
            $keys = array_keys($firstRow);
            $keys = array_map(fn ($k) => is_string($k) ? strtolower(trim($k)) : (string) $k, $keys);

            $hasCin = count(array_intersect($keys, ['cin', 'cni', 'numero_cin', 'id', 'col_0'])) > 0;
            $hasStatus = count(array_intersect($keys, ['aptitude_status', 'statut_aptitude', 'status', 'col_1'])) > 0;
            $hasExamDate = count(array_intersect($keys, ['exam_date', 'date_examen', 'date', 'col_4'])) > 0;

            if (!$hasCin || !$hasStatus || !$hasExamDate) {
                $failedRows[] = $this->failRow(null, null, null, null, null, null, 'Invalid template headers: please use the provided template (Medical Aptitudes)');
            }
        }

        if (!empty($failedRows)) {
            if ($zip) {
                $zip->close();
            }

            $failedRowsUrl = null;
            $filename = 'worker_medical_aptitudes_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
            $path = 'imports/failed_rows/' . $filename;
            $lang = (string) ($user->preferred_language ?? 'fr');
            $contents = Excel::raw(new WorkerMedicalAptitudesMassFailedRowsExport($failedRows, $lang), ExcelFormat::XLSX);
            Storage::disk('public')->put($path, $contents);
            $failedRowsUrl = '/api/imports/failed-rows/' . $filename;

            return [
                'imported' => 0,
                'failed_count' => count($failedRows),
                'failed_rows_url' => $failedRowsUrl,
                'zip_errors' => $zipErrors,
                'unused_pdfs' => [],
                'errors' => $failedRows,
            ];
        }

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
            $aptitudeStatus = null;
            $aptitudeStatusRaw = null;
            $examNature = null;
            $examNatureRaw = null;
            $ableToRaw = null;
            $examDate = null;
            $expiryDate = null;

            try {
                $cin = $this->normalizeCin($this->getColumnValue($row, ['cin', 'cni', 'numero_cin', 'id']));
                $aptitudeStatus = $this->getColumnValue($row, ['aptitude_status', 'statut_aptitude', 'status']);
                $examNature = $this->getColumnValue($row, ['exam_nature', 'nature_examen', 'nature']);
                $ableToRaw = $this->getColumnValue($row, ['able_to', 'apte_a', 'apte_à', 'ableto']);
                $examDate = $this->parseDate($this->getColumnValue($row, ['exam_date', 'date_examen', 'date']));
                $expiryDate = $this->parseDate($this->getColumnValue($row, ['date_expiration', 'expiry_date', 'expiration_date']));

                $aptitudeStatusRaw = $aptitudeStatus !== null ? trim((string) $aptitudeStatus) : null;
                $examNatureRaw = $examNature !== null ? trim((string) $examNature) : null;
                $aptitudeStatus = $this->normalizeMedicalAptitudeStatus($aptitudeStatusRaw);
                $examNature = $this->normalizeExamNature($examNatureRaw);
                $ableToRaw = $ableToRaw !== null ? trim((string) $ableToRaw) : null;

                if (!$cin) {
                    $failedRows[] = $this->failRow(null, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Missing CIN');
                    $rowFailed = true;
                    continue;
                }

                if (isset($seenCins[$cin])) {
                    $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Duplicate CIN in Excel');
                    $rowFailed = true;
                    continue;
                }
                $seenCins[$cin] = true;

                if (!$aptitudeStatus) {
                    $error = ($aptitudeStatusRaw === null || $aptitudeStatusRaw === '')
                        ? 'Missing aptitude_status'
                        : 'Invalid aptitude_status';
                    $failedRows[] = $this->failRow($cin, $aptitudeStatusRaw, $examNatureRaw, $ableToRaw, $examDate, $expiryDate, $error);
                    $rowFailed = true;
                    continue;
                }

                if (!in_array($aptitudeStatus, $this->allowedAptitudeStatuses, true)) {
                    $failedRows[] = $this->failRow($cin, $aptitudeStatusRaw, $examNatureRaw, $ableToRaw, $examDate, $expiryDate, 'Invalid aptitude_status');
                    $rowFailed = true;
                    continue;
                }

                if (!$examNature) {
                    $error = ($examNatureRaw === null || $examNatureRaw === '')
                        ? 'Missing exam_nature'
                        : 'Invalid exam_nature';
                    $failedRows[] = $this->failRow($cin, $aptitudeStatusRaw, $examNatureRaw, $ableToRaw, $examDate, $expiryDate, $error);
                    $rowFailed = true;
                    continue;
                }

                if (!in_array($examNature, self::ALLOWED_EXAM_NATURES, true)) {
                    $failedRows[] = $this->failRow($cin, $aptitudeStatusRaw, $examNatureRaw, $ableToRaw, $examDate, $expiryDate, 'Invalid exam_nature');
                    $rowFailed = true;
                    continue;
                }

                if (!$examDate) {
                    $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Invalid or missing exam_date');
                    $rowFailed = true;
                    continue;
                }

                if (Carbon::parse($examDate)->gt(now()->startOfDay())) {
                    $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Future date not allowed: exam_date');
                    $rowFailed = true;
                    continue;
                }

                if ($expiryDate && Carbon::parse($expiryDate)->lt(Carbon::parse($examDate))) {
                    $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'expiry_date must be after or equal to exam_date');
                    $rowFailed = true;
                    continue;
                }

                $hasPdf = isset($pdfByCin[$cin]);

                $worker = Worker::query()->where('cin', $cin)->first();
                if (!$worker) {
                    $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Worker not found');
                    $rowFailed = true;
                    continue;
                }

                if ($worker->project_id) {
                    $project = Project::find($worker->project_id);
                    if ($project && !$user->canAccessProject($project)) {
                        $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Access denied');
                        $rowFailed = true;
                        continue;
                    }
                } elseif (!$user->hasGlobalProjectScope()) {
                    $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Access denied');
                    $rowFailed = true;
                    continue;
                }

                $ableTo = $this->parseAbleTo($ableToRaw);

                $exists = WorkerMedicalAptitude::query()
                    ->where('worker_id', $worker->id)
                    ->where('exam_nature', $examNature)
                    ->whereDate('exam_date', $examDate)
                    ->exists();
                if ($exists) {
                    $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Duplicate medical aptitude');
                    $rowFailed = true;
                    continue;
                }

                $storedPath = null;
                if ($hasPdf) {
                    $usedPdfCins[$cin] = true;

                    $zipEntry = $pdfByCin[$cin];
                    $pdfContent = $zip ? $zip->getFromName($zipEntry) : false;
                    if ($pdfContent === false) {
                        $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Failed to read PDF from ZIP');
                        $rowFailed = true;
                        continue;
                    }

                    $safeCin = preg_replace('/[^A-Za-z0-9_-]/', '_', $cin);
                    $uuid = (string) Str::uuid();
                    $storedPath = "worker_certificates/mass_medical_aptitudes/{$safeCin}_{$uuid}.pdf";
                    Storage::disk('public')->put($storedPath, $pdfContent);
                }

                WorkerMedicalAptitude::create([
                    'worker_id' => $worker->id,
                    'aptitude_status' => $aptitudeStatus,
                    'exam_nature' => $examNature,
                    'able_to' => $ableTo,
                    'exam_date' => $examDate,
                    'expiry_date' => $expiryDate,
                    'certificate_path' => $storedPath,
                    'created_by' => $user->id,
                ]);

                $importedCount++;
            } catch (\Throwable $e) {
                $failedRows[] = $this->failRow($cin, $aptitudeStatus, $examNature, $ableToRaw, $examDate, $expiryDate, 'Unexpected error: ' . ($e->getMessage() ?: 'Import failed'));
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

        if ($zip) {
            $zip->close();
        }

        $unusedPdfs = [];
        if ($zip) {
            foreach ($pdfByCin as $cin => $entryName) {
                if (!isset($usedPdfCins[$cin])) {
                    $unusedPdfs[] = ['cin' => $cin, 'file' => $entryName];
                }
            }
        }

        foreach ($zipErrors as $e) {
            $file = $e['file'] ?? null;
            $msg = $e['error'] ?? 'ZIP error';
            $failedRows[] = $this->failRow(null, null, null, null, null, null, 'ZIP: ' . ($file ? ($file . ' - ') : '') . $msg);
        }

        foreach ($unusedPdfs as $u) {
            $uCin = $u['cin'] ?? null;
            $file = $u['file'] ?? '-';
            if ($uCin && isset($excelCins[$uCin])) {
                $failedRows[] = $this->failRow($uCin, null, null, null, null, null, 'PDF in ZIP not used (matching Excel row exists but row failed/was skipped) (file: ' . $file . ')');
            } else {
                $failedRows[] = $this->failRow($uCin, null, null, null, null, null, 'PDF in ZIP has no matching Excel row (file: ' . $file . ')');
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
            $filename = 'worker_medical_aptitudes_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
            $path = 'imports/failed_rows/' . $filename;
            $lang = (string) ($user->preferred_language ?? 'fr');
            $contents = Excel::raw(new WorkerMedicalAptitudesMassFailedRowsExport($failedRows, $lang), ExcelFormat::XLSX);
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

    private function parseAbleTo(?string $raw): array
    {
        if ($raw === null || trim($raw) === '') {
            return [];
        }

        $parts = array_map('trim', explode(',', $raw));
        $parts = array_values(array_filter($parts, fn ($v) => $v !== ''));
        $parts = array_values(array_unique($parts));
        return $parts;
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
        if (in_array('aptitude_status', $possibleNames, true) || in_array('statut_aptitude', $possibleNames, true) || in_array('status', $possibleNames, true)) {
            if (isset($row['col_1']) && $row['col_1'] !== null && $row['col_1'] !== '') {
                return $row['col_1'];
            }
        }
        if (in_array('exam_nature', $possibleNames, true) || in_array('nature', $possibleNames, true)) {
            if (isset($row['col_2']) && $row['col_2'] !== null && $row['col_2'] !== '') {
                return $row['col_2'];
            }
        }
        if (in_array('able_to', $possibleNames, true)) {
            if (isset($row['col_3']) && $row['col_3'] !== null && $row['col_3'] !== '') {
                return $row['col_3'];
            }
        }
        if (in_array('exam_date', $possibleNames, true) || in_array('date', $possibleNames, true)) {
            if (isset($row['col_4']) && $row['col_4'] !== null && $row['col_4'] !== '') {
                return $row['col_4'];
            }
        }
        if (in_array('date_expiration', $possibleNames, true) || in_array('expiry_date', $possibleNames, true) || in_array('expiration_date', $possibleNames, true)) {
            if (isset($row['col_5']) && $row['col_5'] !== null && $row['col_5'] !== '') {
                return $row['col_5'];
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

    private function failRow($cin, $aptitudeStatus, $examNature, $ableTo, $examDate, $expiryDate, $error): array
    {
        return [
            'cin' => $cin,
            'aptitude_status' => $aptitudeStatus,
            'exam_nature' => $examNature,
            'able_to' => $ableTo,
            'exam_date' => $examDate,
            'expiry_date' => $expiryDate,
            'error' => (string) $error,
        ];
    }

    private function normalizeMedicalAptitudeStatus(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $v = trim(str_replace("\u{00A0}", ' ', $value));
        if ($v === '') {
            return null;
        }

        $key = $this->normalizeKey($v);
        return in_array($key, $this->allowedAptitudeStatuses, true) ? $key : null;
    }

    private function normalizeExamNature(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $v = trim(str_replace("\u{00A0}", ' ', $value));
        if ($v === '') {
            return null;
        }

        $key = $this->normalizeKey($v);
        return in_array($key, self::ALLOWED_EXAM_NATURES, true) ? $key : null;
    }

    private function normalizeKey(string $value): string
    {
        $s = trim(str_replace("\u{00A0}", ' ', $value));
        $s = preg_replace('/\s+/u', ' ', $s);

        // Accept labelized values coming from Excel dropdowns (e.g. "Visite Systematique")
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
