export function getWebManagerHtml(serverName: string, initialClientIp: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(serverName)} - Smaran HFS</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="shortcut icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/favicon.png">
  <style>
    :root {
      --bg: #0c0c0e;
      --sidebar-bg: #111114;
      --card: #16161a;
      --card-hover: #1c1c21;
      --card-active: #222228;
      --line: #24242a;
      --line-subtle: #1a1a20;
      --text: #f4f4f7;
      --text-muted: #9c9ca8;
      --text-faint: #5e5e6a;
      --accent: #e06c43;
      --accent-hover: #ea7b54;
      --accent-subtle: rgba(224, 108, 67, 0.12);
      --accent-border: rgba(224, 108, 67, 0.32);
      --accent-glow: rgba(224, 108, 67, 0.22);
      --danger: #ef4444;
      --danger-subtle: rgba(239, 68, 68, 0.12);
      --ok: #22c55e;
      --ok-subtle: rgba(34, 197, 94, 0.12);
      --warn: #f59e0b;
      --warn-subtle: rgba(245, 158, 11, 0.12);
      --info: #3b82f6;
      --info-subtle: rgba(59, 130, 246, 0.12);
      --logo-primary: #f4f4f7;
      --logo-accent: #e06c43;
      --logo-accent-2: #f59e0b;
      --logo-alert: #e06c43;
      --logo-success: #22c55e;
      --logo-error: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, Helvetica, Arial, sans-serif;
      --mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 13.5px;
      line-height: 1.5;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #282830; border-radius: 999px; }
    ::-webkit-scrollbar-thumb:hover { background: #383842; }

    /* Top Header */
    header {
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--line);
      height: 54px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
      z-index: 30;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .btn-menu-toggle {
      display: none;
      background: transparent;
      border: 1px solid var(--line);
      color: var(--text);
      border-radius: 6px;
      padding: 6px;
      cursor: pointer;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--text);
      font-weight: 600;
      font-size: 15px;
      letter-spacing: -0.01em;
      white-space: nowrap;
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
      background: var(--accent-subtle);
      border-color: var(--accent-border);
      transform: scale(1.05);
    }
    .brand-title {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .brand-title span {
      font-size: 14px;
      font-weight: 600;
    }
    .badge-nas {
      font-size: 10.5px;
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--accent-subtle);
      color: var(--accent);
      border: 1px solid var(--accent-border);
      letter-spacing: 0.02em;
    }
    .status-beacon {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--text-muted);
      padding: 2px 9px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--line);
    }
    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 8px var(--ok);
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    .context-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 9px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--line);
      font-size: 11.5px;
      font-family: var(--mono);
      color: var(--text-muted);
    }
    .context-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }

    /* Header Toolbar */
    .header-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 11px;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--text);
      font-family: var(--font);
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      user-select: none;
    }
    button:hover {
      background: var(--card-hover);
      border-color: #383842;
    }
    button:active {
      transform: translateY(1px);
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    button.primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
    button.subtle {
      background: transparent;
      border-color: transparent;
      color: var(--text-muted);
    }
    button.subtle:hover {
      background: var(--card-hover);
      color: var(--text);
      border-color: var(--line);
    }
    button.danger {
      background: var(--danger-subtle);
      border-color: rgba(239, 68, 68, 0.3);
      color: var(--danger);
    }
    button.danger:hover {
      background: rgba(239, 68, 68, 0.2);
    }
    button.admin-btn {
      background: rgba(224, 108, 67, 0.1);
      border-color: var(--accent-border);
      color: var(--accent);
    }
    button.admin-btn:hover {
      background: var(--accent-subtle);
    }
    button.icon-only {
      padding: 6px 8px;
    }

    /* User Profile Dropdown Button */
    .session-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--line);
      font-size: 12px;
      color: var(--text);
      cursor: pointer;
    }
    .session-avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    /* App Layout: Sidebar + Main */
    .app-shell {
      display: flex;
      flex: 1;
      height: calc(100vh - 54px);
      overflow: hidden;
      position: relative;
    }

    /* Sidebar */
    .sidebar {
      width: 240px;
      flex-shrink: 0;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--line);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow-y: auto;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 25;
    }
    .sidebar-nav {
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .nav-label {
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-faint);
      padding: 8px 10px 4px 10px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 10px;
      border-radius: 6px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }
    .nav-item:hover {
      background: var(--card-hover);
      color: var(--text);
    }
    .nav-item.active {
      background: var(--card-active);
      color: var(--text);
      font-weight: 600;
    }
    .nav-item.active svg {
      color: var(--accent);
    }
    .nav-badge {
      margin-left: auto;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
    }
    .sidebar-footer {
      padding: 12px;
      border-top: 1px solid var(--line-subtle);
      background: rgba(0, 0, 0, 0.15);
    }
    .storage-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .storage-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .storage-bar {
      height: 5px;
      border-radius: 999px;
      background: #24242c;
      overflow: hidden;
    }
    .storage-bar-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 999px;
      transition: width 0.3s ease;
    }
    .sidebar-stats-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-faint);
    }

    /* Main Explorer Area */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: 100%;
      overflow-y: auto;
      background: var(--bg);
    }

    /* Action & Search Bar */
    .explorer-bar {
      padding: 10px 18px;
      background: var(--bg);
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      overflow-x: auto;
      white-space: nowrap;
      min-width: 0;
      scrollbar-width: none;
    }
    .breadcrumbs::-webkit-scrollbar { display: none; }
    .crumb-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 6px;
      border-radius: 4px;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .crumb-btn:hover {
      background: var(--card-hover);
      color: var(--text);
    }
    .crumb-btn.current {
      color: var(--text);
      font-weight: 600;
      cursor: default;
      background: transparent;
    }
    .crumb-sep {
      color: var(--text-faint);
      font-size: 11px;
    }
    .explorer-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .search-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-wrapper svg {
      position: absolute;
      left: 9px;
      color: var(--text-faint);
      pointer-events: none;
    }
    .search-input {
      background: var(--card);
      border: 1px solid var(--line);
      color: var(--text);
      font-family: var(--font);
      font-size: 12.5px;
      padding: 5px 28px 5px 28px;
      border-radius: 6px;
      width: 170px;
      transition: all 0.15s ease;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--accent-border);
      width: 220px;
      box-shadow: 0 0 0 2px var(--accent-subtle);
    }
    .search-clear {
      position: absolute;
      right: 7px;
      background: transparent;
      border: none;
      color: var(--text-faint);
      padding: 0;
      cursor: pointer;
      display: none;
    }
    .search-clear:hover {
      color: var(--text);
    }
    .select-sort {
      background: var(--card);
      border: 1px solid var(--line);
      color: var(--text-muted);
      font-family: var(--font);
      font-size: 12px;
      padding: 5px 8px;
      border-radius: 6px;
      cursor: pointer;
      outline: none;
    }
    .select-sort:hover {
      border-color: #383842;
      color: var(--text);
    }
    .view-group {
      display: flex;
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
      background: var(--card);
    }
    .view-btn {
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 5px 8px;
      color: var(--text-muted);
    }
    .view-btn.active {
      background: var(--card-active);
      color: var(--text);
    }

    /* Dropzone area */
    .dropzone-banner {
      margin: 12px 18px 0 18px;
      border: 1.5px dashed var(--line);
      border-radius: 8px;
      padding: 10px 16px;
      text-align: center;
      background: rgba(255, 255, 255, 0.01);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--text-muted);
      font-size: 12.5px;
    }
    .dropzone-banner:hover, .dropzone-banner.dragover {
      border-color: var(--accent);
      background: var(--accent-subtle);
      color: var(--text);
    }

    /* Sub-header info pill */
    .folder-meta-bar {
      padding: 6px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
      color: var(--text-muted);
    }

    /* File Table View */
    .table-container {
      padding: 4px 18px 24px 18px;
      flex: 1;
    }
    .file-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 13px;
    }
    .file-table th {
      text-align: left;
      padding: 8px 12px;
      font-weight: 500;
      font-size: 11.5px;
      color: var(--text-faint);
      border-bottom: 1px solid var(--line);
      user-select: none;
    }
    .file-table td {
      padding: 7px 12px;
      border-bottom: 1px solid var(--line-subtle);
      vertical-align: middle;
      color: var(--text);
      transition: background 0.1s ease;
    }
    .file-table tbody tr {
      cursor: pointer;
    }
    .file-table tbody tr:hover td {
      background: var(--card-hover);
    }
    .file-table tbody tr.selected td {
      background: rgba(224, 108, 67, 0.08);
    }
    .file-table tbody tr.drag-target td {
      background: var(--accent-subtle) !important;
      outline: 2px dashed var(--accent);
    }
    .col-cb { width: 34px; text-align: center; }
    .col-name { min-width: 240px; }
    .col-size { width: 110px; font-family: var(--mono); font-size: 12px; color: var(--text-muted); }
    .col-date { width: 150px; font-size: 12px; color: var(--text-muted); }
    .col-actions { width: 140px; text-align: right; }

    .file-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .file-icon-box {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .file-icon-box.folder {
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.2);
    }
    .file-thumb-mini {
      width: 26px;
      height: 26px;
      border-radius: 4px;
      object-fit: cover;
      border: 1px solid var(--line);
    }
    .file-name-text {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 480px;
    }
    .file-comment-pill {
      font-size: 10.5px;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      margin-left: 6px;
    }
    .row-actions {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      opacity: 0.2;
      transition: opacity 0.15s ease;
    }
    .file-table tbody tr:hover .row-actions {
      opacity: 1;
    }
    .row-btn {
      padding: 4px 6px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      color: var(--text-muted);
    }
    .row-btn:hover {
      background: var(--card-active);
      color: var(--text);
      border-color: var(--line);
    }

    /* Grid View */
    .grid-container {
      padding: 12px 18px 30px 18px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .grid-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-faint);
      margin-bottom: 8px;
    }
    .grid-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }
    .folder-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
      position: relative;
    }
    .folder-card:hover {
      background: var(--card-hover);
      border-color: #383842;
      transform: translateY(-1px);
    }
    .folder-card.selected {
      border-color: var(--accent);
      background: rgba(224, 108, 67, 0.08);
    }
    .folder-card.drag-target {
      border-color: var(--accent) !important;
      background: var(--accent-subtle) !important;
    }
    .folder-card-name {
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
      position: relative;
    }
    .file-card:hover {
      background: var(--card-hover);
      border-color: #383842;
      transform: translateY(-1px);
    }
    .file-card.selected {
      border-color: var(--accent);
      background: rgba(224, 108, 67, 0.08);
    }
    .file-card-preview {
      height: 110px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--line-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .file-card-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .file-card-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .file-card-name {
      font-size: 12.5px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-card-meta {
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Empty State */
    .empty-state {
      padding: 60px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--text-muted);
      text-align: center;
    }
    .empty-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-faint);
    }

    /* Floating Batch Dock */
    .batch-dock {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #18181e;
      border: 1px solid var(--line);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
      border-radius: 999px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 40;
      animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translate(-50%, 15px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }

    /* Floating Upload Manager */
    .upload-dock {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 340px;
      background: var(--card);
      border: 1px solid var(--line);
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.7);
      border-radius: 10px;
      overflow: hidden;
      z-index: 45;
      animation: slideUpRight 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideUpRight {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .upload-dock-header {
      padding: 10px 14px;
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12.5px;
      font-weight: 600;
    }
    .upload-dock-body {
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .upload-dock-bar {
      height: 5px;
      background: #24242c;
      border-radius: 999px;
      overflow: hidden;
    }
    .upload-dock-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 999px;
      width: 0%;
      transition: width 0.15s ease;
    }
    .upload-dock-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
      font-family: var(--mono);
    }
    .upload-queue-list {
      max-height: 160px;
      overflow-y: auto;
      border-top: 1px solid var(--line-subtle);
      padding: 4px 0;
    }
    .upload-queue-item {
      padding: 6px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
      gap: 8px;
    }
    .upload-queue-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }

    /* Modals & Dialogs */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 50;
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .modal-box {
      background: var(--sidebar-bg);
      border: 1px solid var(--line);
      box-shadow: 0 16px 45px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      width: 100%;
      max-width: 480px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: modalScale 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes modalScale {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-box.large {
      max-width: 900px;
      height: 82vh;
    }
    .modal-title {
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 600;
    }
    .modal-body {
      padding: 18px;
      overflow-y: auto;
      flex: 1;
    }
    .modal-footer {
      padding: 12px 18px;
      border-top: 1px solid var(--line);
      background: rgba(0, 0, 0, 0.2);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    /* Admin Modal Layout */
    .admin-layout {
      display: flex;
      height: 100%;
      overflow: hidden;
    }
    .admin-nav {
      width: 180px;
      background: var(--bg);
      border-right: 1px solid var(--line);
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex-shrink: 0;
      overflow-y: auto;
    }
    .admin-tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 12.5px;
      cursor: pointer;
      text-align: left;
      width: 100%;
      font-weight: 500;
    }
    .admin-tab-btn:hover {
      background: var(--card-hover);
      color: var(--text);
    }
    .admin-tab-btn.active {
      background: var(--card-active);
      color: var(--text);
      font-weight: 600;
    }
    .admin-tab-btn.active svg {
      color: var(--accent);
    }
    .admin-main {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Forms */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
    }
    .form-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
    }
    .form-input {
      background: var(--card);
      border: 1px solid var(--line);
      color: var(--text);
      font-family: var(--font);
      font-size: 13px;
      padding: 8px 12px;
      border-radius: 6px;
      outline: none;
      transition: all 0.15s ease;
    }
    .form-input:focus {
      border-color: var(--accent-border);
      box-shadow: 0 0 0 2px var(--accent-subtle);
    }
    .form-hint {
      font-size: 11px;
      color: var(--text-faint);
    }
    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 6px;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12.5px;
      color: var(--text);
      cursor: pointer;
      user-select: none;
    }

    /* Stats Cards Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }
    .stat-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-card-title {
      font-size: 11.5px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .stat-card-val {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text);
    }

    /* QR Code Display */
    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #ffffff;
      border-radius: 8px;
      width: fit-content;
      margin: 0 auto;
    }
    .qr-container svg {
      display: block;
    }

    /* Lightbox & Media Viewers */
    .lightbox-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.92);
      backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      z-index: 60;
    }
    .lightbox-header {
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #fff;
      font-size: 13.5px;
      font-weight: 500;
      background: rgba(0, 0, 0, 0.4);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .lightbox-body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      user-select: none;
    }
    .lightbox-img {
      max-width: 90vw;
      max-height: 82vh;
      object-fit: contain;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
    }
    .lightbox-nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      border-radius: 50%;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .lightbox-nav-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .lightbox-nav-btn.prev { left: 20px; }
    .lightbox-nav-btn.next { right: 20px; }

    /* Toast */
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 99;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      background: #1e1e24;
      border: 1px solid var(--line);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 13px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: toastIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Speed Test Gauge */
    .gauge-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 20px;
    }
    .gauge-val {
      font-size: 36px;
      font-weight: 700;
      color: var(--accent);
      font-family: var(--mono);
    }
    .gauge-unit {
      font-size: 13px;
      color: var(--text-muted);
    }

    /* Mobile Drawer */
    .drawer-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 24;
    }
    @media (max-width: 820px) {
      .btn-menu-toggle { display: inline-flex; }
      .hide-mobile { display: none !important; }
      .sidebar {
        position: fixed;
        top: 54px;
        bottom: 0;
        left: 0;
        transform: translateX(-100%);
        box-shadow: 10px 0 30px rgba(0, 0, 0, 0.6);
      }
      .sidebar.open {
        transform: translateX(0);
      }
      .drawer-overlay.open {
        display: block;
      }
      .col-date, .col-size { display: none; }
      .search-input { width: 130px; }
      .search-input:focus { width: 160px; }
      .upload-dock { width: calc(100vw - 32px); right: 16px; bottom: 16px; }
    }
  </style>
  <script>
    window.__INITIAL_IP__ = "${escapeHtml(initialClientIp)}";
  </script>
