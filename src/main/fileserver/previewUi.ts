import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PreviewOptions {
  fileName: string;
  relPath: string;
  physicalPath: string;
  fileSize: number;
  mtime: Date;
  mimeType: string;
  rawUrl: string;
  downloadUrl: string;
  serverName: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function generatePreviewHtml(opts: PreviewOptions): string {
  const ext = path.extname(opts.fileName).slice(1).toLowerCase();

  const isImage = /^(jpe?g|png|gif|webp|svg|bmp|avif|ico)$/i.test(ext);
  const isVideo = /^(mp4|webm|ogv|mov|mkv)$/i.test(ext);
  const isAudio = /^(mp3|wav|ogg|m4a|aac|flac)$/i.test(ext);
  const isPdf = ext === 'pdf';
  const isText = /^(txt|md|json|js|ts|tsx|jsx|py|html|css|xml|yml|yaml|log|sh|bat|ini|conf|c|cpp|h|rs|go|java|sql|php|env|toml|csv)$/i.test(ext);

  let mainContent = '';

  if (isImage) {
    mainContent = `
      <div class="image-viewer-container">
        <div class="image-toolbar">
          <button class="tool-btn" onclick="zoomImage(0.2)" title="Zoom In">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            <span>Zoom In</span>
          </button>
          <button class="tool-btn" onclick="zoomImage(-0.2)" title="Zoom Out">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            <span>Zoom Out</span>
          </button>
          <button class="tool-btn" onclick="resetZoom()" title="Reset Zoom">
            <span id="zoom-level-text">100%</span>
          </button>
          <button class="tool-btn" onclick="rotateImage()" title="Rotate 90°">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            <span>Rotate</span>
          </button>
        </div>
        <div class="image-stage checkerboard" onclick="resetZoom()">
          <img id="preview-img" src="${escapeHtml(opts.rawUrl)}" alt="${escapeHtml(opts.fileName)}" class="preview-image" onclick="event.stopPropagation()">
        </div>
      </div>
      <script>
        let currentZoom = 1;
        let currentRotation = 0;
        function updateTransform() {
          const img = document.getElementById('preview-img');
          if (img) {
            img.style.transform = 'scale(' + currentZoom + ') rotate(' + currentRotation + 'deg)';
            document.getElementById('zoom-level-text').innerText = Math.round(currentZoom * 100) + '%';
          }
        }
        function zoomImage(delta) {
          currentZoom = Math.min(5, Math.max(0.2, currentZoom + delta));
          updateTransform();
        }
        function resetZoom() {
          currentZoom = 1;
          currentRotation = 0;
          updateTransform();
        }
        function rotateImage() {
          currentRotation = (currentRotation + 90) % 360;
          updateTransform();
        }
      </script>
    `;
  } else if (isVideo) {
    mainContent = `
      <div class="media-container video-stage">
        <video controls autoplay playsinline preload="metadata" class="video-player">
          <source src="${escapeHtml(opts.rawUrl)}" type="${escapeHtml(opts.mimeType)}">
          Your browser does not support HTML5 video streaming.
        </video>
      </div>
    `;
  } else if (isAudio) {
    mainContent = `
      <div class="audio-container">
        <div class="audio-card">
          <div class="audio-icon-box">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ff6633" stroke-width="2">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <div class="audio-title">${escapeHtml(opts.fileName)}</div>
          <div class="audio-meta">${formatBytes(opts.fileSize)} · ${escapeHtml(opts.mimeType)}</div>
          <audio controls autoplay preload="metadata" class="audio-player">
            <source src="${escapeHtml(opts.rawUrl)}" type="${escapeHtml(opts.mimeType)}">
            Your browser does not support HTML5 audio.
          </audio>
        </div>
      </div>
    `;
  } else if (isPdf) {
    mainContent = `
      <div class="pdf-container">
        <iframe src="${escapeHtml(opts.rawUrl)}#toolbar=1" class="pdf-frame" title="${escapeHtml(opts.fileName)}"></iframe>
      </div>
    `;
  } else if (isText) {
    let textContent = '';
    let readError = false;
    try {
      if (opts.fileSize > 2 * 1024 * 1024) {
        // Read first 2MB for large text files to prevent hanging
        const buf = Buffer.alloc(2 * 1024 * 1024);
        const fd = fs.openSync(opts.physicalPath, 'r');
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        textContent = buf.toString('utf8', 0, bytesRead) + '\n\n[... Truncated for web preview: file exceeds 2 MB ...]';
      } else {
        textContent = fs.readFileSync(opts.physicalPath, 'utf8');
      }
    } catch {
      readError = true;
    }

    if (readError) {
      mainContent = `
        <div class="fallback-container">
          <div class="fallback-card">
            <h3>Unable to read file text</h3>
            <p>Could not decode text content. Use direct download to view this file.</p>
            <a href="${escapeHtml(opts.downloadUrl)}" class="action-btn primary">Download File</a>
          </div>
        </div>
      `;
    } else {
      const lines = textContent.split(/\r?\n/);
      let lineNumbersHtml = '';
      let codeLinesHtml = '';
      lines.forEach((line, idx) => {
        lineNumbersHtml += `<span>${idx + 1}</span>\n`;
        codeLinesHtml += `${escapeHtml(line)}\n`;
      });

      mainContent = `
        <div class="code-viewer-container">
          <div class="code-toolbar">
            <span>${lines.length} lines · ${formatBytes(opts.fileSize)}</span>
            <button class="tool-btn" onclick="copyCode()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span id="copy-text">Copy Code</span>
            </button>
          </div>
          <div class="code-viewport">
            <div class="line-numbers" aria-hidden="true">${lineNumbersHtml}</div>
            <pre class="code-content"><code id="code-block">${codeLinesHtml}</code></pre>
          </div>
        </div>
        <script>
          function copyCode() {
            const code = document.getElementById('code-block').innerText;
            navigator.clipboard.writeText(code).then(() => {
              const el = document.getElementById('copy-text');
              el.innerText = 'Copied!';
              setTimeout(() => { el.innerText = 'Copy Code'; }, 2000);
            });
          }
        </script>
      `;
    }
  } else {
    mainContent = `
      <div class="fallback-container">
        <div class="fallback-card">
          <div class="fallback-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a0a0ab" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="fallback-name">${escapeHtml(opts.fileName)}</div>
          <div class="fallback-meta">${formatBytes(opts.fileSize)} · ${escapeHtml(opts.mimeType)}</div>
          <p class="fallback-note">Interactive in-browser preview is not available for .${escapeHtml(ext)} files.</p>
          <a href="${escapeHtml(opts.downloadUrl)}" class="action-btn primary" download>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Download File</span>
          </a>
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.fileName)} · Smaran HFS Preview</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <style>
    :root {
      --bg: #0e0e11;
      --card: #16161a;
      --border: #23232a;
      --accent: #ff6633;
      --accent-hover: #ff7744;
      --text: #f0f0f5;
      --text-muted: #9e9ea8;
      --text-faint: #62626e;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      --mono: "JetBrains Mono", Consolas, Menlo, Monaco, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .preview-header {
      height: 56px;
      background: var(--card);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      gap: 12px;
      flex-shrink: 0;
      z-index: 10;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .header-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 102, 51, 0.12);
      border-radius: 6px;
      color: var(--accent);
      flex-shrink: 0;
    }
    .header-titles {
      min-width: 0;
    }
    .header-filename {
      font-size: 13.5px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text);
    }
    .header-meta {
      font-size: 11.5px;
      color: var(--text-muted);
      display: flex;
      gap: 8px;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid var(--border);
      background: #1c1c22;
      color: var(--text);
      transition: all 0.15s ease;
    }
    .action-btn:hover {
      background: #26262e;
      border-color: #383844;
    }
    .action-btn.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .action-btn.primary:hover {
      background: var(--accent-hover);
    }
    .preview-body {
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Image Viewer */
    .image-viewer-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .image-toolbar {
      height: 38px;
      background: #121216;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 12px;
    }
    .tool-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11.5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tool-btn:hover {
      background: #202028;
      border-color: #30303a;
      color: var(--text);
    }
    .image-stage {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
      padding: 24px;
    }
    .checkerboard {
      background-color: #0b0b0d;
      background-image: linear-gradient(45deg, #131317 25%, transparent 25%),
                        linear-gradient(-45deg, #131317 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #131317 75%),
                        linear-gradient(-45deg, transparent 75%, #131317 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    }
    .preview-image {
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
      border-radius: 4px;
      transition: transform 0.1s ease-out;
      user-select: none;
    }
    /* Video Viewer */
    .media-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }
    .video-player {
      max-width: 100%;
      max-height: 100%;
      outline: none;
    }
    /* Audio Viewer */
    .audio-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .audio-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px;
      width: 100%;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 16px 40px rgba(0,0,0,0.5);
    }
    .audio-icon-box {
      width: 72px;
      height: 72px;
      background: rgba(255, 102, 51, 0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px auto;
    }
    .audio-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
      word-break: break-all;
    }
    .audio-meta {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 24px;
    }
    .audio-player {
      width: 100%;
      outline: none;
    }
    /* PDF Viewer */
    .pdf-container {
      width: 100%;
      height: 100%;
    }
    .pdf-frame {
      width: 100%;
      height: 100%;
      border: none;
    }
    /* Code Viewer */
    .code-viewer-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .code-toolbar {
      height: 38px;
      background: #121216;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--mono);
    }
    .code-viewport {
      flex: 1;
      display: flex;
      overflow: auto;
      background: #09090c;
    }
    .line-numbers {
      padding: 16px 12px;
      text-align: right;
      color: var(--text-faint);
      font-family: var(--mono);
      font-size: 12.5px;
      line-height: 1.6;
      user-select: none;
      border-right: 1px solid var(--border);
      background: #0d0d10;
    }
    .code-content {
      padding: 16px;
      font-family: var(--mono);
      font-size: 12.5px;
      line-height: 1.6;
      color: #dcdce6;
      white-space: pre;
    }
    /* Fallback / Unsupported */
    .fallback-container {
      padding: 24px;
      text-align: center;
    }
    .fallback-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 40px;
      max-width: 440px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 16px 40px rgba(0,0,0,0.5);
    }
    .fallback-icon {
      margin-bottom: 16px;
    }
    .fallback-name {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
      word-break: break-all;
    }
    .fallback-meta {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .fallback-note {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <header class="preview-header">
    <div class="header-left">
      <div class="header-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="header-titles">
        <div class="header-filename" title="${escapeHtml(opts.fileName)}">${escapeHtml(opts.fileName)}</div>
        <div class="header-meta">
          <span>${formatBytes(opts.fileSize)}</span>
          <span>·</span>
          <span>${escapeHtml(opts.mtime.toLocaleDateString())}</span>
        </div>
      </div>
    </div>
    <div class="header-right">
      <button class="action-btn" onclick="navigator.clipboard.writeText(window.location.href).then(() => alert('Link copied to clipboard!'))" title="Copy preview link">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span>Copy Link</span>
      </button>
      <a href="${escapeHtml(opts.rawUrl)}" target="_blank" class="action-btn" title="Open raw file">
        <span>Raw</span>
      </a>
      <a href="${escapeHtml(opts.downloadUrl)}" class="action-btn primary" download title="Download file">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Download</span>
      </a>
    </div>
  </header>
  <main class="preview-body">
    ${mainContent}
  </main>
</body>
</html>`;
}
