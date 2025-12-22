<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>HSE KPI Report {{ $year }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 10px;
            line-height: 1.5;
            color: #1f2937;
            background: #ffffff;
        }
        
        /* Cover Page */
        .cover-page {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            page-break-after: always;
        }
        .cover-logo {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .cover-subtitle {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 40px;
        }
        .cover-title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .cover-year {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 40px;
        }
        .cover-meta {
            font-size: 11px;
            opacity: 0.8;
        }
        
        /* Page Header */
        .page-header {
            background: #1e40af;
            color: white;
            padding: 15px 20px;
            margin: -20px -20px 20px -20px;
        }
        .page-header h1 {
            font-size: 16px;
            margin: 0;
        }
        .page-header .meta {
            font-size: 9px;
            opacity: 0.8;
        }
        
        /* Content */
        .content {
            padding: 20px;
        }
        
        /* Section */
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #1e40af;
            border-bottom: 2px solid #1e40af;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        
        /* Stats Grid */
        .stats-grid {
            display: table;
            width: 100%;
            margin-bottom: 20px;
        }
        .stats-row {
            display: table-row;
        }
        .stat-card {
            display: table-cell;
            width: 25%;
            padding: 10px;
            text-align: center;
            border: 1px solid #e5e7eb;
            background: #f9fafb;
        }
        .stat-value {
            font-size: 20px;
            font-weight: bold;
            color: #1e40af;
        }
        .stat-value.danger { color: #dc2626; }
        .stat-value.success { color: #059669; }
        .stat-value.warning { color: #d97706; }
        .stat-label {
            font-size: 9px;
            color: #6b7280;
            margin-top: 3px;
        }
        
        /* Summary Cards */
        .summary-cards {
            display: table;
            width: 100%;
        }
        .summary-card {
            display: table-cell;
            width: 33.33%;
            padding: 12px;
            vertical-align: top;
        }
        .summary-card-inner {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 12px;
            background: #ffffff;
        }
        .summary-card-title {
            font-size: 11px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e5e7eb;
        }
        .summary-card-item {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 9px;
        }
        .summary-card-label { color: #6b7280; }
        .summary-card-value { font-weight: bold; color: #1f2937; }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 9px;
        }
        th, td {
            padding: 8px 6px;
            text-align: left;
            border: 1px solid #e5e7eb;
        }
        th {
            background: #1e40af;
            color: white;
            font-weight: bold;
            font-size: 8px;
            text-transform: uppercase;
        }
        tr:nth-child(even) {
            background: #f9fafb;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        /* Colors */
        .text-danger { color: #dc2626; }
        .text-success { color: #059669; }
        .text-warning { color: #d97706; }
        .text-primary { color: #1e40af; }
        
        /* Badge */
        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 8px;
            font-weight: bold;
        }
        .badge-success { background: #d1fae5; color: #059669; }
        .badge-danger { background: #fee2e2; color: #dc2626; }
        .badge-warning { background: #fef3c7; color: #d97706; }
        
        /* Page Break */
        .page-break {
            page-break-before: always;
        }
        
        /* Footer */
        .footer {
            position: fixed;
            bottom: 10px;
            left: 20px;
            right: 20px;
            text-align: center;
            font-size: 8px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 8px;
        }
        
        /* Trend Box */
        .trend-box {
            display: table;
            width: 100%;
            margin-bottom: 15px;
        }
        .trend-item {
            display: table-cell;
            padding: 8px;
            text-align: center;
            border: 1px solid #e5e7eb;
            background: #f9fafb;
        }
        .trend-week { font-size: 8px; color: #6b7280; }
        .trend-value { font-size: 11px; font-weight: bold; }
    </style>
</head>
<body>
    {{-- Cover Page --}}
    <div class="cover-page">
        <div class="cover-logo">SGTM</div>
        <div class="cover-subtitle">Health, Safety & Environment</div>
        <div class="cover-title">HSE KPI Annual Report</div>
        <div class="cover-year">{{ $year }}</div>
        @if($project)
            <div style="font-size: 14px; margin-bottom: 20px;">{{ $project->name }}</div>
        @endif
        <div class="cover-meta">
            Generated: {{ $generated_at }}<br>
            By: {{ $generated_by }}
        </div>
    </div>

    {{-- Executive Summary Page --}}
    <div class="content">
        <div class="page-header">
            <h1>Executive Summary</h1>
            <div class="meta">HSE KPI Report {{ $year }} @if($project)| {{ $project->name }}@endif</div>
        </div>

        {{-- Overview Stats --}}
        <div class="section">
            <div class="section-title">Overview</div>
            <div class="stats-grid">
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-value">{{ $summary['total_reports'] }}</div>
                        <div class="stat-label">Total Reports</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ $summary['weeks_reported'] }}</div>
                        <div class="stat-label">Weeks Reported</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ $stats['total_projects'] }}</div>
                        <div class="stat-label">Active Projects</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ number_format($summary['total_hours']) }}</div>
                        <div class="stat-label">Hours Worked</div>
                    </div>
                </div>
            </div>
        </div>

        {{-- Key Metrics --}}
        <div class="section">
            <div class="section-title">Key Safety Metrics</div>
            <div class="stats-grid">
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-value {{ $summary['total_accidents'] > 0 ? 'danger' : 'success' }}">
                            {{ $summary['total_accidents'] }}
                        </div>
                        <div class="stat-label">Total Accidents</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value {{ $summary['fatal_accidents'] > 0 ? 'danger' : 'success' }}">
                            {{ $summary['fatal_accidents'] }}
                        </div>
                        <div class="stat-label">Fatal Accidents</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value warning">{{ $summary['near_misses'] }}</div>
                        <div class="stat-label">Near Misses</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ $summary['lost_workdays'] }}</div>
                        <div class="stat-label">Lost Workdays</div>
                    </div>
                </div>
            </div>
        </div>

        {{-- Summary Cards --}}
        <div class="section">
            <div class="summary-cards">
                {{-- Safety Card --}}
                <div class="summary-card">
                    <div class="summary-card-inner">
                        <div class="summary-card-title">🛡️ Safety</div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Serious Accidents</span>
                            <span class="summary-card-value">{{ $summary['serious_accidents'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Minor Accidents</span>
                            <span class="summary-card-value">{{ $summary['minor_accidents'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">First Aid Cases</span>
                            <span class="summary-card-value">{{ $summary['first_aid'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">TF Rate (avg)</span>
                            <span class="summary-card-value">{{ $summary['avg_tf'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">TG Rate (avg)</span>
                            <span class="summary-card-value">{{ $summary['avg_tg'] }}</span>
                        </div>
                    </div>
                </div>

                {{-- Training Card --}}
                <div class="summary-card">
                    <div class="summary-card-inner">
                        <div class="summary-card-title">📚 Training</div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Trainings Conducted</span>
                            <span class="summary-card-value">{{ $summary['total_trainings'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Trainings Planned</span>
                            <span class="summary-card-value">{{ $summary['trainings_planned'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Employees Trained</span>
                            <span class="summary-card-value">{{ $summary['employees_trained'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Training Hours</span>
                            <span class="summary-card-value">{{ number_format($summary['training_hours']) }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Toolbox Talks</span>
                            <span class="summary-card-value">{{ $summary['toolbox_talks'] }}</span>
                        </div>
                    </div>
                </div>

                {{-- Inspections Card --}}
                <div class="summary-card">
                    <div class="summary-card-inner">
                        <div class="summary-card-title">🔍 Inspections</div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Completed</span>
                            <span class="summary-card-value">{{ $summary['total_inspections'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Planned</span>
                            <span class="summary-card-value">{{ $summary['inspections_planned'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Findings Open</span>
                            <span class="summary-card-value text-warning">{{ $summary['findings_open'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Findings Closed</span>
                            <span class="summary-card-value text-success">{{ $summary['findings_closed'] }}</span>
                        </div>
                        <div class="summary-card-item">
                            <span class="summary-card-label">Corrective Actions</span>
                            <span class="summary-card-value">{{ $summary['corrective_actions'] }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {{-- Compliance & Resources --}}
        <div class="section">
            <div class="section-title">Compliance & Resources</div>
            <div class="stats-grid">
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-value success">{{ $summary['avg_hse_compliance'] }}%</div>
                        <div class="stat-label">HSE Compliance</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ $summary['avg_medical_compliance'] }}%</div>
                        <div class="stat-label">Medical Compliance</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ number_format($summary['water_consumption']) }}</div>
                        <div class="stat-label">Water (m³)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ number_format($summary['electricity_consumption']) }}</div>
                        <div class="stat-label">Electricity (kWh)</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {{-- Project Breakdown Page --}}
    <div class="page-break"></div>
    <div class="content">
        <div class="page-header">
            <h1>Project Performance</h1>
            <div class="meta">HSE KPI Report {{ $year }}</div>
        </div>

        <div class="section">
            <div class="section-title">Performance by Project</div>
            <table>
                <thead>
                    <tr>
                        <th>Project</th>
                        <th>Code</th>
                        <th class="text-center">Reports</th>
                        <th class="text-center">Accidents</th>
                        <th class="text-center">Trainings</th>
                        <th class="text-center">Inspections</th>
                        <th class="text-center">TF Rate</th>
                        <th class="text-center">TG Rate</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($project_breakdown as $proj)
                    <tr>
                        <td>{{ $proj['name'] }}</td>
                        <td>{{ $proj['code'] }}</td>
                        <td class="text-center">{{ $proj['reports'] }}</td>
                        <td class="text-center {{ $proj['accidents'] > 0 ? 'text-danger' : '' }}">{{ $proj['accidents'] }}</td>
                        <td class="text-center">{{ $proj['trainings'] }}</td>
                        <td class="text-center">{{ $proj['inspections'] }}</td>
                        <td class="text-center">{{ $proj['avg_tf'] }}</td>
                        <td class="text-center">{{ $proj['avg_tg'] }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        {{-- Weekly Trends --}}
        <div class="section">
            <div class="section-title">Weekly Trends Overview</div>
            <table>
                <thead>
                    <tr>
                        <th>Week</th>
                        <th class="text-center">Accidents</th>
                        <th class="text-center">Trainings</th>
                        <th class="text-center">Inspections</th>
                        <th class="text-center">TF Rate</th>
                        <th class="text-center">TG Rate</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($weekly_trends as $trend)
                    <tr>
                        <td>S{{ $trend['week'] }}</td>
                        <td class="text-center {{ $trend['accidents'] > 0 ? 'text-danger' : '' }}">{{ $trend['accidents'] }}</td>
                        <td class="text-center">{{ $trend['trainings'] }}</td>
                        <td class="text-center">{{ $trend['inspections'] }}</td>
                        <td class="text-center">{{ $trend['tf'] }}</td>
                        <td class="text-center">{{ $trend['tg'] }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>

    {{-- Detailed Reports Page --}}
    @if($reports->count() <= 50)
    <div class="page-break"></div>
    <div class="content">
        <div class="page-header">
            <h1>Detailed Reports</h1>
            <div class="meta">HSE KPI Report {{ $year }} | {{ $reports->count() }} reports</div>
        </div>

        <div class="section">
            <table>
                <thead>
                    <tr>
                        <th>Week</th>
                        <th>Project</th>
                        <th class="text-center">Accidents</th>
                        <th class="text-center">Near Miss</th>
                        <th class="text-center">Training</th>
                        <th class="text-center">Inspect.</th>
                        <th class="text-right">Hours</th>
                        <th class="text-center">TF</th>
                        <th class="text-center">TG</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($reports as $report)
                    <tr>
                        <td>S{{ $report->week_number }}</td>
                        <td>{{ $report->project->code ?? 'N/A' }}</td>
                        <td class="text-center {{ $report->accidents > 0 ? 'text-danger' : '' }}">{{ $report->accidents }}</td>
                        <td class="text-center">{{ $report->near_misses }}</td>
                        <td class="text-center">{{ $report->trainings_conducted }}</td>
                        <td class="text-center">{{ $report->inspections_completed }}</td>
                        <td class="text-right">{{ number_format($report->hours_worked) }}</td>
                        <td class="text-center">{{ number_format($report->tf_value, 2) }}</td>
                        <td class="text-center">{{ number_format($report->tg_value, 4) }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
    @endif

    <div class="footer">
        HSE KPI Tracking System | SGTM | Confidential Report | Generated {{ $generated_at }}
    </div>
</body>
</html>
