<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="HSE KPI Tracking System - Monitor and manage Health, Safety & Environment metrics" />
    <title>HSE KPI Tracker - SGTM</title>
    
    <!-- DNS prefetch -->
    <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
    <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    
    <!-- Critical CSS inline for faster FCP -->
    <style>
      body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:#f9fafb;-webkit-font-smoothing:antialiased}
      #root{min-height:100vh}
      .loading-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%)}
      .loading-spinner{width:48px;height:48px;border:4px solid rgba(255,255,255,0.2);border-top-color:#f59e0b;border-radius:50%;animation:spin 1s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}
    </style>
    
    <!-- Defer font loading (no inline handlers to satisfy CSP) -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
    
    <link rel="icon" href="/favicon.ico" />
    
    <!-- Preload critical JS chunks -->
    <script type="module" crossorigin src="/assets/index.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-react.js" />
    <link rel="modulepreload" crossorigin href="/assets/vendor-ui.js" />
    <link rel="modulepreload" crossorigin href="/assets/vendor-utils.js" />
    <link rel="stylesheet" crossorigin href="/assets/index.css" />
  </head>
  <body class="bg-gray-50 antialiased">
    <div id="root">
      <div class="loading-screen">
        <div class="loading-spinner"></div>
      </div>
    </div>
  </body>
</html>
