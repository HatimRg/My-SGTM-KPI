<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\DeviationsExport;
use App\Exports\SorReportsFailedRowsExport;
use App\Exports\SorReportsTemplateExport;
use App\Imports\SorReportsImport;
use App\Models\SorReport;
use App\Models\Project;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;

class SorReportController extends Controller
{
    private function detectSorHeadingRow(UploadedFile $file, int $default = 3): int
    {
        try {
            $path = $file->getRealPath();
            if (!$path || !is_file($path)) {
                return $default;
            }

            $reader = IOFactory::createReaderForFile($path);
            $reader->setReadDataOnly(true);
            $spreadsheet = $reader->load($path);
            $sheet = $spreadsheet->getSheet(0);

            $maxRow = min(12, (int) $sheet->getHighestRow());
            $maxCol = min(25, (int) \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($sheet->getHighestColumn()));

            $bestRow = $default;
            $bestScore = -1;

            for ($r = 1; $r <= $maxRow; $r++) {
                $cells = [];
                for ($c = 1; $c <= $maxCol; $c++) {
                    $v = $sheet->getCellByColumnAndRow($c, $r)->getValue();
                    $s = strtolower(trim((string) ($v ?? '')));
                    if ($s !== '') {
                        $cells[] = $s;
                    }
                }

                if (empty($cells)) {
                    continue;
                }

                $line = implode(' | ', $cells);
                $score = 0;

                // French/English heuristics
                if (preg_match('/code\s*projet|project\s*code/', $line)) $score += 4;
                if (preg_match('/date.*observ|observation\s*date/', $line)) $score += 4;
                if (preg_match('/non.*conform|non\s*-?conform|nonconform/', $line)) $score += 4;
                if (preg_match('/categorie|category/', $line)) $score += 3;
                if (preg_match('/entreprise|societe|company/', $line)) $score += 1;
                if (preg_match('/zone/', $line)) $score += 1;
                if (preg_match('/superviseur|supervisor/', $line)) $score += 1;
                if (preg_match('/responsable|responsible/', $line)) $score += 1;
                if (preg_match('/echeance|deadline/', $line)) $score += 1;
                if (preg_match('/action.*correct|corrective/', $line)) $score += 1;
                if (preg_match('/statut|status/', $line)) $score += 1;

                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestRow = $r;
                }
            }

            // Only accept if we are confident; otherwise keep default.
            if ($bestScore >= 8) {
                return $bestRow;
            }
        } catch (\Throwable $e) {
            // ignore
        }

