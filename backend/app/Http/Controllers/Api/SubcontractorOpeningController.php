<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Worker;
use App\Models\SubcontractorOpening;
use App\Models\SubcontractorOpeningDocument;
use App\Services\PdfCompressionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class SubcontractorOpeningController extends Controller
{
    private function serializeDocument(SubcontractorOpening $opening, SubcontractorOpeningDocument $doc): array
    {
        $hasFile = (bool) $doc->file_path;

        return [
            'id' => $doc->id,
            'document_key' => $doc->document_key,
            'document_label' => $doc->document_label,
            'start_date' => optional($doc->start_date)->format('Y-m-d'),
            'expiry_date' => optional($doc->expiry_date)->format('Y-m-d'),
            'file_view_url' => $hasFile
                ? "/api/subcontractor-openings/{$opening->id}/documents/{$doc->id}/view"
                : null,
            'file_download_url' => $hasFile
                ? "/api/subcontractor-openings/{$opening->id}/documents/{$doc->id}/download"
                : null,
            'file_size' => $doc->file_size,
            'compressed_size' => $doc->compressed_size,
            'was_compressed' => (bool) $doc->was_compressed,
            'status' => $doc->status,
        ];
    }

    private function ensureAccessToProject(Request $request, Project $project): void
    {
        $user = $request->user();

        if (!$user) {
            abort(401);
        }

        if ($user->isAdminLike()) {
            return;
        }

        if (!$user->isResponsable()) {
            abort(403, 'Access denied');
        }

        if (!$user->canAccessProject($project)) {
            abort(403, 'You are not assigned to this project');
        }
    }

    private function serializeOpening(SubcontractorOpening $opening, int $workersCount = 0): array
    {
        $required = SubcontractorOpening::REQUIRED_DOCUMENTS;
        $requiredByKey = [];
        foreach ($required as $doc) {
            $requiredByKey[$doc['key']] = $doc['label'];
        }

        $docs = $opening->documents;

        $today = now()->startOfDay();
        $expiringLimit = now()->addDays(SubcontractorOpening::EXPIRING_DAYS)->endOfDay();

        $uploadedCount = 0;
        $expired = [];
        $expiring = [];

        foreach ($docs as $d) {
            if ($d->file_path) {
                $uploadedCount++;
            }

            if ($d->expiry_date) {
                if ($d->expiry_date->lt($today)) {
                    $expired[] = [
                        'key' => $d->document_key,
                        'label' => $d->document_label,
                        'expiry_date' => $d->expiry_date->format('Y-m-d'),
                    ];
                } elseif ($d->expiry_date->between($today, $expiringLimit)) {
                    $expiring[] = [
                        'key' => $d->document_key,
                        'label' => $d->document_label,
                        'expiry_date' => $d->expiry_date->format('Y-m-d'),
                    ];
                }
            }
        }

        $requiredCount = count($required);

        $status = 'green';
        if (!empty($expired)) {
            $status = 'red';
        } elseif (!empty($expiring)) {
            $status = 'yellow';
        }

        return [
            'id' => $opening->id,
            'project_id' => $opening->project_id,
            'project' => $opening->relationLoaded('project') && $opening->project
                ? ['id' => $opening->project->id, 'name' => $opening->project->name]
                : null,
            'contractor_name' => $opening->contractor_name,
            'work_type' => $opening->work_type,
            'contractor_start_date' => optional($opening->contractor_start_date)->format('Y-m-d'),
            'created_at' => optional($opening->created_at)->toISOString(),
            'updated_at' => optional($opening->updated_at)->toISOString(),
            'required_documents' => $required,
            'documents_uploaded' => $uploadedCount,
            'required_documents_count' => $requiredCount,
            'workers_count' => $workersCount,
            'status' => $status,
            'expired_documents' => $expired,
            'expiring_documents' => $expiring,
        ];
    }

    public function index(Request $request)
    {
        $request->validate([
            'project_id' => 'nullable|exists:projects,id',
        ]);

        $user = $request->user();

        $query = SubcontractorOpening::query()->with(['documents', 'project:id,name']);

        if ($request->filled('project_id')) {
            $projectId = (int) $request->project_id;
            $project = Project::findOrFail($projectId);
            $this->ensureAccessToProject($request, $project);
            $query->where('project_id', $projectId);
        } else {
            // Without project filter, restrict to user's projects (unless admin)
            $projectIds = $user->visibleProjectIds();
            if ($projectIds !== null) {
                if (count($projectIds) === 0) {
                    return $this->success([]);
                }
                $query->whereIn('project_id', $projectIds);
            }
        }

        $openings = $query->orderBy('contractor_name')->get();

        $projectIds = $openings->pluck('project_id')->unique()->filter()->values()->toArray();
        $workerCountsMap = [];
        if (!empty($projectIds)) {
            $rows = Worker::active()
                ->whereIn('project_id', $projectIds)
                ->whereNotNull('entreprise')
                ->where('entreprise', '!=', '')
                ->select('project_id', 'entreprise', DB::raw('count(*) as count'))
                ->groupBy('project_id', 'entreprise')
                ->get();

            foreach ($rows as $r) {
                $key = ((int) $r->project_id) . '|' . mb_strtolower(trim((string) $r->entreprise));
                $workerCountsMap[$key] = (int) $r->count;
            }
        }

        $data = $openings->map(function ($o) use ($workerCountsMap) {
            $key = ((int) $o->project_id) . '|' . mb_strtolower(trim((string) $o->contractor_name));
            $workersCount = (int) ($workerCountsMap[$key] ?? 0);
            return $this->serializeOpening($o, $workersCount);
        })->toArray();

        // Pin SGTM first (case-insensitive)
        usort($data, function ($a, $b) {
            $aIs = strtolower(trim($a['contractor_name'] ?? '')) === 'sgtm';
            $bIs = strtolower(trim($b['contractor_name'] ?? '')) === 'sgtm';
            if ($aIs === $bIs) {
                return strcasecmp($a['contractor_name'] ?? '', $b['contractor_name'] ?? '');
            }
            return $aIs ? -1 : 1;
        });

        return $this->success($data);
    }

    public function show(Request $request, SubcontractorOpening $subcontractorOpening)
    {
        $subcontractorOpening->load(['documents', 'project:id,name']);
        $project = Project::findOrFail($subcontractorOpening->project_id);
        $this->ensureAccessToProject($request, $project);

        $required = SubcontractorOpening::REQUIRED_DOCUMENTS;
        $existing = $subcontractorOpening->documents->keyBy('document_key');

        $documents = [];
        foreach ($required as $doc) {
            $key = $doc['key'];
            $label = $doc['label'];
            $existingDoc = $existing->get($key);

            if ($existingDoc) {
                $documents[] = $this->serializeDocument($subcontractorOpening, $existingDoc);
            } else {
                $documents[] = [
                    'id' => null,
                    'document_key' => $key,
                    'document_label' => $label,
                    'start_date' => null,
                    'expiry_date' => null,
                    'file_view_url' => null,
                    'file_download_url' => null,
                    'file_size' => null,
                    'compressed_size' => null,
                    'was_compressed' => false,
                    'status' => 'no_file',
                ];
            }
        }

        $workersCount = Worker::active()
            ->where('project_id', $subcontractorOpening->project_id)
            ->whereNotNull('entreprise')
            ->whereRaw('LOWER(entreprise) = ?', [mb_strtolower(trim((string) $subcontractorOpening->contractor_name))])
            ->count();

        return $this->success([
            'opening' => $this->serializeOpening($subcontractorOpening, (int) $workersCount),
            'documents' => $documents,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'contractor_name' => 'required|string|max:255',
            'work_type' => 'nullable|string|max:255',
            'contractor_start_date' => 'nullable|date',
        ]);

        $project = Project::findOrFail($validated['project_id']);
        $this->ensureAccessToProject($request, $project);

        $opening = SubcontractorOpening::create([
            'project_id' => $validated['project_id'],
            'contractor_name' => trim($validated['contractor_name']),
            'work_type' => array_key_exists('work_type', $validated) ? trim((string) $validated['work_type']) : null,
            'contractor_start_date' => $validated['contractor_start_date'] ?? null,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        // Seed required docs (metadata rows)
        foreach (SubcontractorOpening::REQUIRED_DOCUMENTS as $doc) {
            SubcontractorOpeningDocument::firstOrCreate([
                'subcontractor_opening_id' => $opening->id,
                'document_key' => $doc['key'],
            ], [
                'document_label' => $doc['label'],
                'uploaded_by' => $user->id,
            ]);
        }

        $opening->load(['documents']);

        return $this->success($this->serializeOpening($opening), 'Opening created successfully', 201);
    }

    public function update(Request $request, SubcontractorOpening $subcontractorOpening)
    {
        $user = $request->user();
        $project = Project::findOrFail($subcontractorOpening->project_id);
        $this->ensureAccessToProject($request, $project);

        $validated = $request->validate([
            'contractor_name' => 'sometimes|string|max:255',
            'work_type' => 'nullable|string|max:255',
            'contractor_start_date' => 'nullable|date',
        ]);

        $data = [];
        if (array_key_exists('contractor_name', $validated)) {
            $data['contractor_name'] = trim($validated['contractor_name']);
        }
        if (array_key_exists('work_type', $validated)) {
            $data['work_type'] = $validated['work_type'] !== null ? trim((string) $validated['work_type']) : null;
        }
        if (array_key_exists('contractor_start_date', $validated)) {
            $data['contractor_start_date'] = $validated['contractor_start_date'];
        }

        $data['updated_by'] = $user->id;

        $subcontractorOpening->update($data);
        $subcontractorOpening->load(['documents']);

        return $this->success($this->serializeOpening($subcontractorOpening), 'Opening updated successfully');
    }

    public function destroy(Request $request, SubcontractorOpening $subcontractorOpening)
    {
        $project = Project::findOrFail($subcontractorOpening->project_id);
        $this->ensureAccessToProject($request, $project);

        // delete files
        $subcontractorOpening->load(['documents']);
        foreach ($subcontractorOpening->documents as $doc) {
            if ($doc->file_path) {
                Storage::disk('public')->delete($doc->file_path);
            }
        }

        $subcontractorOpening->delete();

        return $this->success(null, 'Opening deleted successfully');
    }

    public function uploadDocument(Request $request, SubcontractorOpening $subcontractorOpening)
    {
        $user = $request->user();
        $project = Project::findOrFail($subcontractorOpening->project_id);
        $this->ensureAccessToProject($request, $project);

        $validated = $request->validate([
            'document_key' => 'required|string|max:255',
            'document_label' => 'required|string|max:255',
            'start_date' => 'nullable|date',
            'expiry_date' => 'nullable|date|after_or_equal:start_date',
            'file' => 'required|file|mimes:pdf|max:51200',
        ]);

        $file = $request->file('file');
        $fileSize = $file->getSize();

        $document = SubcontractorOpeningDocument::firstOrCreate([
            'subcontractor_opening_id' => $subcontractorOpening->id,
            'document_key' => $validated['document_key'],
        ], [
            'document_label' => $validated['document_label'],
        ]);

        // Delete old file
        if ($document->file_path) {
            Storage::disk('public')->delete($document->file_path);
        }

        $document->document_label = $validated['document_label'];
        $document->start_date = $validated['start_date'] ?? null;
        $document->expiry_date = $validated['expiry_date'] ?? null;
        $document->uploaded_by = $user->id;
        $document->file_size = $fileSize;

        $baseDir = 'subcontractor_openings/' . $subcontractorOpening->id;
        $originalPath = $file->store($baseDir, 'public');

        $document->file_path = $originalPath;
        $document->was_compressed = false;
        $document->compressed_size = null;

        // Conditional compression if > 5MB
        $compressor = new PdfCompressionService();
        if ($compressor->isCompressionNeeded((int) $fileSize)) {
            $inputAbs = Storage::disk('public')->path($originalPath);
            $compressedRel = $baseDir . '/compressed_' . uniqid() . '.pdf';
            $compressedAbsTmp = Storage::disk('public')->path($compressedRel);

            $result = $compressor->compressToUnderLimit($inputAbs, $compressedAbsTmp, PdfCompressionService::TARGET_BYTES);

            if (($result['success'] ?? false) === true) {
                $outBytes = (int) ($result['output_bytes'] ?? 0);
                if ($outBytes > 0 && $outBytes < (int) $fileSize) {
                    Storage::disk('public')->delete($originalPath);
                    $document->file_path = $compressedRel;
                    $document->was_compressed = true;
                    $document->compressed_size = $outBytes;
                } else {
                    Storage::disk('public')->delete($compressedRel);
                }
            } else {
                if (Storage::disk('public')->exists($compressedRel)) {
                    Storage::disk('public')->delete($compressedRel);
                }
            }
        }

        $document->save();

        $subcontractorOpening->load(['documents']);

        $fresh = $document->fresh();

        return $this->success([
            'opening' => $this->serializeOpening($subcontractorOpening),
            'document' => $fresh ? $this->serializeDocument($subcontractorOpening, $fresh) : null,
        ], 'Document uploaded successfully');
    }

    public function viewDocument(
        Request $request,
        SubcontractorOpening $subcontractorOpening,
        SubcontractorOpeningDocument $document
    ) {
        $project = Project::findOrFail($subcontractorOpening->project_id);
        $this->ensureAccessToProject($request, $project);

        if ((int) $document->subcontractor_opening_id !== (int) $subcontractorOpening->id) {
            abort(404);
        }

        if (!$document->file_path || !Storage::disk('public')->exists($document->file_path)) {
            abort(404, 'File not found');
        }

        $path = $document->file_path;
        $filename = basename($path);

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
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    public function downloadDocument(
        Request $request,
        SubcontractorOpening $subcontractorOpening,
        SubcontractorOpeningDocument $document
    ) {
        $project = Project::findOrFail($subcontractorOpening->project_id);
        $this->ensureAccessToProject($request, $project);

        if ((int) $document->subcontractor_opening_id !== (int) $subcontractorOpening->id) {
            abort(404);
        }

        if (!$document->file_path || !Storage::disk('public')->exists($document->file_path)) {
            abort(404, 'File not found');
        }

        $path = $document->file_path;
        $filename = basename($path);

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
            'Content-Type' => 'application/pdf',
        ]);
    }
}
