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
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use ZipArchive;

class WorkerTrainingMassImportService
{
    public function handle(User $user, UploadedFile $excelFile, UploadedFile $zipFile): array
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

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $stat = $zip->statIndex($i);
            $name = $stat['name'] ?? null;
            if (!$name || str_ends_with($name, '/')) {
                continue;
            }

            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if ($ext !== 'pdf') {
                continue;
            }

            $base = pathinfo($name, PATHINFO_FILENAME);
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

        $import = new WorkerTrainingsMassImport();
        Excel::import($import, $excelFile);
        $rows = $import->getRows();

        $seenCins = [];
        foreach ($rows as $row) {
            $row = array_change_key_case($row, CASE_LOWER);
            if ($this->isRowEmpty($row)) {
                continue;
            }

            $cin = $this->normalizeCin($this->getColumnValue($row, ['cin', 'cni', 'numero_cin', 'id']));
            $trainingType = $this->getColumnValue($row, ['type_formation', 'training_type', 'type']);
            $trainingDate = $this->parseDate($this->getColumnValue($row, ['date_formation', 'training_date', 'date']));
            $expiryDate = $this->parseDate($this->getColumnValue($row, ['date_expiration', 'expiry_date', 'expiration_date']));

            $trainingType = $trainingType !== null ? trim((string) $trainingType) : null;

            if (!$cin) {
                $failedRows[] = $this->failRow(null, $trainingType, $trainingDate, $expiryDate, 'Missing CIN');
                continue;
            }

            if (isset($seenCins[$cin])) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Duplicate CIN in Excel');
                continue;
            }
            $seenCins[$cin] = true;

            if (!$trainingType) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Missing training_type');
                continue;
            }

            if ($trainingType === 'other') {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Training type other is not supported in mass import');
                continue;
            }

            if (!$trainingDate) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Invalid or missing training_date');
                continue;
            }

            if ($expiryDate && Carbon::parse($expiryDate)->lt(Carbon::parse($trainingDate))) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'expiry_date must be after or equal to training_date');
                continue;
            }

            if (!isset($pdfByCin[$cin])) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Missing PDF in ZIP for CIN');
                continue;
            }

            $worker = Worker::query()->where('cin', $cin)->first();
            if (!$worker) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Worker not found');
                continue;
            }

            if ($worker->project_id) {
                $project = Project::find($worker->project_id);
                if ($project && !$user->canAccessProject($project)) {
                    $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Access denied');
                    continue;
                }
            } elseif (!$user->hasGlobalProjectScope()) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Access denied');
                continue;
            }

            $exists = WorkerTraining::query()
                ->where('worker_id', $worker->id)
                ->where('training_type', $trainingType)
                ->whereDate('training_date', $trainingDate)
                ->exists();
            if ($exists) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Duplicate training');
                continue;
            }

            $zipEntry = $pdfByCin[$cin];
            $pdfContent = $zip->getFromName($zipEntry);
            if ($pdfContent === false) {
                $failedRows[] = $this->failRow($cin, $trainingType, $trainingDate, $expiryDate, 'Failed to read PDF from ZIP');
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
        }

        $zip->close();

        $failedRowsUrl = null;
        if (!empty($failedRows)) {
            $filename = 'worker_trainings_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
            $path = 'imports/failed_rows/' . $filename;
            $contents = Excel::raw(new WorkerTrainingsMassFailedRowsExport($failedRows), ExcelFormat::XLSX);
            Storage::disk('public')->put($path, $contents);
            $failedRowsUrl = Storage::disk('public')->url($path);
        }

        return [
            'imported' => $importedCount,
            'failed_count' => count($failedRows),
            'failed_rows_url' => $failedRowsUrl,
            'zip_errors' => $zipErrors,
            'errors' => $failedRows,
        ];
    }

    private function normalizeCin($value): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            $value = trim($value);
            if ($value === '') {
                return null;
            }

            if (preg_match('/^[0-9]+\.0+$/', $value)) {
                $value = preg_replace('/\.0+$/', '', $value);
            }

            if (stripos($value, 'e') !== false && is_numeric($value)) {
                $value = sprintf('%.0f', (float) $value);
            }

            return trim($value);
        }

        if (is_int($value)) {
            return (string) $value;
        }

        if (is_float($value)) {
            return sprintf('%.0f', $value);
        }

        $v = trim((string) $value);
        return $v === '' ? null : $v;
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
            if ($v !== null && trim((string) $v) !== '') {
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
}
