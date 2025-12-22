<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>HSE KPI Report</title>
    <style>
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 10px;
            line-height: 1.4;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #1e40af;
            padding-bottom: 10px;
        }
        .header h1 {
            color: #1e40af;
            margin: 0;
            font-size: 18px;
        }
        .header p {
            margin: 5px 0;
            color: #666;
        }
        .summary-box {
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .summary-grid {
            display: table;
            width: 100%;
        }
        .summary-item {
            display: table-cell;
            width: 16.66%;
            text-align: center;
            padding: 5px;
        }
        .summary-value {
            font-size: 16px;
            font-weight: bold;
            color: #1e40af;
        }
        .summary-label {
            font-size: 9px;
            color: #666;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
        }
        th {
            background: #1e40af;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background: #f9fafb;
        }
        .footer {
            position: fixed;
            bottom: 0;
            width: 100%;
            text-align: center;
            font-size: 8px;
            color: #999;
            border-top: 1px solid #ddd;
            padding-top: 5px;
        }
        .danger { color: #dc2626; }
        .warning { color: #f59e0b; }
        .success { color: #16a34a; }
    </style>
</head>
<body>
    <div class="header">
        <h1>HSE KPI Report</h1>
        @if($project)
            <p><strong>Project:</strong> {{ $project->name }} ({{ $project->code }})</p>
        @endif
        <p><strong>Period:</strong> {{ $year }}</p>
        <p><strong>Generated:</strong> {{ $generated_at }} by {{ $generated_by }}</p>
    </div>

    <div class="summary-box">
        <h3 style="margin-top: 0;">Summary</h3>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-value {{ $summary['total_accidents'] > 0 ? 'danger' : 'success' }}">
                    {{ $summary['total_accidents'] }}
                </div>
                <div class="summary-label">Total Accidents</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">{{ $summary['total_trainings'] }}</div>
                <div class="summary-label">Trainings</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">{{ $summary['total_inspections'] }}</div>
                <div class="summary-label">Inspections</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">{{ number_format($summary['total_hours']) }}</div>
                <div class="summary-label">Hours Worked</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">{{ $summary['avg_tf'] }}</div>
                <div class="summary-label">Avg TF Rate</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">{{ $summary['avg_tg'] }}</div>
                <div class="summary-label">Avg TG Rate</div>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Project</th>
                <th>Month/Year</th>
                <th>Accidents</th>
                <th>Trainings</th>
                <th>Inspections</th>
                <th>Hours</th>
                <th>TF</th>
                <th>TG</th>
            </tr>
        </thead>
        <tbody>
            @foreach($reports as $report)
            <tr>
                <td>{{ $report->project->name ?? 'N/A' }}</td>
                <td>{{ $report->report_month }}/{{ $report->report_year }}</td>
                <td class="{{ $report->accidents > 0 ? 'danger' : '' }}">{{ $report->accidents }}</td>
                <td>{{ $report->trainings_conducted }}</td>
                <td>{{ $report->inspections_completed }}</td>
                <td>{{ number_format($report->hours_worked) }}</td>
                <td>{{ number_format($report->tf_value, 4) }}</td>
                <td>{{ number_format($report->tg_value, 4) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        HSE KPI Tracking System - Confidential Report - Page {PAGE_NUM} of {PAGE_COUNT}
    </div>
</body>
</html>
