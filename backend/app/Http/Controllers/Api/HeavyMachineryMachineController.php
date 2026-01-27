<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Exports\MachinesTemplateExport;
use App\Imports\MachinesImport;
use App\Models\Machine;
use App\Models\MachineDocument;
use App\Models\MachineDocumentKey;
use App\Models\MachineInspection;
use App\Models\Project;
use App\Models\Worker;
use App\Models\WorkerQualification;
use App\Support\MachineTypeCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Facades\Excel;

class HeavyMachineryMachineController extends Controller
{
    private function normalizeMachineTypeOrFail(?string $input): string
    {
        $key = MachineTypeCatalog::keyFromInput($input);
        if (!$key) {
            throw ValidationException::withMessages([
                'machine_type' => ['Invalid machine type. Please choose a value from the official list.'],
            ]);
        }

        return $key;
    }

    private function isOperatorQualifiedWorker(int $workerId): bool
    {
        $today = now()->startOfDay();

        return WorkerQualification::query()
            ->where('worker_id', $workerId)
            ->where(function ($q) {
                $q->whereRaw('LOWER(qualification_label) LIKE ?', ['%operator%'])
                    ->orWhereRaw('LOWER(qualification_label) LIKE ?', ['%operateur%'])
                    ->orWhereRaw('LOWER(qualification_label) LIKE ?', ['%opérateur%'])
                    ->orWhereRaw('LOWER(qualification_type) LIKE ?', ['%operator%'])
                    ->orWhereRaw('LOWER(qualification_type) LIKE ?', ['%operateur%'])
                    ->orWhereRaw('LOWER(qualification_type) LIKE ?', ['%opérateur%']);
            })
            ->where(function ($d) use ($today) {
                $d->whereNull('expiry_date')
                    ->orWhere('expiry_date', '>=', $today);
            })
            ->exists();
    }

