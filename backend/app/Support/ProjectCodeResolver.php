<?php

namespace App\Support;

use App\Models\Project;
use App\Models\ProjectCodeAlias;

class ProjectCodeResolver
{
    public static function resolveProjectId(string $code): ?int
    {
        $normalized = strtoupper(trim($code));
        if ($normalized === '') {
            return null;
        }

        $id = Project::query()->where('code', $normalized)->value('id');
        if ($id) {
            return (int) $id;
        }

        $aliasProjectId = ProjectCodeAlias::query()->where('code', $normalized)->value('project_id');
        if ($aliasProjectId) {
            return (int) $aliasProjectId;
        }

        return null;
    }

    public static function resolveProject(string $code): ?Project
    {
        $id = self::resolveProjectId($code);
        if (!$id) {
            return null;
        }

        return Project::query()->find($id);
    }
}