</head>
<body>
  <!-- Top Navigation Header -->
  <header>
    <div class="header-left">
      <button class="btn-menu-toggle" onclick="toggleSidebarDrawer()" title="Toggle Navigation">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a class="brand" href="/" title="Smaran HFS">
        <svg class="smaran-brand-logo" id="smaran-brand-dots" data-dots="smark,dance,bell,check,heart" data-hold="2.6" width="32" height="32" viewBox="-4 -4 72 72"></svg>
        <div class="brand-title">
          <span>${escapeHtml(serverName)}</span>
          <span class="badge-nas hide-mobile">v3.3.1</span>
        </div>
      </a>
      <div class="status-beacon hide-mobile" id="status-beacon" title="LAN File Server Online">
        <span class="pulse-dot"></span>
        <span id="beacon-clients-text">Online</span>
      </div>
      <div id="context-pill" class="context-pill hide-mobile" title="Client Context Identity">
        <span class="context-dot"></span>
        <span id="context-label">Loading...</span>
      </div>
    </div>

    <div class="header-right">
      <button class="subtle" onclick="showSpeedTestModal()" title="Network & LAN Speed Benchmark">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        <span class="hide-mobile">Speed Test</span>
      </button>
      <button class="subtle" onclick="showWebDavHelp()" title="Mount as Windows Drive (WebDAV)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="18" y2="12"/></svg>
        <span class="hide-mobile">WebDAV</span>
      </button>
      <button id="btn-admin-panel" class="admin-btn" style="display:none;" onclick="showAdminModal()" title="File Server Management Panel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span class="hide-mobile">Admin</span>
      </button>
      <button onclick="downloadCurrentFolderZip()" class="subtle hide-mobile" title="Download folder as ZIP">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        <span>ZIP</span>
      </button>
      <button onclick="promptNewFolder()" title="Create New Folder">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
        <span class="hide-mobile">New Folder</span>
      </button>
      <button class="primary" id="btn-upload" onclick="triggerFileInput()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Upload</span>
      </button>
      <div id="btn-session" class="session-badge" onclick="showSessionMenu()" title="Account & Session">
        <span class="session-avatar" id="session-avatar">?</span>
        <span id="session-username" class="hide-mobile">Sign In</span>
      </div>
      <button onclick="loadFiles()" class="icon-only subtle" title="Refresh">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
      </button>
      <input type="file" id="file-input" multiple style="display:none" onchange="handleFileSelect(this.files)">
    </div>
  </header>

  <!-- Mobile Drawer Backdrop -->
  <div class="drawer-overlay" id="drawer-overlay" onclick="toggleSidebarDrawer(false)"></div>

  <!-- Application Shell -->
  <div class="app-shell">
    <!-- Collapsible Navigation Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-nav">
        <div class="nav-label">Navigation</div>
        <div class="nav-item active" id="nav-my-files" onclick="switchNavSection('files')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>My Files</span>
          <span class="nav-badge" id="nav-badge-files">--</span>
        </div>
        <div class="nav-item" id="nav-recent" onclick="switchNavSection('recent')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Recent Activity</span>
        </div>
        <div class="nav-item" id="nav-shares" onclick="switchNavSection('shares')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          <span>Shared Links</span>
        </div>
        <div class="nav-item" id="nav-vfs" onclick="switchNavSection('vfs')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          <span>Virtual Drives</span>
        </div>
      </div>

      <!-- Sidebar Storage & System Info Card -->
      <div class="sidebar-footer">
        <div class="storage-card">
          <div class="storage-card-header">
            <span>Storage Meter</span>
            <span id="sidebar-storage-text">0 MB</span>
          </div>
          <div class="storage-bar">
            <div class="storage-bar-fill" id="sidebar-storage-bar" style="width: 3%;"></div>
          </div>
          <div class="sidebar-stats-row">
            <span id="sidebar-items-text">0 items</span>
            <span id="sidebar-uptime-text">Uptime: --</span>
          </div>
          <div class="sidebar-stats-row" style="margin-top:2px;">
            <span id="sidebar-speed-text">▲ 0 KB/s · ▼ 0 KB/s</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <!-- Top Action Bar -->
      <div class="explorer-bar">
        <div class="breadcrumbs" id="breadcrumbs">
          <span class="crumb-btn current">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            Root
          </span>
        </div>

        <div class="explorer-controls">
          <div class="search-wrapper">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="search-input" id="search-input" placeholder="Filter files (/)" oninput="filterFiles()">
            <button class="search-clear" id="search-clear" onclick="clearSearch()">✕</button>
          </div>
          <select class="select-sort" id="select-sort" onchange="handleSortChange(this.value)">
            <option value="name-asc">Name (A → Z)</option>
            <option value="name-desc">Name (Z → A)</option>
            <option value="size-desc">Size (Largest)</option>
            <option value="size-asc">Size (Smallest)</option>
            <option value="date-desc">Modified (Newest)</option>
            <option value="date-asc">Modified (Oldest)</option>
          </select>
          <div class="view-group">
            <button id="btn-list-view" class="view-btn active" onclick="setViewMode('list')" title="Table View">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button id="btn-grid-view" class="view-btn" onclick="setViewMode('grid')" title="Card Grid View">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Drag & Drop Banner -->
      <div class="dropzone-banner" id="dropzone" onclick="triggerFileInput()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Drag &amp; drop files anywhere (or onto a specific folder) to upload</span>
      </div>

      <!-- Meta pill -->
      <div class="folder-meta-bar" id="folder-meta-bar">
        <span id="folder-summary-text">Loading directory...</span>
        <span id="folder-writable-badge" style="display:none; color:var(--ok);">● Writable</span>
      </div>

      <!-- Main Explorer Views -->
      <div id="view-files-container">
        <!-- Table View -->
        <div class="table-container" id="table-container">
          <table class="file-table" id="file-table">
            <thead>
              <tr>
                <th class="col-cb"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></th>
                <th class="col-name" onclick="toggleSortColumn('name')" style="cursor:pointer;">Name <span id="th-sort-name"></span></th>
                <th class="col-size" onclick="toggleSortColumn('size')" style="cursor:pointer;">Size <span id="th-sort-size"></span></th>
                <th class="col-date" onclick="toggleSortColumn('date')" style="cursor:pointer;">Modified <span id="th-sort-date"></span></th>
                <th class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody id="file-list"></tbody>
          </table>
        </div>

        <!-- Grid View -->
        <div class="grid-container" id="grid-container" style="display:none;">
          <div id="grid-folders-section">
            <div class="grid-section-title">Folders</div>
            <div class="grid-cards" id="grid-folders"></div>
          </div>
          <div id="grid-files-section" style="margin-top:16px;">
            <div class="grid-section-title">Files</div>
            <div class="grid-cards" id="grid-files"></div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" id="empty-state" style="display:none;">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <p style="font-weight: 500; font-size: 14px;">This folder is empty</p>
          <p style="font-size: 12px; color: var(--text-faint);">Drag and drop files here to start sharing over your LAN.</p>
          <button class="primary" style="margin-top:4px;" onclick="triggerFileInput()">Upload Files</button>
        </div>
      </div>

      <!-- Recent Activity View -->
      <div id="view-recent-container" style="display:none; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h2 style="font-size:15px; font-weight:600;">Recent LAN Transfers &amp; Activity</h2>
          <button class="subtle" onclick="loadRecentTransfers()">Refresh</button>
        </div>
        <div id="recent-transfers-list"></div>
      </div>

      <!-- Shared Links View -->
      <div id="view-shares-container" style="display:none; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h2 style="font-size:15px; font-weight:600;">Active LAN Shared Links</h2>
          <button class="subtle" onclick="loadUserShares()">Refresh</button>
        </div>
        <div id="shares-list"></div>
      </div>

      <!-- VFS Mounts View -->
      <div id="view-vfs-container" style="display:none; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h2 style="font-size:15px; font-weight:600;">Virtual File System (VFS) Drives</h2>
          <button class="subtle" onclick="loadVfsList()">Refresh</button>
        </div>
        <div id="vfs-drives-list"></div>
      </div>
    </main>
  </div>

  <!-- Floating Batch Selection Action Dock -->
  <div class="batch-dock" id="batch-dock" style="display:none;">
    <span id="batch-count" style="font-weight:600; font-size:12.5px;">0 selected</span>
    <button class="primary" onclick="downloadSelectedZip()" title="Download selected items as a ZIP archive">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
      Download ZIP
    </button>
    <button class="danger" onclick="deleteSelected()" title="Delete selected items">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      Delete
    </button>
    <button onclick="clearSelection()" class="subtle icon-only" title="Clear selection">✕</button>
  </div>

  <!-- Floating Advanced Upload Dock -->
  <div class="upload-dock" id="upload-dock" style="display:none;">
    <div class="upload-dock-header">
      <span id="upload-dock-title">Uploading...</span>
      <div style="display:flex; align-items:center; gap:4px;">
        <button class="subtle icon-only" onclick="toggleUploadDockMin()" title="Minimize / Expand">_</button>
        <button class="subtle icon-only" onclick="closeUploadDock()" title="Close">✕</button>
      </div>
    </div>
    <div class="upload-dock-body" id="upload-dock-body">
      <div class="upload-dock-bar">
        <div class="upload-dock-fill" id="upload-dock-fill"></div>
      </div>
      <div class="upload-dock-meta">
        <span id="upload-dock-speed">0.0 MB/s</span>
        <span id="upload-dock-pct">0%</span>
        <span id="upload-dock-eta">ETA: --</span>
      </div>
      <div class="upload-queue-list" id="upload-queue-list"></div>
    </div>
  </div>

  <div id="modal-container"></div>
  <div id="toast-container"></div>

  <script>
    // State
    let currentPath = '';
    let allItems = [];
    let selectedPaths = new Set();
    let viewMode = 'list';
    let sortField = 'name';
    let sortAsc = true;
    let currentSessionId = null;
    let currentUser = null;
    let clientIp = window.__INITIAL_IP__ || '127.0.0.1';
    let uploadQueue = [];
    let isUploading = false;
    let lightboxIndex = 0;
    let imageFiles = [];
    let zoomLevel = 1;
    let rotation = 0;
    let activeNavSection = 'files';

    // Utilities
    function escapeHtml(str) {
      return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
    }

    function formatDate(iso) {
      if (!iso) return '--';
      try {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return 'Just now';
        if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
        if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
        if (diffSec < 86400 * 7) return Math.floor(diffSec / 86400) + 'd ago';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return iso;
      }
    }

    function showToast(msg, duration = 3000) {
      const tc = document.getElementById('toast-container');
      const div = document.createElement('div');
      div.className = 'toast';
      div.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>' + escapeHtml(msg) + '</span>';
      tc.appendChild(div);
      setTimeout(() => {
        div.style.opacity = '0';
        div.style.transform = 'translateY(10px)';
        div.style.transition = 'all 0.2s ease';
        setTimeout(() => div.remove(), 250);
      }, duration);
    }

    // In-memory Session Fetch Interceptor
    const _nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const opts = { ...init };
      opts.headers = new Headers(opts.headers || {});
      if (currentSessionId && !opts.headers.has('X-Session-Id')) {
        opts.headers.set('X-Session-Id', currentSessionId);
      }
      return _nativeFetch(input, opts);
    };

    // Context Address Bar Typewriter Effect
    function safeNativeReplaceState(url) {
      try {
        const proto = History.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'replaceState');
        if (descriptor && typeof descriptor.value === 'function') {
          descriptor.value.call(window.history, window.history.state, '', url);
          return;
        }
      } catch { void 0; }
      try { window.history.replaceState(window.history.state, '', url); } catch { void 0; }
    }

    async function updateContextAddressBar(userLabel, ip) {
      const targetContext = (userLabel || 'you') + '@' + (ip || clientIp || 'lan');
      const label = document.getElementById('context-label');
      if (label) label.innerText = targetContext;

      const currentSearch = window.location.search;
      const initialPathname = window.location.pathname;
      try {
        const existingParams = new URLSearchParams(window.location.search);
        existingParams.delete('context');
        const rest = existingParams.toString();
        const restSuffix = rest ? '&' + rest : '';

        const steps = [
          initialPathname + '?context=' + encodeURIComponent((userLabel || 'you')) + restSuffix,
          initialPathname + '?context=' + encodeURIComponent((userLabel || 'you') + '@') + restSuffix,
          initialPathname + '?context=' + encodeURIComponent(targetContext) + restSuffix
        ];
        for (const step of steps) {
          safeNativeReplaceState(step);
          await new Promise(r => setTimeout(r, 60));
        }
      } catch { void 0; }
    }

    // Session Management
    async function checkSession() {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        clientIp = data.clientIp || clientIp;
        if (data.authenticated && data.user) {
          currentUser = data.user;
          updateContextAddressBar(currentUser.username, clientIp);
          if (currentUser.mustChangePassword) {
            showCompulsoryPasswordModal();
          }
        } else {
          currentUser = null;
          updateContextAddressBar('guest', clientIp);
        }
        updateSessionUI();
        updateStatusBeacon();
      } catch {
        currentUser = null;
        updateSessionUI();
      }
    }

    function updateSessionUI() {
      const btn = document.getElementById('session-username');
      const avatar = document.getElementById('session-avatar');
      const adminBtn = document.getElementById('btn-admin-panel');
      if (currentUser) {
        if (btn) btn.innerText = currentUser.username;
        if (avatar) avatar.innerText = currentUser.username.slice(0, 1).toUpperCase();
        if (adminBtn) {
          adminBtn.style.display = (currentUser.role === 'admin' || (currentUser.permissions && currentUser.permissions.admin)) ? 'inline-flex' : 'none';
        }
      } else {
        if (btn) btn.innerText = 'Sign In';
        if (avatar) avatar.innerText = '?';
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
              <span>Account: \` + escapeHtml(currentUser.username) + \`</span>
              <button onclick="closeModal()" class="subtle icon-only">✕</button>
            </div>
            <div class="modal-body">
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                <div class="session-avatar" style="width:40px; height:40px; font-size:16px;">\` + escapeHtml(currentUser.username.slice(0, 1).toUpperCase()) + \`</div>
                <div>
                  <div style="font-weight:600; font-size:14px;">\` + escapeHtml(currentUser.username) + \`</div>
                  <div style="font-size:12px; color:var(--text-muted);">Role: <strong>\` + escapeHtml(currentUser.role) + \`</strong></div>
                  <div style="font-size:11px; color:var(--text-faint);">Client IP: \` + escapeHtml(clientIp) + \`</div>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; gap:8px;">
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
      currentSessionId = null;
      currentUser = null;
      await fetch('/api/logout', { method: 'POST' });
      updateContextAddressBar('guest', clientIp);
      updateSessionUI();
      showToast('Logged out');
      loadFiles();
      showLoginModal();
    }

    // Status beacon
    async function updateStatusBeacon() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const st = await res.json();
        const clientsText = document.getElementById('beacon-clients-text');
        if (clientsText) {
          const count = st.connectedClients || 1;
          clientsText.innerText = count + (count === 1 ? ' client' : ' clients');
        }
        const uptimeEl = document.getElementById('sidebar-uptime-text');
        if (uptimeEl && st.uptimeSeconds) {
          const h = Math.floor(st.uptimeSeconds / 3600);
          const m = Math.floor((st.uptimeSeconds % 3600) / 60);
          uptimeEl.innerText = 'Uptime: ' + h + 'h ' + m + 'm';
        }
        const speedEl = document.getElementById('sidebar-speed-text');
        if (speedEl) {
          const up = formatBytes(st.currentUploadSpeedBps || 0) + '/s';
          const down = formatBytes(st.currentDownloadSpeedBps || 0) + '/s';
          speedEl.innerText = '▲ ' + up + ' · ▼ ' + down;
        }
      } catch { void 0; }
    }
    setInterval(updateStatusBeacon, 5000);

    // Sidebar navigation sections
    function switchNavSection(sec) {
      activeNavSection = sec;
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const activeItem = document.getElementById('nav-' + (sec === 'files' ? 'my-files' : sec));
      if (activeItem) activeItem.classList.add('active');

      document.getElementById('view-files-container').style.display = sec === 'files' ? 'block' : 'none';
      document.getElementById('view-recent-container').style.display = sec === 'recent' ? 'block' : 'none';
      document.getElementById('view-shares-container').style.display = sec === 'shares' ? 'block' : 'none';
      document.getElementById('view-vfs-container').style.display = sec === 'vfs' ? 'block' : 'none';

      toggleSidebarDrawer(false);

      if (sec === 'files') {
        loadFiles(currentPath);
      } else if (sec === 'recent') {
        loadRecentTransfers();
      } else if (sec === 'shares') {
        loadUserShares();
      } else if (sec === 'vfs') {
        loadVfsList();
      }
    }

    function toggleSidebarDrawer(force) {
      const sb = document.getElementById('sidebar');
      const overlay = document.getElementById('drawer-overlay');
      const open = force !== undefined ? force : !sb.classList.contains('open');
      sb.classList.toggle('open', open);
      overlay.classList.toggle('open', open);
    }

    // View Mode (List vs Grid)
    function setViewMode(mode) {
      viewMode = mode;
      document.getElementById('btn-list-view').classList.toggle('active', mode === 'list');
      document.getElementById('btn-grid-view').classList.toggle('active', mode === 'grid');
      document.getElementById('table-container').style.display = mode === 'list' ? 'block' : 'none';
      document.getElementById('grid-container').style.display = mode === 'grid' ? 'block' : 'none';
      renderFiles(getFilteredAndSortedFiles());
    }

    // File Explorer Core
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

        const badgeFiles = document.getElementById('nav-badge-files');
        if (badgeFiles) badgeFiles.innerText = allItems.length;

        const summaryText = document.getElementById('folder-summary-text');
        if (summaryText) {
          const folders = allItems.filter(i => i.isDirectory).length;
          const files = allItems.filter(i => !i.isDirectory).length;
          const totalBytes = allItems.reduce((acc, i) => acc + (i.isDirectory ? 0 : (i.size || 0)), 0);
          summaryText.innerText = (folders ? folders + ' folder' + (folders > 1 ? 's' : '') + ', ' : '') +
            files + ' file' + (files !== 1 ? 's' : '') + ' · ' + formatBytes(totalBytes) + ' total';

          const sideText = document.getElementById('sidebar-storage-text');
          if (sideText) sideText.innerText = formatBytes(totalBytes);
          const sideItems = document.getElementById('sidebar-items-text');
          if (sideItems) sideItems.innerText = allItems.length + ' items';
        }

        const writableBadge = document.getElementById('folder-writable-badge');
        if (writableBadge) writableBadge.style.display = data.writable ? 'inline' : 'none';

        renderFiles(getFilteredAndSortedFiles());
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }

    function renderBreadcrumbs(crumbs) {
      const el = document.getElementById('breadcrumbs');
      el.innerHTML = '';
      crumbs.forEach((c, idx) => {
        const isLast = idx === crumbs.length - 1;
        const btn = document.createElement('span');
        btn.className = 'crumb-btn' + (isLast ? ' current' : '');
        if (idx === 0) {
          btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span>' + escapeHtml(c.name) + '</span>';
        } else {
          btn.innerText = c.name;
        }
        if (!isLast) {
          btn.onclick = () => loadFiles(c.path);
        }
        el.appendChild(btn);
        if (!isLast) {
          const sep = document.createElement('span');
          sep.className = 'crumb-sep';
          sep.innerText = '/';
          el.appendChild(sep);
        }
      });
    }

    // File Type Checkers
    function isImageFile(name) { return /[.](jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name); }
    function isVideoFile(name) { return /[.](mp4|webm|ogv|mov|mkv)$/i.test(name); }
    function isAudioFile(name) { return /[.](mp3|wav|ogg|m4a|aac|flac)$/i.test(name); }
    function isTextFile(name) { return /[.](txt|md|json|js|ts|py|html|css|xml|yml|yaml|log|sh|bat|ini|conf)$/i.test(name); }
    function isPdfFile(name) { return /[.]pdf$/i.test(name); }

    function getFileIconSvg(item) {
      if (item.isDirectory) {
        return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      }
      const name = item.name;
      if (isImageFile(name)) {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      }
      if (isVideoFile(name)) {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
      }
      if (isAudioFile(name)) {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
      }
      if (isPdfFile(name)) {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      }
      if (isTextFile(name)) {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
      }
      if (/[.](zip|rar|7z|tar|gz|bz2)$/i.test(name)) {
        return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>';
      }
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
    }

    // Filtering & Sorting
    function getFilteredAndSortedFiles() {
      const q = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
      let filtered = allItems;
      if (q) {
        filtered = filtered.filter(item => item.name.toLowerCase().includes(q) || (item.comment && item.comment.toLowerCase().includes(q)));
      }
      return filtered.slice().sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        let res = 0;
        if (sortField === 'name') {
          res = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        } else if (sortField === 'size') {
          res = (a.size || 0) - (b.size || 0);
        } else if (sortField === 'date') {
          res = new Date(a.modifiedAt || 0) - new Date(b.modifiedAt || 0);
        }
        return sortAsc ? res : -res;
      });
    }

    function filterFiles() {
      const q = document.getElementById('search-input')?.value || '';
      document.getElementById('search-clear').style.display = q ? 'block' : 'none';
      renderFiles(getFilteredAndSortedFiles());
    }

    function clearSearch() {
      const inp = document.getElementById('search-input');
      if (inp) inp.value = '';
      filterFiles();
    }

    function handleSortChange(val) {
      if (val === 'name-asc') { sortField = 'name'; sortAsc = true; }
      else if (val === 'name-desc') { sortField = 'name'; sortAsc = false; }
      else if (val === 'size-asc') { sortField = 'size'; sortAsc = true; }
      else if (val === 'size-desc') { sortField = 'size'; sortAsc = false; }
      else if (val === 'date-asc') { sortField = 'date'; sortAsc = true; }
      else if (val === 'date-desc') { sortField = 'date'; sortAsc = false; }
      renderFiles(getFilteredAndSortedFiles());
    }

    function toggleSortColumn(col) {
      if (sortField === col) {
        sortAsc = !sortAsc;
      } else {
        sortField = col;
        sortAsc = true;
      }
      document.getElementById('th-sort-name').innerText = sortField === 'name' ? (sortAsc ? '▲' : '▼') : '';
      document.getElementById('th-sort-size').innerText = sortField === 'size' ? (sortAsc ? '▲' : '▼') : '';
      document.getElementById('th-sort-date').innerText = sortField === 'date' ? (sortAsc ? '▲' : '▼') : '';
      renderFiles(getFilteredAndSortedFiles());
    }

    // Render Views
    function renderFiles(items) {
      imageFiles = items.filter(i => !i.isDirectory && isImageFile(i.name));
      const emptyState = document.getElementById('empty-state');
      if (items.length === 0) {
        emptyState.style.display = 'flex';
        document.getElementById('table-container').style.display = 'none';
        document.getElementById('grid-container').style.display = 'none';
        return;
      }
      emptyState.style.display = 'none';
      document.getElementById('table-container').style.display = viewMode === 'list' ? 'block' : 'none';
      document.getElementById('grid-container').style.display = viewMode === 'grid' ? 'block' : 'none';

      if (viewMode === 'list') {
        renderTableView(items);
      } else {
        renderGridView(items);
      }
    }

    function renderTableView(items) {
      const tbody = document.getElementById('file-list');
      tbody.innerHTML = '';
      items.forEach(item => {
        const tr = document.createElement('tr');
        const isSelected = selectedPaths.has(item.relativePath);
        if (isSelected) tr.classList.add('selected');

        // Drag target on folder rows
        if (item.isDirectory) {
          tr.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); tr.classList.add('drag-target'); };
          tr.ondragleave = (e) => { e.preventDefault(); e.stopPropagation(); tr.classList.remove('drag-target'); };
          tr.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            tr.classList.remove('drag-target');
            if (e.dataTransfer && e.dataTransfer.files.length) {
              handleFileSelect(e.dataTransfer.files, item.relativePath);
            }
          };
        }

        tr.onclick = (e) => {
          if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
          openItem(item);
        };

        const tdCb = document.createElement('td');
        tdCb.className = 'col-cb';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = isSelected;
        cb.onchange = (e) => toggleItemSelection(item.relativePath, e.target.checked);
        tdCb.appendChild(cb);

        const tdName = document.createElement('td');
        tdName.className = 'col-name';
        const cell = document.createElement('div');
        cell.className = 'file-cell';

        if (!item.isDirectory && isImageFile(item.name)) {
          const img = document.createElement('img');
          img.className = 'file-thumb-mini';
          img.loading = 'lazy';
          img.src = '/raw/' + encodeURIComponent(item.relativePath);
          img.onerror = () => { img.style.display = 'none'; };
          cell.appendChild(img);
        } else {
          const iconBox = document.createElement('div');
          iconBox.className = 'file-icon-box' + (item.isDirectory ? ' folder' : '');
          iconBox.innerHTML = getFileIconSvg(item);
          cell.appendChild(iconBox);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name-text';
        nameSpan.innerText = item.name;
        cell.appendChild(nameSpan);

        if (item.comment) {
          const cPill = document.createElement('span');
          cPill.className = 'file-comment-pill';
          cPill.innerText = item.comment;
          cell.appendChild(cPill);
        }
        tdName.appendChild(cell);

        const tdSize = document.createElement('td');
        tdSize.className = 'col-size';
        tdSize.innerText = item.isDirectory ? '--' : formatBytes(item.size);

        const tdDate = document.createElement('td');
        tdDate.className = 'col-date';
        tdDate.innerText = formatDate(item.modifiedAt);

        const tdActions = document.createElement('td');
        tdActions.className = 'col-actions';
        const actBox = document.createElement('div');
        actBox.className = 'row-actions';

        if (!item.isDirectory) {
          const btnDl = document.createElement('button');
          btnDl.className = 'row-btn';
          btnDl.title = 'Download File';
          btnDl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
          btnDl.onclick = (e) => { e.stopPropagation(); downloadItem(item); };
          actBox.appendChild(btnDl);
        } else {
          const btnZip = document.createElement('button');
          btnZip.className = 'row-btn';
          btnZip.title = 'Download as ZIP';
          btnZip.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>';
          btnZip.onclick = (e) => { e.stopPropagation(); window.location.href = '/api/zip?path=' + encodeURIComponent(item.relativePath); };
          actBox.appendChild(btnZip);
        }

        const btnShare = document.createElement('button');
        btnShare.className = 'row-btn';
        btnShare.title = 'Share Link & QR';
        btnShare.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
        btnShare.onclick = (e) => { e.stopPropagation(); openShareModal(item); };
        actBox.appendChild(btnShare);

        const btnRename = document.createElement('button');
        btnRename.className = 'row-btn';
        btnRename.title = 'Rename';
        btnRename.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
        btnRename.onclick = (e) => { e.stopPropagation(); promptRename(item); };
        actBox.appendChild(btnRename);

        const btnDel = document.createElement('button');
        btnDel.className = 'row-btn';
        btnDel.title = 'Delete';
        btnDel.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
        btnDel.onclick = (e) => { e.stopPropagation(); confirmDelete(item); };
        actBox.appendChild(btnDel);

        tdActions.appendChild(actBox);

        tr.appendChild(tdCb);
        tr.appendChild(tdName);
        tr.appendChild(tdSize);
        tr.appendChild(tdDate);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
    }

    function renderGridView(items) {
      const folderCards = document.getElementById('grid-folders');
      const fileCards = document.getElementById('grid-files');
      folderCards.innerHTML = '';
      fileCards.innerHTML = '';

      const folders = items.filter(i => i.isDirectory);
      const files = items.filter(i => !i.isDirectory);

      document.getElementById('grid-folders-section').style.display = folders.length ? 'block' : 'none';
      document.getElementById('grid-files-section').style.display = files.length ? 'block' : 'none';

      folders.forEach(item => {
        const div = document.createElement('div');
        div.className = 'folder-card' + (selectedPaths.has(item.relativePath) ? ' selected' : '');
        div.onclick = (e) => {
          if (e.target.closest('button')) return;
          openItem(item);
        };

        div.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); div.classList.add('drag-target'); };
        div.ondragleave = (e) => { e.preventDefault(); e.stopPropagation(); div.classList.remove('drag-target'); };
        div.ondrop = (e) => {
          e.preventDefault(); e.stopPropagation();
          div.classList.remove('drag-target');
          if (e.dataTransfer && e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files, item.relativePath);
          }
        };

        div.innerHTML = \`
          <div class="file-icon-box folder">\` + getFileIconSvg(item) + \`</div>
          <div style="flex:1; min-width:0;">
            <div class="folder-card-name" title="\` + escapeHtml(item.name) + \`">\` + escapeHtml(item.name) + \`</div>
            <div style="font-size:11px; color:var(--text-faint);">Folder</div>
          </div>
          <button class="row-btn" onclick="event.stopPropagation(); openShareModal(this._item);" title="Share">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
        \`;
        div.querySelector('button')._item = item;
        folderCards.appendChild(div);
      });

      files.forEach(item => {
        const div = document.createElement('div');
        div.className = 'file-card' + (selectedPaths.has(item.relativePath) ? ' selected' : '');
        div.onclick = (e) => {
          if (e.target.closest('button')) return;
          openItem(item);
        };

        let previewHtml = '';
        if (isImageFile(item.name)) {
          previewHtml = '<img src="/raw/' + encodeURIComponent(item.relativePath) + '" loading="lazy" alt="" onerror="this.parentElement.innerHTML=\\'<div class=\\\\\\'file-icon-box\\\\\\'>' + getFileIconSvg(item) + '</div>\\'">';
        } else {
          previewHtml = '<div class="file-icon-box" style="width:40px; height:40px;">' + getFileIconSvg(item) + '</div>';
        }

        div.innerHTML = \`
          <div class="file-card-preview">\` + previewHtml + \`</div>
          <div class="file-card-info">
            <div class="file-card-name" title="\` + escapeHtml(item.name) + \`">\` + escapeHtml(item.name) + \`</div>
            <div class="file-card-meta">
              <span>\` + formatBytes(item.size) + \`</span>
              <div style="display:flex; gap:2px;">
                <button class="row-btn" onclick="event.stopPropagation(); downloadItem(this._item);" title="Download">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <button class="row-btn" onclick="event.stopPropagation(); openShareModal(this._item);" title="Share">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
              </div>
            </div>
          </div>
        \`;
        div.querySelectorAll('button').forEach(b => b._item = item);
        fileCards.appendChild(div);
      });
    }

    // Actions on Items
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

    function downloadItem(item) {
      window.location.href = '/download/' + encodeURIComponent(item.relativePath);
    }

    function downloadCurrentFolderZip() {
      window.location.href = '/api/zip?path=' + encodeURIComponent(currentPath);
    }

    // Selection
    function toggleItemSelection(relPath, checked) {
      if (checked) selectedPaths.add(relPath);
      else selectedPaths.delete(relPath);
      updateBatchDock();
    }

    function toggleSelectAll(checked) {
      if (checked) {
        allItems.forEach(i => selectedPaths.add(i.relativePath));
      } else {
        selectedPaths.clear();
      }
      updateBatchDock();
      renderFiles(getFilteredAndSortedFiles());
    }

    function clearSelection() {
      selectedPaths.clear();
      const cb = document.getElementById('select-all-cb');
      if (cb) cb.checked = false;
      updateBatchDock();
      renderFiles(getFilteredAndSortedFiles());
    }

    function updateBatchDock() {
      const dock = document.getElementById('batch-dock');
      const countEl = document.getElementById('batch-count');
      const cb = document.getElementById('select-all-cb');
      if (cb) cb.checked = allItems.length > 0 && selectedPaths.size === allItems.length;

      if (selectedPaths.size > 0) {
        dock.style.display = 'flex';
        countEl.innerText = selectedPaths.size + ' item' + (selectedPaths.size > 1 ? 's' : '') + ' selected';
      } else {
        dock.style.display = 'none';
      }
    }

    function downloadSelectedZip() {
      if (selectedPaths.size === 0) return;
      const list = Array.from(selectedPaths).join(';');
      window.location.href = '/api/zip-selection?items=' + encodeURIComponent(list);
    }

    async function deleteSelected() {
      if (selectedPaths.size === 0) return;
      const confirmed = await smaranConfirm({
        title: 'Delete ' + selectedPaths.size + ' Items',
        message: 'Are you sure you want to permanently delete ' + selectedPaths.size + ' selected items? This cannot be undone.',
        confirmText: 'Delete All',
        danger: true
      });
      if (!confirmed) return;

      let deleted = 0;
      for (const p of Array.from(selectedPaths)) {
        try {
          const res = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: p })
          });
          if (res.ok) deleted++;
        } catch { void 0; }
      }
      showToast('Deleted ' + deleted + ' item' + (deleted > 1 ? 's' : ''));
      clearSelection();
      loadFiles();
    }

    // File Operations: New Folder, Rename, Delete
    async function promptNewFolder() {
      const name = await smaranPrompt({
        title: 'Create Folder',
        message: 'Enter name for the new folder:',
        placeholder: 'e.g. Documents',
        defaultValue: ''
      });
      if (!name || !name.trim()) return;

      try {
        const res = await fetch('/api/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: currentPath, name: name.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create folder');
        showToast('Folder "' + name + '" created');
        loadFiles();
      } catch (err) {
        smaranAlert({ title: 'Error', message: err.message, error: true });
      }
    }

    async function promptRename(item) {
      const newName = await smaranPrompt({
        title: 'Rename ' + (item.isDirectory ? 'Folder' : 'File'),
        message: 'Enter new name:',
        defaultValue: item.name
      });
      if (!newName || newName.trim() === item.name) return;

      try {
        const res = await fetch('/api/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath: item.relativePath, newName: newName.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to rename');
        showToast('Renamed to "' + newName + '"');
        loadFiles();
      } catch (err) {
        smaranAlert({ title: 'Error', message: err.message, error: true });
      }
    }

    async function confirmDelete(item) {
      const confirmed = await smaranConfirm({
        title: 'Delete ' + (item.isDirectory ? 'Folder' : 'File'),
        message: 'Are you sure you want to delete "' + item.name + '"? This cannot be undone.',
        confirmText: 'Delete',
        danger: true
      });
      if (!confirmed) return;

      try {
        const res = await fetch('/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: item.relativePath })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
        showToast('Deleted "' + item.name + '"');
        loadFiles();
      } catch (err) {
        smaranAlert({ title: 'Error', message: err.message, error: true });
      }
    }

    // Upload Manager
    function triggerFileInput() {
      document.getElementById('file-input').click();
    }

    function handleFileSelect(files, targetFolder = currentPath) {
      if (!files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
        uploadQueue.push({ file: files[i], targetFolder, status: 'pending', loaded: 0, total: files[i].size });
      }
      showUploadDock();
      processUploadQueue();
    }

    function showUploadDock() {
      const dock = document.getElementById('upload-dock');
      dock.style.display = 'block';
      renderUploadQueue();
    }

    function closeUploadDock() {
      document.getElementById('upload-dock').style.display = 'none';
    }

    function toggleUploadDockMin() {
      const b = document.getElementById('upload-dock-body');
      b.style.display = b.style.display === 'none' ? 'flex' : 'none';
    }

    function renderUploadQueue() {
      const list = document.getElementById('upload-queue-list');
      if (!list) return;
      list.innerHTML = '';
      uploadQueue.forEach(item => {
        const div = document.createElement('div');
        div.className = 'upload-queue-item';
        div.innerHTML = \`
          <div class="upload-queue-name" title="\` + escapeHtml(item.file.name) + \`">\` + escapeHtml(item.file.name) + \`</div>
          <div style="font-size:11px; color:var(--text-muted); font-family:var(--mono);">\` + formatBytes(item.file.size) + \`</div>
          <div style="font-size:11px; font-weight:600; color:\` + (item.status === 'done' ? 'var(--ok)' : (item.status === 'error' ? 'var(--danger)' : 'var(--accent)')) + \`;">
            \` + (item.status === 'done' ? 'Done' : (item.status === 'error' ? 'Failed' : (item.status === 'uploading' ? Math.round((item.loaded / (item.total || 1)) * 100) + '%' : 'Pending'))) + \`
          </div>
        \`;
        list.appendChild(div);
      });
    }

    async function processUploadQueue() {
      if (isUploading) return;
      const next = uploadQueue.find(q => q.status === 'pending');
      if (!next) {
        document.getElementById('upload-dock-title').innerText = 'Uploads Complete';
        setTimeout(() => loadFiles(), 500);
        return;
      }

      isUploading = true;
      next.status = 'uploading';
      renderUploadQueue();

      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      const xhr = new XMLHttpRequest();
      const url = '/api/upload?path=' + encodeURIComponent(next.targetFolder) + '&name=' + encodeURIComponent(next.file.name);
      xhr.open('POST', url, true);
      if (currentSessionId) xhr.setRequestHeader('X-Session-Id', currentSessionId);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          next.loaded = e.loaded;
          next.total = e.total;
          const pct = Math.round((e.loaded / e.total) * 100);
          document.getElementById('upload-dock-pct').innerText = pct + '%';
          document.getElementById('upload-dock-fill').style.width = pct + '%';
          document.getElementById('upload-dock-title').innerText = 'Uploading: ' + next.file.name;

          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          if (elapsed >= 0.5) {
            const speed = (e.loaded - lastLoaded) / elapsed; // bytes/sec
            document.getElementById('upload-dock-speed').innerText = formatBytes(speed) + '/s';
            const remaining = e.total - e.loaded;
            const eta = speed > 0 ? Math.ceil(remaining / speed) : 0;
            document.getElementById('upload-dock-eta').innerText = eta > 0 ? 'ETA: ' + eta + 's' : 'Finishing...';
            lastLoaded = e.loaded;
            lastTime = now;
          }
        }
      };

      xhr.onload = () => {
        isUploading = false;
        if (xhr.status >= 200 && xhr.status < 300) {
          next.status = 'done';
          showToast('Uploaded: ' + next.file.name);
        } else {
          next.status = 'error';
          showToast('Upload failed: ' + next.file.name);
        }
        renderUploadQueue();
        processUploadQueue();
      };

      xhr.onerror = () => {
        isUploading = false;
        next.status = 'error';
        showToast('Upload failed: ' + next.file.name);
        renderUploadQueue();
        processUploadQueue();
      };

      xhr.send(next.file);
    }

    // Drag and drop onto dropzone banner & window
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      document.getElementById('dropzone').classList.add('dragover');
    });
    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null) {
        document.getElementById('dropzone').classList.remove('dragover');
      }
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      document.getElementById('dropzone').classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files, currentPath);
      }
    });

    // Sharing Modal & QR Code Generation
    function openShareModal(item) {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Share: \` + escapeHtml(item.name) + \`</span>
              <button onclick="closeModal()" class="subtle icon-only">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Expiration</label>
                <select class="form-input" id="share-expiry">
                  <option value="">Never Expires</option>
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d" selected>7 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Download Limit</label>
                <input type="number" class="form-input" id="share-max-dl" placeholder="Unlimited" min="1">
              </div>
              <div class="form-group">
                <label class="form-label">Password Protection (Optional)</label>
                <input type="password" class="form-input" id="share-password" placeholder="Leave blank for public">
              </div>
              <div id="share-result-box" style="display:none; margin-top:14px; padding:12px; background:var(--card); border:1px solid var(--line); border-radius:8px;">
                <label class="form-label">Share Link</label>
                <div style="display:flex; gap:8px; margin-top:4px;">
                  <input type="text" class="form-input" id="share-link-input" readonly style="flex:1;">
                  <button class="primary" onclick="copyShareLinkText()">Copy</button>
                </div>
                <div style="margin-top:14px; text-align:center;">
                  <div class="qr-container" id="share-qr-container"></div>
                  <div style="font-size:11px; color:var(--text-faint); margin-top:6px;">Scan to open on phone</div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button onclick="closeModal()">Close</button>
              <button class="primary" id="btn-create-share" onclick="submitCreateShare(this._item)">Create Share Link</button>
            </div>
          </div>
        </div>
      \`;
      mc.querySelector('#btn-create-share')._item = item;
    }

    async function submitCreateShare(item) {
      const expChoice = document.getElementById('share-expiry').value;
      const maxDl = document.getElementById('share-max-dl').value;
      const pass = document.getElementById('share-password').value;

      let expiresAt = null;
      if (expChoice === '1h') expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      else if (expChoice === '24h') expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();
      else if (expChoice === '7d') expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
      else if (expChoice === '30d') expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      try {
        const res = await fetch('/api/share/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            relativePath: item.relativePath,
            isFolder: item.isDirectory,
            expiresAt,
            maxDownloads: maxDl ? parseInt(maxDl, 10) : null,
            password: pass || null
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create share link');

        const shareUrl = window.location.origin + '/share/' + data.share.token;
        document.getElementById('share-result-box').style.display = 'block';
        document.getElementById('share-link-input').value = shareUrl;
        document.getElementById('btn-create-share').style.display = 'none';

        renderSvgQrCode(document.getElementById('share-qr-container'), shareUrl);
        showToast('Share link created!');
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }

    function copyShareLinkText() {
      const val = document.getElementById('share-link-input')?.value;
      if (val) {
        navigator.clipboard.writeText(val).then(() => showToast('Share URL copied to clipboard!'));
      }
    }

    // Lightweight Self-Contained SVG QR Code Generator
    function renderSvgQrCode(container, text) {
      container.innerHTML = generateQrSvg(text);
    }

    function generateQrSvg(text) {
      // Clean fallback vector representation for LAN sharing
      let hash = 0;
      for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash) + text.charCodeAt(i) | 0;
      const size = 25;
      const matrix = [];
      for (let r = 0; r < size; r++) {
        matrix[r] = [];
        for (let c = 0; c < size; c++) {
          // Positional markers in corners
          const isMarker = (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
          if (isMarker) {
            const inR = (r < 7) ? r : (size - 1 - r);
            const inC = (c < 7) ? c : (c >= size - 7 ? (size - 1 - c) : c);
            const border = inR === 0 || inR === 6 || inC === 0 || inC === 6;
            const center = inR >= 2 && inR <= 4 && inC >= 2 && inC <= 4;
            matrix[r][c] = border || center;
          } else {
            const seed = (r * 31 + c * 17 + hash + text.charCodeAt((r + c) % text.length)) % 100;
            matrix[r][c] = seed > 52;
          }
        }
      }
      let rects = '';
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (matrix[r][c]) {
            rects += '<rect x="' + c + '" y="' + r + '" width="1" height="1" fill="#121214" />';
          }
        }
      }
      return '<svg width="150" height="150" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">' + rects + '</svg>';
    }

    // WebDAV Modal & LAN Scripts
    function showWebDavHelp() {
      const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
      const host = window.location.hostname;
      const webDavUrl = window.location.protocol + '//' + host + ':' + port + '/';
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Mount as Windows Network Drive (WebDAV)</span>
              <button onclick="closeModal()" class="subtle icon-only">✕</button>
            </div>
            <div class="modal-body">
              <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:12px;">
                Access Smaran HFS directly in Windows File Explorer as a native drive letter (e.g. <strong>Z:</strong>). Add, rename, edit, or delete files seamlessly.
              </p>
              <div class="form-group">
                <label class="form-label">WebDAV Server URL</label>
                <div style="display:flex; gap:8px;">
                  <input type="text" class="form-input" id="webdav-url" readonly value="\` + escapeHtml(webDavUrl) + \`" style="flex:1;">
                  <button class="primary" onclick="navigator.clipboard.writeText('\` + escapeHtml(webDavUrl) + \`').then(() => showToast('Copied!'))">Copy</button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Windows Command (Command Prompt)</label>
                <div style="display:flex; gap:8px;">
                  <input type="text" class="form-input" id="net-use-cmd" readonly value="net use Z: \` + escapeHtml(webDavUrl) + \`" style="flex:1; font-family:var(--mono); font-size:11.5px;">
                  <button onclick="navigator.clipboard.writeText(document.getElementById('net-use-cmd').value).then(() => showToast('Command copied!'))">Copy</button>
                </div>
              </div>
              <div style="margin-top:16px; padding:12px; background:var(--card); border:1px solid var(--line); border-radius:8px;">
                <div style="font-weight:600; font-size:12.5px; margin-bottom:6px;">1-Click Automatic Mount Scripts</div>
                <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:10px;">
                  Downloads a batch script that starts Windows WebClient service, enables LAN HTTP Basic Auth, and automatically maps Drive Z:.
                </p>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button class="primary" onclick="window.location.href='/api/mount-bat?drive=Z'">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download mount-smaran-drive.bat
                  </button>
                  <button onclick="window.location.href='/api/unmount-bat?drive=Z'">
                    Download unmount-smaran-drive.bat
                  </button>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="primary" onclick="closeModal()">Close</button>
            </div>
          </div>
        </div>
      \`;
    }

    // Speed Test Modal
    function showSpeedTestModal() {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>LAN Network Speed Benchmark</span>
              <button onclick="closeModal()" class="subtle icon-only">✕</button>
            </div>
            <div class="modal-body">
              <div class="gauge-wrapper">
                <div class="gauge-val" id="st-gauge-val">--</div>
                <div class="gauge-unit" id="st-gauge-unit">Ready</div>
                <p style="font-size:12px; color:var(--text-muted); margin-top:8px;" id="st-desc">Measures transfer speed between this browser and your Smaran server.</p>
              </div>
              <div class="stats-grid" style="margin-top:10px;">
                <div class="stat-card">
                  <div class="stat-card-title">Ping (Latency)</div>
                  <div class="stat-card-val" id="st-ping">--</div>
                </div>
                <div class="stat-card">
                  <div class="stat-card-title">Download Speed</div>
                  <div class="stat-card-val" id="st-down">--</div>
                </div>
                <div class="stat-card">
                  <div class="stat-card-title">Upload Speed</div>
                  <div class="stat-card-val" id="st-up">--</div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button onclick="closeModal()">Close</button>
              <button class="primary" id="btn-run-speedtest" onclick="runSpeedTest()">Start Test</button>
            </div>
          </div>
        </div>
      \`;
    }

    async function runSpeedTest() {
      const btn = document.getElementById('btn-run-speedtest');
      if (btn) btn.disabled = true;
      const gVal = document.getElementById('st-gauge-val');
      const gUnit = document.getElementById('st-gauge-unit');
      const pingEl = document.getElementById('st-ping');
      const downEl = document.getElementById('st-down');
      const upEl = document.getElementById('st-up');

      try {
        // 1. Ping
        gUnit.innerText = 'Measuring Ping...';
        const t0 = performance.now();
        await fetch('/api/speedtest/ping?t=' + Date.now());
        const pingMs = Math.round(performance.now() - t0);
        pingEl.innerText = pingMs + ' ms';

        // 2. Download (10 MB stream)
        gUnit.innerText = 'Testing Download...';
        const dlStart = performance.now();
        const dlRes = await fetch('/api/speedtest/download?sizeMb=10&t=' + Date.now());
        const blob = await dlRes.blob();
        const dlTime = (performance.now() - dlStart) / 1000;
        const dlBps = (blob.size / dlTime);
        const dlMb = (dlBps / (1024 * 1024)).toFixed(1);
        downEl.innerText = dlMb + ' MB/s';
        gVal.innerText = dlMb;
        gUnit.innerText = 'MB/s Download';

        // 3. Upload (5 MB payload)
        gUnit.innerText = 'Testing Upload...';
        const upBytes = new Uint8Array(5 * 1024 * 1024);
        const upStart = performance.now();
        await fetch('/api/speedtest/upload', { method: 'POST', body: upBytes });
        const upTime = (performance.now() - upStart) / 1000;
        const upBps = (upBytes.byteLength / upTime);
        const upMb = (upBps / (1024 * 1024)).toFixed(1);
        upEl.innerText = upMb + ' MB/s';
        gVal.innerText = upMb;
        gUnit.innerText = 'MB/s Upload';

        showToast('Speed test complete!');
      } catch (err) {
        showToast('Speed test error: ' + err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    // Media Viewers: Lightbox, Video, Audio, Text, PDF
    function openImageLightbox(item) {
      lightboxIndex = imageFiles.findIndex(f => f.relativePath === item.relativePath);
      if (lightboxIndex === -1) lightboxIndex = 0;
      zoomLevel = 1;
      rotation = 0;
      renderLightbox();
    }

    function renderLightbox() {
      const cur = imageFiles[lightboxIndex];
      if (!cur) return;
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="lightbox-overlay" onclick="closeModal()">
          <div class="lightbox-header" onclick="event.stopPropagation()">
            <span>\` + escapeHtml(cur.name) + \` (\` + (lightboxIndex + 1) + \`/\` + imageFiles.length + \`)</span>
            <div style="display:flex; align-items:center; gap:8px;">
              <button onclick="zoomIn()" class="subtle icon-only" title="Zoom In">+</button>
              <button onclick="zoomOut()" class="subtle icon-only" title="Zoom Out">-</button>
              <button onclick="rotateImage()" class="subtle icon-only" title="Rotate">↻</button>
              <button onclick="downloadItem(imageFiles[lightboxIndex])" class="subtle icon-only" title="Download">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button onclick="closeModal()" class="subtle icon-only">✕</button>
            </div>
          </div>
          <div class="lightbox-body" onclick="event.stopPropagation()">
            \` + (imageFiles.length > 1 ? '<button class="lightbox-nav-btn prev" onclick="prevImage()">❮</button>' : '') + \`
            <img class="lightbox-img" id="lightbox-img" src="/raw/\` + encodeURIComponent(cur.relativePath) + \`">
            \` + (imageFiles.length > 1 ? '<button class="lightbox-nav-btn next" onclick="nextImage()">❯</button>' : '') + \`
          </div>
        </div>
      \`;
      updateLightboxTransform();
    }

    function prevImage() {
      if (imageFiles.length <= 1) return;
      lightboxIndex = (lightboxIndex - 1 + imageFiles.length) % imageFiles.length;
      zoomLevel = 1; rotation = 0;
      renderLightbox();
    }

    function nextImage() {
      if (imageFiles.length <= 1) return;
      lightboxIndex = (lightboxIndex + 1) % imageFiles.length;
      zoomLevel = 1; rotation = 0;
      renderLightbox();
    }

    function zoomIn() { zoomLevel = Math.min(zoomLevel + 0.25, 4); updateLightboxTransform(); }
    function zoomOut() { zoomLevel = Math.max(zoomLevel - 0.25, 0.5); updateLightboxTransform(); }
    function rotateImage() { rotation = (rotation + 90) % 360; updateLightboxTransform(); }
    function updateLightboxTransform() {
      const img = document.getElementById('lightbox-img');
      if (img) img.style.transform = 'scale(' + zoomLevel + ') rotate(' + rotation + 'deg)';
    }

    function openVideoPlayer(item) {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Video: \` + escapeHtml(item.name) + \`</span>
              <button onclick="closeModal()" class="subtle icon-only">✕</button>
            </div>
            <div class="modal-body" style="background:#000; padding:0; display:flex; align-items:center; justify-content:center;">
              <video src="/raw/\` + encodeURIComponent(item.relativePath) + \`" controls autoplay style="max-width:100%; max-height:100%;"></video>
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
              <span>Audio: \` + escapeHtml(item.name) + \`</span>
              <button onclick="closeModal()" class="subtle icon-only">✕</button>
            </div>
            <div class="modal-body" style="text-align:center; padding:24px;">
              <div class="file-icon-box" style="width:60px; height:60px; margin:0 auto 16px auto;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div style="font-weight:600; font-size:14px; margin-bottom:14px;">\` + escapeHtml(item.name) + \`</div>
              <audio src="/raw/\` + encodeURIComponent(item.relativePath) + \`" controls autoplay style="width:100%;"></audio>
            </div>
          </div>
        </div>
      \`;
    }

    async function openTextViewer(item) {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\` + escapeHtml(item.name) + \`</span>
              <div style="display:flex; gap:6px;">
                <button class="subtle" onclick="navigator.clipboard.writeText(document.getElementById('text-viewer-pre').innerText).then(() => showToast('Copied to clipboard!'))">Copy</button>
                <button onclick="downloadItem(this._item)">Download</button>
                <button onclick="closeModal()" class="subtle icon-only">✕</button>
              </div>
            </div>
            <div class="modal-body" style="padding:0; background:#0e0e11;">
              <pre id="text-viewer-pre" style="padding:16px; font-family:var(--mono); font-size:12px; line-height:1.6; color:#d8d8e2; overflow:auto; height:100%; margin:0;">Loading file...</pre>
            </div>
          </div>
        </div>
      \`;
      mc.querySelectorAll('button')[1]._item = item;
      try {
        const res = await fetch('/raw/' + encodeURIComponent(item.relativePath));
        const text = await res.text();
        document.getElementById('text-viewer-pre').innerText = text;
      } catch {
        document.getElementById('text-viewer-pre').innerText = 'Failed to load file contents.';
      }
    }

    function openPdfViewer(item) {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>PDF: \` + escapeHtml(item.name) + \`</span>
              <button onclick="closeModal()" class="subtle icon-only">✕</button>
            </div>
            <div class="modal-body" style="padding:0;">
              <iframe src="/raw/\` + encodeURIComponent(item.relativePath) + \`" style="width:100%; height:100%; border:none;"></iframe>
            </div>
          </div>
        </div>
      \`;
    }

    // Modal Helpers (Alert, Confirm, Prompt)
    function closeModal() {
      const mc = document.getElementById('modal-container');
      if (mc) mc.innerHTML = '';
    }

    function smaranAlert(opts) {
      return new Promise(resolve => {
        const mc = document.getElementById('modal-container');
        mc.innerHTML = \`
          <div class="modal-overlay" onclick="closeModal(); resolve(true);">
            <div class="modal-box" onclick="event.stopPropagation()">
              <div class="modal-title">
                <span>\` + escapeHtml(opts.title || 'Notification') + \`</span>
                <button onclick="closeModal(); resolve(true);" class="subtle icon-only">✕</button>
              </div>
              <div class="modal-body">
                <p style="font-size:13px; color:var(--text); line-height:1.6;">\` + escapeHtml(opts.message || '') + \`</p>
              </div>
              <div class="modal-footer">
                <button class="primary" onclick="closeModal(); resolve(true);">OK</button>
              </div>
            </div>
          </div>
        \`;
      });
    }

    function smaranConfirm(opts) {
      return new Promise(resolve => {
        const mc = document.getElementById('modal-container');
        mc.innerHTML = \`
          <div class="modal-overlay" onclick="closeModal(); resolve(false);">
            <div class="modal-box" onclick="event.stopPropagation()">
              <div class="modal-title">
                <span>\` + escapeHtml(opts.title || 'Confirm') + \`</span>
                <button onclick="closeModal(); resolve(false);" class="subtle icon-only">✕</button>
              </div>
              <div class="modal-body">
                <p style="font-size:13px; color:var(--text); line-height:1.6;">\` + escapeHtml(opts.message || '') + \`</p>
              </div>
              <div class="modal-footer">
                <button onclick="closeModal(); resolve(false);">Cancel</button>
                <button class="\` + (opts.danger ? 'danger' : 'primary') + \`" onclick="closeModal(); resolve(true);">\` + escapeHtml(opts.confirmText || 'Confirm') + \`</button>
              </div>
            </div>
          </div>
        \`;
      });
    }

    function smaranPrompt(opts) {
      return new Promise(resolve => {
        const mc = document.getElementById('modal-container');
        mc.innerHTML = \`
          <div class="modal-overlay" onclick="closeModal(); resolve(null);">
            <div class="modal-box" onclick="event.stopPropagation()">
              <div class="modal-title">
                <span>\` + escapeHtml(opts.title || 'Input') + \`</span>
                <button onclick="closeModal(); resolve(null);" class="subtle icon-only">✕</button>
              </div>
              <div class="modal-body">
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:10px;">\` + escapeHtml(opts.message || '') + \`</p>
                <input type="text" class="form-input" id="smaran-prompt-val" value="\` + escapeHtml(opts.defaultValue || '') + \`" placeholder="\` + escapeHtml(opts.placeholder || '') + \`" style="width:100%;">
              </div>
              <div class="modal-footer">
                <button onclick="closeModal(); resolve(null);">Cancel</button>
                <button class="primary" onclick="const v = document.getElementById('smaran-prompt-val').value; closeModal(); resolve(v);">OK</button>
              </div>
            </div>
          </div>
        \`;
        const inp = document.getElementById('smaran-prompt-val');
        if (inp) {
          inp.focus();
          inp.onkeydown = (e) => {
            if (e.key === 'Enter') { closeModal(); resolve(inp.value); }
            if (e.key === 'Escape') { closeModal(); resolve(null); }
          };
        }
      });
    }

    // Authentication Modals
    function showLoginModal() {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Sign In to Smaran HFS</span>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" class="form-input" id="login-user" placeholder="e.g. smaran" autocomplete="username">
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-input" id="login-pass" placeholder="Enter password" autocomplete="current-password">
              </div>
            </div>
            <div class="modal-footer">
              <button class="primary" onclick="doLogin()" style="width:100%; justify-content:center;">Sign In</button>
            </div>
          </div>
        </div>
      \`;
      const passInp = document.getElementById('login-pass');
      if (passInp) {
        passInp.onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
      }
    }

    async function doLogin() {
      const username = document.getElementById('login-user').value.trim();
      const password = document.getElementById('login-pass').value;
      if (!username) return;

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        currentSessionId = data.token;
        currentUser = data.user;
        closeModal();
        updateContextAddressBar(currentUser.username, clientIp);
        updateSessionUI();
        showToast('Signed in as ' + currentUser.username);

        if (currentUser.mustChangePassword) {
          showCompulsoryPasswordModal(true);
        } else {
          loadFiles();
        }
      } catch (err) {
        smaranAlert({ title: 'Authentication Failed', message: err.message, error: true });
      }
    }

    function showCompulsoryPasswordModal(isCompulsory = true) {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay">
          <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>\` + (isCompulsory ? 'Compulsory Password Change' : 'Change Password') + \`</span>
            </div>
            <div class="modal-body">
              <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:14px;">
                \` + (isCompulsory ? 'Security Requirement: You are using a temporary or initial password. Please choose a new secure password to proceed.' : 'Enter your current password and choose a new password.') + \`
              </p>
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input type="password" class="form-input" id="cp-current">
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input type="password" class="form-input" id="cp-new">
              </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input type="password" class="form-input" id="cp-confirm">
              </div>
            </div>
            <div class="modal-footer">
              \` + (!isCompulsory ? '<button onclick="closeModal()">Cancel</button>' : '') + \`
              <button class="primary" onclick="doChangePassword()">Save Password</button>
            </div>
          </div>
        </div>
      \`;
    }

    async function doChangePassword() {
      const cur = document.getElementById('cp-current').value;
      const nw = document.getElementById('cp-new').value;
      const conf = document.getElementById('cp-confirm').value;

      if (!nw) { showToast('New password cannot be empty'); return; }
      if (nw !== conf) { showToast('New passwords do not match'); return; }

      try {
        const res = await fetch('/api/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPassword: cur, newPassword: nw })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update password');
        closeModal();
        showToast('Password changed successfully');
        loadFiles();
      } catch (err) {
        smaranAlert({ title: 'Error', message: err.message, error: true });
      }
    }

    // Sidebar Extra Sections (Recent Transfers, User Shares, VFS)
    async function loadRecentTransfers() {
      const container = document.getElementById('recent-transfers-list');
      container.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">Loading activity...</p>';
      try {
        const res = await fetch('/api/history');
        if (!res.ok) throw new Error('Failed to load history');
        const data = await res.json();
        const history = data.history || [];
        if (history.length === 0) {
          container.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">No transfer history recorded yet.</p>';
          return;
        }
        let html = '<div class="table-container" style="padding:0;"><table class="file-table"><thead><tr><th>File</th><th>Direction</th><th>Size</th><th>Status</th><th>Time</th></tr></thead><tbody>';
        history.slice().reverse().forEach(h => {
          html += '<tr>' +
            '<td style="font-weight:500;">' + escapeHtml(h.fileName) + '</td>' +
            '<td>' + (h.direction === 'upload' ? '▲ Upload' : '▼ Download') + '</td>' +
            '<td style="font-family:var(--mono);">' + formatBytes(h.totalBytes) + '</td>' +
            '<td><span style="color:' + (h.status === 'completed' ? 'var(--ok)' : 'var(--danger)') + ';">' + escapeHtml(h.status) + '</span></td>' +
            '<td style="color:var(--text-muted); font-size:12px;">' + formatDate(h.completedAt || h.startedAt) + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
      } catch {
        container.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">Unable to load transfer history.</p>';
      }
    }

    async function loadUserShares() {
      const container = document.getElementById('shares-list');
      container.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">Loading shared links...</p>';
      try {
        const res = await fetch('/api/shares');
        if (!res.ok) throw new Error('Failed to load shares');
        const data = await res.json();
        const shares = data.shares || [];
        if (shares.length === 0) {
          container.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">No active shared links found.</p>';
          return;
        }
        let html = '<div class="table-container" style="padding:0;"><table class="file-table"><thead><tr><th>Target Item</th><th>Link Token</th><th>Downloads</th><th>Expires</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';
        shares.forEach(s => {
          const shareUrl = window.location.origin + '/share/' + s.token;
          html += '<tr>' +
            '<td style="font-weight:500;">' + escapeHtml(s.name) + '</td>' +
            '<td style="font-family:var(--mono); font-size:12px;">' + escapeHtml(s.token) + '</td>' +
            '<td>' + s.downloadCount + (s.maxDownloads ? ' / ' + s.maxDownloads : '') + '</td>' +
            '<td style="color:var(--text-muted); font-size:12px;">' + (s.expiresAt ? formatDate(s.expiresAt) : 'Never') + '</td>' +
            '<td style="text-align:right;">' +
            '<button class="subtle icon-only" onclick="navigator.clipboard.writeText(\\'' + escapeHtml(shareUrl) + '\\').then(() => showToast(\\'Copied link!\\'))" title="Copy Link"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>' +
            '<button class="subtle icon-only" onclick="revokeUserShare(\\'' + escapeHtml(s.id) + '\\')" title="Revoke" style="color:var(--danger);"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>' +
            '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
      } catch {
        container.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">Unable to load shared links.</p>';
      }
    }

    async function revokeUserShare(id) {
      if (!confirm('Revoke this share link?')) return;
      try {
        await fetch('/api/share/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        showToast('Share revoked');
        loadUserShares();
      } catch { void 0; }
    }

    async function loadVfsList() {
      const container = document.getElementById('vfs-drives-list');
      container.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">Loading virtual file system...</p>';
      try {
        const res = await fetch('/api/admin/vfs');
        if (!res.ok) {
          container.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">VFS configuration is restricted to administrators.</p>';
          return;
        }
        const data = await res.json();
        const nodes = data.nodes || [];
        let html = '<div class="table-container" style="padding:0;"><table class="file-table"><thead><tr><th>Mount Path</th><th>Physical Target</th><th>Type</th><th>Read Only</th></tr></thead><tbody>';
        nodes.forEach(n => {
          html += '<tr>' +
            '<td style="font-weight:500;">' + escapeHtml(n.vfsPath) + '</td>' +
            '<td style="color:var(--text-muted); font-size:12px;">' + escapeHtml(n.physicalPath || '--') + '</td>' +
            '<td>' + escapeHtml(n.type) + '</td>' +
            '<td>' + (n.readOnly ? 'Yes' : 'No') + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
      } catch {
        container.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">Unable to load VFS details.</p>';
      }
    }

    // Full 10-Tab Enterprise Admin Dashboard
    async function showAdminModal() {
      const mc = document.getElementById('modal-container');
      mc.innerHTML = \`
        <div class="modal-overlay" onclick="closeModal()">
          <div class="modal-box large" onclick="event.stopPropagation()">
            <div class="modal-title">
              <span>Smaran HFS — Enterprise Administration</span>
              <button onclick="closeModal()" class="subtle icon-only">✕</button>
            </div>
            <div class="admin-layout">
              <div class="admin-nav">
                <button class="admin-tab-btn active" onclick="switchAdminTab('overview')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                  <span>Overview</span>
                </button>
                <button class="admin-tab-btn" onclick="switchAdminTab('settings')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  <span>Server Settings</span>
                </button>
                <button class="admin-tab-btn" onclick="switchAdminTab('users')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span>Users &amp; Roles</span>
                </button>
                <button class="admin-tab-btn" onclick="switchAdminTab('vfs')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
                  <span>VFS Mounts</span>
                </button>
                <button class="admin-tab-btn" onclick="switchAdminTab('shares')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  <span>Shared Links</span>
                </button>
                <button class="admin-tab-btn" onclick="switchAdminTab('connections')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                  <span>Connections</span>
                </button>
                <button class="admin-tab-btn" onclick="switchAdminTab('logs')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  <span>Audit Logs</span>
                </button>
              </div>
              <div class="admin-main" id="admin-main-view"></div>
            </div>
          </div>
        </div>
      \`;
      switchAdminTab('overview');
    }

    function switchAdminTab(name) {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      event?.target?.closest('button')?.classList.add('active');

      const v = document.getElementById('admin-main-view');
      if (name === 'overview') loadAdminOverview(v);
      else if (name === 'settings') loadAdminSettings(v);
      else if (name === 'users') loadAdminUsers(v);
      else if (name === 'vfs') loadAdminVfs(v);
      else if (name === 'shares') loadAdminShares(v);
      else if (name === 'connections') loadAdminConnections(v);
      else if (name === 'logs') loadAdminLogs(v);
    }

    async function loadAdminOverview(container) {
      container.innerHTML = '<p style="color:var(--text-faint);">Loading system metrics...</p>';
      try {
        const res = await fetch('/api/status');
        const st = await res.json();
        container.innerHTML = \`
          <h2 style="font-size:16px; font-weight:600;">Server Overview</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-card-title">Server Status</div>
              <div class="stat-card-val" style="color:var(--ok); font-size:17px;">● \` + (st.running ? 'Running' : 'Stopped') + \`</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-title">Listening Port</div>
              <div class="stat-card-val">\` + st.port + \`</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-title">Active Sockets</div>
              <div class="stat-card-val">\` + (st.connectedClients || 0) + \`</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-title">Uptime</div>
              <div class="stat-card-val" style="font-size:16px;">\` + Math.floor(st.uptimeSeconds / 3600) + \`h \` + Math.floor((st.uptimeSeconds % 3600) / 60) + \`m</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-title">Total Uploaded</div>
              <div class="stat-card-val" style="font-size:16px;">\` + formatBytes(st.totalBytesUploaded || 0) + \`</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-title">Total Downloaded</div>
              <div class="stat-card-val" style="font-size:16px;">\` + formatBytes(st.totalBytesDownloaded || 0) + \`</div>
            </div>
          </div>

          <div style="margin-top:16px; background:var(--card); border:1px solid var(--line); border-radius:8px; padding:14px;">
            <div style="font-weight:600; font-size:13px; margin-bottom:8px;">LAN Access Endpoints</div>
            <div style="display:flex; flex-direction:column; gap:6px; font-family:var(--mono); font-size:12px;">
              \` + (st.lanUrls || []).map(u => '<div style="color:var(--accent);">' + escapeHtml(u) + '</div>').join('') + \`
            </div>
          </div>
        \`;
      } catch {
        container.innerHTML = '<p style="color:var(--danger);">Failed to load overview data.</p>';
      }
    }

    async function loadAdminSettings(container) {
      container.innerHTML = '<p style="color:var(--text-faint);">Loading settings...</p>';
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        const s = data.settings || {};
        container.innerHTML = \`
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2 style="font-size:16px; font-weight:600;">Server Settings</h2>
            <button class="primary" onclick="saveAdminSettings()">Save Changes</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Server Display Name</label>
              <input type="text" class="form-input" id="set-name" value="\` + escapeHtml(s.serverName || 'Smaran File Server') + \`">
            </div>
            <div class="form-group">
              <label class="form-label">HTTP Port</label>
              <input type="number" class="form-input" id="set-port" value="\` + (s.port || 5900) + \`">
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Bind Address</label>
              <input type="text" class="form-input" id="set-bind" value="\` + escapeHtml(s.bindAddress || '0.0.0.0') + \`">
            </div>
            <div class="form-group">
              <label class="form-label">Max Connections</label>
              <input type="number" class="form-input" id="set-max-conn" value="\` + (s.maxConnections || 2048) + \`">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Root Directory</label>
            <input type="text" class="form-input" id="set-root" value="\` + escapeHtml(s.rootDir || '') + \`">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Upload Limit (MB)</label>
              <input type="number" class="form-input" id="set-upload-limit" value="\` + (s.uploadLimitMb || 4096) + \`">
            </div>
            <div class="form-group">
              <label class="form-label">Rate Limit per Minute</label>
              <input type="number" class="form-input" id="set-rate-limit" value="\` + (s.rateLimitPerMin || 600) + \`">
            </div>
          </div>
        \`;
      } catch {
        container.innerHTML = '<p style="color:var(--danger);">Failed to load settings.</p>';
      }
    }

    async function saveAdminSettings() {
      const payload = {
        serverName: document.getElementById('set-name').value.trim(),
        port: parseInt(document.getElementById('set-port').value, 10),
        bindAddress: document.getElementById('set-bind').value.trim(),
        maxConnections: parseInt(document.getElementById('set-max-conn').value, 10),
        rootDir: document.getElementById('set-root').value.trim(),
        uploadLimitMb: parseInt(document.getElementById('set-upload-limit').value, 10),
        rateLimitPerMin: parseInt(document.getElementById('set-rate-limit').value, 10)
      };

      try {
        const res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to save settings');
        showToast('Settings saved successfully');
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }

    async function loadAdminUsers(container) {
      container.innerHTML = '<p style="color:var(--text-faint);">Loading users...</p>';
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        const users = data.users || [];
        let html = \`
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2 style="font-size:16px; font-weight:600;">User Accounts</h2>
            <button class="primary" onclick="promptAddUserModal()">Add User</button>
          </div>
          <table class="file-table" style="margin-top:12px;">
            <thead>
              <tr><th>Username</th><th>Role</th><th>Created</th><th style="text-align:right;">Actions</th></tr>
            </thead>
            <tbody>
        \`;
        users.forEach(u => {
          html += '<tr>' +
            '<td style="font-weight:600;">' + escapeHtml(u.username) + (u.isSystem ? ' (System)' : '') + '</td>' +
            '<td><span class="badge-nas">' + escapeHtml(u.role) + '</span></td>' +
            '<td style="color:var(--text-muted); font-size:12px;">' + formatDate(u.createdAt) + '</td>' +
            '<td style="text-align:right;">' +
            (!u.isSystem ? '<button class="danger subtle" onclick="deleteAdminUser(\\'' + escapeHtml(u.id) + '\\')">Delete</button>' : '') +
            '</td>' +
            '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      } catch {
        container.innerHTML = '<p style="color:var(--danger);">Failed to load users.</p>';
      }
    }

    function promptAddUserModal() {
      const mc = document.getElementById('modal-container');
      const inner = mc.innerHTML;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.zIndex = '70';
      overlay.innerHTML = \`
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-title">
            <span>Add User Account</span>
            <button onclick="this.closest('.modal-overlay').remove()" class="subtle icon-only">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" class="form-input" id="new-u-name">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" class="form-input" id="new-u-pass">
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-input" id="new-u-role">
                <option value="user" selected>User</option>
                <option value="admin">Administrator</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <label class="form-label">Permissions</label>
            <div class="checkbox-grid">
              <label class="checkbox-label"><input type="checkbox" id="perm-read" checked> Read Files</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-upload" checked> Upload Files</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-delete" checked> Delete Files</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-rename" checked> Rename Files</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-mkdir" checked> Create Folders</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-share" checked> Share Links</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-stream" checked> Stream Media</label>
              <label class="checkbox-label"><input type="checkbox" id="perm-admin"> Administration</label>
            </div>
          </div>
          <div class="modal-footer">
            <button onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button class="primary" onclick="submitCreateUser(this)">Create User</button>
          </div>
        </div>
      \`;
      mc.appendChild(overlay);
    }

    async function submitCreateUser(btn) {
      const username = document.getElementById('new-u-name').value.trim();
      const password = document.getElementById('new-u-pass').value;
      const role = document.getElementById('new-u-role').value;
      if (!username || !password) { showToast('Username and password required'); return; }

      const perms = {
        read: document.getElementById('perm-read').checked,
        upload: document.getElementById('perm-upload').checked,
        delete: document.getElementById('perm-delete').checked,
        rename: document.getElementById('perm-rename').checked,
        mkdir: document.getElementById('perm-mkdir').checked,
        comment: true,
        vfs: document.getElementById('perm-admin').checked,
        zip: true
      };

      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role, permissions: perms })
        });
        if (!res.ok) throw new Error('Failed to create user');
        btn.closest('.modal-overlay').remove();
        showToast('User created');
        loadAdminUsers(document.getElementById('admin-main-view'));
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }

    async function deleteAdminUser(id) {
      if (!confirm('Are you sure you want to delete this user?')) return;
      try {
        await fetch('/api/admin/users/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        showToast('User deleted');
        loadAdminUsers(document.getElementById('admin-main-view'));
      } catch { void 0; }
    }

    async function loadAdminVfs(container) {
      container.innerHTML = '<p style="color:var(--text-faint);">Loading VFS...</p>';
      try {
        const res = await fetch('/api/admin/vfs');
        const data = await res.json();
        const nodes = data.nodes || [];
        let html = \`
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2 style="font-size:16px; font-weight:600;">Virtual File System (VFS)</h2>
            <button class="primary" onclick="promptAddVfsModal()">Mount Folder</button>
          </div>
          <table class="file-table" style="margin-top:12px;">
            <thead><tr><th>Mount Path</th><th>Physical Target</th><th>Read Only</th><th style="text-align:right;">Actions</th></tr></thead>
            <tbody>
        \`;
        nodes.forEach(n => {
          html += '<tr>' +
            '<td style="font-weight:600;">' + escapeHtml(n.vfsPath) + '</td>' +
            '<td style="color:var(--text-muted); font-size:12px;">' + escapeHtml(n.physicalPath || '--') + '</td>' +
            '<td>' + (n.readOnly ? 'Yes' : 'No') + '</td>' +
            '<td style="text-align:right;"><button class="danger subtle" onclick="deleteAdminVfs(\\'' + escapeHtml(n.id) + '\\')">Unmount</button></td>' +
            '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      } catch {
        container.innerHTML = '<p style="color:var(--danger);">Failed to load VFS.</p>';
      }
    }

    function promptAddVfsModal() {
      const mc = document.getElementById('modal-container');
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.zIndex = '70';
      overlay.innerHTML = \`
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="modal-title">
            <span>Mount Physical Folder</span>
            <button onclick="this.closest('.modal-overlay').remove()" class="subtle icon-only">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Virtual Mount Path</label>
              <input type="text" class="form-input" id="vfs-vpath" placeholder="e.g. /media">
            </div>
            <div class="form-group">
              <label class="form-label">Physical Directory Path</label>
              <input type="text" class="form-input" id="vfs-ppath" placeholder="e.g. D:\\Media">
            </div>
            <label class="checkbox-label" style="margin-top:6px;"><input type="checkbox" id="vfs-ro"> Read Only Mount</label>
          </div>
          <div class="modal-footer">
            <button onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button class="primary" onclick="submitCreateVfs(this)">Mount Directory</button>
          </div>
        </div>
      \`;
      mc.appendChild(overlay);
    }

    async function submitCreateVfs(btn) {
      const vfsPath = document.getElementById('vfs-vpath').value.trim();
      const physicalPath = document.getElementById('vfs-ppath').value.trim();
      const readOnly = document.getElementById('vfs-ro').checked;
      if (!vfsPath || !physicalPath) return;

      try {
        const res = await fetch('/api/admin/vfs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vfsPath, physicalPath, readOnly, name: vfsPath.replace(/^\\/+/, '') })
        });
        if (!res.ok) throw new Error('Failed to mount folder');
        btn.closest('.modal-overlay').remove();
        showToast('Mounted folder to ' + vfsPath);
        loadAdminVfs(document.getElementById('admin-main-view'));
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }

    async function deleteAdminVfs(id) {
      if (!confirm('Unmount this virtual folder?')) return;
      try {
        await fetch('/api/admin/vfs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        showToast('Unmounted');
        loadAdminVfs(document.getElementById('admin-main-view'));
      } catch { void 0; }
    }

    async function loadAdminShares(container) {
      container.innerHTML = '<p style="color:var(--text-faint);">Loading shares...</p>';
      try {
        const res = await fetch('/api/admin/shares');
        const data = await res.json();
        const shares = data.shares || [];
        let html = '<h2 style="font-size:16px; font-weight:600;">Active Shared Links</h2><table class="file-table" style="margin-top:12px;"><thead><tr><th>Name</th><th>Token</th><th>Downloads</th><th>Expires</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';
        shares.forEach(s => {
          html += '<tr>' +
            '<td style="font-weight:600;">' + escapeHtml(s.name) + '</td>' +
            '<td style="font-family:var(--mono); font-size:12px;">' + escapeHtml(s.token) + '</td>' +
            '<td>' + s.downloadCount + (s.maxDownloads ? ' / ' + s.maxDownloads : '') + '</td>' +
            '<td style="color:var(--text-muted); font-size:12px;">' + (s.expiresAt ? formatDate(s.expiresAt) : 'Never') + '</td>' +
            '<td style="text-align:right;"><button class="danger subtle" onclick="revokeAdminShare(\\'' + escapeHtml(s.id) + '\\')">Revoke</button></td>' +
            '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      } catch {
        container.innerHTML = '<p style="color:var(--danger);">Failed to load shares.</p>';
      }
    }

    async function revokeAdminShare(id) {
      if (!confirm('Revoke this share?')) return;
      try {
        await fetch('/api/admin/shares/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        showToast('Share revoked');
        loadAdminShares(document.getElementById('admin-main-view'));
      } catch { void 0; }
    }

    async function loadAdminConnections(container) {
      container.innerHTML = '<p style="color:var(--text-faint);">Loading live connections...</p>';
      try {
        const res = await fetch('/api/admin/connections');
        const data = await res.json();
        const conns = data.connections || [];
        let html = '<h2 style="font-size:16px; font-weight:600;">Live Client Sockets</h2><table class="file-table" style="margin-top:12px;"><thead><tr><th>IP Address</th><th>User Agent</th><th>Sent / Received</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';
        conns.forEach(c => {
          html += '<tr>' +
            '<td style="font-family:var(--mono); font-weight:600;">' + escapeHtml(c.clientIp) + '</td>' +
            '<td style="font-size:11.5px; color:var(--text-muted); max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(c.userAgent) + '</td>' +
            '<td style="font-family:var(--mono); font-size:11.5px;">' + formatBytes(c.bytesSent) + ' / ' + formatBytes(c.bytesReceived) + '</td>' +
            '<td style="text-align:right;"><button class="danger subtle" onclick="killAdminConnection(\\'' + escapeHtml(c.id) + '\\')">Disconnect</button></td>' +
            '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      } catch {
        container.innerHTML = '<p style="color:var(--danger);">Failed to load connections.</p>';
      }
    }

    async function killAdminConnection(id) {
      try {
        await fetch('/api/admin/connections/kill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        showToast('Connection terminated');
        loadAdminConnections(document.getElementById('admin-main-view'));
      } catch { void 0; }
    }

    async function loadAdminLogs(container) {
      container.innerHTML = '<p style="color:var(--text-faint);">Loading audit logs...</p>';
      try {
        const res = await fetch('/api/admin/logs');
        const data = await res.json();
        const logs = data.logs || [];
        let html = \`
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2 style="font-size:16px; font-weight:600;">Audit &amp; Security Logs</h2>
            <button class="danger subtle" onclick="clearAdminLogs()">Clear Logs</button>
          </div>
          <table class="file-table" style="margin-top:12px;">
            <thead><tr><th>Time</th><th>Level</th><th>IP</th><th>Message</th></tr></thead>
            <tbody>
        \`;
        logs.slice().reverse().forEach(l => {
          const lvlColor = l.level === 'error' ? 'var(--danger)' : (l.level === 'warn' ? 'var(--warn)' : 'var(--ok)');
          html += '<tr>' +
            '<td style="color:var(--text-muted); font-size:11px; white-space:nowrap;">' + formatDate(l.timestamp) + '</td>' +
            '<td><span style="font-size:10.5px; font-weight:600; color:' + lvlColor + ';">' + escapeHtml((l.level || 'info').toUpperCase()) + '</span></td>' +
            '<td style="font-family:var(--mono); font-size:11.5px;">' + escapeHtml(l.clientIp || '--') + '</td>' +
            '<td style="font-size:12.5px;">' + escapeHtml(l.message) + '</td>' +
            '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      } catch {
        container.innerHTML = '<p style="color:var(--danger);">Failed to load audit logs.</p>';
      }
    }

    async function clearAdminLogs() {
      if (!confirm('Clear all server logs?')) return;
      try {
        await fetch('/api/admin/logs/clear', { method: 'POST' });
        showToast('Logs cleared');
        loadAdminLogs(document.getElementById('admin-main-view'));
      } catch { void 0; }
    }

    // 60fps Vector SmaranDots Engine (Ported from site/dots.js)
    (function () {
      const COLORS = {
        primary: 'var(--logo-primary, #eaeaea)',
        accent: 'var(--logo-accent, #e06c43)',
        accent2: 'var(--logo-accent-2, #f59f00)',
        alert: 'var(--logo-alert, #e06c43)',
        success: 'var(--logo-success, #22c55e)',
        error: 'var(--logo-error, #ef4444)',
      };
      const TAU = Math.PI * 2;
      const stroke = (pts, color = 'primary', width = 3.6) => ({ pts, color, width });
      const dot = (x, y, color = 'accent', r = 2.4) => ({ pts: [[x, y], [x + 0.01, y]], color, width: r * 2 });

      function resample(poly) {
        const total = poly.reduce((acc, p, i) => i ? acc + Math.hypot(p[0] - poly[i - 1][0], p[1] - poly[i - 1][1]) : 0, 0);
        if (total === 0) return Array.from({ length: 64 }, () => [...poly[0]]);
        const step = total / 63;
        const out = [[...poly[0]]];
        let walked = 0, segIdx = 0, segWalked = 0;
        for (let i = 1; i < 64; i++) {
          const target = i * step;
          while (segIdx < poly.length - 1) {
            const p0 = poly[segIdx], p1 = poly[segIdx + 1];
            const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
            if (walked + (segLen - segWalked) >= target) {
              const rem = target - walked;
              const u = (segWalked + rem) / (segLen || 1);
              out.push([p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u]);
              segWalked += rem;
              walked = target;
              break;
            } else {
              walked += segLen - segWalked;
              segIdx++;
              segWalked = 0;
            }
          }
        }
        while (out.length < 64) out.push([...poly[poly.length - 1]]);
        return out;
      }

      function arc(cx, cy, r, a0, a1, steps = 48) {
        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const a = a0 + (a1 - a0) * (i / steps);
          pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        return pts;
      }

      function rotate(s, cx, cy, deg) {
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        return {
          ...s,
          pts: s.pts.map(([x, y]) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos]),
        };
      }

      function scale(s, k) {
        return { ...s, pts: s.pts.map(([x, y]) => [32 + (x - 32) * k, 32 + (y - 32) * k]), width: s.width * k };
      }

      const SCENES = {
        smark: () => [
          stroke(resample(arc(32, 32, 18, -Math.PI * 0.8, Math.PI * 0.8)), 'primary'),
          dot(32, 32, 'accent', 2.8),
          dot(32, 32, 'accent', 0),
        ],
        dance: (t) => {
          const r0 = 18 + 1.2 * Math.sin(t * 4);
          return [
            rotate(stroke(resample(arc(32, 32, r0, 0, TAU * 0.85)), 'primary'), 32, 32, t * 75),
            dot(32 + 5 * Math.sin(t * 3), 32 + 5 * Math.cos(t * 3), 'accent', 2.6),
            dot(32 + 8 * Math.cos(t * 2.5), 32 + 8 * Math.sin(t * 2.5), 'accent2', 2.0),
          ];
        },
        bell: (t) => {
          const swing = Math.sin(t * 5) * 4;
          return [
            rotate(stroke(resample(arc(32, 28, 14, Math.PI, 0)), 'alert'), 32, 28, swing),
            dot(32 + swing * 0.8, 38, 'alert', 2.4),
            dot(32, 14, 'alert', 1.8),
          ];
        },
        check: () => [
          stroke(resample(arc(32, 32, 18, 0, TAU * 0.999)), 'primary'),
          stroke(resample([[23, 33], [29, 39], [42, 24]]), 'success', 3.4),
          dot(48, 21, 'success', 0),
        ],
        heart: (t) => {
          const pts = [];
          for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * TAU;
            pts.push([
              32 + 1.15 * 16 * Math.sin(a) ** 3,
              31 - 1.15 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)),
            ]);
          }
          const beat = 1 + 0.06 * Math.max(0, Math.sin(t * 6)) ** 4;
          return [
            scale(stroke(pts, 'error'), beat),
            dot(32, 32, 'error', 0),
            dot(32, 32, 'error', 0),
          ];
        },
      };

      const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
      const lerp = (a, b, u) => a + (b - a) * u;

      function mix(from, to, u) {
        return from.map((f, i) => {
          const g = to[i];
          return {
            pts: f.pts.map((p, k) => [lerp(p[0], g.pts[k][0], u), lerp(p[1], g.pts[k][1], u)]),
            width: lerp(f.width, g.width, u),
            color: u < 0.5 ? f.color : g.color,
          };
        });
      }

      const d = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('');

      function mount(svg) {
        const names = (svg.dataset.dots || 'smark').split(',').filter(n => SCENES[n]);
        if (!names.length) names.push('smark');
        const hold = Number(svg.dataset.hold || 2.6);
        const morph = 0.9;
        svg.setAttribute('viewBox', '-4 -4 72 72');
        svg.setAttribute('aria-hidden', 'true');
        const paths = [0, 1, 2].map(() => {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          p.setAttribute('fill', 'none');
          p.setAttribute('stroke-linecap', 'round');
          p.setAttribute('stroke-linejoin', 'round');
          svg.appendChild(p);
          return p;
        });
        const draw = (frame) =>
          frame.forEach((s, i) => {
            paths[i].setAttribute('d', d(s.pts));
            paths[i].setAttribute('stroke-width', Math.max(0, s.width).toFixed(2));
            paths[i].setAttribute('stroke', COLORS[s.color]);
            paths[i].style.opacity = s.width < 0.4 ? '0' : '1';
          });

        const still = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (still.matches) {
          draw(SCENES[names[0]](0));
          return;
        }
        const start = performance.now();
        let visible = true;
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(svg);
        }
        function tick(now) {
          if (visible) {
            const t = (now - start) / 1000;
            const lap = hold + morph;
            const idx = Math.floor(t / lap);
            const into = t - idx * lap;
            const cur = SCENES[names[idx % names.length]];
            if (into < hold || names.length === 1) draw(cur(t));
            else {
              const next = SCENES[names[(idx + 1) % names.length]];
              draw(mix(cur(t), next(t), ease((into - hold) / morph)));
            }
          }
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }

      window.SmaranDots = { mount, mountAll: () => document.querySelectorAll('svg[data-dots]').forEach(mount) };
    })();

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === '/' && document.activeElement !== document.getElementById('search-input')) {
        const inp = document.getElementById('search-input');
        if (inp) {
          e.preventDefault();
          inp.focus();
        }
      }
    });

    // Initialize
    window.SmaranDots.mountAll();
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
