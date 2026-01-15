<?php

namespace App\Services;

use App\Exports\WorkerTrainingsMassFailedRowsExport;
use App\Imports\WorkerTrainingsMassImport;
use App\Models\Project;
use App\Models\User;
use App\Models\Worker;
use App\Models\WorkerTraining;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use ZipArchive;

class WorkerTrainingMassImportService
{
    private const ALLOWED_TRAINING_TYPES = [
        'bypassing_safety_controls',
        'formation_coactivite',
        'formation_coffrage_decoffrage',
        'formation_conduite_defensive',
        'formation_analyse_des_risques',
        'formation_elingage_manutention',
        'formation_ergonomie',
        'formation_excavations',
        'formation_outils_electroportatifs',
        'formation_epi',
        'formation_environnement',
        'formation_espaces_confines',
        'formation_flagman',
        'formation_jha',
        'formation_line_of_fire',
        'formation_manutention_manuelle',
        'formation_manutention_mecanique',
        'formation_point_chaud',
        'formation_produits_chimiques',
        'formation_risques_electriques',
        'induction_hse',
        'travail_en_hauteur',
    ];

    public function handle(User $user, UploadedFile $excelFile, UploadedFile $zipFile, ?string $progressId = null): array
    {
        $debugImport = (bool) env('WORKER_TRAINING_IMPORT_DEBUG', false);

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

        $zipParsedSample = [];

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

            if ($debugImport && count($zipParsedSample) < 20) {
                $zipParsedSample[] = [
                    'zip_entry' => $name,
                    'basename' => $zipBaseName,
                    'cin_raw' => $base,
                    'cin_normalized' => $cin,
                ];
            }

            if (isset($pdfByCin[$cin])) {
                $zipErrors[] = ['file' => $name, 'error' => 'Duplicate PDF for CIN'];
                continue;
            }

            $pdfByCin[$cin] = $name;
        }

        if ($debugImport) {
            Log::info('WorkerTrainingMassImport ZIP parsed', [
                'zip_original_name' => $zipFile->getClientOriginalName(),
                'zip_size' => $zipFile->getSize(),
                'zip_num_files' => $zip->numFiles,
                'pdf_by_cin_count' => count($pdfByCin),
                'zip_errors_count' => count($zipErrors),
                'zip_parsed_sample' => $zipParsedSample,
                'pdf_cins_sample' => array_slice(array_keys($pdfByCin), 0, 25),
            ]);
        }

        $import = new WorkerTrainingsMassImport();
        Excel::import($import, $excelFile);
        $rows = $import->getRows();

        if ($debugImport) {
            $row0 = $rows[0] ?? null;
            Log::info('WorkerTrainingMassImport Excel parsed', [
                'excel_original_name' => $excelFile->getClientOriginalName(),
                'excel_size' => $excelFile->getSize(),
                'rows_count' => is_array($rows) ? count($rows) : null,
                'row0_keys' => is_array($row0) ? array_keys($row0) : null,
                'rows_sample' => array_slice($rows, 0, 5),
            ]);
        }

        $excelCins = [];
        $excelCinSample = [];
        foreach ($rows as $rowForCin) {
            $rowForCin = array_change_key_case($rowForCin, CASE_LOWER);
            if ($this->isRowEmpty($rowForCin)) {
                continue;
            }
            $cinForCinSet = $this->normalizeCin($this->getColumnValue($rowForCin, ['cin', 'cni', 'numero_cin', 'id']));
            if ($cinForCinSet) {
                $excelCins[$cinForCinSet] = true;
                if ($debugImport && count($excelCinSample) < 25) {
                    $excelCinSample[] = $cinForCinSet;
                }
            }
        }

