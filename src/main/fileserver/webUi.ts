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
      gap: 10px;
      font-weight: 600;
      font-size: 16px;
      color: var(--text);
    }
    .brand svg { color: var(--accent); }
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
    /* Modals & Lightbox */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
    }
    .modal-box {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 24px;
      width: 90%;
      max-width: 520px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .modal-box.large {
      max-width: 960px;
      width: 95%;
    }
    .modal-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .modal-body { margin-bottom: 20px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
        <line x1="6" y1="6" x2="6.01" y2="6"/>
        <line x1="6" y1="18" x2="6.01" y2="18"/>
      </svg>
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

    async function deleteSelected() {
      if (selectedPaths.size === 0) return;
      if (!confirm('Delete ' + selectedPaths.size + ' selected item(s)?')) return;
      for (const p of selectedPaths) {
        await fetch('/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: p })
        });
      }
      clearSelection();
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

    function promptComment(item) {
      const current = item.comment || '';
      const text = prompt('Edit description for "' + item.name + '":', current);
      if (text === null) return;
      fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.relativePath, comment: text.trim() })
      }).then(res => {
        if (!res.ok) throw new Error('Could not update description');
        loadFiles();
      }).catch(err => showToast(err.message));
    }

    function closeModal() {
      document.getElementById('modal-container').innerHTML = '';
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

    function promptNewFolder() {
      const name = prompt('Enter new folder name:');
      if (!name || !name.trim()) return;
      fetch('/api/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, name: name.trim() })
      }).then(res => {
        if (!res.ok) throw new Error('Could not create folder');
        loadFiles();
      }).catch(err => showToast(err.message));
    }

    function promptRename(item) {
      const newName = prompt('Rename ' + item.name + ' to:', item.name);
      if (!newName || newName.trim() === item.name) return;
      fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.relativePath, newName: newName.trim() })
      }).then(res => {
        if (!res.ok) throw new Error('Could not rename item');
        loadFiles();
      }).catch(err => showToast(err.message));
    }

    function confirmDelete(item) {
      if (!confirm('Are you sure you want to delete "' + item.name + '"?')) return;
      fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.relativePath })
      }).then(res => {
        if (!res.ok) throw new Error('Could not delete item');
        loadFiles();
      }).catch(err => showToast(err.message));
    }

    function showLoginModal() {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay">
          <div class="modal-box">
            <div class="modal-title">Sign In</div>
            <div class="modal-body">
              <p style="color:var(--muted); font-size:13px; margin-bottom:12px;">This server requires credentials to access files.</p>
              <div style="margin-bottom:10px;">
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">Username</label>
                <input type="text" id="login-user" autofocus>
              </div>
              <div>
                <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:4px;">Password</label>
                <input type="password" id="login-pass">
              </div>
            </div>
            <div class="modal-actions">
              <button class="primary" onclick="doLogin()">Log In</button>
            </div>
          </div>
        </div>
      \`;
    }

    async function doLogin() {
      const u = document.getElementById('login-user').value;
      const p = document.getElementById('login-pass').value;
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      if (res.ok) {
        document.getElementById('modal-container').innerHTML = '';
        loadFiles();
      } else {
        alert('Invalid credentials');
      }
    }

    // Keyboard navigation in lightbox
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    });

    // Initial load
    loadFiles();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
