import { useEffect, useState } from 'react';
import type { FileServerSettings, ServerLogEntry, ServerStatus } from '@shared/fileserver';
import {
  ActivityIcon,
  CheckIcon,
  CopyIcon,
  FolderIcon,
  GlobeIcon,
  LinkIcon,
  QrIcon,
  RefreshIcon,
  ServerIcon,
  ShieldIcon,
  XIcon,
} from '../icons';
import { Button, Dialog, IconButton, Input, Switch } from '../ui';

export function FileServer() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [settings, setSettings] = useState<FileServerSettings | null>(null);
  const [adminUsername, setAdminUsername] = useState('smaran');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credMessage, setCredMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<ServerLogEntry[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [driveMounting, setDriveMounting] = useState(false);
  const [driveResult, setDriveResult] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    void window.smaran.fileserver.status().then(setStatus);
    void window.smaran.fileserver.getSettings().then((s) => {
      setSettings(s);
      if (s.adminUsername) setAdminUsername(s.adminUsername);
    });
    void window.smaran.fileserver.getAdminCredentials().then((creds) => {
      if (creds.username) setAdminUsername(creds.username);
      if (creds.password) setAdminPassword(creds.password);
    });
    void window.smaran.fileserver.logs.get().then(setLogs);

    const offStatus = window.smaran.fileserver.onStatusChanged((s) => setStatus(s));
    const offLog = window.smaran.fileserver.onLogAdded((entry) => {
      setLogs((prev) => [...prev.slice(-300), entry]);
    });

    return () => {
      offStatus();
      offLog();
    };
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await window.smaran.fileserver.start();
      const s = await window.smaran.fileserver.status();
      setStatus(s);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await window.smaran.fileserver.stop();
      const s = await window.smaran.fileserver.status();
      setStatus(s);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      await window.smaran.fileserver.restart();
      const s = await window.smaran.fileserver.status();
      setStatus(s);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenUrl = async (url: string) => {
    await window.smaran.fileserver.openUrl(url);
  };

  const handleCopyUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleShowQr = async (url: string) => {
    const qrData = await window.smaran.fileserver.generateQr(url);
    setQrCodeData(qrData);
    setQrModalUrl(url);
  };

  const handleSaveCredentials = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setCredMessage('Username and password cannot be empty.');
      return;
    }
    setCredSaving(true);
    setCredMessage(null);
    try {
      const res = await window.smaran.fileserver.setAdminCredentials({
        username: adminUsername.trim(),
        password: adminPassword,
      });
      if (res.ok) {
        setCredMessage('Admin credentials saved successfully!');
      } else {
        setCredMessage(res.error || 'Failed to update credentials.');
      }
    } finally {
      setCredSaving(false);
      setTimeout(() => setCredMessage(null), 4000);
    }
  };

  const handleResetDefaults = async () => {
    setResetting(true);
    try {
      const res = await window.smaran.fileserver.resetDefaults();
      if (res.ok) {
        setCredMessage('File server has been reset to factory defaults.');
        const s = await window.smaran.fileserver.getSettings();
        setSettings(s);
        const creds = await window.smaran.fileserver.getAdminCredentials();
        setAdminUsername(creds.username || 'smaran');
        setAdminPassword(creds.password || 'smaran');
        setShowResetDialog(false);
      } else {
        alert(res.error || 'Failed to reset file server');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  };

  const handleMountDrive = async () => {
    setDriveMounting(true);
    setDriveResult(null);
    try {
      const res = await window.smaran.fileserver.mountLocalDrive({
        driveLetter: 'Z:',
        username: adminUsername,
        password: adminPassword,
      });
      if (res.ok) {
        setDriveResult(`Mounted successfully as ${res.driveLetter || 'Z:'}`);
      } else {
        setDriveResult(`Error: ${res.error || 'Failed to mount drive'}`);
      }
    } finally {
      setDriveMounting(false);
      setTimeout(() => setDriveResult(null), 5000);
    }
  };

  const handleUnmountDrive = async () => {
    setDriveMounting(true);
    setDriveResult(null);
    try {
      const res = await window.smaran.fileserver.unmountLocalDrive('Z:');
      if (res.ok) {
        setDriveResult('Drive Z: unmounted.');
      } else {
        setDriveResult(`Error: ${res.error || 'Failed to unmount'}`);
      }
    } finally {
      setDriveMounting(false);
      setTimeout(() => setDriveResult(null), 5000);
    }
  };

  const handlePickRootDir = async () => {
    const picked = await window.smaran.fileserver.pickRootDir();
    if (picked) {
      const updated = await window.smaran.fileserver.saveSettings({ rootDir: picked });
      setSettings(updated);
    }
  };

  const handleOpenStorageFolder = async () => {
    await window.smaran.fileserver.openFolder('');
  };

  const handlePortChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1024 && num <= 65535) {
      const updated = await window.smaran.fileserver.saveSettings({ port: num });
      setSettings(updated);
    }
  };

  const handleAutoStartChange = async (autoStart: boolean) => {
    const updated = await window.smaran.fileserver.saveSettings({ autoStart });
    setSettings(updated);
  };

  const handleClearLogs = async () => {
    await window.smaran.fileserver.logs.clear();
    setLogs([]);
  };

  const isRunning = status?.running ?? false;
  const currentPort = status?.port ?? settings?.port ?? 5901;
  const adminUrl = `http://localhost:${currentPort}/~/admin/`;
  const primaryLanUrl = status?.lanUrls?.[0] || `http://127.0.0.1:${currentPort}`;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* 1. Header & Server Power Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-line bg-surface shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#e06c43]/15 border border-[#e06c43]/30 flex items-center justify-center text-[#e06c43]">
            <ServerIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-text">Smaran HFS</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#16161a] border border-line text-muted">
                HFS 3.4.1 Engine
              </span>
            </div>
            <p className="text-[13px] text-muted">
              Fast, self-hosted LAN HTTP file server &amp; WebDAV engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-surface-raised">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRunning ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-500'
              }`}
            />
            <span className="text-xs font-medium">
              {isRunning ? `Running on port ${currentPort}` : 'Server Stopped'}
            </span>
            {isRunning && status && (
              <span className="text-[11px] text-muted border-l border-line pl-2 ml-1">
                {status.liveConnections} active {status.liveConnections === 1 ? 'conn' : 'conns'}
              </span>
            )}
          </div>

          {isRunning ? (
            <div className="flex items-center gap-1.5">
              <Button variant="danger" size="sm" onClick={handleStop} disabled={actionLoading}>
                Stop Server
              </Button>
              <IconButton
                aria-label="Restart Server"
                title="Restart Server"
                onClick={handleRestart}
                disabled={actionLoading}
              >
                <RefreshIcon size={14} className={actionLoading ? 'animate-spin' : ''} />
              </IconButton>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={handleStart} disabled={actionLoading}>
              Start Server
            </Button>
          )}
        </div>
      </div>

      {/* 2. Client Web Links Card */}
      <div className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <GlobeIcon size={18} className="text-[#e06c43]" />
            <h2 className="text-sm font-semibold text-text">Client Web Links</h2>
          </div>
          <span className="text-xs text-muted">
            Share with phones, tablets, or computers on your network
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* LAN Link */}
          <div className="p-3.5 rounded-lg border border-line bg-surface-raised space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-muted uppercase tracking-wider">
                LAN Wi-Fi Link
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleShowQr(primaryLanUrl)}
                  disabled={!isRunning}
                >
                  <QrIcon size={13} />
                  QR Code
                </Button>
                <IconButton
                  aria-label="Copy LAN Link"
                  title="Copy LAN Link"
                  onClick={() => handleCopyUrl(primaryLanUrl)}
                  disabled={!isRunning}
                >
                  {copiedUrl === primaryLanUrl ? (
                    <CheckIcon size={14} className="text-emerald-500" />
                  ) : (
                    <CopyIcon size={14} />
                  )}
                </IconButton>
              </div>
            </div>
            <div className="font-mono text-sm font-semibold truncate text-[#e06c43]">
              {primaryLanUrl}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="w-full justify-center"
              onClick={() => handleOpenUrl(primaryLanUrl)}
              disabled={!isRunning}
            >
              <LinkIcon size={13} />
              Open Web File Manager ↗
            </Button>
          </div>

          {/* Localhost Link & WebDAV Mount */}
          <div className="p-3.5 rounded-lg border border-line bg-surface-raised space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-medium text-muted uppercase tracking-wider">
                Localhost Link &amp; WebDAV Drive
              </span>
              <IconButton
                aria-label="Copy Localhost Link"
                title="Copy Localhost Link"
                onClick={() => handleCopyUrl(`http://127.0.0.1:${currentPort}`)}
                disabled={!isRunning}
              >
                {copiedUrl === `http://127.0.0.1:${currentPort}` ? (
                  <CheckIcon size={14} className="text-emerald-500" />
                ) : (
                  <CopyIcon size={14} />
                )}
              </IconButton>
            </div>
            <div className="font-mono text-sm truncate text-text">
              {`http://127.0.0.1:${currentPort}`}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 justify-center"
                onClick={handleMountDrive}
                disabled={!isRunning || driveMounting}
              >
                <FolderIcon size={13} />
                {driveMounting ? 'Mounting...' : 'Mount as Drive Z:'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUnmountDrive}
                disabled={driveMounting}
              >
                Unmount
              </Button>
            </div>
            {driveResult && <p className="text-[11.5px] text-muted italic">{driveResult}</p>}
          </div>
        </div>
      </div>

      {/* 3. Web Admin Panel Link Card */}
      <div className="p-5 rounded-xl border border-[#e06c43]/30 bg-[#e06c43]/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-text font-semibold text-sm">
            <ShieldIcon size={17} className="text-[#e06c43]" />
            Web Administration Panel
          </div>
          <p className="text-xs text-muted max-w-xl">
            Open the complete <strong>Smaran HFS Web Administration Panel</strong> in your browser
            to edit all things: Virtual File System (VFS), create folders, assign accounts &amp;
            permissions, upload/download limits, plugins, and logs.
          </p>
        </div>
        <Button
          size="md"
          variant="primary"
          onClick={() => handleOpenUrl(adminUrl)}
          disabled={!isRunning}
          className="shrink-0"
        >
          Open Web Admin Panel ↗
        </Button>
      </div>

      {/* 4. Admin Credentials Control Card */}
      <div className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <ShieldIcon size={18} className="text-[#e06c43]" />
            <h2 className="text-sm font-semibold text-text">Admin Credentials Control</h2>
          </div>
          <span className="text-xs text-muted">
            Directly configure the server administrator login
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Admin Username</label>
            <Input
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="admin"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted">Admin Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-[#e06c43] hover:underline cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter password..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSaveCredentials}
            disabled={credSaving}
          >
            {credSaving ? 'Saving...' : 'Save Credentials'}
          </Button>
          {credMessage && (
            <span className="text-xs text-emerald-400 font-medium">{credMessage}</span>
          )}
        </div>
      </div>

      {/* 5. Basic Settings Card */}
      <div className="p-5 rounded-xl border border-line bg-surface space-y-4">
        <h2 className="text-sm font-semibold text-text border-b border-line pb-3">
          Basic Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Storage Root Path</label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={settings?.rootDir || 'Default (Smaran Files)'}
                className="truncate font-mono text-xs"
              />
              <Button size="sm" variant="secondary" onClick={handlePickRootDir}>
                Browse...
              </Button>
              <IconButton
                aria-label="Open in Explorer"
                title="Open in Explorer"
                onClick={handleOpenStorageFolder}
              >
                <FolderIcon size={14} className="text-[#e06c43]" />
              </IconButton>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">HTTP Server Port</label>
            <Input
              type="number"
              defaultValue={settings?.port ?? 5901}
              onBlur={handlePortChange}
              min={1024}
              max={65535}
            />
          </div>
        </div>

        <div className="pt-2 space-y-1">
          <Switch
            checked={settings?.autoStart ?? true}
            onChange={handleAutoStartChange}
            label="Auto-start File Server when Smaran opens"
          />
          <p className="text-[12px] text-muted">
            Automatically starts the Smaran HFS engine when Smaran launches.
          </p>
        </div>
      </div>

      {/* 6. Reset to Factory Defaults */}
      <div className="p-5 rounded-xl border border-rose-950/40 bg-rose-950/10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-rose-300">Reset Server to Defaults</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Revert port to 5901, reset credentials to smaran / smaran, and enable all 19 default plugins. Shared files will not be touched.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowResetDialog(true)}
            disabled={actionLoading || resetting}
          >
            {resetting ? 'Resetting...' : 'Reset to Defaults'}
          </Button>
        </div>
      </div>

      {/* 7. Real-time Activity Logs */}
      <div className="p-5 rounded-xl border border-line bg-surface space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-2 text-sm font-semibold text-text hover:text-[#e06c43] transition-colors cursor-pointer"
          >
            <ActivityIcon size={18} className="text-[#e06c43]" />
            <span>Activity Logs ({logs.length})</span>
            <span className="text-xs text-muted font-normal">
              {showLogs ? '▲ Collapse' : '▼ Expand'}
            </span>
          </button>
          {showLogs && (
            <Button size="sm" variant="ghost" onClick={handleClearLogs}>
              Clear Logs
            </Button>
          )}
        </div>

        {showLogs && (
          <div className="h-60 overflow-y-auto rounded-lg border border-line bg-[#0c0c0e] p-3 font-mono text-xs text-zinc-300 space-y-1">
            {logs.length === 0 ? (
              <p className="text-zinc-600 italic py-4 text-center">No logs recorded yet.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-zinc-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`shrink-0 px-1 rounded text-[10px] uppercase font-bold ${
                      log.level === 'error'
                        ? 'bg-rose-950 text-rose-300'
                        : log.level === 'warn'
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {qrModalUrl && qrCodeData && (
        <Dialog
          open={!!qrModalUrl}
          title="Scan to Connect to Smaran HFS"
          onClose={() => setQrModalUrl(null)}
          actions={
            <Button variant="secondary" onClick={() => setQrModalUrl(null)}>
              <XIcon size={14} />
              Close
            </Button>
          }
        >
          <div className="flex flex-col items-center justify-center p-4 space-y-3">
            <img
              src={qrCodeData}
              alt="QR Code"
              className="w-56 h-56 rounded-xl border border-line p-2 bg-[#0c0c0e]"
            />
            <p className="text-xs text-muted text-center max-w-xs">
              Scan with your phone or tablet camera to open Smaran HFS on your local network:
            </p>
            <p className="font-mono text-xs text-[#e06c43] break-all text-center">{qrModalUrl}</p>
          </div>
        </Dialog>
      )}

      {/* Reset Confirmation Modal */}
      {showResetDialog && (
        <Dialog
          open={showResetDialog}
          title="Reset File Server to Default Settings?"
          onClose={() => !resetting && setShowResetDialog(false)}
          actions={
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResetDialog(false)}
                disabled={resetting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleResetDefaults}
                disabled={resetting}
              >
                {resetting ? 'Resetting...' : 'Confirm Reset to Defaults'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs text-zinc-300">
            <p>
              Are you sure you want to reset all Smaran HFS settings back to factory defaults?
            </p>
            <div className="p-3 rounded-lg bg-[#0c0c0e] border border-line space-y-1.5 font-mono text-[11px]">
              <div>• Port: <span className="text-[#e06c43]">5901</span></div>
              <div>• Admin Username: <span className="text-[#e06c43]">smaran</span></div>
              <div>• Admin Password: <span className="text-[#e06c43]">smaran</span></div>
              <div>• Default Plugins: <span className="text-emerald-400">19 bundled plugins enabled</span></div>
              <div>• Web Reset URL: <span className="text-zinc-400">http://&lt;lan-ip&gt;:5901/~/admin/reset</span></div>
            </div>
            <p className="text-amber-400/90 text-[11px]">
              Note: Files stored in your shared directories will remain safe and untouched.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
