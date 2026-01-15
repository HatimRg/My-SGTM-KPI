<?php

return [
    'roles' => [
        'admin' => [
            'admin_routes' => true,
            'project_scope' => 'all',
        ],
        'consultation' => [
            'admin_routes' => true,
            'project_scope' => 'all',
        ],
        'dev' => [
            'admin_routes' => true,
            'project_scope' => 'all',
        ],
        'hse_director' => [
            'admin_routes' => true,
            'project_scope' => 'all',
        ],
        'hr_director' => [
            'admin_routes' => true,
            'project_scope' => 'all',
        ],
        'pole_director' => [
            'admin_routes' => true,
            'project_scope' => 'pole',
        ],
        'works_director' => [
            'admin_routes' => true,
            'project_scope' => 'assigned',
        ],
        'hse_manager' => [
            'admin_routes' => false,
            'project_scope' => 'assigned',
        ],
        'regional_hse_manager' => [
            'admin_routes' => false,
            'project_scope' => 'pole',
        ],
        'responsable' => [
            'admin_routes' => false,
            'project_scope' => 'assigned',
        ],
        'supervisor' => [
            'admin_routes' => false,
            'project_scope' => 'assigned',
        ],
        'user' => [
            'admin_routes' => false,
            'project_scope' => 'assigned',
        ],
        'hr' => [
            'admin_routes' => false,
            'project_scope' => 'assigned',
        ],
    ],
];
