/**
 * Generates the self-contained Web File Manager HTML/CSS/JS served to LAN clients.
 * Zero external dependencies: works offline on any Wi-Fi or airgapped LAN.
 * Features: Rich Media Lightbox, Video/Audio Player, Code/Text Viewer,
 * Streaming ZIP Downloads, Batch Multi-Select, List & Grid Views, WebDAV Guide, File Comments.
 */
export function getWebManagerHtml(serverName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(serverName)} - Smaran HFS</title>
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
      gap: 8px;
    }
    .search-box {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 6px 12px;
      color: var(--text);
      font-size: 13px;
      width: 200px;
      outline: none;
    }
    .search-box:focus { border-color: var(--accent); }
    .view-toggle {
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
      background: var(--card);
    }
    .view-toggle button {
      border: none;
      border-radius: 0;
      padding: 6px 10px;
      background: transparent;
    }
    .view-toggle button.active {
      background: var(--card-hover);
      color: var(--accent);
    }
    .dropzone {
      border: 2px dashed var(--line);
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      margin-bottom: 18px;
      background: rgba(27, 27, 30, 0.4);
      transition: all 0.2s;
      cursor: pointer;
    }
    .dropzone.dragover {
      border-color: var(--accent);
      background: var(--accent-soft);
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
    }
    .action-btn {
      padding: 4px 7px;
      font-size: 12px;
    }
    /* Grid View styles */
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
    .grid-checkbox {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 2;
    }
    /* Floating Batch Action Dock */
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
    .progress-list {
      margin-bottom: 18px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .progress-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 14px;
    }
    .progress-bar-bg {
      height: 6px;
      background: var(--line);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 6px;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--accent);
      transition: width 0.2s;
    }
    /* Modals, Popups & Dialogs */
    @keyframes smaranModalIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(6px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    @keyframes smaranFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
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
      max-width: 440px;
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
      margin-bottom: 20px;
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
    input[type="text"], input[type="password"] {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 8px 12px;
      color: var(--text);
      font-size: 14px;
      outline: none;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: var(--accent);
    }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--card);
      border: 1px solid var(--line);
      padding: 10px 16px;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
      z-index: 200;
      font-size: 13px;
    }
    .empty-state {
      padding: 48px 16px;
      text-align: center;
      color: var(--muted);
    }
    @media (max-width: 640px) {
      .hide-mobile { display: none; }
      header { padding: 10px 16px; }
      main { padding: 16px 16px 80px 16px; }
      .search-box { width: 140px; }
      .batch-dock { width: 90%; justify-content: space-between; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="smaran-brand-logo" id="smaran-brand-dots" title="Smaran"></div>
      <span>${escapeHtml(serverName)}</span>
      <span class="badge">LAN File Server</span>
    </div>
    <div class="toolbar">
      <button class="primary" id="btn-upload" onclick="triggerFileInput()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload
      </button>
      <button onclick="promptNewFolder()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
        New Folder
      </button>
      <button onclick="downloadCurrentFolderZip()" title="Download current folder as ZIP">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        Folder ZIP
      </button>
      <button onclick="showWebDavHelp()" title="Mount as Windows Network Drive">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        WebDAV
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

    <div class="progress-list" id="progress-container"></div>

    <div class="dropzone" id="dropzone" onclick="triggerFileInput()">
      <p style="font-weight: 500;">Drag and drop files anywhere to upload</p>
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
          <th style="text-align: right;">Actions</th>
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
      return /\\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name);
    }

    function isVideoFile(name) {
      return /\\.(mp4|webm|ogv|mov|mkv)$/i.test(name);
    }

    function isAudioFile(name) {
      return /\\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name);
    }

    function isTextFile(name) {
      return /\\.(txt|md|json|js|ts|py|html|css|xml|yml|yaml|log|sh|bat|ini|conf)$/i.test(name);
    }

    function isPdfFile(name) {
      return /\\.pdf$/i.test(name);
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
          dlBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
          divActions.appendChild(dlBtn);
        }

        const commentBtn = document.createElement('button');
        commentBtn.className = 'action-btn';
        commentBtn.title = 'Edit description';
        commentBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
        commentBtn.onclick = (e) => { e.stopPropagation(); promptComment(item); };
        divActions.appendChild(commentBtn);

        const renameBtn = document.createElement('button');
        renameBtn.className = 'action-btn';
        renameBtn.title = 'Rename';
        renameBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
        renameBtn.onclick = (e) => { e.stopPropagation(); promptRename(item); };
        divActions.appendChild(renameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn danger';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
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
      if (selectedPaths.size > 0) {
        dock.style.display = 'flex';
        countEl.innerText = selectedPaths.size + (selectedPaths.size === 1 ? ' item selected' : ' items selected');
      } else {
        dock.style.display = 'none';
      }
    }

    function downloadCurrentFolderZip() {
      const url = '/api/zip?path=' + encodeURIComponent(currentPath);
      window.location.href = url;
    }

    function downloadSelectedZip() {
      if (selectedPaths.size === 0) return;
      const list = Array.from(selectedPaths).join(';');
      window.location.href = '/api/zip-selection?items=' + encodeURIComponent(list);
    }

    /* Custom Smaran Dialogs (Confirm, Prompt, Alert) */
    let activeDialogCleanup = null;

    function smaranConfirm(options) {
      return new Promise(function(resolve) {
        if (activeDialogCleanup) activeDialogCleanup(false);
        const mc = document.getElementById('modal-container');
        const title = options.title || 'Confirm';
        const message = options.message || '';
        const confirmText = options.confirmText || 'Confirm';
        const cancelText = options.cancelText || 'Cancel';
        const isDanger = !!options.isDanger;

        mc.innerHTML = '<div class="modal-overlay" id="smaran-dialog-overlay">' +
          '<div class="modal-box" onclick="event.stopPropagation()">' +
            '<div class="modal-title">' + escapeHtml(title) + '</div>' +
            '<div class="modal-message">' + escapeHtml(message) + '</div>' +
            '<div class="modal-actions">' +
              '<button type="button" id="smaran-dialog-cancel">' + escapeHtml(cancelText) + '</button>' +
              '<button type="button" class="' + (isDanger ? 'danger' : 'primary') + '" id="smaran-dialog-confirm">' + escapeHtml(confirmText) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

        const overlay = document.getElementById('smaran-dialog-overlay');
        const cancelBtn = document.getElementById('smaran-dialog-cancel');
        const confirmBtn = document.getElementById('smaran-dialog-confirm');

        function cleanup(result) {
          document.removeEventListener('keydown', handleKey);
          activeDialogCleanup = null;
          mc.innerHTML = '';
          resolve(result);
        }
        function handleKey(e) {
          if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
          else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
        }
        activeDialogCleanup = cleanup;
        overlay.onclick = function() { cleanup(false); };
        cancelBtn.onclick = function() { cleanup(false); };
        confirmBtn.onclick = function() { cleanup(true); };
        document.addEventListener('keydown', handleKey);
        confirmBtn.focus();
      });
    }

    function smaranPrompt(options) {
      return new Promise(function(resolve) {
        if (activeDialogCleanup) activeDialogCleanup(null);
        const mc = document.getElementById('modal-container');
        const title = options.title || 'Input';
        const message = options.message || '';
        const defaultValue = options.defaultValue || '';
        const placeholder = options.placeholder || '';
        const confirmText = options.confirmText || 'Save';
        const cancelText = options.cancelText || 'Cancel';
        const isDanger = !!options.isDanger;

        mc.innerHTML = '<div class="modal-overlay" id="smaran-dialog-overlay">' +
          '<div class="modal-box" onclick="event.stopPropagation()">' +
            '<div class="modal-title">' + escapeHtml(title) + '</div>' +
            '<div class="modal-message">' + escapeHtml(message) + '</div>' +
            '<input type="text" class="modal-input" id="smaran-dialog-input" value="' + escapeHtml(defaultValue) + '" placeholder="' + escapeHtml(placeholder) + '" />' +
            '<div class="modal-actions">' +
              '<button type="button" id="smaran-dialog-cancel">' + escapeHtml(cancelText) + '</button>' +
              '<button type="button" class="' + (isDanger ? 'danger' : 'primary') + '" id="smaran-dialog-confirm">' + escapeHtml(confirmText) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

        const overlay = document.getElementById('smaran-dialog-overlay');
        const cancelBtn = document.getElementById('smaran-dialog-cancel');
        const confirmBtn = document.getElementById('smaran-dialog-confirm');
        const input = document.getElementById('smaran-dialog-input');

        function cleanup(result) {
          document.removeEventListener('keydown', handleKey);
          activeDialogCleanup = null;
          mc.innerHTML = '';
          resolve(result);
        }
        function handleKey(e) {
          if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
          else if (e.key === 'Enter') { e.preventDefault(); cleanup(input.value); }
        }
        activeDialogCleanup = cleanup;
        overlay.onclick = function() { cleanup(null); };
        cancelBtn.onclick = function() { cleanup(null); };
        confirmBtn.onclick = function() { cleanup(input.value); };
        document.addEventListener('keydown', handleKey);
        input.focus();
        input.select();
      });
    }

    function smaranAlert(options) {
      return new Promise(function(resolve) {
        if (activeDialogCleanup) activeDialogCleanup(undefined);
        const mc = document.getElementById('modal-container');
        const title = options.title || 'Notice';
        const message = options.message || '';
        const confirmText = options.confirmText || 'OK';
        const tone = options.tone || 'neutral';

        mc.innerHTML = '<div class="modal-overlay" id="smaran-dialog-overlay">' +
          '<div class="modal-box" onclick="event.stopPropagation()">' +
            '<div class="modal-title" style="' + (tone === 'error' ? 'color:var(--danger);' : '') + '">' + escapeHtml(title) + '</div>' +
            '<div class="modal-message">' + escapeHtml(message) + '</div>' +
            '<div class="modal-actions">' +
              '<button type="button" class="primary" id="smaran-dialog-confirm">' + escapeHtml(confirmText) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

        const overlay = document.getElementById('smaran-dialog-overlay');
        const confirmBtn = document.getElementById('smaran-dialog-confirm');

        function cleanup() {
          document.removeEventListener('keydown', handleKey);
          activeDialogCleanup = null;
          mc.innerHTML = '';
          resolve();
        }
        function handleKey(e) {
          if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); cleanup(); }
        }
        activeDialogCleanup = cleanup;
        overlay.onclick = function() { cleanup(); };
        confirmBtn.onclick = function() { cleanup(); };
        document.addEventListener('keydown', handleKey);
        confirmBtn.focus();
      });
    }

    async function deleteSelected() {
      if (selectedPaths.size === 0) return;
      const count = selectedPaths.size;
      const ok = await smaranConfirm({
        title: 'Delete Selected Items',
        message: 'Are you sure you want to permanently delete ' + count + ' selected item' + (count > 1 ? 's' : '') + '? This action cannot be undone.',
        confirmText: 'Delete ' + count + ' Item' + (count > 1 ? 's' : ''),
        isDanger: true
      });
      if (!ok) return;
      for (const p of selectedPaths) {
        await fetch('/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: p })
        });
      }
      clearSelection();
      showToast(count + ' item' + (count > 1 ? 's' : '') + ' deleted');
      loadFiles();
    }

    /* Lightbox & Media Players */
    function openImageLightbox(item) {
      lightboxIndex = imageFiles.findIndex(f => f.relativePath === item.relativePath);
      if (lightboxIndex === -1) lightboxIndex = 0;
      zoomLevel = 1;
      rotation = 0;
      showLightboxModal();
    }

    function showLightboxModal() {
      const cur = imageFiles[lightboxIndex];
      if (!cur) return;

      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\${escapeHtml(cur.name)} (\${formatBytes(cur.size)})</span>
              <button class="icon-only" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body" style="margin-bottom:0;">
              <div class="lightbox-img-wrap">
                <img id="lb-image" class="lightbox-img" src="/raw/\${encodeURIComponent(cur.relativePath)}" style="transform: scale(\${zoomLevel}) rotate(\${rotation}deg);">
              </div>
              <div class="lightbox-toolbar">
                <div style="display:flex; gap:6px;">
                  <button onclick="prevImage()" \${imageFiles.length <= 1 ? 'disabled' : ''}>← Prev</button>
                  <button onclick="nextImage()" \${imageFiles.length <= 1 ? 'disabled' : ''}>Next →</button>
                  <span style="align-self:center; font-size:12px; color:var(--muted); margin-left:6px;">\${lightboxIndex + 1} / \${imageFiles.length}</span>
                </div>
                <div style="display:flex; gap:6px;">
                  <button onclick="rotateImage()">Rotate</button>
                  <button onclick="zoomImage(0.2)">Zoom +</button>
                  <button onclick="zoomImage(-0.2)">Zoom -</button>
                  <a class="btn primary" href="/download/\${encodeURIComponent(cur.relativePath)}" download="\${escapeHtml(cur.name)}">Download</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    function prevImage() {
      if (imageFiles.length === 0) return;
      lightboxIndex = (lightboxIndex - 1 + imageFiles.length) % imageFiles.length;
      zoomLevel = 1;
      rotation = 0;
      showLightboxModal();
    }

    function nextImage() {
      if (imageFiles.length === 0) return;
      lightboxIndex = (lightboxIndex + 1) % imageFiles.length;
      zoomLevel = 1;
      rotation = 0;
      showLightboxModal();
    }

    function zoomImage(delta) {
      zoomLevel = Math.max(0.5, Math.min(3, zoomLevel + delta));
      const img = document.getElementById('lb-image');
      if (img) img.style.transform = \`scale(\${zoomLevel}) rotate(\${rotation}deg)\`;
    }

    function rotateImage() {
      rotation = (rotation + 90) % 360;
      const img = document.getElementById('lb-image');
      if (img) img.style.transform = \`scale(\${zoomLevel}) rotate(\${rotation}deg)\`;
    }

    function openVideoPlayer(item) {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\${escapeHtml(item.name)}</span>
              <button class="icon-only" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body" style="text-align:center;">
              <video controls autoplay playsinline style="max-width:100%; max-height:70vh; border-radius:6px; background:#000;">
                <source src="/raw/\${encodeURIComponent(item.relativePath)}">
                Your browser does not support HTML5 video playback.
              </video>
            </div>
            <div class="modal-actions">
              <a class="btn primary" href="/download/\${encodeURIComponent(item.relativePath)}" download="\${escapeHtml(item.name)}">Download Video</a>
            </div>
          </div>
        </div>
      \`;
    }

    function openAudioPlayer(item) {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\${escapeHtml(item.name)}</span>
              <button class="icon-only" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body" style="text-align:center; padding:18px 0;">
              <audio controls autoplay style="width:100%;">
                <source src="/raw/\${encodeURIComponent(item.relativePath)}">
              </audio>
            </div>
            <div class="modal-actions">
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
        window._activePreviewText = text;
        const mc = document.getElementById('modal-container');
        mc.innerHTML = \`
          <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-box large" onclick="event.stopPropagation()">
              <div class="modal-title">
                <span>\${escapeHtml(item.name)} (\${formatBytes(item.size)})</span>
                <button class="icon-only" onclick="closeModal()">✕</button>
              </div>
              <div class="modal-body">
                <pre class="code-view"><code>\${escapeHtml(text)}</code></pre>
              </div>
              <div class="modal-actions">
                <button onclick="copyPreviewText()">Copy Text</button>
                <a class="btn primary" href="/download/\${encodeURIComponent(item.relativePath)}" download="\${escapeHtml(item.name)}">Download</a>
              </div>
            </div>
          </div>
        \`;
      } catch (err) {
        showToast('Failed to load file preview: ' + err.message);
      }
    }

    function copyPreviewText() {
      if (window._activePreviewText) {
        navigator.clipboard.writeText(window._activePreviewText);
        showToast('Copied to clipboard');
      }
    }

    function openPdfViewer(item) {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" style="height:85vh; display:flex; flex-direction:column;" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\${escapeHtml(item.name)}</span>
              <button class="icon-only" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body" style="flex:1; margin-bottom:0;">
              <iframe src="/raw/\${encodeURIComponent(item.relativePath)}" style="width:100%; height:100%; border:none; border-radius:6px; background:#fff;"></iframe>
            </div>
          </div>
        </div>
      \`;
    }

    function showWebDavHelp() {
      const host = window.location.host;
      const proto = window.location.protocol;
      const davUrl = proto + '//' + host + '/';
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Map as Windows Network Drive</span>
              <button class="icon-only" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body" style="font-size:13px; color:var(--text); line-height:1.6;">
              <p style="margin-bottom:10px;">You can mount this Smaran File Server directly inside Windows File Explorer as a drive letter (e.g. <code>Z:</code>) or inside macOS Finder.</p>
              <div style="background:#0d0d0f; border:1px solid var(--line); border-radius:6px; padding:10px; margin-bottom:12px; font-family:monospace; font-size:12px; word-break:break-all;">
                net use Z: \${davUrl}
              </div>
              <p style="font-size:12px; color:var(--muted);"><strong>In Windows Explorer:</strong> Right click "This PC" → "Map network drive" → enter <code>\${davUrl}</code> → click Finish.</p>
              <p style="font-size:12px; color:var(--muted); margin-top:6px;"><strong>In macOS:</strong> Finder → Go → Connect to Server → enter <code>\${davUrl}</code>.</p>
            </div>
            <div class="modal-actions">
              <button class="primary" onclick="navigator.clipboard.writeText('net use Z: ' + '\${davUrl}'); showToast('Command copied!');">Copy Command</button>
            </div>
          </div>
        </div>
      \`;
    }

    async function promptComment(item) {
      const current = item.comment || '';
      const text = await smaranPrompt({
        title: 'File Description',
        message: 'Enter a description or comment for "' + item.name + '":',
        defaultValue: current,
        placeholder: 'Enter notes or description...',
        confirmText: 'Save Description'
      });
      if (text === null) return;
      fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.relativePath, comment: text.trim() })
      }).then(res => {
        if (!res.ok) throw new Error('Could not update description');
        showToast('Description updated');
        loadFiles();
      }).catch(err => smaranAlert({ title: 'Error', message: err.message, tone: 'error' }));
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

    async function handleFileSelect(files) {
      if (!files || files.length === 0) return;
      for (const file of files) {
        await uploadFile(file);
      }
      document.getElementById('file-input').value = '';
      loadFiles();
    }

    function uploadFile(file) {
      return new Promise((resolve) => {
        const pc = document.getElementById('progress-container');
        const card = document.createElement('div');
        card.className = 'progress-card';
        card.innerHTML = \`
          <div style="display:flex; justify-content:space-between; font-size:12px;">
            <span>\${escapeHtml(file.name)} (\${formatBytes(file.size)})</span>
            <span class="pct">0%</span>
          </div>
          <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:0%"></div></div>
        \`;
        pc.appendChild(card);

        const fill = card.querySelector('.progress-bar-fill');
        const pct = card.querySelector('.pct');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload?path=' + encodeURIComponent(currentPath) + '&name=' + encodeURIComponent(file.name));

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const p = Math.round((e.loaded / e.total) * 100);
            fill.style.width = p + '%';
            pct.innerText = p + '%';
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            pct.innerText = 'Done';
            pct.style.color = 'var(--ok)';
          } else {
            pct.innerText = 'Failed';
            pct.style.color = 'var(--danger)';
          }
          setTimeout(() => card.remove(), 2500);
          resolve();
        };

        xhr.onerror = () => {
          pct.innerText = 'Error';
          pct.style.color = 'var(--danger)';
          setTimeout(() => card.remove(), 2500);
          resolve();
        };

        xhr.send(file);
      });
    }

    // Drag and drop handling
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
        message: 'Create a new folder in ' + (currentPath === '/' ? 'the root directory' : currentPath) + ':',
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
              <p class="modal-message">This server requires authentication to access and manage files.</p>
              <div id="login-error-msg" class="login-error-alert" style="display:none;"></div>
              <div style="margin-bottom:12px;">
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:5px; font-weight:500;">Username</label>
                <input type="text" class="modal-input" id="login-user" style="margin-bottom:0;" autofocus />
              </div>
              <div>
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:5px; font-weight:500;">Password</label>
                <input type="password" class="modal-input" id="login-pass" style="margin-bottom:0;" />
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
      if (uInput) uInput.focus();
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
          document.getElementById('modal-container').innerHTML = '';
          loadFiles();
        } else {
          const errData = await res.json().catch(() => ({}));
          const msg = errData.error || 'Invalid username or password';
          if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
          } else {
            smaranAlert({ title: 'Sign In Failed', message: msg, tone: 'error' });
          }
        }
      } catch (err) {
        if (errEl) {
          errEl.textContent = 'Server connection failed';
          errEl.style.display = 'block';
        } else {
          smaranAlert({ title: 'Network Error', message: 'Could not connect to the file server', tone: 'error' });
        }
      }
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

    // Initialize Animated Logo & Initial Load
    initSmaranDots();
    loadFiles();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
