/**
 * Generates the self-contained Web File Manager HTML/CSS/JS served to LAN clients.
 * Zero external dependencies: works offline on any Wi-Fi or airgapped LAN.
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
      gap: 10px;
    }
    button, .btn {
      background: var(--card);
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 7px 13px;
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
    main {
      flex: 1;
      padding: 20px 24px;
      max-width: 1200px;
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
    .search-box {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 6px 12px;
      color: var(--text);
      font-size: 13px;
      width: 220px;
      outline: none;
    }
    .search-box:focus { border-color: var(--accent); }
    .dropzone {
      border: 2px dashed var(--line);
      border-radius: 10px;
      padding: 24px;
      text-align: center;
      margin-bottom: 20px;
      background: rgba(27, 27, 30, 0.5);
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
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
    }
    .file-table tr:last-child td { border-bottom: none; }
    .file-table tr:hover td { background: var(--card-hover); }
    .file-name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 500;
      cursor: pointer;
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
      gap: 6px;
    }
    .action-btn {
      padding: 4px 8px;
      font-size: 12px;
    }
    .progress-list {
      margin-bottom: 20px;
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
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal-box {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 24px;
      width: 90%;
      max-width: 440px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .modal-title {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .modal-body { margin-bottom: 20px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
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
      main { padding: 16px; }
      .search-box { width: 100%; }
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
      <button onclick="loadFiles()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
      </button>
      <input type="file" id="file-input" multiple style="display:none" onchange="handleFileSelect(this.files)">
    </div>
  </header>

  <main>
    <div class="nav-bar">
      <div class="breadcrumbs" id="breadcrumbs"></div>
      <input type="text" class="search-box" id="search-input" placeholder="Search files..." oninput="filterFiles()">
    </div>

    <div class="progress-list" id="progress-container"></div>

    <div class="dropzone" id="dropzone" onclick="triggerFileInput()">
      <p style="font-weight: 500;">Drag and drop files anywhere to upload</p>
      <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">or click here to browse files</p>
    </div>

    <table class="file-table" id="file-table">
      <thead>
        <tr>
          <th>Name</th>
          <th class="hide-mobile">Size</th>
          <th class="hide-mobile">Modified</th>
          <th style="text-align: right;">Actions</th>
        </tr>
      </thead>
      <tbody id="file-list"></tbody>
    </table>
  </main>

  <div id="modal-container"></div>
  <div id="toast-container"></div>

  <script>
    let currentPath = '';
    let allItems = [];
    let isUploading = false;

    function escapeHtml(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
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

    function renderFiles(items) {
      const tbody = document.getElementById('file-list');
      tbody.innerHTML = '';

      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No files in this folder</td></tr>';
        return;
      }

      // Sort folders first, then by name
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      items.forEach(item => {
        const tr = document.createElement('tr');

        // Name cell
        const tdName = document.createElement('td');
        const divName = document.createElement('div');
        divName.className = 'file-name-cell';

        const iconSvg = item.isDirectory
          ? '<svg class="file-icon folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
          : '<svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

        divName.innerHTML = iconSvg + '<span>' + escapeHtml(item.name) + '</span>';
        if (item.isDirectory) {
          divName.onclick = () => loadFiles(item.relativePath);
        } else {
          divName.onclick = () => window.open('/raw/' + encodeURIComponent(item.relativePath), '_blank');
        }
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

        if (!item.isDirectory) {
          const downloadBtn = document.createElement('a');
          downloadBtn.className = 'btn action-btn';
          downloadBtn.href = '/download/' + encodeURIComponent(item.relativePath);
          downloadBtn.download = item.name;
          downloadBtn.title = 'Download';
          downloadBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
          divActions.appendChild(downloadBtn);
        }

        const renameBtn = document.createElement('button');
        renameBtn.className = 'action-btn';
        renameBtn.title = 'Rename';
        renameBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
        renameBtn.onclick = (e) => { e.stopPropagation(); promptRename(item); };
        divActions.appendChild(renameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn danger';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        deleteBtn.onclick = (e) => { e.stopPropagation(); confirmDelete(item); };
        divActions.appendChild(deleteBtn);

        tdActions.appendChild(divActions);

        tr.appendChild(tdName);
        tr.appendChild(tdSize);
        tr.appendChild(tdDate);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
    }

    function filterFiles() {
      const q = document.getElementById('search-input').value.toLowerCase().trim();
      if (!q) {
        renderFiles(allItems);
        return;
      }
      const filtered = allItems.filter(i => i.name.toLowerCase().includes(q));
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

    // Initial load
    loadFiles();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
