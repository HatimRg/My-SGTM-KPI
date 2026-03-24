<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#E59A2F">
    <title>{{ $document->title ?? 'Fiche de Données de Sécurité' }} - MySafeKPI</title>
    <style>
        :root{--bg:#0B1220;--panel:#3D3D3D;--muted:rgba(255,255,255,.72);--text:#FFFFFF;--border:rgba(255,255,255,.14);--accent:#E59A2F;--accent2:#F5B24D}
        html,body{height:100%}
        body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Inter,Arial}
        .page{min-height:100%;display:flex;flex-direction:column}
        .topbar{position:sticky;top:0;z-index:10;background:rgba(61,61,61,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
        .topbar-inner{max-width:1080px;margin:0 auto;padding:12px 14px;display:flex;gap:12px;align-items:center;justify-content:space-between}
        .brand{display:flex;align-items:center;gap:10px;min-width:0}
        .logo{width:44px;height:44px;display:block;flex:0 0 auto}
        .logo img{width:44px;height:44px;object-fit:contain;display:block}
        .doc{min-width:0;display:flex;flex-direction:column}
        .title{font-weight:700;font-size:15px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .subtitle{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}
        .btn{appearance:none;border:1px solid var(--border);background:rgba(255,255,255,.06);color:var(--text);padding:10px 12px;border-radius:12px;font-weight:600;font-size:14px;display:inline-flex;align-items:center;gap:8px;text-decoration:none}
        .btn-primary{background:var(--accent);border-color:rgba(255,255,255,.12);color:#1b1b1b}
        .btn-ghost{background:transparent}
        .btn:active{transform:translateY(1px)}
        .content{flex:1;display:flex}
        .viewer-wrap{max-width:1080px;margin:0 auto;padding:12px 0 0;width:100%;display:flex;flex:1}
        .viewer{width:100%;border:0;flex:1;background:#0F172A}
        .pdf-object{width:100%;height:100%;border:0;display:block}
        .hint{max-width:1080px;margin:0 auto;padding:0 14px 14px;color:var(--muted);font-size:12px}
        .fallback{max-width:1080px;margin:0 auto;padding:12px 14px 16px;color:var(--muted);font-size:13px}
        .fallback a{color:var(--accent);text-decoration:none;font-weight:700}
        .quick-actions{max-width:1080px;margin:0 auto;padding:10px 14px 14px;display:flex;gap:10px;flex-wrap:wrap}
        .quick-actions a{color:#1b1b1b;text-decoration:none;border:1px solid rgba(255,255,255,.12);background:var(--accent);padding:12px 14px;border-radius:14px;font-weight:800;font-size:15px;display:inline-flex;align-items:center;gap:10px}
        @media (max-width:640px){
            .topbar-inner{padding:10px 12px}
            .btn span{display:none}
            .btn{padding:10px}
        }
    </style>
</head>
<body>
    <div class="page">
        <header class="topbar">
            <div class="topbar-inner">
                <div class="brand">
                    <div class="logo" aria-hidden="true">
                        <img src="/assets/App_Logo.png" alt="MySafeKPI" onerror="this.onerror=null;this.src='/assets/SGTM_Logo.jpg';" />
                    </div>
                    <div class="doc">
                        <div class="title">{{ $document->title ?? 'Fiche de Données de Sécurité' }}</div>
                        <div class="subtitle">{{ $document->original_name }}</div>
                    </div>
                </div>

                <div class="actions">
                    <a class="btn btn-primary" href="/api/public/sds/{{ $token }}/download">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M12 3v12m0 0 4-4m-4 4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <span>Télécharger</span>
                    </a>
                </div>
            </div>
        </header>

        <div class="hint">
            Astuce : tu peux zoomer dans le PDF avec les gestes du téléphone.
        </div>

        <main class="content">
            <div class="viewer-wrap">
                <iframe class="viewer" title="SDS PDF" src="/api/public/sds/{{ $token }}/raw#toolbar=1&navpanes=0&view=FitH"></iframe>
            </div>
        </main>

        <div class="quick-actions">
            <a href="/api/public/sds/{{ $token }}/download">Télécharger</a>
        </div>
    </div>
</body>
</html>