    private function ensureAccessToMachine(Request $request, Machine $machine): void
    {
        $user = $request->user();
        if (!$user) {
            abort(401);
        }
        if ($machine->project_id === null) {
            if (!$user->hasGlobalProjectScope()) {
                abort(403, 'Access denied');
            }
            return;
        }

        $project = Project::findOrFail($machine->project_id);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }
    }

    public function downloadTemplate(Request $request)
    {
        try {
            $user = $request->user();

            if (!class_exists(\ZipArchive::class) || !extension_loaded('zip')) {
                return $this->error('XLSX export requires PHP zip extension (ZipArchive). Please enable/install php-zip on the server.', 422);
            }

            $visibleProjectIds = $user ? $user->visibleProjectIds() : null;
            $projectCodes = [];
            if ($visibleProjectIds !== null) {
                if (count($visibleProjectIds) === 0) {
                    $projectCodes = [];
                } else {
                    $projectCodes = Project::whereIn('id', $visibleProjectIds)->orderBy('name')->pluck('name')->toArray();
                }
            } else {
                $projectCodes = Project::query()->orderBy('name')->pluck('name')->toArray();
            }

            $machineTypesQuery = Machine::query()->whereNotNull('machine_type');
            if ($visibleProjectIds !== null) {
                if (count($visibleProjectIds) === 0) {
                    $machineTypesQuery->whereRaw('1=0');
                } else {
                    $machineTypesQuery->whereIn('project_id', $visibleProjectIds);
                }
            }
            $machineTypes = $machineTypesQuery
                ->select('machine_type')
                ->distinct()
                ->orderBy('machine_type')
                ->pluck('machine_type')
                ->map(fn ($v) => trim((string) $v))
                ->filter(fn ($v) => $v !== '')
                ->values()
                ->toArray();

            $filename = 'SGTM-Machines-Template.xlsx';

            $lang = (string) ($request->get('lang') ?: ($user->preferred_language ?? 'fr'));

            return Excel::download(new MachinesTemplateExport(200, $projectCodes, $lang, $machineTypes), $filename);
        } catch (\Throwable $e) {
            Log::error('Machines template generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to generate machines template: ' . $e->getMessage(), 422);
        }
    }

    public function bulkImport(Request $request)
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
        $import = new MachinesImport($user ? (int) $user->id : 0, $visibleProjectIds);

        try {
            DB::beginTransaction();
            Excel::import($import, $request->file('file'));
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Machines bulk import failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->error('Failed to import machines: ' . $e->getMessage(), 422);
        }

        return $this->success([
            'imported' => $import->getImportedCount(),
            'updated' => $import->getUpdatedCount(),
            'errors' => $import->getErrors(),
        ], 'Machines imported');
    }

    private function ensureAccessToProjectId(Request $request, ?int $projectId): void
    {
        $user = $request->user();
        if (!$user) {
            abort(401);
        }

        if ($projectId === null) {
            if (!$user->hasGlobalProjectScope()) {
                abort(403, 'Access denied');
            }
            return;
        }

        $project = Project::findOrFail($projectId);
        if (!$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }
    }

    private function streamPublicFile(?string $path, bool $inline, string $contentType)
    {
        if (!$path || !Storage::disk('public')->exists($path)) {
            abort(404, 'File not found');
        }

        $filename = basename($path);

        if ($inline) {
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
                'Content-Type' => $contentType,
                'Content-Disposition' => 'inline; filename="' . $filename . '"',
            ]);
        }

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
            'Content-Type' => $contentType,
        ]);
    }

    private function storeOptimizedMachineImage(UploadedFile $image, int $machineId): string
    {
        $dir = "heavy_machinery/machines/{$machineId}";
        $filename = "machine_{$machineId}.jpg";
        $path = "{$dir}/{$filename}";

        if (!function_exists('imagecreatetruecolor')) {
            $ext = strtolower($image->getClientOriginalExtension() ?: 'jpg');
            $filenameRaw = "machine_{$machineId}.{$ext}";
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
                $extFallback = 'jpg';
                $filenameRaw = "machine_{$machineId}.{$extFallback}";
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
            $filenameRaw = "machine_{$machineId}.{$extFallback}";
            return $image->storeAs($dir, $filenameRaw, 'public');
        }
    }

    public function viewImage(Request $request, Machine $machine)
    {
        $this->ensureAccessToMachine($request, $machine);

        $path = $machine->image_path;
        if (!$path || !Storage::disk('public')->exists($path)) {
            abort(404, 'Image not found');
        }

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $contentType = match ($ext) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };

        $disk = Storage::disk('public');
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
            'Content-Type' => $contentType,
            'Content-Disposition' => 'inline; filename="' . basename($path) . '"',
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'ETag' => $etag,
        ]);
    }

    private function ensureGlobalSearchCodeMatches(Request $request, Machine $machine): string
    {
        $code = trim((string) $request->query('code', ''));
        if ($code === '') {
            abort(422, 'Missing code');
        }

        if ($code !== (string) $machine->serial_number && $code !== (string) $machine->internal_code) {
            abort(403, 'Access denied');
        }

        return $code;
    }

    private function serializeMachine(Machine $machine): array
    {
        $project = null;
        if ($machine->relationLoaded('project') && $machine->project) {
            $project = ['id' => $machine->project->id, 'name' => $machine->project->name];
        }

        $machineTypeRaw = $machine->machine_type;
        $machineTypeKey = $machineTypeRaw !== null ? MachineTypeCatalog::keyFromInput((string) $machineTypeRaw) : null;

        return [
            'id' => $machine->id,
            'serial_number' => $machine->serial_number,
            'internal_code' => $machine->internal_code,
            'machine_type' => $machine->machine_type,
            'machine_type_key' => $machineTypeKey,
            'machine_type_label_fr' => $machineTypeKey ? MachineTypeCatalog::labelForKey($machineTypeKey, 'fr') : null,
            'machine_type_label_en' => $machineTypeKey ? MachineTypeCatalog::labelForKey($machineTypeKey, 'en') : null,
            'brand' => $machine->brand,
            'model' => $machine->model,
            'project_id' => $machine->project_id,
            'project' => $project,
            'is_active' => (bool) $machine->is_active,
            'image_url' => $machine->image_url,
            'created_at' => optional($machine->created_at)->toISOString(),
            'updated_at' => optional($machine->updated_at)->toISOString(),
        ];
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'project_id' => 'nullable|exists:projects,id',
        ]);

        $query = Machine::query()->with(['project:id,name']);

        if ($request->filled('project_id')) {
            $projectId = (int) $request->get('project_id');
            $this->ensureAccessToProjectId($request, $projectId);
            $query->where('project_id', $projectId);
        } else {
            $visibleProjectIds = $user ? $user->visibleProjectIds() : [];
            if ($visibleProjectIds !== null) {
                if (count($visibleProjectIds) === 0) {
                    return $this->success([]);
                }
                $query->whereIn('project_id', $visibleProjectIds);
            }
        }

        $machines = $query->orderBy('internal_code')->orderBy('serial_number')->get();

        return $this->success($machines->map(fn ($m) => $this->serializeMachine($m))->toArray());
    }

    public function show(Request $request, Machine $machine)
    {
        $this->ensureAccessToMachine($request, $machine);

        $machine->load([
            'project:id,name',
            'documents',
            'inspections',
            'operators.project:id,name',
        ]);

        $documents = $machine->documents
            ->sortBy('expiry_date')
            ->values()
            ->map(function ($d) use ($machine) {
                $hasFile = (bool) $d->file_path;

                return [
                    'id' => $d->id,
                    'document_key' => $d->document_key,
                    'document_label' => $d->document_label,
                    'start_date' => optional($d->start_date)->format('Y-m-d'),
                    'expiry_date' => optional($d->expiry_date)->format('Y-m-d'),
                    'file_view_url' => $hasFile ? "/api/heavy-machinery/machines/{$machine->id}/documents/{$d->id}/view" : null,
                    'file_download_url' => $hasFile ? "/api/heavy-machinery/machines/{$machine->id}/documents/{$d->id}/download" : null,
                    'file_size' => $d->file_size,
                    'status' => $d->status,
                ];
            })->toArray();

        $inspections = $machine->inspections
            ->sortByDesc('created_at')
            ->values()
            ->map(function ($i) use ($machine) {
                $hasFile = (bool) $i->file_path;

                return [
                    'id' => $i->id,
                    'parent_id' => $i->parent_id,
                    'version' => $i->version,
                    'start_date' => optional($i->start_date)->format('Y-m-d'),
                    'end_date' => optional($i->end_date)->format('Y-m-d'),
                    'file_view_url' => $hasFile ? "/api/heavy-machinery/machines/{$machine->id}/inspections/{$i->id}/view" : null,
                    'file_download_url' => $hasFile ? "/api/heavy-machinery/machines/{$machine->id}/inspections/{$i->id}/download" : null,
                    'file_size' => $i->file_size,
                    'created_at' => optional($i->created_at)->toISOString(),
                ];
            })->toArray();

        $operators = $machine->operators
            ->values()
            ->map(function ($w) {
                return [
                    'id' => $w->id,
                    'full_name' => $w->full_name,
                    'cin' => $w->cin,
                    'fonction' => $w->fonction,
                    'project_id' => $w->project_id,
                    'project' => $w->project ? ['id' => $w->project->id, 'name' => $w->project->name] : null,
                    'assigned_at' => $w->pivot ? optional($w->pivot->assigned_at)->toISOString() : null,
                ];
            })->toArray();

        return $this->success([
            'machine' => $this->serializeMachine($machine),
            'documents' => $documents,
            'inspections' => $inspections,
            'operators' => $operators,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'serial_number' => 'required|string|max:255|unique:machines,serial_number',
            'internal_code' => 'nullable|string|max:255|unique:machines,internal_code',
            'machine_type' => 'required|string|max:255',
            'brand' => 'required|string|max:255',
            'model' => 'nullable|string|max:255',
            'project_id' => 'nullable|exists:projects,id',
            'is_active' => 'nullable|boolean',
            'image' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $machineTypeKey = $this->normalizeMachineTypeOrFail($validated['machine_type']);

        $this->ensureAccessToProjectId($request, array_key_exists('project_id', $validated) ? ($validated['project_id'] !== null ? (int) $validated['project_id'] : null) : null);

        $data = [
            'serial_number' => trim($validated['serial_number']),
            'internal_code' => array_key_exists('internal_code', $validated) ? ($validated['internal_code'] !== null ? trim((string) $validated['internal_code']) : null) : null,
            'machine_type' => $machineTypeKey,
            'brand' => trim($validated['brand']),
            'model' => array_key_exists('model', $validated) ? ($validated['model'] !== null ? trim((string) $validated['model']) : null) : null,
            'project_id' => $validated['project_id'] ?? null,
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            'created_by' => $user ? $user->id : null,
            'updated_by' => $user ? $user->id : null,
        ];

        $machine = Machine::create($data);

        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $path = $this->storeOptimizedMachineImage($image, (int) $machine->id);
            $machine->update(['image_path' => $path]);
        }

        $machine->load(['project:id,name']);

        return $this->success($this->serializeMachine($machine), 'Machine created successfully', 201);
    }

    public function update(Request $request, Machine $machine)
    {
        $user = $request->user();

        $this->ensureAccessToMachine($request, $machine);

        $validated = $request->validate([
            'serial_number' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('machines', 'serial_number')->ignore($machine->id),
            ],
            'internal_code' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('machines', 'internal_code')->ignore($machine->id),
            ],
            'machine_type' => 'sometimes|string|max:255',
            'brand' => 'sometimes|string|max:255',
            'model' => 'nullable|string|max:255',
            'project_id' => 'nullable|exists:projects,id',
            'is_active' => 'nullable|boolean',
        ]);

        if (array_key_exists('machine_type', $validated)) {
            $validated['machine_type'] = $this->normalizeMachineTypeOrFail($validated['machine_type']);
        }

        if (array_key_exists('project_id', $validated)) {
            $this->ensureAccessToProjectId($request, $validated['project_id'] !== null ? (int) $validated['project_id'] : null);
        }

        $data = [];
        foreach (['serial_number', 'internal_code', 'machine_type', 'brand', 'model', 'project_id', 'is_active'] as $field) {
            if (array_key_exists($field, $validated)) {
                $val = $validated[$field];
                if (is_string($val)) {
                    $val = trim($val);
                }
                $data[$field] = $val;
            }
        }

        $data['updated_by'] = $user ? $user->id : null;

        $machine->update($data);
        $machine->load(['project:id,name']);

        return $this->success($this->serializeMachine($machine), 'Machine updated successfully');
    }

    public function destroy(Request $request, Machine $machine)
    {
        $this->ensureAccessToMachine($request, $machine);

        $machine->load(['documents', 'inspections']);

        if ($machine->image_path) {
            Storage::disk('public')->delete($machine->image_path);
        }

        foreach ($machine->documents as $d) {
            if ($d->file_path) {
                Storage::disk('public')->delete($d->file_path);
            }
        }

        foreach ($machine->inspections as $i) {
            if ($i->file_path) {
                Storage::disk('public')->delete($i->file_path);
            }
        }

        $machine->operators()->detach();
        $machine->delete();

        return $this->success(null, 'Machine deleted successfully');
    }

    public function transfer(Request $request, Machine $machine)
    {
        $user = $request->user();

        $this->ensureAccessToMachine($request, $machine);

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
        ]);

        $toProjectId = (int) $validated['project_id'];
        $this->ensureAccessToProjectId($request, $toProjectId);

        DB::transaction(function () use ($machine, $toProjectId, $user) {
            $machine->operators()->detach();
            $machine->update([
                'project_id' => $toProjectId,
                'updated_by' => $user ? $user->id : null,
            ]);
        });

        $machine->load(['project:id,name']);

        return $this->success($this->serializeMachine($machine), 'Machine transferred successfully');
    }

    public function uploadImage(Request $request, Machine $machine)
    {
        $user = $request->user();

        $this->ensureAccessToMachine($request, $machine);

        $validated = $request->validate([
            'image' => 'required|file|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        $oldPath = $machine->image_path;

        $image = $request->file('image');
        $path = $this->storeOptimizedMachineImage($image, (int) $machine->id);

        if ($oldPath && $oldPath !== $path) {
            Storage::disk('public')->delete($oldPath);
        }

        $machine->update([
            'image_path' => $path,
            'updated_by' => $user ? $user->id : null,
        ]);

        $machine->load(['project:id,name']);

        return $this->success($this->serializeMachine($machine), 'Image uploaded successfully');
    }

    public function upsertDocument(Request $request, Machine $machine)
    {
        $user = $request->user();

        $this->ensureAccessToMachine($request, $machine);

        $allowedKeys = MachineDocumentKey::query()
            ->where('is_active', true)
            ->pluck('key')
            ->toArray();

        $documentKeyRules = ['required', 'string', 'max:255'];
        if (count($allowedKeys) > 0) {
            $documentKeyRules[] = Rule::in($allowedKeys);
        }

        $validated = $request->validate([
            'document_key' => $documentKeyRules,
            'start_date' => 'nullable|date',
            'expiry_date' => 'nullable|date|after_or_equal:start_date',
            'file' => 'required|file|mimes:pdf|max:51200',
        ]);

        $file = $request->file('file');
        $fileSize = $file->getSize();

        $documentKey = trim((string) $validated['document_key']);
        $documentLabel = MachineDocumentKey::query()->where('key', $documentKey)->value('label');
        $documentLabel = trim((string) ($documentLabel ?: $documentKey));
        $document = MachineDocument::firstOrCreate([
            'machine_id' => $machine->id,
            'document_key' => $documentKey,
        ], [
            'document_label' => $documentLabel,
        ]);

        if ($document->file_path) {
            Storage::disk('public')->delete($document->file_path);
        }

        $document->document_label = $documentLabel;
        $document->start_date = $validated['start_date'] ?? null;
        $document->expiry_date = $validated['expiry_date'] ?? null;
        $document->uploaded_by = $user ? $user->id : null;
        $document->file_size = $fileSize;

        $baseDir = "heavy_machinery/machines/{$machine->id}/documents";
        $path = $file->store($baseDir, 'public');
        $document->file_path = $path;

        $document->save();

        return $this->success($document->fresh(), 'Document uploaded successfully');
    }

    public function updateDocument(Request $request, Machine $machine, MachineDocument $machineDocument)
    {
        $user = $request->user();

        $this->ensureAccessToMachine($request, $machine);

        if ((int) $machineDocument->machine_id !== (int) $machine->id) {
            abort(404);
        }

        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'expiry_date' => 'nullable|date|after_or_equal:start_date',
            'file' => 'nullable|file|mimes:pdf|max:51200',
        ]);

        $data = [];

        if (array_key_exists('start_date', $validated)) {
            $data['start_date'] = $validated['start_date'];
        }
        if (array_key_exists('expiry_date', $validated)) {
            $data['expiry_date'] = $validated['expiry_date'];
        }

        if ($request->hasFile('file')) {
            if ($machineDocument->file_path) {
                Storage::disk('public')->delete($machineDocument->file_path);
            }

            $file = $request->file('file');
            $data['file_size'] = $file->getSize();
            $baseDir = "heavy_machinery/machines/{$machine->id}/documents";
            $data['file_path'] = $file->store($baseDir, 'public');
            $data['uploaded_by'] = $user ? $user->id : null;
        }

        $machineDocument->update($data);

        return $this->success($machineDocument->fresh(), 'Document updated successfully');
    }

    public function deleteDocument(Request $request, Machine $machine, MachineDocument $machineDocument)
    {
        $this->ensureAccessToMachine($request, $machine);

        if ((int) $machineDocument->machine_id !== (int) $machine->id) {
            abort(404);
        }

        if ($machineDocument->file_path) {
            Storage::disk('public')->delete($machineDocument->file_path);
        }

        $machineDocument->delete();

        return $this->success(null, 'Document deleted successfully');
    }

    public function viewDocument(Request $request, Machine $machine, MachineDocument $machineDocument)
    {
        $this->ensureAccessToMachine($request, $machine);

        if ((int) $machineDocument->machine_id !== (int) $machine->id) {
            abort(404);
        }

        return $this->streamPublicFile($machineDocument->file_path, true, 'application/pdf');
    }

    public function downloadDocument(Request $request, Machine $machine, MachineDocument $machineDocument)
    {
        $this->ensureAccessToMachine($request, $machine);

        if ((int) $machineDocument->machine_id !== (int) $machine->id) {
            abort(404);
        }

        return $this->streamPublicFile($machineDocument->file_path, false, 'application/pdf');
    }

    public function upsertInspection(Request $request, Machine $machine)
    {
        $user = $request->user();

        $this->ensureAccessToMachine($request, $machine);

        $validated = $request->validate([
            'parent_id' => 'nullable|exists:machine_inspections,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'file' => 'required|file|mimes:pdf|max:51200',
        ]);

        $parentId = array_key_exists('parent_id', $validated) ? ($validated['parent_id'] !== null ? (int) $validated['parent_id'] : null) : null;

        $parent = null;

        if ($parentId !== null) {
            $parent = MachineInspection::findOrFail($parentId);
            if ((int) $parent->machine_id !== (int) $machine->id) {
                abort(422, 'Invalid parent inspection');
            }
        }

        $rootId = null;
        if ($parentId !== null) {
            $rootId = $parent && $parent->parent_id !== null
                ? (int) $parent->parent_id
                : (int) $parent->id;
        }

        $nextVersion = 1;
        if ($rootId !== null) {
            $maxVersion = MachineInspection::where('machine_id', $machine->id)
                ->where(function ($q) use ($rootId) {
                    $q->where('id', $rootId)->orWhere('parent_id', $rootId);
                })
                ->max('version');
            $nextVersion = ((int) $maxVersion) + 1;
        }

        $file = $request->file('file');
        $fileSize = $file->getSize();

        $inspection = MachineInspection::create([
            'machine_id' => $machine->id,
            'parent_id' => $rootId,
            'version' => $rootId ? $nextVersion : 1,
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'file_size' => $fileSize,
            'uploaded_by' => $user ? $user->id : null,
        ]);

        $baseDir = "heavy_machinery/machines/{$machine->id}/inspections";
        if ($rootId) {
            $baseDir .= "/{$rootId}";
        } else {
            $baseDir .= "/{$inspection->id}";
        }

        $path = $file->store($baseDir, 'public');

        $inspection->update([
            'file_path' => $path,
        ]);

        return $this->success($inspection->fresh(), 'Inspection uploaded successfully');
    }

    public function viewInspection(Request $request, Machine $machine, MachineInspection $machineInspection)
    {
        $this->ensureAccessToMachine($request, $machine);

        if ((int) $machineInspection->machine_id !== (int) $machine->id) {
            abort(404);
        }

        return $this->streamPublicFile($machineInspection->file_path, true, 'application/pdf');
    }

    public function downloadInspection(Request $request, Machine $machine, MachineInspection $machineInspection)
    {
        $this->ensureAccessToMachine($request, $machine);

        if ((int) $machineInspection->machine_id !== (int) $machine->id) {
            abort(404);
        }

        return $this->streamPublicFile($machineInspection->file_path, false, 'application/pdf');
    }

    public function deleteInspection(Request $request, Machine $machine, MachineInspection $machineInspection)
    {
        $this->ensureAccessToMachine($request, $machine);

        if ((int) $machineInspection->machine_id !== (int) $machine->id) {
            abort(404);
        }

        if ($machineInspection->file_path) {
            Storage::disk('public')->delete($machineInspection->file_path);
        }

        $machineInspection->delete();

        return $this->success(null, 'Inspection deleted successfully');
    }

    public function searchWorkers(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'q' => 'nullable|string|max:255',
            'limit' => 'nullable|integer|min:1|max:50',
        ]);

        $projectId = (int) $validated['project_id'];
        $project = Project::findOrFail($projectId);
        if (!$user || !$user->canAccessProject($project)) {
            abort(403, 'Access denied');
        }

        $q = trim((string) ($validated['q'] ?? ''));
        $limit = (int) ($validated['limit'] ?? 20);

        $query = Worker::query()
            ->with(['project:id,name'])
            ->where('project_id', $projectId)
            ->where('is_active', true)
            ->whereHas('qualifications', function ($tq) {
                $today = now()->startOfDay();

                $tq->where(function ($q) {
                    $q->whereRaw('LOWER(qualification_label) LIKE ?', ['%operator%'])
                        ->orWhereRaw('LOWER(qualification_label) LIKE ?', ['%operateur%'])
                        ->orWhereRaw('LOWER(qualification_label) LIKE ?', ['%opérateur%'])
                        ->orWhereRaw('LOWER(qualification_type) LIKE ?', ['%operator%'])
                        ->orWhereRaw('LOWER(qualification_type) LIKE ?', ['%operateur%'])
                        ->orWhereRaw('LOWER(qualification_type) LIKE ?', ['%opérateur%']);
                })->where(function ($d) use ($today) {
                    $d->whereNull('expiry_date')
                        ->orWhere('expiry_date', '>=', $today);
                });
            });

        if ($q !== '') {
            $query->search($q);
        }

        $workers = $query->orderBy('prenom')->orderBy('nom')->limit($limit)->get();

        return $this->success($workers->map(function ($w) {
            return [
                'id' => $w->id,
                'full_name' => $w->full_name,
                'cin' => $w->cin,
                'fonction' => $w->fonction,
                'project_id' => $w->project_id,
                'project' => $w->project ? ['id' => $w->project->id, 'name' => $w->project->name] : null,
            ];
        })->toArray());
    }

    public function addOperator(Request $request, Machine $machine)
    {
        $user = $request->user();

        $this->ensureAccessToMachine($request, $machine);

        $validated = $request->validate([
            'worker_id' => 'required|exists:workers,id',
        ]);

        $worker = Worker::with(['project:id,name'])->findOrFail((int) $validated['worker_id']);

        if ($machine->project_id === null) {
            return $this->error('Machine must be assigned to a project before assigning operators', 422);
        }

        if ((int) $worker->project_id !== (int) $machine->project_id) {
            return $this->error('Worker must belong to the same project as the machine', 422);
        }

        if (!$this->isOperatorQualifiedWorker((int) $worker->id)) {
            return $this->error('Worker is not qualified as an operator', 422);
        }

        $machine->operators()->syncWithoutDetaching([
            $worker->id => [
                'assigned_at' => now(),
                'created_by' => $user ? $user->id : null,
            ],
        ]);

        $machine->load(['operators.project:id,name']);

        return $this->success($machine->operators->map(function ($w) {
            return [
                'id' => $w->id,
                'full_name' => $w->full_name,
                'cin' => $w->cin,
                'fonction' => $w->fonction,
                'project_id' => $w->project_id,
                'project' => $w->project ? ['id' => $w->project->id, 'name' => $w->project->name] : null,
                'assigned_at' => $w->pivot ? optional($w->pivot->assigned_at)->toISOString() : null,
            ];
        })->toArray(), 'Operator assigned successfully');
    }

    public function removeOperator(Request $request, Machine $machine, Worker $worker)
    {
        $this->ensureAccessToMachine($request, $machine);

        $machine->operators()->detach($worker->id);

        return $this->success(null, 'Operator removed successfully');
    }

    public function globalSearch(Request $request)
    {
        $request->validate([
            'query' => 'required|string|max:255',
        ]);

        $q = trim((string) $request->get('query'));

        $code = urlencode($q);

        $machine = Machine::with(['project:id,name', 'documents'])
            ->where('serial_number', $q)
            ->orWhere('internal_code', $q)
            ->first();

        if (!$machine) {
            return $this->success(null);
        }

        $documents = $machine->documents
            ->sortBy('expiry_date')
            ->values()
            ->map(function ($d) use ($machine, $code) {
                $hasFile = (bool) $d->file_path;

                return [
                    'id' => $d->id,
                    'document_key' => $d->document_key,
                    'document_label' => $d->document_label,
                    'start_date' => optional($d->start_date)->format('Y-m-d'),
                    'expiry_date' => optional($d->expiry_date)->format('Y-m-d'),
                    'file_view_url' => $hasFile ? "/api/heavy-machinery/global/machines/{$machine->id}/documents/{$d->id}/view?code={$code}" : null,
                    'file_download_url' => $hasFile ? "/api/heavy-machinery/global/machines/{$machine->id}/documents/{$d->id}/download?code={$code}" : null,
                    'file_size' => $d->file_size,
                    'status' => $d->status,
                ];
            })->toArray();

        return $this->success([
            'machine' => $this->serializeMachine($machine),
            'documents' => $documents,
        ]);
    }

    public function globalViewDocument(Request $request, Machine $machine, MachineDocument $machineDocument)
    {
        $this->ensureGlobalSearchCodeMatches($request, $machine);

        if ((int) $machineDocument->machine_id !== (int) $machine->id) {
            abort(404);
        }

        return $this->streamPublicFile($machineDocument->file_path, true, 'application/pdf');
    }

    public function globalDownloadDocument(Request $request, Machine $machine, MachineDocument $machineDocument)
    {
        $this->ensureGlobalSearchCodeMatches($request, $machine);

        if ((int) $machineDocument->machine_id !== (int) $machine->id) {
            abort(404);
        }

        return $this->streamPublicFile($machineDocument->file_path, false, 'application/pdf');
    }
}
