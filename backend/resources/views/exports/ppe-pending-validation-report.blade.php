<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $labels['title'] ?? 'PPE Pending Validation Report' }}</title>
    <style>
        @page {
            margin: 24px 22px 34px 22px;
        }
        body {
            font-family: 'DejaVu Sans', 'Helvetica', Arial, sans-serif;
            font-size: 10px;
            line-height: 1.45;
            color: #111827;
            background: #ffffff;
        }

        .report-shell {
            width: 100%;
        }

        .hero {
            border: 2px solid #f97316;
            background: #ffffff;
            border-radius: 10px;
            padding: 14px 16px;
            position: relative;
            margin-bottom: 14px;
        }
        .hero-title {
            font-size: 16px;
            font-weight: 800;
            margin: 0;
            padding: 0;
            color: #2f3136;
        }
        .hero-sub {
            margin-top: 4px;
            font-size: 9px;
            color: #6b7280;
        }
        .meta-grid {
            margin-top: 10px;
            width: 100%;
            border-collapse: collapse;
        }
        .meta-grid td {
            border: 0;
            padding: 3px 0;
            vertical-align: top;
            font-size: 9.5px;
        }
        .meta-label {
            color: #6b7280;
            width: 28%;
            white-space: nowrap;
        }
        .meta-value {
            color: #111827;
            font-weight: 600;
        }

        .section-title {
            margin: 14px 0 8px;
            font-size: 11px;
            font-weight: 800;
            color: #2f3136;
            letter-spacing: 0.2px;
        }
        .section-title .accent {
            display: inline-block;
            width: 10px;
            height: 10px;
            background: #f97316;
            border-radius: 2px;
            margin-right: 6px;
            position: relative;
            top: 1px;
        }
        .section-note {
            margin: -2px 0 8px;
            font-size: 9px;
            color: #6b7280;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        th, td {
            border: 1px solid #e5e7eb;
            padding: 7px 7px;
            text-align: left;
            vertical-align: top;
        }
        th {
            background: #2f3136;
            color: #ffffff;
            font-weight: 800;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        tr:nth-child(even) {
            background: #f8fafc;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .muted { color: #6b7280; }
        .article-title {
            margin: 10px 0 6px;
            font-size: 10px;
            font-weight: 800;
            color: #2f3136;
        }

        .article-block {
            border: 2px solid #f97316;
            border-radius: 10px;
            padding: 10px 10px 2px 10px;
            margin: 10px 0 12px;
            page-break-inside: avoid;
        }
        .footer {
            position: fixed;
            bottom: -20px;
            left: 0;
            right: 0;
            height: 18px;
            font-size: 8px;
            color: #6b7280;
        }
        .footer .left {
            position: absolute;
            left: 0;
        }
        .footer .right {
            position: absolute;
            right: 0;
        }
        .footer .brand {
            color: #2f3136;
            font-weight: 700;
        }

        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    <div class="report-shell">
        <div class="hero">
            <h1 class="hero-title">{{ $labels['title'] ?? 'PPE Pending Validation Report' }}</h1>
            <div class="hero-sub">SGTM</div>

            <table class="meta-grid">
                <tr>
                    <td class="meta-label">{{ $labels['project'] ?? 'Project' }}</td>
                    <td class="meta-value">{{ $project['name'] ?? '' }}</td>
                    <td class="meta-label">{{ $labels['pole'] ?? 'Pole' }}</td>
                    <td class="meta-value">{{ $project['pole'] ?? '' }}</td>
                </tr>
                <tr>
                    <td class="meta-label">{{ $labels['hse_manager'] ?? 'HSE Manager' }}</td>
                    <td class="meta-value">{{ $project['hse_manager_name'] ?? '-' }} ({{ $project['hse_manager_email'] ?? '-' }})</td>
                    <td class="meta-label">{{ $labels['current_total_workers'] ?? 'Current Total Workers' }}</td>
                    <td class="meta-value">{{ $project['current_total_workers'] ?? 0 }}</td>
                </tr>
                <tr>
                    <td class="meta-label">{{ $labels['report_date'] ?? 'Report Date' }}</td>
                    <td class="meta-value">{{ $report_date ?? '' }}</td>
                    <td class="meta-label"></td>
                    <td class="meta-value"></td>
                </tr>
            </table>
        </div>

        <div class="section-title"><span class="accent"></span>{{ $labels['summary'] ?? 'Summary' }}</div>
    <table>
        <thead>
            <tr>
                <th style="width: 34%">{{ $labels['article'] ?? 'Article' }}</th>
                <th style="width: 16%" class="text-right">{{ $labels['current_stock'] ?? 'Current Stock' }}</th>
                <th style="width: 20%" class="text-right">{{ $labels['distributed_last_week'] ?? 'Distributed (Last Week)' }}</th>
                <th style="width: 20%" class="text-right">{{ $labels['distributed_last_month'] ?? 'Distributed (Last Month)' }}</th>
            </tr>
        </thead>
        <tbody>
            @forelse($rows as $r)
                <tr>
                    <td>{{ $r['article'] ?? $r['item_name'] ?? '' }}</td>
                    <td class="text-right">{{ $r['current_stock'] ?? 0 }}</td>
                    <td class="text-right">{{ $r['distributed_last_week'] ?? 0 }}</td>
                    <td class="text-right">{{ $r['distributed_last_month'] ?? 0 }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="4" class="muted">{{ $labels['no_data'] ?? 'No data' }}</td>
                </tr>
            @endforelse
        </tbody>
    </table>

        <div class="section-title"><span class="accent"></span>{{ $labels['workers_last_month'] ?? 'Worker Names (Last Month)' }}</div>
        <div class="section-note">{{ $labels['range'] ?? 'Range' }}: {{ $details_range['start'] ?? '' }} - {{ $details_range['end'] ?? '' }}</div>

    @forelse($details_by_item as $item)
        <div class="article-block">
            <div class="article-title">{{ $item['article'] ?? '' }}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 18%">{{ $labels['cin'] ?? 'CIN' }}</th>
                        <th style="width: 42%">{{ $labels['name'] ?? 'Name' }}</th>
                        <th style="width: 14%" class="text-right">{{ $labels['quantity'] ?? 'Quantity' }}</th>
                        <th style="width: 26%">{{ $labels['date'] ?? 'Date' }}</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse(($item['rows'] ?? []) as $d)
                        <tr>
                            <td>{{ $d['cin'] ?? '' }}</td>
                            <td>{{ $d['name'] ?? '' }}</td>
                            <td class="text-right">{{ $d['quantity'] ?? 0 }}</td>
                            <td>{{ $d['date'] ?? '' }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4" class="muted">{{ $labels['no_distributions'] ?? 'No distributions found' }}</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    @empty
        <div class="muted">{{ $labels['no_data'] ?? 'No data' }}</div>
    @endforelse

        <div class="footer">
            <div class="left"><span class="brand">SGTM</span> - {{ $labels['title'] ?? 'PPE Pending Validation Report' }}</div>
            <div class="right"></div>
        </div>
    </div>
</body>
</html>
