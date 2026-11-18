export function getWebManagerHtml(serverName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(serverName)} - Smaran HFS</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='20' cy='32' r='7' fill='%23eaeaea'/%3E%3Ccircle cx='32' cy='32' r='7' fill='%23e06c43'/%3E%3Ccircle cx='44' cy='32' r='7' fill='%23f59f00'/%3E%3C/svg%3E">
  <style>
    :root {
      --bg: #121214;
      --card: #1b1b1e;
      --card-hover: #232328;
      --line: #2e2e33;
      --text: #eaeaea;
      --muted: #96969e;
      --faint: #63636c;
      --accent: #e06c43;
      --accent-hover: #f07b51;
      --accent-soft: rgba(224, 108, 67, 0.15);
      --danger: #ef4444;
      --ok: #22c55e;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--card);
      border-bottom: 1px solid var(--line);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      font-size: 16px;
      color: var(--text);
    }
    .smaran-brand-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      user-select: none;
      flex-shrink: 0;
    }
    .smaran-brand-logo:hover {
      background: rgba(224, 108, 67, 0.12);
      border-color: rgba(224, 108, 67, 0.35);
      transform: scale(1.06);
    }
    .smaran-brand-logo:active {
      transform: scale(0.94);
    }
    .badge {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 500;
    }
    .context-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--line);
      font-size: 11.5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: var(--muted);
      user-select: all;
    }
    .context-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 6px var(--ok);
      flex-shrink: 0;
    }
    .session-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 5px 10px;
      cursor: pointer;
    }
    .session-badge:hover {
      border-color: var(--muted);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    button, .btn {
      background: var(--card);
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 7px 12px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
      text-decoration: none;
    }
    button:hover, .btn:hover { background: var(--card-hover); border-color: var(--muted); }
    button.primary, .btn.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    button.primary:hover, .btn.primary:hover { background: var(--accent-hover); }
    button.danger { color: var(--danger); }
    button.danger:hover { background: rgba(239, 68, 68, 0.1); border-color: var(--danger); }
    button.icon-only { padding: 7px 9px; }
    main {
      flex: 1;
      padding: 20px 24px 80px 24px;
      max-width: 1240px;
      width: 100%;
      margin: 0 auto;
    }
    .nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      font-size: 14px;
    }
    .crumb {
      color: var(--muted);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      transition: color 0.15s;
    }
    .crumb:hover { color: var(--text); background: var(--card); }
    .crumb.current { color: var(--text); font-weight: 600; cursor: default; }
    .nav-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .search-box {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 6px 12px;
      color: var(--text);
      font-size: 13px;
      outline: none;
      width: 200px;
      transition: border-color 0.15s;
    }
    .search-box:focus { border-color: var(--accent); }
    .view-toggle {
      display: flex;
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
    }
    .view-toggle button {
      border: none;
      border-radius: 0;
      padding: 6px 10px;
      background: var(--card);
    }
    .view-toggle button.active {
      background: var(--accent);
      color: #fff;
    }
    .dropzone {
      border: 2px dashed var(--line);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      margin-bottom: 20px;
      transition: all 0.2s;
      cursor: pointer;
    }
    .dropzone.dragover {
      border-color: var(--accent);
      background: var(--accent-soft);
    }
    .folder-drop-hover {
      outline: 2px dashed var(--accent) !important;
      outline-offset: -2px;
      background: rgba(224, 108, 67, 0.16) !important;
      transition: all 0.15s ease;
    }
    .file-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    .file-table th {
      text-align: left;
      padding: 10px 16px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      border-bottom: 1px solid var(--line);
      background: rgba(0, 0, 0, 0.2);
    }
    .file-table td {
      padding: 11px 16px;
      border-bottom: 1px solid var(--line);
    }
    .file-table tr:last-child td { border-bottom: none; }
    .file-table tr:hover td { background: var(--card-hover); }
    .file-table tr.selected td { background: rgba(224, 108, 67, 0.08); }
    .file-name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 500;
      cursor: pointer;
    }
    .file-name-cell .name-wrap {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .file-comment {
      font-size: 11px;
      color: var(--muted);
      font-style: italic;
    }
    .file-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      color: var(--muted);
    }
    .folder-icon { color: var(--accent); }
    .file-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 5px;
      flex-wrap: wrap;
    }
    .action-btn {
      padding: 4px 7px;
      font-size: 12px;
    }
    .file-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 14px;
    }
    .grid-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: pointer;
      position: relative;
      transition: all 0.15s;
    }
    .grid-card:hover {
      background: var(--card-hover);
      border-color: var(--muted);
      transform: translateY(-1px);
    }
    .grid-card.selected {
      border-color: var(--accent);
      background: rgba(224, 108, 67, 0.08);
    }
    .grid-card .card-thumb {
      height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }
    .grid-card .card-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .grid-card .card-thumb svg {
      width: 42px;
      height: 42px;
    }
    .grid-card .card-title {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .grid-card .card-meta {
      font-size: 11px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
    }
    .grid-card .card-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 4px;
    }
    .grid-checkbox {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 2;
    }
    .batch-dock {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--card);
      border: 1px solid var(--accent);
      padding: 10px 18px;
      border-radius: 999px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 50;
      animation: slideUp 0.2s ease-out;
    }
    @keyframes slideUp {
      from { transform: translate(-50%, 20px); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    .upload-dock {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 320px;
      background: #18181b;
      border: 1px solid var(--accent);
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7);
      z-index: 120;
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: smaranModalIn 0.2s ease-out;
    }
    .upload-dock-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text);
    }
    .upload-dock-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    }
    .upload-dock-bar {
      height: 6px;
      background: var(--line);
      border-radius: 999px;
      overflow: hidden;
    }
    .upload-dock-fill {
      height: 100%;
      background: var(--accent);
      width: 0%;
      transition: width 0.15s ease;
    }
    @keyframes smaranModalIn {
      from { opacity: 0; transform: scale(0.95) translateY(6px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes smaranFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes smaranShake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-5px); }
      40%, 80% { transform: translateX(5px); }
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 150;
      padding: 20px;
      animation: smaranFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .modal-box {
      background: #18181b;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 24px;
      width: 92%;
      max-width: 460px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
      animation: smaranModalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .modal-box.large {
      max-width: 960px;
      width: 95%;
    }
    .modal-title {
      font-family: Georgia, Cambria, "Times New Roman", Times, serif;
      font-size: 19px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      letter-spacing: -0.01em;
    }
    .modal-message {
      font-size: 13.5px;
      color: var(--muted);
      line-height: 1.55;
      margin-bottom: 16px;
    }
    .modal-input {
      width: 100%;
      background: #121214;
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--text);
      padding: 9px 12px;
      font-size: 13.5px;
      font-family: inherit;
      outline: none;
      transition: all 0.15s ease;
      margin-bottom: 16px;
      box-sizing: border-box;
    }
    .modal-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-soft);
    }
    .modal-body { margin-bottom: 20px; }
    .modal-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
    .login-error-alert {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12.5px;
      margin-bottom: 14px;
      animation: smaranShake 0.4s ease;
    }
    .st-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin: 16px 0;
    }
    @media (min-width: 600px) {
      .st-grid { grid-template-columns: repeat(4, 1fr); }
    }
    .st-tile {
      background: #121214;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .st-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 500; }
    .st-value { font-size: 18px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, monospace; margin-top: 4px; color: var(--text); }
    .admin-nav {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 16px;
      padding-bottom: 6px;
      overflow-x: auto;
    }
    .admin-nav-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--muted);
      cursor: pointer;
      white-space: nowrap;
    }
    .admin-nav-btn.active {
      background: rgba(224, 108, 67, 0.15);
      color: var(--accent);
    }
    .admin-pane { display: none; }
    .admin-pane.active { display: block; }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .admin-table th, .admin-table td {
      padding: 9px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
    }
    .admin-table th { color: var(--muted); font-size: 11px; text-transform: uppercase; }
    .lightbox-img-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      max-height: 72vh;
      overflow: hidden;
      background: #0a0a0c;
      border-radius: 8px;
      position: relative;
    }
    .lightbox-img {
      max-width: 100%;
      max-height: 72vh;
      object-fit: contain;
      transition: transform 0.2s ease;
    }
    .lightbox-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
    }
    pre.code-view {
      background: #0d0d0f;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 14px;
      color: #d1d5db;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      max-height: 65vh;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .toast {
      position: fixed;
      bottom: 24px;
      left: 24px;
      background: var(--card);
      border: 1px solid var(--accent);
      padding: 10px 16px;
      border-radius: 8px;
      box-shadow: 0 10px 25px -3px rgba(0,0,0,0.6);
      z-index: 200;
      font-size: 13px;
      animation: smaranFadeIn 0.2s ease;
    }
    .empty-state {
      padding: 48px 16px;
      text-align: center;
      color: var(--muted);
    }
    @media (max-width: 768px) {
      .hide-mobile { display: none !important; }
      header { padding: 10px 14px; }
      main { padding: 14px 14px 80px 14px; }
      .search-box { width: 130px; }
      .batch-dock { width: 92%; justify-content: space-between; }
      .upload-dock { width: 90%; right: 5%; left: 5%; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="smaran-brand-logo" id="smaran-brand-dots" title="Smaran"></div>
      <span>${escapeHtml(serverName)}</span>
      <span class="badge hide-mobile">LAN File Server</span>
      <div id="context-pill" class="context-pill" title="Client Context Identity">
        <span class="context-dot"></span>
        <span id="context-label">Loading...</span>
      </div>
    </div>
    <div class="toolbar">
      <button onclick="showSpeedTestModal()" title="Network & LAN Data Transfer Benchmark">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span class="hide-mobile">Speed Test</span>
      </button>
      <button id="btn-admin-panel" style="display:none;" onclick="showAdminModal()" title="File Server Administration Panel">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span class="hide-mobile">Admin Panel</span>
      </button>
      <button class="primary" id="btn-upload" onclick="triggerFileInput()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Upload</span>
      </button>
      <button onclick="promptNewFolder()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
        <span class="hide-mobile">New Folder</span>
      </button>
      <button onclick="downloadCurrentFolderZip()" title="Download current folder as ZIP">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        <span class="hide-mobile">Folder ZIP</span>
      </button>
      <button onclick="showWebDavHelp()" title="Mount as Windows Network Drive">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <span class="hide-mobile">WebDAV</span>
      </button>
      <button id="btn-session" class="session-badge" onclick="showSessionMenu()" title="User Account & Session">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span id="session-username">Sign In</span>
      </button>
      <button onclick="loadFiles()" class="icon-only" title="Refresh">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
      </button>
      <input type="file" id="file-input" multiple style="display:none" onchange="handleFileSelect(this.files)">
    </div>
  </header>

  <main>
    <div class="nav-bar">
      <div class="breadcrumbs" id="breadcrumbs"></div>
      <div class="nav-controls">
        <input type="text" class="search-box" id="search-input" placeholder="Filter files..." oninput="filterFiles()">
        <div class="view-toggle">
          <button id="btn-list-view" class="active" onclick="setViewMode('list')" title="List View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button id="btn-grid-view" onclick="setViewMode('grid')" title="Grid View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div class="dropzone" id="dropzone" onclick="triggerFileInput()">
      <p style="font-weight: 500;">Drag and drop files anywhere (or onto a folder) to upload</p>
      <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">or click here to browse files</p>
    </div>

    <!-- Table View -->
    <table class="file-table" id="file-table">
      <thead>
        <tr>
          <th style="width: 32px;"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></th>
          <th>Name</th>
          <th class="hide-mobile">Size</th>
          <th class="hide-mobile">Modified</th>
          <th style="text-align: right; min-width: 220px;">Actions</th>
        </tr>
      </thead>
      <tbody id="file-list"></tbody>
    </table>

    <!-- Grid View -->
    <div class="file-grid" id="file-grid" style="display:none;"></div>
  </main>

  <!-- Floating Batch Action Dock -->
  <div class="batch-dock" id="batch-dock" style="display:none;">
    <span id="batch-count" style="font-weight:600; font-size:13px;">0 items</span>
    <button class="primary" onclick="downloadSelectedZip()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
      Download ZIP
    </button>
    <button class="danger" onclick="deleteSelected()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      Delete
    </button>
    <button onclick="clearSelection()" class="icon-only" title="Clear selection">✕</button>
  </div>

  <!-- Floating Upload Progress Dock -->
  <div class="upload-dock" id="upload-dock" style="display:none;">
    <div class="upload-dock-header">
      <span id="upload-dock-filename" style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Uploading...</span>
      <span id="upload-dock-pct" style="color:var(--accent);">0%</span>
    </div>
    <div class="upload-dock-bar">
      <div class="upload-dock-fill" id="upload-dock-fill"></div>
    </div>
    <div class="upload-dock-meta">
      <span id="upload-dock-speed">0.0 MB/s</span>
      <span id="upload-dock-eta">ETA: --</span>
    </div>
  </div>

  <div id="modal-container"></div>
  <div id="toast-container"></div>

  <script>
    let currentPath = '';
    let allItems = [];
    let selectedPaths = new Set();
    let viewMode = 'list';
    let lightboxIndex = 0;
    let imageFiles = [];
    let zoomLevel = 1;
    let rotation = 0;
    let currentUser = null;
    let clientIp = '127.0.0.1';
    let activeUploadCount = 0;
    let idleSeconds = 0;
    const SESSION_MAX_IDLE = 15 * 60; // 15 minutes

    function escapeHtml(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatDate(iso) {
      if (!iso) return '-';
      const d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function showToast(msg, duration = 3000) {
      const tc = document.getElementById('toast-container');
      const div = document.createElement('div');
      div.className = 'toast';
      div.innerText = msg;
      tc.appendChild(div);
      setTimeout(() => div.remove(), duration);
    }

    /* Client Inactivity & Session Monitor */
    function resetIdleTimer() {
      idleSeconds = 0;
    }
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, resetIdleTimer, { passive: true });
    });

    setInterval(() => {
      idleSeconds++;
      if (idleSeconds === SESSION_MAX_IDLE - 60) {
        showToast('Session expiring in 60s due to inactivity...', 5000);
      }
      if (idleSeconds >= SESSION_MAX_IDLE) {
        // If active transfers are underway, grant transfer exemption
        if (activeUploadCount > 0) {
          idleSeconds = 0;
          return;
        }
        idleSeconds = 0;
        fetch('/api/logout', { method: 'POST' }).finally(() => {
          currentUser = null;
          updateSessionUI();
          smaranAlert({
            title: 'Session Expired',
            message: 'You have been logged out after 15 minutes of inactivity for security.',
            tone: 'warning'
          }).then(() => showLoginModal());
        });
      }
    }, 1000);

    window.addEventListener('beforeunload', (e) => {
      if (activeUploadCount > 0) {
        e.preventDefault();
        e.returnValue = 'File uploads are currently in progress. Leaving will cancel them.';
      }
    });

    async function checkSession() {
      try {
        const res = await fetch('/api/session');
        if (res.ok) {
          const data = await res.json();
          clientIp = data.clientIp || '127.0.0.1';
          currentUser = data.user;
          updateContextPill();
          updateSessionUI();

          if (data.authenticated && data.user && data.user.mustChangePassword) {
            showCompulsoryPasswordModal();
          } else if (!data.authenticated && data.authEnabled && !data.guestAccess) {
            showLoginModal();
          }
        }
      } catch (err) {
        console.error('Session check failed', err);
      }
    }

    function updateContextPill() {
      const uName = currentUser ? currentUser.username : 'visitor';
      const label = document.getElementById('context-label');
      if (label) label.innerText = uName + '@' + clientIp;

      // Sync URL without refreshing: /?context=user@ip
      const contextStr = uName + '@' + clientIp;
      const url = new URL(window.location.href);
      if (url.searchParams.get('context') !== contextStr) {
        url.searchParams.set('context', contextStr);
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    }

    function updateSessionUI() {
      const btn = document.getElementById('session-username');
      const adminBtn = document.getElementById('btn-admin-panel');
      if (currentUser) {
        if (btn) btn.innerText = currentUser.username;
        if (adminBtn) adminBtn.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none';
      } else {
        if (btn) btn.innerText = 'Sign In';
        if (adminBtn) adminBtn.style.display = 'none';
      }
    }

    function showSessionMenu() {
      if (!currentUser) {
        showLoginModal();
        return;
      }
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Account: \${escapeHtml(currentUser.username)}</span>
              <button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>
            </div>
            <div class="modal-body">
              <p class="modal-message">Role: <strong>\${escapeHtml(currentUser.role)}</strong></p>
              <p class="modal-message" style="margin-top:-8px; font-size:12px;">Connected from IP: \${escapeHtml(clientIp)}</p>
              <div style="display:flex; flex-direction:column; gap:8px; margin-top:16px;">
                <button onclick="closeModal(); showCompulsoryPasswordModal(false);" style="justify-content:center;">Change Password</button>
                <button class="danger" onclick="doLogout()" style="justify-content:center;">Log Out</button>
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    async function doLogout() {
      closeModal();
      await fetch('/api/logout', { method: 'POST' });
      currentUser = null;
      updateContextPill();
      updateSessionUI();
      showToast('Logged out');
      loadFiles();
    }

    function setViewMode(mode) {
      viewMode = mode;
      document.getElementById('btn-list-view').classList.toggle('active', mode === 'list');
      document.getElementById('btn-grid-view').classList.toggle('active', mode === 'grid');
      document.getElementById('file-table').style.display = mode === 'list' ? 'table' : 'none';
      document.getElementById('file-grid').style.display = mode === 'grid' ? 'grid' : 'none';
      renderFiles(allItems);
    }

    async function loadFiles(path = currentPath) {
      try {
        const res = await fetch('/api/files?path=' + encodeURIComponent(path));
        if (res.status === 401) {
          showLoginModal();
          return;
        }
        if (!res.ok) throw new Error('Failed to load files');
        const data = await res.json();
        currentPath = data.currentPath || '';
        allItems = data.items || [];
        selectedPaths.clear();
        updateBatchDock();
        renderBreadcrumbs(data.breadcrumbs || []);
        renderFiles(allItems);
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }

    function renderBreadcrumbs(crumbs) {
      const el = document.getElementById('breadcrumbs');
      el.innerHTML = '';
      crumbs.forEach((c, idx) => {
        const span = document.createElement('span');
        const isLast = idx === crumbs.length - 1;
        span.className = 'crumb' + (isLast ? ' current' : '');
        span.innerText = c.name;
        if (!isLast) {
          span.onclick = () => loadFiles(c.path);
        }
        el.appendChild(span);
        if (!isLast) {
          const sep = document.createElement('span');
          sep.style.color = 'var(--line)';
          sep.innerText = '/';
          el.appendChild(sep);
        }
      });
    }

    function isImageFile(name) {
      return /[.](jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name);
    }
    function isVideoFile(name) {
      return /[.](mp4|webm|ogv|mov|mkv)$/i.test(name);
    }
    function isAudioFile(name) {
      return /[.](mp3|wav|ogg|m4a|aac|flac)$/i.test(name);
    }
    function isTextFile(name) {
      return /[.](txt|md|json|js|ts|py|html|css|xml|yml|yaml|log|sh|bat|ini|conf)$/i.test(name);
    }
    function isPdfFile(name) {
      return /[.]pdf$/i.test(name);
    }

    function openItem(item) {
      if (item.isDirectory) {
        loadFiles(item.relativePath);
        return;
      }
      if (isImageFile(item.name)) {
        openImageLightbox(item);
      } else if (isVideoFile(item.name)) {
        openVideoPlayer(item);
      } else if (isAudioFile(item.name)) {
        openAudioPlayer(item);
      } else if (isTextFile(item.name)) {
        openTextViewer(item);
      } else if (isPdfFile(item.name)) {
        openPdfViewer(item);
      } else {
        window.open('/raw/' + encodeURIComponent(item.relativePath), '_blank');
      }
    }

    function copyItemLink(item) {
      const origin = window.location.origin;
      const url = item.isDirectory
        ? origin + '/?path=' + encodeURIComponent(item.relativePath)
        : origin + '/download/' + encodeURIComponent(item.relativePath);
      navigator.clipboard.writeText(url).then(() => {
        showToast('Direct LAN Link copied to clipboard!');
      }).catch(() => {
        prompt('Copy link:', url);
      });
    }

    function renderFiles(items) {
      imageFiles = items.filter(i => !i.isDirectory && isImageFile(i.name));
      if (viewMode === 'list') {
        renderTableView(items);
      } else {
        renderGridView(items);
      }
    }

    function renderTableView(items) {
      const tbody = document.getElementById('file-list');
      tbody.innerHTML = '';

      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No files in this folder</td></tr>';
        return;
      }

      items.forEach(item => {
        const isSelected = selectedPaths.has(item.relativePath);
        const tr = document.createElement('tr');
        if (isSelected) tr.className = 'selected';

        // Folder drag & drop hover
        if (item.isDirectory) {
          tr.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tr.classList.add('folder-drop-hover');
          });
          tr.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tr.classList.remove('folder-drop-hover');
          });
          tr.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            tr.classList.remove('folder-drop-hover');
            if (e.dataTransfer && e.dataTransfer.files) {
              handleFileSelect(e.dataTransfer.files, item.relativePath);
            }
          });
        }

        // Checkbox cell
        const tdCb = document.createElement('td');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isSelected;
        cb.onchange = (e) => {
          e.stopPropagation();
          toggleItemSelection(item.relativePath, cb.checked);
        };
        tdCb.appendChild(cb);

        // Name cell
        const tdName = document.createElement('td');
        const divName = document.createElement('div');
        divName.className = 'file-name-cell';

        const iconSvg = item.isDirectory
          ? '<svg class="file-icon folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
          : '<svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

        divName.innerHTML = iconSvg + '<div class="name-wrap"><span>' + escapeHtml(item.name) + '</span>' +
          (item.comment ? '<span class="file-comment">' + escapeHtml(item.comment) + '</span>' : '') +
          '</div>';
        divName.onclick = () => openItem(item);
        tdName.appendChild(divName);

        // Size cell
        const tdSize = document.createElement('td');
        tdSize.className = 'hide-mobile';
        tdSize.innerText = item.isDirectory ? '-' : formatBytes(item.size);

        // Date cell
        const tdDate = document.createElement('td');
        tdDate.className = 'hide-mobile';
        tdDate.innerText = formatDate(item.modifiedAt);

        // Actions cell
        const tdActions = document.createElement('td');
        const divActions = document.createElement('div');
        divActions.className = 'file-actions';

        // 1-Click Copy Link Button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.title = 'Copy Direct LAN Link';
        copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Link';
        copyBtn.onclick = (e) => { e.stopPropagation(); copyItemLink(item); };
        divActions.appendChild(copyBtn);

        if (item.isDirectory) {
          const zipBtn = document.createElement('a');
          zipBtn.className = 'btn action-btn';
          zipBtn.href = '/api/zip?path=' + encodeURIComponent(item.relativePath);
          zipBtn.title = 'Download as ZIP';
          zipBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg> ZIP';
          divActions.appendChild(zipBtn);
        } else {
          const dlBtn = document.createElement('a');
          dlBtn.className = 'btn action-btn';
          dlBtn.href = '/download/' + encodeURIComponent(item.relativePath);
          dlBtn.download = item.name;
          dlBtn.title = 'Download file';
          dlBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
          divActions.appendChild(dlBtn);
        }

        const commentBtn = document.createElement('button');
        commentBtn.className = 'action-btn';
        commentBtn.title = 'Edit description';
        commentBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
        commentBtn.onclick = (e) => { e.stopPropagation(); promptComment(item); };
        divActions.appendChild(commentBtn);

        const renameBtn = document.createElement('button');
        renameBtn.className = 'action-btn';
        renameBtn.title = 'Rename';
        renameBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
        renameBtn.onclick = (e) => { e.stopPropagation(); promptRename(item); };
        divActions.appendChild(renameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn danger';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
        deleteBtn.onclick = (e) => { e.stopPropagation(); confirmDelete(item); };
        divActions.appendChild(deleteBtn);

        tdActions.appendChild(divActions);

        tr.appendChild(tdCb);
        tr.appendChild(tdName);
        tr.appendChild(tdSize);
        tr.appendChild(tdDate);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
    }

    function renderGridView(items) {
      const grid = document.getElementById('file-grid');
      grid.innerHTML = '';

      if (items.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">No files in this folder</div>';
        return;
      }

      items.forEach(item => {
        const isSelected = selectedPaths.has(item.relativePath);
        const card = document.createElement('div');
        card.className = 'grid-card' + (isSelected ? ' selected' : '');

        if (item.isDirectory) {
          card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.add('folder-drop-hover');
          });
          card.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove('folder-drop-hover');
          });
          card.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove('folder-drop-hover');
            if (e.dataTransfer && e.dataTransfer.files) {
              handleFileSelect(e.dataTransfer.files, item.relativePath);
            }
          });
        }

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'grid-checkbox';
        cb.checked = isSelected;
        cb.onclick = (e) => e.stopPropagation();
        cb.onchange = (e) => toggleItemSelection(item.relativePath, cb.checked);
        card.appendChild(cb);

        const thumb = document.createElement('div');
        thumb.className = 'card-thumb';

        if (!item.isDirectory && isImageFile(item.name)) {
          const img = document.createElement('img');
          img.loading = 'lazy';
          img.src = '/raw/' + encodeURIComponent(item.relativePath);
          thumb.appendChild(img);
        } else if (item.isDirectory) {
          thumb.innerHTML = '<svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
        } else {
          thumb.innerHTML = '<svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        }
        card.appendChild(thumb);

        const title = document.createElement('div');
        title.className = 'card-title';
        title.innerText = item.name;
        title.title = item.name;
        card.appendChild(title);

        if (item.comment) {
          const cmt = document.createElement('div');
          cmt.className = 'file-comment';
          cmt.innerText = item.comment;
          card.appendChild(cmt);
        }

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        meta.innerHTML = '<span>' + (item.isDirectory ? 'Folder' : formatBytes(item.size)) + '</span>';
        card.appendChild(meta);

        const cActions = document.createElement('div');
        cActions.className = 'card-actions';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.title = 'Copy Link';
        copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Link';
        copyBtn.onclick = (e) => { e.stopPropagation(); copyItemLink(item); };
        cActions.appendChild(copyBtn);
        card.appendChild(cActions);

        card.onclick = () => openItem(item);
        grid.appendChild(card);
      });
    }

    function toggleItemSelection(relPath, checked) {
      if (checked) {
        selectedPaths.add(relPath);
      } else {
        selectedPaths.delete(relPath);
      }
      updateBatchDock();
    }

    function toggleSelectAll(checked) {
      if (checked) {
        allItems.forEach(i => selectedPaths.add(i.relativePath));
      } else {
        selectedPaths.clear();
      }
      updateBatchDock();
      renderFiles(allItems);
    }

    function clearSelection() {
      selectedPaths.clear();
      const allCb = document.getElementById('select-all-cb');
      if (allCb) allCb.checked = false;
      updateBatchDock();
      renderFiles(allItems);
    }

    function updateBatchDock() {
      const dock = document.getElementById('batch-dock');
      const countEl = document.getElementById('batch-count');
      const count = selectedPaths.size;
      if (count > 0) {
        dock.style.display = 'flex';
        countEl.innerText = count + ' item' + (count > 1 ? 's' : '') + ' selected';
      } else {
        dock.style.display = 'none';
      }
    }

    function downloadSelectedZip() {
      if (selectedPaths.size === 0) return;
      const param = Array.from(selectedPaths).join(';');
      window.location.href = '/api/zip-selection?items=' + encodeURIComponent(param);
    }

    async function deleteSelected() {
      const count = selectedPaths.size;
      if (count === 0) return;
      const ok = await smaranConfirm({
        title: 'Delete Selected Items',
        message: 'Are you sure you want to permanently delete ' + count + ' selected item' + (count > 1 ? 's' : '') + '?',
        confirmText: 'Delete All',
        isDanger: true
      });
      if (!ok) return;

      for (const rel of selectedPaths) {
        await fetch('/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: rel })
        });
      }
      showToast('Deleted ' + count + ' items');
      loadFiles();
    }

    function downloadCurrentFolderZip() {
      window.location.href = '/api/zip?path=' + encodeURIComponent(currentPath);
    }

    function showWebDavHelp() {
      const host = window.location.host;
      const webdavUrl = window.location.origin + '/webdav';
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Mount as Network Drive (WebDAV)</span>
              <button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>
            </div>
            <div class="modal-body">
              <p class="modal-message">Mount this file server directly inside Windows File Explorer, macOS Finder, or Linux to edit files as a native local drive.</p>
              <div style="background:#111; padding:12px; border-radius:6px; border:1px solid var(--line); font-family:monospace; margin-bottom:16px; word-break:break-all;">
                \${webdavUrl}
              </div>
              <h4 style="margin-bottom:8px; font-size:13px; color:var(--text);">Windows Setup:</h4>
              <ol style="margin-left:20px; color:var(--muted); font-size:12.5px; line-height:1.7;">
                <li>Open <strong>This PC</strong> in File Explorer.</li>
                <li>Click <strong>Map network drive</strong> on the top menu bar.</li>
                <li>Enter the WebDAV URL above in the <em>Folder</em> field.</li>
                <li>Check <em>Connect using different credentials</em>, then sign in with your Smaran username and password.</li>
              </ol>
            </div>
            <div class="modal-actions">
              <button class="primary" onclick="navigator.clipboard.writeText('\${webdavUrl}'); showToast('WebDAV URL copied!');">Copy WebDAV URL</button>
              <button onclick="closeModal()">Close</button>
            </div>
          </div>
        </div>
      \`;
    }

    async function promptComment(item) {
      const current = item.comment || '';
      const comment = await smaranPrompt({
        title: 'File Description (descript.ion)',
        message: 'Enter description or note for "' + item.name + '":',
        defaultValue: current,
        placeholder: 'e.g. Project backup 2026',
        confirmText: 'Save Note'
      });
      if (comment === null) return;
      fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.relativePath, comment: comment.trim() })
      }).then(res => {
        if (!res.ok) throw new Error('Could not save note');
        showToast('Description updated');
        loadFiles();
      }).catch(err => smaranAlert({ title: 'Error', message: err.message, tone: 'error' }));
    }

    // Lightbox & Viewers
    function openImageLightbox(item) {
      lightboxIndex = imageFiles.findIndex(i => i.relativePath === item.relativePath);
      if (lightboxIndex === -1) lightboxIndex = 0;
      zoomLevel = 1;
      rotation = 0;
      renderLightbox();
    }

    function renderLightbox() {
      const item = imageFiles[lightboxIndex];
      if (!item) return;
      const rawUrl = '/raw/' + encodeURIComponent(item.relativePath);
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\${escapeHtml(item.name)} (\${lightboxIndex + 1} of \${imageFiles.length})</span>
              <button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>
            </div>
            <div class="lightbox-img-wrap">
              <img id="lb-image" class="lightbox-img" src="\${rawUrl}" style="transform: scale(\${zoomLevel}) rotate(\${rotation}deg);">
            </div>
            <div class="lightbox-toolbar">
              <div style="display:flex; gap:6px;">
                <button onclick="prevImage()" \${lightboxIndex === 0 ? 'disabled' : ''}>← Prev</button>
                <button onclick="nextImage()" \${lightboxIndex === imageFiles.length - 1 ? 'disabled' : ''}>Next →</button>
              </div>
              <div style="display:flex; gap:6px;">
                <button onclick="zoomIn()">Zoom +</button>
                <button onclick="zoomOut()">Zoom -</button>
                <button onclick="rotateImage()">Rotate</button>
                <a class="btn primary" href="/download/\${encodeURIComponent(item.relativePath)}" download="\${escapeHtml(item.name)}">Download</a>
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    function prevImage() {
      if (lightboxIndex > 0) {
        lightboxIndex--;
        zoomLevel = 1;
        rotation = 0;
        renderLightbox();
      }
    }
    function nextImage() {
      if (lightboxIndex < imageFiles.length - 1) {
        lightboxIndex++;
        zoomLevel = 1;
        rotation = 0;
        renderLightbox();
      }
    }
    function zoomIn() {
      zoomLevel = Math.min(zoomLevel + 0.25, 3);
      updateLightboxTransform();
    }
    function zoomOut() {
      zoomLevel = Math.max(zoomLevel - 0.25, 0.5);
      updateLightboxTransform();
    }
    function rotateImage() {
      rotation = (rotation + 90) % 360;
      updateLightboxTransform();
    }
    function updateLightboxTransform() {
      const img = document.getElementById('lb-image');
      if (img) img.style.transform = 'scale(' + zoomLevel + ') rotate(' + rotation + 'deg)';
    }

    function openVideoPlayer(item) {
      const rawUrl = '/raw/' + encodeURIComponent(item.relativePath);
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\${escapeHtml(item.name)}</span>
              <button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>
            </div>
            <video controls autoplay style="width:100%; max-height:70vh; border-radius:6px; background:#000;">
              <source src="\${rawUrl}">
              Your browser does not support video playback.
            </video>
            <div style="display:flex; justify-content:flex-end; margin-top:12px;">
              <a class="btn primary" href="/download/\${encodeURIComponent(item.relativePath)}" download="\${escapeHtml(item.name)}">Download Video</a>
            </div>
          </div>
        </div>
      \`;
    }

    function openAudioPlayer(item) {
      const rawUrl = '/raw/' + encodeURIComponent(item.relativePath);
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\${escapeHtml(item.name)}</span>
              <button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>
            </div>
            <div style="padding:20px 0;">
              <audio controls autoplay style="width:100%;">
                <source src="\${rawUrl}">
                Your browser does not support audio playback.
              </audio>
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:12px;">
              <a class="btn primary" href="/download/\${encodeURIComponent(item.relativePath)}" download="\${escapeHtml(item.name)}">Download Audio</a>
            </div>
          </div>
        </div>
      \`;
    }

    async function openTextViewer(item) {
      try {
        const res = await fetch('/raw/' + encodeURIComponent(item.relativePath));
        const text = await res.text();
        const mc = document.getElementById('modal-container');
        mc.innerHTML = \`
          <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-box large" onclick="event.stopPropagation()">
              <div class="modal-title">
                <span>\${escapeHtml(item.name)}</span>
                <button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>
              </div>
              <pre class="code-view">\${escapeHtml(text)}</pre>
              <div style="display:flex; justify-content:flex-end; margin-top:12px;">
                <a class="btn primary" href="/download/\${encodeURIComponent(item.relativePath)}" download="\${escapeHtml(item.name)}">Download File</a>
              </div>
            </div>
          </div>
        \`;
      } catch (err) {
        showToast('Error loading file: ' + err.message);
      }
    }

    function openPdfViewer(item) {
      const rawUrl = '/raw/' + encodeURIComponent(item.relativePath);
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" style="height:85vh; display:flex; flex-direction:column;" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\${escapeHtml(item.name)}</span>
              <button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>
            </div>
            <iframe src="\${rawUrl}" style="flex:1; width:100%; border:none; border-radius:6px; background:#fff;"></iframe>
          </div>
        </div>
      \`;
    }

    let activeDialogCleanup = null;
    function smaranAlert(opts) {
      return new Promise((resolve) => {
        const mc = document.getElementById('modal-container');
        const title = opts.title || 'Notice';
        const message = opts.message || '';
        const tone = opts.tone || 'neutral';
        mc.innerHTML = \`
          <div class="modal-overlay">
            <div class="modal-box" onclick="event.stopPropagation()">
              <div class="modal-title">\${escapeHtml(title)}</div>
              <div class="modal-body">
                <p class="modal-message">\${escapeHtml(message)}</p>
              </div>
              <div class="modal-actions">
                <button class="primary" id="btn-dialog-ok">OK</button>
              </div>
            </div>
          </div>
        \`;
        activeDialogCleanup = () => { mc.innerHTML = ''; activeDialogCleanup = null; resolve(true); };
        document.getElementById('btn-dialog-ok').onclick = activeDialogCleanup;
      });
    }

    function smaranConfirm(opts) {
      return new Promise((resolve) => {
        const mc = document.getElementById('modal-container');
        const title = opts.title || 'Confirm';
        const message = opts.message || '';
        const confirmText = opts.confirmText || 'Confirm';
        const isDanger = opts.isDanger || false;
        mc.innerHTML = \`
          <div class="modal-overlay">
            <div class="modal-box" onclick="event.stopPropagation()">
              <div class="modal-title">\${escapeHtml(title)}</div>
              <div class="modal-body">
                <p class="modal-message">\${escapeHtml(message)}</p>
              </div>
              <div class="modal-actions">
                <button id="btn-dialog-cancel">Cancel</button>
                <button class="\${isDanger ? 'danger' : 'primary'}" id="btn-dialog-confirm">\${escapeHtml(confirmText)}</button>
              </div>
            </div>
          </div>
        \`;
        const cleanup = (val) => { mc.innerHTML = ''; activeDialogCleanup = null; resolve(val); };
        activeDialogCleanup = () => cleanup(false);
        document.getElementById('btn-dialog-cancel').onclick = () => cleanup(false);
        document.getElementById('btn-dialog-confirm').onclick = () => cleanup(true);
      });
    }

    function smaranPrompt(opts) {
      return new Promise((resolve) => {
        const mc = document.getElementById('modal-container');
        const title = opts.title || 'Input Required';
        const message = opts.message || '';
        const placeholder = opts.placeholder || '';
        const defaultValue = opts.defaultValue || '';
        const confirmText = opts.confirmText || 'Save';
        mc.innerHTML = \`
          <div class="modal-overlay">
            <div class="modal-box" onclick="event.stopPropagation()">
              <div class="modal-title">\${escapeHtml(title)}</div>
              <div class="modal-body">
                <p class="modal-message">\${escapeHtml(message)}</p>
                <input type="text" class="modal-input" id="dialog-prompt-input" value="\${escapeHtml(defaultValue)}" placeholder="\${escapeHtml(placeholder)}" autofocus />
              </div>
              <div class="modal-actions">
                <button id="btn-dialog-cancel">Cancel</button>
                <button class="primary" id="btn-dialog-confirm">\${escapeHtml(confirmText)}</button>
              </div>
            </div>
          </div>
        \`;
        const input = document.getElementById('dialog-prompt-input');
        const cleanup = (val) => { mc.innerHTML = ''; activeDialogCleanup = null; resolve(val); };
        activeDialogCleanup = () => cleanup(null);
        document.getElementById('btn-dialog-cancel').onclick = () => cleanup(null);
        document.getElementById('btn-dialog-confirm').onclick = () => cleanup(input.value);
        input.onkeydown = (e) => {
          if (e.key === 'Enter') cleanup(input.value);
          if (e.key === 'Escape') cleanup(null);
        };
        setTimeout(() => input.focus(), 50);
      });
    }

    function closeModal() {
      if (activeDialogCleanup) {
        activeDialogCleanup(null);
      } else {
        document.getElementById('modal-container').innerHTML = '';
      }
    }

    function filterFiles() {
      const q = document.getElementById('search-input').value.toLowerCase().trim();
      if (!q) {
        renderFiles(allItems);
        return;
      }
      const filtered = allItems.filter(i => i.name.toLowerCase().includes(q) || (i.comment && i.comment.toLowerCase().includes(q)));
      renderFiles(filtered);
    }

    function triggerFileInput() {
      document.getElementById('file-input').click();
    }

    async function handleFileSelect(files, targetFolder = currentPath) {
      if (!files || files.length === 0) return;
      for (const file of files) {
        await uploadFile(file, targetFolder);
      }
      document.getElementById('file-input').value = '';
      loadFiles();
    }

    function uploadFile(file, targetFolder = currentPath) {
      return new Promise((resolve) => {
        activeUploadCount++;
        const dock = document.getElementById('upload-dock');
        const dockName = document.getElementById('upload-dock-filename');
        const dockPct = document.getElementById('upload-dock-pct');
        const dockFill = document.getElementById('upload-dock-fill');
        const dockSpeed = document.getElementById('upload-dock-speed');
        const dockEta = document.getElementById('upload-dock-eta');

        dock.style.display = 'flex';
        dockName.innerText = file.name;
        dockPct.innerText = '0%';
        dockFill.style.width = '0%';
        dockSpeed.innerText = 'Starting...';
        dockEta.innerText = 'ETA: --';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload?path=' + encodeURIComponent(targetFolder) + '&name=' + encodeURIComponent(file.name));

        let lastLoaded = 0;
        let lastTime = performance.now();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const p = Math.round((e.loaded / e.total) * 100);
            dockFill.style.width = p + '%';
            dockPct.innerText = p + '%';

            const now = performance.now();
            const dtSec = (now - lastTime) / 1000;
            if (dtSec >= 0.3) {
              const speedBps = (e.loaded - lastLoaded) / dtSec;
              lastLoaded = e.loaded;
              lastTime = now;
              dockSpeed.innerText = formatBytes(speedBps) + '/s';
              const remaining = Math.max(0, e.total - e.loaded);
              const etaSec = speedBps > 0 ? Math.ceil(remaining / speedBps) : 0;
              dockEta.innerText = 'ETA: ' + (etaSec < 60 ? etaSec + 's' : Math.floor(etaSec / 60) + 'm ' + (etaSec % 60) + 's');
            }
          }
        };

        xhr.onload = () => {
          activeUploadCount = Math.max(0, activeUploadCount - 1);
          if (xhr.status >= 200 && xhr.status < 300) {
            dockPct.innerText = 'Done';
            dockFill.style.width = '100%';
            showToast('Uploaded: ' + file.name);
          } else {
            dockPct.innerText = 'Failed';
            showToast('Upload failed for ' + file.name);
          }
          setTimeout(() => {
            if (activeUploadCount === 0) dock.style.display = 'none';
          }, 2000);
          resolve();
        };

        xhr.onerror = () => {
          activeUploadCount = Math.max(0, activeUploadCount - 1);
          dockPct.innerText = 'Error';
          showToast('Network error uploading ' + file.name);
          setTimeout(() => {
            if (activeUploadCount === 0) dock.style.display = 'none';
          }, 2000);
          resolve();
        };

        xhr.send(file);
      });
    }

    // Drag and drop handling on window/dropzone
    const dz = document.getElementById('dropzone');
    ['dragenter', 'dragover'].forEach(name => {
      window.addEventListener(name, (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(name => {
      window.addEventListener(name, (e) => { e.preventDefault(); dz.classList.remove('dragover'); });
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files);
      }
    });

    async function promptNewFolder() {
      const name = await smaranPrompt({
        title: 'New Folder',
        message: 'Create a new folder in ' + (currentPath === '/' || !currentPath ? 'the root directory' : currentPath) + ':',
        placeholder: 'Folder name',
        confirmText: 'Create Folder'
      });
      if (!name || !name.trim()) return;
      fetch('/api/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, name: name.trim() })
      }).then(res => {
        if (!res.ok) throw new Error('Could not create folder');
        showToast('Folder created');
        loadFiles();
      }).catch(err => smaranAlert({ title: 'Error', message: err.message, tone: 'error' }));
    }

    async function promptRename(item) {
      const newName = await smaranPrompt({
        title: 'Rename ' + (item.isDir ? 'Folder' : 'File'),
        message: 'Enter a new name for "' + item.name + '":',
        defaultValue: item.name,
        confirmText: 'Rename'
      });
      if (!newName || !newName.trim() || newName.trim() === item.name) return;
      fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.relativePath, newName: newName.trim() })
      }).then(res => {
        if (!res.ok) throw new Error('Could not rename item');
        showToast('Renamed successfully');
        loadFiles();
      }).catch(err => smaranAlert({ title: 'Error', message: err.message, tone: 'error' }));
    }

    async function confirmDelete(item) {
      const ok = await smaranConfirm({
        title: 'Delete ' + (item.isDir ? 'Folder' : 'File'),
        message: 'Are you sure you want to permanently delete "' + item.name + '"? This action cannot be undone.',
        confirmText: 'Delete',
        isDanger: true
      });
      if (!ok) return;
      fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.relativePath })
      }).then(res => {
        if (!res.ok) throw new Error('Could not delete item');
        showToast('Item deleted');
        loadFiles();
      }).catch(err => smaranAlert({ title: 'Error', message: err.message, tone: 'error' }));
    }

    function showLoginModal() {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">Sign In</div>
            <div class="modal-body">
              <p class="modal-message">Sign in to access your Smaran HFS storage. Default administrator credentials: <strong>smaran</strong> / <strong>smaran@123</strong></p>
              <div id="login-error-msg" class="login-error-alert" style="display:none;"></div>
              <div style="margin-bottom:12px;">
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:5px; font-weight:500;">Username</label>
                <input type="text" class="modal-input" id="login-user" value="smaran" style="margin-bottom:0;" autofocus />
              </div>
              <div>
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:5px; font-weight:500;">Password</label>
                <input type="password" class="modal-input" id="login-pass" value="smaran@123" style="margin-bottom:0;" />
              </div>
            </div>
            <div class="modal-actions">
              <button class="primary" id="btn-login-submit" onclick="doLogin()">Log In</button>
            </div>
          </div>
        </div>
      \`;
      const uInput = document.getElementById('login-user');
      const pInput = document.getElementById('login-pass');
      const handleKey = (e) => {
        if (e.key === 'Enter') doLogin();
      };
      if (uInput) uInput.addEventListener('keydown', handleKey);
      if (pInput) pInput.addEventListener('keydown', handleKey);
      if (pInput) pInput.focus();
    }

    async function doLogin() {
      const u = document.getElementById('login-user') ? document.getElementById('login-user').value : '';
      const p = document.getElementById('login-pass') ? document.getElementById('login-pass').value : '';
      const errEl = document.getElementById('login-error-msg');
      if (errEl) errEl.style.display = 'none';

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        if (res.ok) {
          const data = await res.json();
          currentUser = data.user;
          document.getElementById('modal-container').innerHTML = '';
          updateContextPill();
          updateSessionUI();
          if (data.mustChangePassword) {
            showCompulsoryPasswordModal(true);
          } else {
            showToast('Signed in as ' + currentUser.username);
            loadFiles();
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          const msg = errData.error || 'Invalid username or password';
          if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
          }
        }
      } catch (err) {
        if (errEl) {
          errEl.textContent = 'Server connection failed';
          errEl.style.display = 'block';
        }
      }
    }

    function showCompulsoryPasswordModal(isCompulsory = true) {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" style="z-index: 250;">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\${isCompulsory ? 'Compulsory Password Change' : 'Change Password'}</span>
              \${!isCompulsory ? '<button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>' : ''}
            </div>
            <div class="modal-body">
              <p class="modal-message">
                \${isCompulsory ? 'Welcome to Smaran HFS! You are using default credentials. You must update your password before proceeding.' : 'Update your administrator password:'}
              </p>
              <div id="pw-error-msg" class="login-error-alert" style="display:none;"></div>
              <div style="margin-bottom:12px;">
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:5px; font-weight:500;">Username (Locked)</label>
                <input type="text" class="modal-input" value="\${escapeHtml(currentUser?.username || 'smaran')}" disabled style="background:#202024; color:var(--muted); cursor:not-allowed; margin-bottom:4px;" />
                <span style="font-size:11px; color:var(--faint);">The default username 'smaran' is permanent and cannot be modified.</span>
              </div>
              <div style="margin-bottom:12px;">
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:5px; font-weight:500;">Current Password</label>
                <input type="password" class="modal-input" id="cpw-current" value="\${isCompulsory ? 'smaran@123' : ''}" style="margin-bottom:0;" />
              </div>
              <div style="margin-bottom:12px;">
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:5px; font-weight:500;">New Password (min 6 characters)</label>
                <input type="password" class="modal-input" id="cpw-new" placeholder="Enter new password" style="margin-bottom:0;" />
              </div>
              <div>
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:5px; font-weight:500;">Confirm New Password</label>
                <input type="password" class="modal-input" id="cpw-confirm" placeholder="Repeat new password" style="margin-bottom:0;" />
              </div>
            </div>
            <div class="modal-actions">
              \${!isCompulsory ? '<button onclick="closeModal()">Cancel</button>' : ''}
              <button class="primary" id="btn-change-pw-submit" onclick="doChangePassword()">Save Password</button>
            </div>
          </div>
        </div>
      \`;
    }

    async function doChangePassword() {
      const cur = document.getElementById('cpw-current').value;
      const nw = document.getElementById('cpw-new').value;
      const cnf = document.getElementById('cpw-confirm').value;
      const errEl = document.getElementById('pw-error-msg');
      if (errEl) errEl.style.display = 'none';

      if (!cur || !nw) {
        if (errEl) { errEl.innerText = 'Please fill all password fields'; errEl.style.display = 'block'; }
        return;
      }
      if (nw !== cnf) {
        if (errEl) { errEl.innerText = 'New password and confirmation do not match'; errEl.style.display = 'block'; }
        return;
      }
      if (nw.length < 6) {
        if (errEl) { errEl.innerText = 'Password must be at least 6 characters long'; errEl.style.display = 'block'; }
        return;
      }

      try {
        const res = await fetch('/api/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: cur, newPassword: nw })
        });
        const data = await res.json();
        if (res.ok) {
          if (currentUser) currentUser.mustChangePassword = false;
          document.getElementById('modal-container').innerHTML = '';
          showToast('Password changed successfully!');
          loadFiles();
        } else {
          if (errEl) { errEl.innerText = data.error || 'Failed to update password'; errEl.style.display = 'block'; }
        }
      } catch (err) {
        if (errEl) { errEl.innerText = 'Network error: ' + err.message; errEl.style.display = 'block'; }
      }
    }

    /* Speed Test Benchmark Modal */
    function showSpeedTestModal() {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Network & LAN Speed Test Benchmark</span>
              <button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>
            </div>
            <div class="modal-body">
              <p class="modal-message">Benchmark latency and real throughput between your client device and the file server.</p>
              <div class="st-grid">
                <div class="st-tile">
                  <div class="st-label">LAN Latency</div>
                  <div class="st-value" id="st-ping">-- ms</div>
                </div>
                <div class="st-tile">
                  <div class="st-label">LAN Download</div>
                  <div class="st-value" id="st-down" style="color:var(--accent);">-- Mbps</div>
                </div>
                <div class="st-tile">
                  <div class="st-label">LAN Upload</div>
                  <div class="st-value" id="st-up" style="color:var(--ok);">-- Mbps</div>
                </div>
                <div class="st-tile">
                  <div class="st-label">Internet Status</div>
                  <div class="st-value" id="st-internet" style="font-size:15px;">--</div>
                </div>
              </div>
              <div style="background:var(--line); height:6px; border-radius:999px; overflow:hidden; margin:16px 0;">
                <div id="st-progress" style="background:var(--accent); width:0%; height:100%; transition:width 0.2s;"></div>
              </div>
              <p id="st-status-msg" style="font-size:12.5px; color:var(--muted); font-style:italic;">Ready to benchmark.</p>
            </div>
            <div class="modal-actions">
              <button class="primary" id="btn-start-st" onclick="runSpeedTest()">Run Speed Test</button>
              <button onclick="closeModal()">Close</button>
            </div>
          </div>
        </div>
      \`;
    }

    async function runSpeedTest() {
      const btn = document.getElementById('btn-start-st');
      const pEl = document.getElementById('st-ping');
      const dEl = document.getElementById('st-down');
      const uEl = document.getElementById('st-up');
      const iEl = document.getElementById('st-internet');
      const bar = document.getElementById('st-progress');
      const msg = document.getElementById('st-status-msg');

      if (btn) btn.disabled = true;
      pEl.innerText = '-- ms';
      dEl.innerText = '-- Mbps';
      uEl.innerText = '-- Mbps';
      iEl.innerText = '--';

      try {
        // 1. LAN Ping
        msg.innerText = '1/3 Measuring LAN ping latency...';
        bar.style.width = '20%';
        const pings = [];
        for (let i = 0; i < 3; i++) {
          const t0 = performance.now();
          await fetch('/api/speedtest/ping', { cache: 'no-store' });
          pings.push(performance.now() - t0);
        }
        const avgPing = Math.round((pings.reduce((a, b) => a + b, 0) / pings.length) * 10) / 10;
        pEl.innerText = avgPing + ' ms';

        // 2. LAN Download (10 MB stream)
        msg.innerText = '2/3 Measuring LAN Download throughput (10 MB stream)...';
        bar.style.width = '55%';
        const tStartDl = performance.now();
        const resDl = await fetch('/api/speedtest/download?sizeMb=10', { cache: 'no-store' });
        const blob = await resDl.blob();
        const dtDl = Math.max(0.001, (performance.now() - tStartDl) / 1000);
        const dlMbps = Math.round(((blob.size * 8) / dtDl / 1_000_000) * 10) / 10;
        dEl.innerText = dlMbps + ' Mbps';

        // 3. LAN Upload (8 MB payload)
        msg.innerText = '3/3 Measuring LAN Upload throughput (8 MB stream)...';
        bar.style.width = '85%';
        const buffer = new Uint8Array(8 * 1024 * 1024);
        const resUp = await fetch('/api/speedtest/upload', {
          method: 'POST',
          body: buffer,
          headers: { 'Content-Type': 'application/octet-stream' }
        });
        const upData = await resUp.json();
        uEl.innerText = upData.speedMbps + ' Mbps';

        // 4. Internet status
        bar.style.width = '100%';
        try {
          const tNet = performance.now();
          await fetch('https://www.google.com/generate_204', { mode: 'no-cors', cache: 'no-store' });
          const netMs = Math.round(performance.now() - tNet);
          iEl.innerText = 'Online (' + netMs + ' ms)';
        } catch {
          iEl.innerText = navigator.onLine ? 'Connected' : 'Offline';
        }
        msg.innerText = 'Benchmark complete!';
      } catch (err) {
        msg.innerText = 'Benchmark error: ' + err.message;
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    /* Web Admin Panel */
    async function showAdminModal() {
      if (!currentUser || currentUser.role !== 'admin') {
        smaranAlert({ title: 'Access Denied', message: 'Administrator role required.', tone: 'error' });
        return;
      }

      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Smaran HFS Web Administration Panel</span>
              <button onclick="closeModal()" class="icon-only" style="border:none;background:transparent;cursor:pointer;">✕</button>
            </div>
            <div class="admin-nav">
              <button class="admin-nav-btn active" onclick="switchAdminTab('settings')">Settings</button>
              <button class="admin-nav-btn" onclick="switchAdminTab('users')">User Accounts</button>
              <button class="admin-nav-btn" onclick="switchAdminTab('vfs')">VFS Mounts</button>
              <button class="admin-nav-btn" onclick="switchAdminTab('logs')">Audit Logs</button>
            </div>
            <div class="modal-body" style="min-height:360px;">
              <div id="admin-pane-settings" class="admin-pane active">Loading settings...</div>
              <div id="admin-pane-users" class="admin-pane">Loading users...</div>
              <div id="admin-pane-vfs" class="admin-pane">Loading VFS mounts...</div>
              <div id="admin-pane-logs" class="admin-pane">Loading audit logs...</div>
            </div>
          </div>
        </div>
      \`;

      loadAdminSettings();
    }

    function switchAdminTab(name) {
      document.querySelectorAll('.admin-nav-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      document.querySelectorAll('.admin-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById('admin-pane-' + name);
      if (activePane) activePane.classList.add('active');

      if (name === 'settings') loadAdminSettings();
      if (name === 'users') loadAdminUsers();
      if (name === 'vfs') loadAdminVfs();
      if (name === 'logs') loadAdminLogs();
    }

    async function loadAdminSettings() {
      const pane = document.getElementById('admin-pane-settings');
      try {
        const res = await fetch('/api/admin/settings');
        const s = await res.json();
        pane.innerHTML = \`
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">Server Name</label>
              <input type="text" class="modal-input" id="adm-set-name" value="\${escapeHtml(s.serverName)}" style="margin-bottom:0;" />
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">Port</label>
                <input type="number" class="modal-input" id="adm-set-port" value="\${s.port}" style="margin-bottom:0;" />
              </div>
              <div>
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">Max Connections</label>
                <input type="number" class="modal-input" id="adm-set-maxconns" value="\${s.maxConnections || 2048}" style="margin-bottom:0;" />
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div>
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">Upload Limit (MB)</label>
                <input type="number" class="modal-input" id="adm-set-uploadlimit" value="\${s.uploadLimitMb || 4096}" style="margin-bottom:0;" />
              </div>
              <div>
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">Rate Limit / min</label>
                <input type="number" class="modal-input" id="adm-set-ratelimit" value="\${s.rateLimitPerMin || 600}" style="margin-bottom:0;" />
              </div>
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:14px;">
              <button class="primary" onclick="saveAdminSettings()">Save Server Settings</button>
            </div>
          </div>
        \`;
      } catch (err) {
        pane.innerHTML = '<p style="color:var(--danger)">Failed to load settings: ' + escapeHtml(err.message) + '</p>';
      }
    }

    async function saveAdminSettings() {
      const serverName = document.getElementById('adm-set-name').value;
      const port = Number(document.getElementById('adm-set-port').value);
      const maxConnections = Number(document.getElementById('adm-set-maxconns').value);
      const uploadLimitMb = Number(document.getElementById('adm-set-uploadlimit').value);
      const rateLimitPerMin = Number(document.getElementById('adm-set-ratelimit').value);

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverName, port, maxConnections, uploadLimitMb, rateLimitPerMin })
      });
      if (res.ok) {
        showToast('Settings saved!');
      } else {
        smaranAlert({ title: 'Error', message: 'Could not update settings', tone: 'error' });
      }
    }

    async function loadAdminUsers() {
      const pane = document.getElementById('admin-pane-users');
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        const users = data.users || [];
        let html = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">'
          + '<span style="font-weight:600; font-size:13px;">Configured User Accounts</span>'
          + '<button class="primary" onclick="promptAddUserModal()">+ Add User</button>'
          + '</div>'
          + '<table class="admin-table">'
          + '<thead><tr><th>Username</th><th>Role</th><th>Permissions</th><th>Actions</th></tr></thead>'
          + '<tbody>';
        for (const u of users) {
          const perms = ['Read'];
          if (u.permissions && u.permissions.upload) perms.push('Upload');
          if (u.permissions && u.permissions.delete) perms.push('Delete');
          if (u.permissions && u.permissions.rename) perms.push('Rename');
          if (u.permissions && u.permissions.mkdir) perms.push('Mkdir');
          const isSmaran = u.username.toLowerCase() === 'smaran';
          html += '<tr>'
            + '<td><strong>' + escapeHtml(u.username) + '</strong> ' + (isSmaran ? '<span class="badge">System</span>' : '') + '</td>'
            + '<td>' + escapeHtml(u.role) + '</td>'
            + '<td style="font-size:11px; color:var(--muted);">' + perms.join(', ') + '</td>'
            + '<td>' + (!isSmaran && !u.isSystem ? '<button class="danger action-btn" data-user-id="' + escapeHtml(u.id) + '" onclick="deleteAdminUser(this.dataset.userId)">Delete</button>' : '<span style="font-size:11px; color:var(--muted);">Permanent</span>') + '</td>'
            + '</tr>';
        }
        html += '</tbody></table>';
        pane.innerHTML = html;
      } catch (err) {
        pane.innerHTML = '<p style="color:var(--danger)">Error loading users: ' + escapeHtml(err.message) + '</p>';
      }
    }

    function promptAddUserModal() {
      const mc = document.createElement('div');
      mc.id = 'sub-modal';
      mc.innerHTML = \`
        <div class="modal-overlay" style="z-index:160;">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">Add New User Account</div>
            <div class="modal-body">
              <p class="modal-message">All permissions are enabled by default for new accounts.</p>
              <div style="margin-bottom:10px;">
                <label style="font-size:12px; color:var(--muted);">Username</label>
                <input type="text" class="modal-input" id="new-u-name" placeholder="Username" style="margin-bottom:0;" />
              </div>
              <div style="margin-bottom:10px;">
                <label style="font-size:12px; color:var(--muted);">Password</label>
                <input type="password" class="modal-input" id="new-u-pass" placeholder="Password" style="margin-bottom:0;" />
              </div>
              <div style="margin-bottom:12px;">
                <label style="font-size:12px; color:var(--muted);">Role</label>
                <select id="new-u-role" class="modal-input" style="margin-bottom:0;">
                  <option value="user" selected>Standard User</option>
                  <option value="admin">Administrator</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
              <div style="display:flex; flex-direction:column; gap:6px; font-size:12.5px; margin-top:8px;">
                <label><input type="checkbox" id="perm-read" checked /> Read Files & Folders</label>
                <label><input type="checkbox" id="perm-upload" checked /> Upload Files</label>
                <label><input type="checkbox" id="perm-delete" checked /> Delete Files & Folders</label>
                <label><input type="checkbox" id="perm-rename" checked /> Rename Files</label>
                <label><input type="checkbox" id="perm-mkdir" checked /> Create New Folders</label>
                <label><input type="checkbox" id="perm-comment" checked /> Edit Descriptions</label>
                <label><input type="checkbox" id="perm-vfs" /> Manage VFS Mounts</label>
                <label><input type="checkbox" id="perm-zip" checked /> Download ZIP Archives</label>
              </div>
            </div>
            <div class="modal-actions">
              <button onclick="document.getElementById('sub-modal').remove()">Cancel</button>
              <button class="primary" onclick="submitCreateUser()">Save User</button>
            </div>
          </div>
        </div>
      \`;
      document.body.appendChild(mc);
    }

    async function submitCreateUser() {
      const username = document.getElementById('new-u-name').value.trim();
      const password = document.getElementById('new-u-pass').value.trim();
      const role = document.getElementById('new-u-role').value;
      if (!username || !password) {
        alert('Username and password are required');
        return;
      }
      const permissions = {
        read: document.getElementById('perm-read').checked,
        upload: document.getElementById('perm-upload').checked,
        delete: document.getElementById('perm-delete').checked,
        rename: document.getElementById('perm-rename').checked,
        mkdir: document.getElementById('perm-mkdir').checked,
        comment: document.getElementById('perm-comment').checked,
        vfs: document.getElementById('perm-vfs').checked,
        zip: document.getElementById('perm-zip').checked,
      };
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, permissions })
      });
      if (res.ok) {
        document.getElementById('sub-modal').remove();
        showToast('User ' + username + ' created');
        loadAdminUsers();
      } else {
        alert('Could not save user');
      }
    }

    async function deleteAdminUser(id) {
      if (!confirm('Are you sure you want to delete this user?')) return;
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        showToast('User deleted');
        loadAdminUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Cannot delete user');
      }
    }

    async function loadAdminVfs() {
      const pane = document.getElementById('admin-pane-vfs');
      try {
        const res = await fetch('/api/admin/vfs');
        const data = await res.json();
        const nodes = data.nodes || [];
        let html = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">'
          + '<span style="font-weight:600; font-size:13px;">Virtual File System Mounts</span>'
          + '</div>';
        if (nodes.length === 0) {
          html += '<p style="color:var(--muted); font-size:13px;">Default storage root mounted at /</p>';
        } else {
          html += '<table class="admin-table">'
            + '<thead><tr><th>Virtual Path</th><th>Name</th><th>Type</th><th>Actions</th></tr></thead><tbody>';
          for (const n of nodes) {
            html += '<tr>'
              + '<td style="font-family:monospace;">' + escapeHtml(n.vfsPath) + '</td>'
              + '<td>' + escapeHtml(n.name) + '</td>'
              + '<td><span class="badge">' + escapeHtml(n.type) + '</span></td>'
              + '<td><button class="danger action-btn" data-vfs-id="' + escapeHtml(n.id) + '" onclick="deleteAdminVfs(this.dataset.vfsId)">Delete</button></td>'
              + '</tr>';
          }
          html += '</tbody></table>';
        }
        pane.innerHTML = html;
      } catch (err) {
        pane.innerHTML = '<p style="color:var(--danger)">Error: ' + escapeHtml(err.message) + '</p>';
      }
    }

    async function deleteAdminVfs(id) {
      if (!confirm('Remove this VFS mount?')) return;
      await fetch('/api/admin/vfs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      loadAdminVfs();
    }

    async function loadAdminLogs() {
      const pane = document.getElementById('admin-pane-logs');
      try {
        const res = await fetch('/api/admin/logs');
        const data = await res.json();
        const logs = data.logs || [];
        let html = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">'
          + '<span style="font-weight:600; font-size:13px;">Server Audit Log (' + logs.length + ' entries)</span>'
          + '<button class="danger action-btn" onclick="clearAdminLogs()">Clear Logs</button>'
          + '</div>'
          + '<div style="max-height:300px; overflow-y:auto; border:1px solid var(--line); border-radius:6px;">'
          + '<table class="admin-table">'
          + '<thead><tr><th>Time</th><th>IP</th><th>Action</th><th>Status</th></tr></thead><tbody>';
        for (const l of logs) {
          const badgeStyle = (l.status >= 400) ? 'color:var(--danger); background:rgba(239,68,68,0.15);' : '';
          html += '<tr>'
            + '<td style="font-size:11px; color:var(--muted); white-space:nowrap;">' + formatDate(l.timestamp) + '</td>'
            + '<td style="font-family:monospace; font-size:11.5px;">' + escapeHtml(l.clientIp || '') + '</td>'
            + '<td style="font-size:12px;">' + escapeHtml(l.message || '') + '</td>'
            + '<td style="font-size:11px;"><span class="badge" style="' + badgeStyle + '">' + (l.status || 200) + '</span></td>'
            + '</tr>';
        }
        html += '</tbody></table></div>';
        pane.innerHTML = html;
      } catch (err) {
        pane.innerHTML = '<p style="color:var(--danger)">Error: ' + escapeHtml(err.message) + '</p>';
      }
    }

    async function clearAdminLogs() {
      if (!confirm('Clear all audit logs?')) return;
      await fetch('/api/admin/logs/clear', { method: 'POST' });
      loadAdminLogs();
    }

    /* Smaran Animated Dots Logo Engine */
    function initSmaranDots() {
      const container = document.getElementById('smaran-brand-dots');
      if (!container) return;

      const N = 32;
      const CX = 32, CY = 32;
      const STROKES = 3;
      const colors = ['#eaeaea', '#e06c43', '#f59f00'];

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 64 64');
      svg.setAttribute('width', '26');
      svg.setAttribute('height', '26');
      svg.style.overflow = 'visible';
      svg.style.display = 'block';

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = '<filter id="web-smaran-goo" filterUnits="userSpaceOnUse" x="-32" y="-32" width="128" height="128">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />' +
        '<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 8 -3" result="goo" />' +
        '<feComposite in="SourceGraphic" in2="goo" operator="atop" />' +
      '</filter>';
      svg.appendChild(defs);

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('filter', 'url(#web-smaran-goo)');

      const paths = [];
      for (let s = 0; s < STROKES; s++) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('stroke', colors[s]);
        p.setAttribute('stroke-width', '4.5');
        group.appendChild(p);
        paths.push(p);
      }
      svg.appendChild(group);
      container.appendChild(svg);

      const pos = new Float64Array(STROKES * N * 2);
      const vel = new Float64Array(STROKES * N * 2);
      const targetPts = new Float64Array(STROKES * N * 2);
      const curWidth = [4.5, 4.5, 4.5];
      const targetWidth = [4.5, 4.5, 4.5];

      function arcPts(cx, cy, r, a0Deg, a1Deg, count) {
        const pts = [];
        const rad0 = (a0Deg * Math.PI) / 180;
        const rad1 = (a1Deg * Math.PI) / 180;
        for (let i = 0; i < count; i++) {
          const u = count > 1 ? i / (count - 1) : 0;
          const th = rad0 + (rad1 - rad0) * u;
          pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
        }
        return pts;
      }

      function dotPts(x, y, count) {
        const pts = [];
        for (let i = 0; i < count; i++) pts.push([x, y]);
        return pts;
      }

      function getSMarkTargets(t) {
        const breath = 1 + 0.03 * Math.sin(t * 3);
        const s0 = arcPts(CX, 22, 10.5 * breath, -30, -270, N);
        const s1 = arcPts(CX, 42, 10.5 * breath, -90, 150, N);
        const dX = CX + 18 * Math.cos((-45 * Math.PI) / 180);
        const dY = CY + 18 * Math.sin((-45 * Math.PI) / 180);
        const s2 = dotPts(dX, dY, N);
        return { strokes: [s0, s1, s2], widths: [4.2, 4.2, 7.5] };
      }

      function getBounceTargets(t) {
        const xs = [20, 32, 44];
        const s0 = dotPts(xs[0], CY - 9 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * (t * 1.1))), 1.5), N);
        const s1 = dotPts(xs[1], CY - 9 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * (t * 1.1 - 0.16))), 1.5), N);
        const s2 = dotPts(xs[2], CY - 9 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * (t * 1.1 - 0.32))), 1.5), N);
        return { strokes: [s0, s1, s2], widths: [7.5, 7.5, 7.5] };
      }

      function getSpiralTargets(t) {
        const p = (t * 0.4) % 1;
        const r = 4 + 13 * Math.sin(p * Math.PI);
        const a = (720 * p * Math.PI) / 180;
        const p0 = [CX + r * Math.cos(a - Math.PI / 2), CY + r * Math.sin(a - Math.PI / 2)];
        const p1 = [CX + r * Math.cos(a + Math.PI / 6), CY + r * Math.sin(a + Math.PI / 6)];
        const p2 = [CX + r * Math.cos(a + (5 * Math.PI) / 6), CY + r * Math.sin(a + (5 * Math.PI) / 6)];
        return { strokes: [dotPts(p0[0], p0[1], N), dotPts(p1[0], p1[1], N), dotPts(p2[0], p2[1], N)], widths: [7.0, 7.0, 7.0] };
      }

      function getWaveTargets(t) {
        const xs = [20, 32, 44];
        const s0 = dotPts(xs[0], CY + 7.5 * Math.sin(2 * Math.PI * (t * 0.9) - 0.0), N);
        const s1 = dotPts(xs[1], CY + 7.5 * Math.sin(2 * Math.PI * (t * 0.9) - 0.9), N);
        const s2 = dotPts(xs[2], CY + 7.5 * Math.sin(2 * Math.PI * (t * 0.9) - 1.8), N);
        return { strokes: [s0, s1, s2], widths: [7.5, 7.5, 7.5] };
      }

      const scenes = [getSMarkTargets, getBounceTargets, getSpiralTargets, getWaveTargets];
      let sceneIndex = 0;
      let sceneTime = 0;
      const SCENE_DURATION = 4.0;

      const initFrame = getSMarkTargets(0);
      for (let s = 0; s < STROKES; s++) {
        curWidth[s] = initFrame.widths[s];
        targetWidth[s] = initFrame.widths[s];
        for (let k = 0; k < N; k++) {
          const idx = (s * N + k) * 2;
          pos[idx] = initFrame.strokes[s][k][0];
          pos[idx + 1] = initFrame.strokes[s][k][1];
          vel[idx] = 0;
          vel[idx + 1] = 0;
        }
      }

      function impulse(strength) {
        strength = strength || 1;
        for (let s = 0; s < STROKES; s++) {
          const kick = (95 + 30 * s) * strength;
          const spin = (s - 1) * 55 * strength;
          for (let k = 0; k < N; k++) {
            const i = (s * N + k) * 2;
            const dx = pos[i] - CX;
            const dy = pos[i + 1] - CY;
            const len = Math.hypot(dx, dy) || 1;
            vel[i] += (dx / len) * kick - (dy / len) * spin;
            vel[i + 1] += (dy / len) * kick + (dx / len) * spin;
          }
        }
      }

      container.addEventListener('click', function() {
        impulse(1.3);
        sceneIndex = (sceneIndex + 1) % scenes.length;
        sceneTime = 0;
      });

      container.addEventListener('mouseenter', function() {
        impulse(0.5);
      });

      let lastTime = performance.now();
      function tick(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        if (!document.hidden) {
          sceneTime += dt;
          if (sceneTime >= SCENE_DURATION) {
            sceneTime = 0;
            sceneIndex = (sceneIndex + 1) % scenes.length;
          }

          const activeFn = scenes[sceneIndex];
          const frame = activeFn(sceneTime);

          for (let s = 0; s < STROKES; s++) {
            targetWidth[s] = frame.widths[s];
            curWidth[s] += (targetWidth[s] - curWidth[s]) * Math.min(1, dt * 10);

            for (let k = 0; k < N; k++) {
              const idx = (s * N + k) * 2;
              targetPts[idx] = frame.strokes[s][k][0];
              targetPts[idx + 1] = frame.strokes[s][k][1];
            }
          }

          const OMEGA = 14;
          const DAMPING = 2 * OMEGA;
          const steps = 2;
          const h = dt / steps;

          for (let step = 0; step < steps; step++) {
            for (let i = 0; i < STROKES * N * 2; i += 2) {
              const fx = OMEGA * OMEGA * (targetPts[i] - pos[i]) - DAMPING * vel[i];
              const fy = OMEGA * OMEGA * (targetPts[i + 1] - pos[i + 1]) - DAMPING * vel[i + 1];

              vel[i] += fx * h;
              vel[i + 1] += fy * h;

              pos[i] += vel[i] * h;
              pos[i + 1] += vel[i + 1] * h;
            }
          }

          for (let s = 0; s < STROKES; s++) {
            let d = '';
            for (let k = 0; k < N; k++) {
              const i = (s * N + k) * 2;
              d += (k === 0 ? 'M' : 'L') + pos[i].toFixed(2) + ' ' + pos[i + 1].toFixed(2);
            }
            paths[s].setAttribute('d', d);
            paths[s].setAttribute('stroke-width', curWidth[s].toFixed(2));
          }
        }

        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    }

    // Keyboard navigation in lightbox
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    });

    // Initialize Animated Logo, Session & Initial Load
    initSmaranDots();
    checkSession().finally(() => {
      loadFiles();
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