        return $default;
    }

    private function storeOptimizedSorPhoto(UploadedFile $image, int $reportId, string $kind): string
    {
        $dir = 'sor-photos';
        $filename = "SOR_{$reportId}_{$kind}.jpg";
        $path = "{$dir}/{$filename}";

        if (!function_exists('imagecreatetruecolor')) {
            $ext = strtolower($image->getClientOriginalExtension() ?: 'jpg');
            $filenameRaw = "SOR_{$reportId}_{$kind}.{$ext}";
            return $image->storeAs($dir, $filenameRaw, 'public');
        }

        $ext = strtolower($image->getClientOriginalExtension() ?: 'jpg');
        $src = null;
        try {
            if (in_array($ext, ['jpg', 'jpeg'], true) && function_exists('imagecreatefromjpeg')) {
                $src = @imagecreatefromjpeg($image->getRealPath());
            } elseif ($ext === 'png' && function_exists('imagecreatefrompng')) {
                $src = @imagecreatefrompng($image->getRealPath());
            } elseif ($ext === 'webp' && function_exists('imagecreatefromwebp')) {
                $src = @imagecreatefromwebp($image->getRealPath());
            }

            if (!$src) {
                $extFallback = strtolower($image->getClientOriginalExtension() ?: 'jpg');
                $filenameRaw = "SOR_{$reportId}_{$kind}.{$extFallback}";
                return $image->storeAs($dir, $filenameRaw, 'public');
            }

            $w = imagesx($src);
            $h = imagesy($src);
            $maxW = 1280;
            $maxH = 1280;
            $scale = min($maxW / max(1, $w), $maxH / max(1, $h), 1);
            $newW = (int) max(1, round($w * $scale));
            $newH = (int) max(1, round($h * $scale));

            if ($newW !== $w || $newH !== $h) {
                $dst = imagecreatetruecolor($newW, $newH);
                imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $w, $h);
                imagedestroy($src);
                $src = $dst;
            }

            ob_start();
            imagejpeg($src, null, 80);
            $jpeg = ob_get_clean();
            imagedestroy($src);

            Storage::disk('public')->put($path, $jpeg);
            return $path;
        } catch (\Throwable $e) {
            if (is_resource($src) || (class_exists('GdImage') && $src instanceof \GdImage)) {
                @imagedestroy($src);
            }
            $extFallback = strtolower($image->getClientOriginalExtension() ?: 'jpg');
            $filenameRaw = "SOR_{$reportId}_{$kind}.{$extFallback}";
            return $image->storeAs($dir, $filenameRaw, 'public');
        }
    }

    private function streamPublicFileWithCache(Request $request, string $path): \Illuminate\Http\Response
    {
        if (!Storage::disk('public')->exists($path)) {
            abort(404, 'File not found');
        }

        $disk = Storage::disk('public');
        $filename = basename($path);
        $mime = $disk->mimeType($path) ?: 'application/octet-stream';
        $etag = '"' . sha1($path . '|' . $disk->lastModified($path) . '|' . $disk->size($path)) . '"';

        if ((string) $request->header('If-None-Match') === $etag) {
            return response('', 304, [
                'ETag' => $etag,
                'Cache-Control' => 'private, max-age=31536000, immutable',
            ]);
        }

        return response()->stream(function () use ($path) {
            $stream = Storage::disk('public')->readStream($path);
            if ($stream === false) {
                return;
            }
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'ETag' => $etag,
        ]);
    }

    /**
     * Get all SOR reports with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = SorReport::with(['project', 'submitter', 'closer']);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        // Apply filters
        if ($request->has('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('from_date')) {
            $query->where('observation_date', '>=', $request->from_date);
        }

        if ($request->has('to_date')) {
            $query->where('observation_date', '<=', $request->to_date);
        }

        if ($request->has('is_pinned') && $request->is_pinned) {
            $query->where('is_pinned', true);
        }

        // Order by pinned first, then by date
        $reports = $query->orderBy('is_pinned', 'desc')
                         ->orderBy('observation_date', 'desc')
                         ->paginate($request->get('per_page', 15));

        return response()->json($reports);
    }

    public function export(Request $request)
    {
        $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'status' => 'nullable|string',
            'category' => 'nullable|string',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
        ]);

        $user = $request->user();
        $query = SorReport::with(['project', 'submitter', 'closer']);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('from_date')) {
            $query->whereDate('observation_date', '>=', $request->from_date);
        }

        if ($request->filled('to_date')) {
            $query->whereDate('observation_date', '<=', $request->to_date);
        }

        $filters = [
            'visible_project_ids' => $projectIds,
            'project_id' => $request->get('project_id'),
            'status' => $request->get('status'),
            'category' => $request->get('category'),
            'from_date' => $request->get('from_date'),
            'to_date' => $request->get('to_date'),
        ];

        $filename = 'deviations_' . date('Y-m-d_His') . '.xlsx';

        return Excel::download(new DeviationsExport($filters), $filename);
    }

    public function template(Request $request)
    {
        try {
            $user = $request->user();

            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));

            if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
                return $this->error('XLSX export requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
            }

            $visibleProjectIds = $user ? $user->visibleProjectIds() : null;
            $projectCodes = [];
            if ($visibleProjectIds !== null) {
                if (count($visibleProjectIds) === 0) {
                    $projectCodes = [];
                } else {
                    $projectCodes = Project::whereIn('id', $visibleProjectIds)->orderBy('code')->pluck('code')->toArray();
                }
            } else {
                $projectCodes = Project::query()->orderBy('code')->pluck('code')->toArray();
            }

            $filename = 'SGTM-SOR-Template.xlsx';
            return Excel::download(new SorReportsTemplateExport(200, $projectCodes, $lang), $filename);
        } catch (\Throwable $e) {
            Log::error('SOR template generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to generate SOR template: ' . $e->getMessage(), 422);
        }
    }

    public function import(Request $request)
    {
        @ini_set('max_execution_time', '300');
        @ini_set('memory_limit', '512M');

        if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
            return $this->error('XLSX import requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
        }

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $user = $request->user();
        $visibleProjectIds = $user ? $user->visibleProjectIds() : null;
        $upload = $request->file('file');
        $headingRow = $this->detectSorHeadingRow($upload, 3);
        $import = new SorReportsImport($user ? (int) $user->id : 0, $visibleProjectIds, $headingRow);

        try {
            DB::beginTransaction();
            Excel::import($import, $upload);
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('SOR bulk import failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to import SOR reports: ' . $e->getMessage(), 422);
        }

        $errors = $import->getErrors();
        $failedRowsUrl = null;
        if (!empty($errors)) {
            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));
            $filename = 'sor_reports_failed_rows_' . now()->format('Ymd_His') . '.xlsx';
            $path = 'imports/failed_rows/' . $filename;
            $contents = Excel::raw(new SorReportsFailedRowsExport($errors, $lang), ExcelFormat::XLSX);
            Storage::disk('public')->put($path, $contents);
            $failedRowsUrl = '/api/imports/failed-rows/' . $filename;
        }

        return $this->success([
            'imported' => $import->getImportedCount(),
            'updated' => $import->getUpdatedCount(),
            'failed_count' => count($errors),
            'failed_rows_url' => $failedRowsUrl,
            'errors' => $errors,
        ], 'SOR reports imported');
    }

    public function viewPhoto(Request $request, SorReport $sorReport)
    {
        $user = $request->user();

        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        if (!$sorReport->photo_path || !Storage::disk('public')->exists($sorReport->photo_path)) {
            abort(404, 'File not found');
        }

        return $this->streamPublicFileWithCache($request, $sorReport->photo_path);
    }

    public function viewCorrectivePhoto(Request $request, SorReport $sorReport)
    {
        $user = $request->user();

        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        if (!$sorReport->corrective_action_photo_path || !Storage::disk('public')->exists($sorReport->corrective_action_photo_path)) {
            abort(404, 'File not found');
        }

        return $this->streamPublicFileWithCache($request, $sorReport->corrective_action_photo_path);
    }

    /**
     * Get pinned SOR reports (pending corrective action)
     */
    public function pinned(Request $request)
    {
        $user = $request->user();
        $query = SorReport::with(['project', 'submitter', 'closer'])
                          ->where('is_pinned', true);

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        $reports = $query->orderBy('pinned_at', 'desc')->get();

        return response()->json(['data' => $reports]);
    }

    /**
     * Store a new SOR report (Problem part)
     * If submit_corrective_action is true, also saves corrective action and marks as closed
     * If submit_later is true, pins the SOR for all users
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            // Problem fields
            'project_id' => 'required|exists:projects,id',
            'company' => 'nullable|string|max:255',
            'observation_date' => 'required|date',
            'observation_time' => 'nullable|string|max:10',
            'zone' => 'nullable|string|max:255',
            'supervisor' => 'nullable|string|max:255',
            'non_conformity' => 'required|string',
            'photo' => 'nullable|image|max:5120',
            'category' => 'required|string',
            'responsible_person' => 'nullable|string|max:255',
            
            // Corrective action fields (optional)
            'deadline' => 'nullable|date',
            'corrective_action' => 'nullable|string',
            'corrective_action_date' => 'nullable|date',
            'corrective_action_time' => 'nullable|string|max:10',
            'corrective_action_photo' => 'nullable|image|max:5120',
            
            // Workflow flags
            'submit_corrective_action' => 'nullable|boolean',
            'submit_later' => 'nullable|boolean',
            
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();
        $project = Project::findOrFail($validated['project_id']);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        $validated['submitted_by'] = $request->user()->id;
        $submitCorrectiveAction = $request->boolean('submit_corrective_action');
        $submitLater = $request->boolean('submit_later');
        
        unset($validated['photo'], $validated['corrective_action_photo'], 
              $validated['submit_corrective_action'], $validated['submit_later']);

        // Set status based on workflow
        if ($submitCorrectiveAction && $request->filled('corrective_action')) {
            $validated['status'] = 'closed';
            $validated['closed_at'] = now();
            $validated['closed_by'] = $request->user()->id;
            $validated['is_pinned'] = false;
        } elseif ($submitLater) {
            $validated['status'] = 'open';
            $validated['is_pinned'] = true;
            $validated['pinned_at'] = now();
        } else {
            $validated['status'] = 'open';
        }

        // Create the report
        $report = SorReport::create($validated);
        $project = Project::find($validated['project_id']);
        $projectCode = $project ? preg_replace('/[^a-zA-Z0-9]/', '_', $project->code ?? $project->name) : 'unknown';

        // Handle problem photo upload
        if ($request->hasFile('photo')) {
            $photo = $request->file('photo');
            $path = $this->storeOptimizedSorPhoto($photo, (int) $report->id, 'problem');
            $report->update(['photo_path' => $path]);
        }

        // Handle corrective action photo upload
        if ($request->hasFile('corrective_action_photo')) {
            $photo = $request->file('corrective_action_photo');
            $path = $this->storeOptimizedSorPhoto($photo, (int) $report->id, 'corrective');
            $report->update(['corrective_action_photo_path' => $path]);
        }

        $report->load(['project', 'submitter']);

        // Notify admins and project users
        NotificationService::sorSubmitted($report);

        $message = $submitLater 
            ? 'SOR report created and pinned for follow-up'
            : ($submitCorrectiveAction ? 'SOR report created and closed' : 'SOR report created successfully');

        return response()->json([
            'message' => $message,
            'data' => $report
        ], 201);
    }

    /**
     * Submit corrective action for a pinned SOR report
     */
    public function submitCorrectiveAction(Request $request, SorReport $sorReport)
    {
        $user = $request->user();

        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        $validated = $request->validate([
            'deadline' => 'nullable|date',
            'corrective_action' => 'required|string',
            'corrective_action_date' => 'nullable|date',
            'corrective_action_time' => 'nullable|string|max:10',
            'corrective_action_photo' => 'nullable|image|max:5120',
        ]);

        unset($validated['corrective_action_photo']);

        // Mark as closed and unpin
        $validated['status'] = 'closed';
        $validated['is_pinned'] = false;
        if ($sorReport->status !== 'closed') {
            $validated['closed_at'] = now();
            $validated['closed_by'] = $request->user()->id;
        }

        // Handle corrective action photo
        if ($request->hasFile('corrective_action_photo')) {
            // Delete old corrective action photo if exists
            if ($sorReport->corrective_action_photo_path) {
                Storage::disk('public')->delete($sorReport->corrective_action_photo_path);
            }
            
            $photo = $request->file('corrective_action_photo');
            $path = $this->storeOptimizedSorPhoto($photo, (int) $sorReport->id, 'corrective');
            $validated['corrective_action_photo_path'] = $path;
        }

        $sorReport->update($validated);
        $sorReport->load(['project', 'submitter', 'closer']);

        // Notify admins of corrective action
        NotificationService::sorCorrected($sorReport);

        return response()->json([
            'message' => 'Corrective action submitted and SOR closed',
            'data' => $sorReport
        ]);
    }

    /**
     * Get a specific SOR report
     */
    public function show(SorReport $sorReport)
    {
        $user = request()->user();
        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        return response()->json([
            'data' => $sorReport->load(['project', 'submitter', 'closer'])
        ]);
    }

    /**
     * Update a SOR report
     */
    public function update(Request $request, SorReport $sorReport)
    {
        $user = $request->user();
        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        $validated = $request->validate([
            'project_id' => 'nullable|exists:projects,id',
            'company' => 'nullable|string|max:255',
            'observation_date' => 'nullable|date',
            'observation_time' => 'nullable|string|max:10',
            'zone' => 'nullable|string|max:255',
            'supervisor' => 'nullable|string|max:255',
            'non_conformity' => 'nullable|string',
            'photo' => 'nullable|image|max:5120',
            'category' => 'nullable|string',
            'responsible_person' => 'nullable|string|max:255',
            'deadline' => 'nullable|date',
            'corrective_action' => 'nullable|string',
            'corrective_action_date' => 'nullable|date',
            'corrective_action_time' => 'nullable|string|max:10',
            'corrective_action_photo' => 'nullable|image|max:5120',
            'status' => 'nullable|in:open,in_progress,closed',
            'notes' => 'nullable|string',
        ]);

        // Filter out null values so we don't overwrite existing data
        $validated = array_filter($validated, fn($value) => $value !== null);
        unset($validated['photo'], $validated['corrective_action_photo']);

        // Handle photo upload with custom naming
        if ($request->hasFile('photo')) {
            // Delete old photo
            if ($sorReport->photo_path) {
                Storage::disk('public')->delete($sorReport->photo_path);
            }
            
            $photo = $request->file('photo');
            $path = $this->storeOptimizedSorPhoto($photo, (int) $sorReport->id, 'problem');
            $validated['photo_path'] = $path;
        }

        // Handle corrective action photo upload
        if ($request->hasFile('corrective_action_photo')) {
            // Delete old corrective action photo
            if ($sorReport->corrective_action_photo_path) {
                Storage::disk('public')->delete($sorReport->corrective_action_photo_path);
            }

            $photo = $request->file('corrective_action_photo');
            $path = $this->storeOptimizedSorPhoto($photo, (int) $sorReport->id, 'corrective');
            $validated['corrective_action_photo_path'] = $path;
        }

        // Handle status change to closed
        if (isset($validated['status']) && $validated['status'] === 'closed' && $sorReport->status !== 'closed') {
            $validated['closed_at'] = now();
            $validated['closed_by'] = $request->user()->id;
        }

        $sorReport->update($validated);

        return response()->json([
            'message' => 'SOR report updated successfully',
            'data' => $sorReport->fresh()->load(['project', 'submitter', 'closer'])
        ]);
    }

    /**
     * Delete a SOR report
     */
    public function destroy(SorReport $sorReport)
    {
        $user = request()->user();
        $project = Project::findOrFail($sorReport->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        if (!$user->isAdminLike() && (int) $sorReport->submitted_by !== (int) $user->id) {
            abort(403, 'Access denied');
        }

        // Delete photo if exists
        if ($sorReport->photo_path) {
            Storage::disk('public')->delete($sorReport->photo_path);
        }

        $sorReport->delete();

        return response()->json([
            'message' => 'SOR report deleted successfully'
        ]);
    }

    /**
     * Get available categories
     */
    public function categories()
    {
        return response()->json([
            'data' => SorReport::CATEGORIES
        ]);
    }

    /**
     * Get SOR statistics for dashboard
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $query = SorReport::query();

        $projectIds = $user->visibleProjectIds();
        if ($projectIds !== null) {
            $query->whereIn('project_id', $projectIds);
        }

        if ($request->has('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        $stats = [
            'total' => (clone $query)->count(),
            'open' => (clone $query)->where('status', 'open')->count(),
            'in_progress' => (clone $query)->where('status', 'in_progress')->count(),
            'closed' => (clone $query)->where('status', 'closed')->count(),
            'overdue' => (clone $query)->overdue()->count(),
            'by_category' => (clone $query)->selectRaw('category, count(*) as count')
                                           ->groupBy('category')
                                           ->pluck('count', 'category'),
        ];

        return response()->json(['data' => $stats]);
    }
}