        if ($debugImport) {
            $zipOnlyCins = array_values(array_diff(array_keys($pdfByCin), array_keys($excelCins)));
            $excelOnlyCins = array_values(array_diff(array_keys($excelCins), array_keys($pdfByCin)));
            Log::info('WorkerTrainingMassImport CIN sets', [
                'excel_cins_count' => count($excelCins),
                'excel_cins_sample' => $excelCinSample,
                'zip_cins_count' => count($pdfByCin),
                'zip_only_cins_count' => count($zipOnlyCins),
                'zip_only_cins_sample' => array_slice($zipOnlyCins, 0, 25),
                'excel_only_cins_count' => count($excelOnlyCins),
                'excel_only_cins_sample' => array_slice($excelOnlyCins, 0, 25),
            ]);
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
            $trainingType = null;
            $trainingTypeRaw = null;
            $trainingDate = null;
            $expiryDate = null;

            try {
                $cin = $this->normalizeCin($this->getColumnValue($row, ['cin', 'cni', 'numero_cin', 'id']));
                $trainingType = $this->getColumnValue($row, ['type_formation', 'training_type', 'type']);
                $trainingDate = $this->parseDate($this->getColumnValue($row, ['date_formation', 'training_date', 'date']));
                $expiryDate = $this->parseDate($this->getColumnValue($row, ['date_expiration', 'expiry_date', 'expiration_date']));

                $trainingTypeRaw = $trainingType !== null ? trim((string) $trainingType) : null;
                $trainingType = $this->normalizeTrainingType($trainingTypeRaw);

                if (!$cin) {
                    $failedRows[] = $this->failRow(null, $trainingType, $trainingDate, $expiryDate, 'Missing CIN');
                    $rowFailed = true;
                    continue;
                }

                if (isset($seenCins[$cin])) {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Duplicate CIN in Excel');
                    $rowFailed = true;
                    continue;
                }
                $seenCins[$cin] = true;

                if (!$trainingType) {
                    $error = ($trainingTypeRaw === null || $trainingTypeRaw === '')
                        ? 'Missing training_type'
                        : 'Invalid training_type';
                    $failedRows[] = $this->failRow($cin, $trainingTypeRaw, $trainingDate, $expiryDate, $error);
                    $rowFailed = true;
                    continue;
                }

                if ($trainingType === 'other') {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Training type other is not supported in mass import');
                    $rowFailed = true;
                    continue;
                }

                if (!$trainingDate) {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Invalid or missing training_date');
                    $rowFailed = true;
                    continue;
                }

                if ($expiryDate && Carbon::parse($expiryDate)->lt(Carbon::parse($trainingDate))) {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'expiry_date must be after or equal to training_date');
                    $rowFailed = true;
                    continue;
                }

                if (!isset($pdfByCin[$cin])) {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Missing PDF in ZIP for CIN');
                    $rowFailed = true;
                    continue;
                }

                $usedPdfCins[$cin] = true;

                $worker = Worker::query()->where('cin', $cin)->first();
                if (!$worker) {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Worker not found');
                    $rowFailed = true;
                    continue;
                }

                if ($worker->project_id) {
                    $project = Project::find($worker->project_id);
                    if ($project && !$user->canAccessProject($project)) {
                        $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Access denied');
                        $rowFailed = true;
                        continue;
                    }
                } elseif (!$user->hasGlobalProjectScope()) {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Access denied');
                    $rowFailed = true;
                    continue;
                }

                $exists = WorkerTraining::query()
                    ->where('worker_id', $worker->id)
                    ->where('training_type', $trainingType)
                    ->whereDate('training_date', $trainingDate)
                    ->exists();
                if ($exists) {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Duplicate training');
                    $rowFailed = true;
                    continue;
                }

                $zipEntry = $pdfByCin[$cin];
                $pdfContent = $zip->getFromName($zipEntry);
                if ($pdfContent === false) {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Failed to read PDF from ZIP');
                    $rowFailed = true;
                    continue;
                }

                $safeCin = preg_replace('/[^A-Za-z0-9_-]/', '_', $cin);
                $uuid = (string) Str::uuid();
                $storedPath = "worker_certificates/mass_trainings/{$safeCin}_{$uuid}.pdf";
                Storage::disk('public')->put($storedPath, $pdfContent);

                WorkerTraining::create([
                    'worker_id' => $worker->id,
                    'training_type' => $trainingType,
                    'training_date' => $trainingDate,
                    'expiry_date' => $expiryDate,
                    'certificate_path' => $storedPath,
                    'created_by' => $user->id,
                ]);

                $importedCount++;
            } catch (\Throwable $e) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Unexpected error: ' . ($e->getMessage() ?: 'Import failed'));
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
            $failedRows[] = $this->failRow(null, null, null, null, 'ZIP: ' . ($file ? ($file . ' - ') : '') . $msg);
        }

        foreach ($unusedPdfs as $u) {
            $uCin = $u['cin'] ?? null;
            $file = $u['file'] ?? '-';
            if ($uCin && isset($excelCins[$uCin])) {
                $failedRows[] = $this->failRow($uCin, null, null, null, 'PDF in ZIP not used (matching Excel row exists but row failed/was skipped) (file: ' . $file . ')');
            } else {
                $failedRows[] = $this->failRow($uCin, null, null, null, 'PDF in ZIP has no matching Excel row (file: ' . $file . ')');
            }
        }

        if ($debugImport) {
            Log::info('WorkerTrainingMassImport ZIP usage result', [
                'used_pdf_cins_count' => count($usedPdfCins),
                'unused_pdfs_count' => count($unusedPdfs),
                'unused_pdfs_sample' => array_slice($unusedPdfs, 0, 25),
                'failed_rows_count' => count($failedRows),
            ]);
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
            $filename = 'worker_trainings_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
            $path = 'imports/failed_rows/' . $filename;
            $contents = Excel::raw(new WorkerTrainingsMassFailedRowsExport($failedRows), ExcelFormat::XLSX);
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
        if (in_array('type_formation', $possibleNames, true) || in_array('training_type', $possibleNames, true)) {
            if (isset($row['col_1']) && $row['col_1'] !== null && $row['col_1'] !== '') {
                return $row['col_1'];
            }
        }
        if (in_array('date_formation', $possibleNames, true) || in_array('training_date', $possibleNames, true)) {
            if (isset($row['col_2']) && $row['col_2'] !== null && $row['col_2'] !== '') {
                return $row['col_2'];
            }
        }
        if (in_array('date_expiration', $possibleNames, true) || in_array('expiry_date', $possibleNames, true) || in_array('expiration_date', $possibleNames, true)) {
            if (isset($row['col_3']) && $row['col_3'] !== null && $row['col_3'] !== '') {
                return $row['col_3'];
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

    private function failRow($cin, $trainingType, $a3 = null, $a4 = null, $a5 = null, $a6 = null): array
    {
        $args = func_get_args();
        $count = count($args);

        if ($count === 6) {
            $trainingDate = $a4;
            $expiryDate = $a5;
            $error = (string) $a6;
        } else {
            $trainingDate = $a3;
            $expiryDate = $a4;
            $error = (string) $a5;
        }

        return [
            'cin' => $cin,
            'training_type' => $trainingType,
            'training_date' => $trainingDate,
            'expiry_date' => $expiryDate,
            'error' => $error,
        ];
    }

    private function normalizeTrainingType(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $v = trim(str_replace("\u{00A0}", ' ', $value));
        if ($v === '') {
            return null;
        }

        $key = $this->normalizeTrainingTypeKey($v);

        if ($key === 'other') {
            return 'other';
        }

        return in_array($key, self::ALLOWED_TRAINING_TYPES, true) ? $key : null;
    }

    private function normalizeTrainingTypeKey(string $value): string
    {
        $s = trim(str_replace("\u{00A0}", ' ', $value));
        $s = preg_replace('/\s+/u', ' ', $s);

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
