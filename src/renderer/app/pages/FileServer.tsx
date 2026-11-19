import { useEffect, useState } from 'react';
import type { FileServerSettings, ServerStatus } from '@shared/fileserver';
import {
  CheckIcon,
  CopyIcon,
  FolderIcon,
  GlobeIcon,
  LinkIcon,
  PlayIcon,
  PowerIcon,
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
  const [actionLoading, setActionLoading] = useState<'starting' | 'stopping' | 'restarting' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [driveMounting, setDriveMounting] = useState(false);
  const [driveResult, setDriveResult] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    void window.smaran.fileserver.status().then((s) => {
      setStatus(s);
      if (s?.error) setServerError(s.error);
    });
    void window.smaran.fileserver.getSettings().then((s) => {
      setSettings(s);
      if (s.adminUsername) setAdminUsername(s.adminUsername);
    });
    void window.smaran.fileserver.getAdminCredentials().then((creds) => {
      if (creds.username) setAdminUsername(creds.username);
      if (creds.password) setAdminPassword(creds.password);
    });

    const offStatus = window.smaran.fileserver.onStatusChanged((s) => {
      setStatus(s);
      if (s?.error) setServerError(s.error);
      else if (s?.running) setServerError(null);
    });

    return () => {
      offStatus();
    };
  }, []);

  const handleStart = async () => {
    setActionLoading('starting');
    setServerError(null);
    try {
      const res = await window.smaran.fileserver.start();
      const s = await window.smaran.fileserver.status();
      setStatus(s);
      if (!res.ok) {
        setServerError(res.error || 'Failed to start file server');
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading('stopping');
    try {
      await window.smaran.fileserver.stop();
      const s = await window.smaran.fileserver.status();
      setStatus(s);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    setActionLoading('restarting');
    setServerError(null);
    try {
      const res = await window.smaran.fileserver.restart();
      const s = await window.smaran.fileserver.status();
      setStatus(s);
      if (!res.ok) {
        setServerError(res.error || 'Failed to restart file server');
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
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
    } catch (err: unknown) {
      setCredMessage(err instanceof Error ? err.message : String(err));
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
        setServerError(null);
      } else {
        setServerError(res.error || 'Failed to reset file server');
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
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
    } catch (err: unknown) {
      setDriveResult(err instanceof Error ? err.message : String(err));
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
    } catch (err: unknown) {
      setDriveResult(err instanceof Error ? err.message : String(err));
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

  const isRunning = status?.running ?? false;
  const currentPort = status?.port ?? settings?.port ?? 5901;
  const adminUrl = `http://localhost:${currentPort}/~/admin/`;
  const primaryLanUrl = status?.lanUrls?.[0] || `http://127.0.0.1:${currentPort}`;
  const rootStoragePath = status?.rootDir || settings?.rootDir || 'Default (Smaran Files)';
  const displayFolderName = rootStoragePath.split(/[/\\]/).filter(Boolean).pop() || 'Smaran Files';

  return (
    <div className="space-y-5 p-6 max-w-5xl mx-auto">
      {/* 0. Optional Error Notification Banner */}
      {serverError && (
        <div className="flex items-start justify-between gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs shadow-xs animate-fade">
          <div className="flex items-start gap-2.5">
            <span className="font-semibold text-rose-300">Server Alert:</span>
            <span className="leading-relaxed">{serverError}</span>
          </div>
          <button
            type="button"
            onClick={() => setServerError(null)}
            className="text-rose-400 hover:text-rose-100 transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss error"
          >
            <XIcon size={14} />
          </button>
        </div>
      )}

      {/* 1. Header & Server Hero Dashboard Card */}
      <div className="p-5 sm:p-6 rounded-2xl border border-line bg-surface shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-xs shrink-0">
              <ServerIcon size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink">Smaran HFS</h1>
              <p className="text-xs text-muted mt-0.5">
                Fast, self-hosted local file server &amp; WebDAV storage.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-surface-raised">
              {actionLoading ? (
                <RefreshIcon size={12} className="animate-spin text-accent" />
              ) : isRunning ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
              )}
              <span className="text-xs font-medium text-ink">
                {actionLoading === 'starting' && 'Starting Server...'}
                {actionLoading === 'stopping' && 'Stopping Server...'}
                {actionLoading === 'restarting' && 'Restarting Server...'}
                {!actionLoading && (isRunning ? `Running on port ${currentPort}` : 'Server Offline')}
              </span>
            </div>

            {/* Power Action Buttons */}
            {isRunning ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleStop}
                  disabled={actionLoading !== null}
                >
                  <PowerIcon size={13} />
                  Stop Server
                </Button>
                <IconButton
                  aria-label="Restart Server"
                  title="Restart Server"
                  onClick={handleRestart}
                  disabled={actionLoading !== null}
                >
                  <RefreshIcon
                    size={14}
                    className={actionLoading === 'restarting' ? 'animate-spin text-accent' : ''}
                  />
                </IconButton>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenUrl(adminUrl)}
                >
                  <ShieldIcon size={13} />
                  Admin Panel ↗
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleStart}
                disabled={actionLoading !== null}
                className="shadow-sm"
              >
                <PlayIcon size={14} />
                Start Server
              </Button>
            )}
          </div>
        </div>

        {/* Live Metrics Row (Shown when running) */}
        {isRunning && (
          <div className="pt-3 border-t border-line/60 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-line bg-surface-raised space-y-1">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                HTTP Port
              </span>
              <span className="font-mono text-sm font-semibold text-accent">{currentPort}</span>
            </div>
            <div className="p-3 rounded-xl border border-line bg-surface-raised space-y-1">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                Active Clients
              </span>
              <span className="font-mono text-sm font-semibold text-ink">
                {status?.liveConnections ?? 0}{' '}
                <span className="text-xs text-muted font-normal">
                  {(status?.liveConnections ?? 0) === 1 ? 'conn' : 'conns'}
                </span>
              </span>
            </div>
            <div className="p-3 rounded-xl border border-line bg-surface-raised space-y-1">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                Web Access
              </span>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                LAN &amp; Localhost
              </span>
            </div>
            <div className="p-3 rounded-xl border border-line bg-surface-raised space-y-1">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                Storage Folder
              </span>
              <button
                type="button"
                onClick={handleOpenStorageFolder}
                className="text-xs font-medium text-ink hover:text-accent truncate flex items-center gap-1 cursor-pointer transition-colors max-w-full"
                title={rootStoragePath}
              >
                <FolderIcon size={12} className="text-accent shrink-0" />
                <span className="truncate">{displayFolderName}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Client Web Links & Network Endpoints Card */}
      <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <GlobeIcon size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Network Access &amp; Endpoints</h2>
          </div>
          <span className="text-xs text-muted">
            Share files with phones, tablets, or computers on your network
          </span>
        </div>

        {isRunning ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary LAN Wi-Fi Endpoint */}
            <div className="p-4 rounded-xl border border-line bg-surface-raised space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                  LAN Wi-Fi Link
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleShowQr(primaryLanUrl)}
                  >
                    <QrIcon size={13} />
                    QR Code
                  </Button>
                  <IconButton
                    aria-label="Copy LAN Link"
                    title="Copy LAN Link"
                    onClick={() => handleCopyUrl(primaryLanUrl)}
                  >
                    {copiedUrl === primaryLanUrl ? (
                      <CheckIcon size={14} className="text-emerald-500" />
                    ) : (
                      <CopyIcon size={14} />
                    )}
                  </IconButton>
                </div>
              </div>
              <div className="p-2.5 rounded-lg border border-line/60 bg-surface font-mono text-xs font-semibold text-accent break-all select-all">
                {primaryLanUrl}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full justify-center"
                onClick={() => handleOpenUrl(primaryLanUrl)}
              >
                <LinkIcon size={13} />
                Open Web File Explorer ↗
              </Button>
              {status?.lanUrls && status.lanUrls.length > 1 && (
                <div className="pt-1 text-[11px] text-muted space-y-1">
                  <span className="font-medium text-zinc-400">Other Network IPs:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {status.lanUrls.slice(1).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => handleCopyUrl(u)}
                        className="px-2 py-0.5 rounded font-mono text-[10px] bg-surface border border-line text-zinc-400 hover:text-accent transition-colors cursor-pointer"
                        title="Click to copy"
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Localhost Link & WebDAV Drive Mount */}
            <div className="p-4 rounded-xl border border-line bg-surface-raised space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                  Localhost &amp; WebDAV Drive
                </span>
                <IconButton
                  aria-label="Copy Localhost Link"
                  title="Copy Localhost Link"
                  onClick={() => handleCopyUrl(`http://127.0.0.1:${currentPort}`)}
                >
                  {copiedUrl === `http://127.0.0.1:${currentPort}` ? (
                    <CheckIcon size={14} className="text-emerald-500" />
                  ) : (
                    <CopyIcon size={14} />
                  )}
                </IconButton>
              </div>
              <div className="p-2.5 rounded-lg border border-line/60 bg-surface font-mono text-xs text-ink break-all select-all">
                {`http://127.0.0.1:${currentPort}/`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 justify-center"
                  onClick={handleMountDrive}
                  disabled={driveMounting}
                >
                  <FolderIcon size={13} />
                  {driveMounting ? 'Mounting Drive...' : 'Mount as Drive Z:'}
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
              {driveResult && (
                <p className="text-[11px] text-muted italic leading-snug">{driveResult}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-xl border border-line/60 bg-surface-raised/40 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800/80 border border-line mx-auto flex items-center justify-center text-zinc-400">
              <GlobeIcon size={20} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-semibold text-ink">Server is Offline</h3>
              <p className="text-xs text-muted leading-relaxed">
                Click <strong>Start Server</strong> above to share your folders over Wi-Fi, scan QR codes on mobile devices, or mount your files as a native Windows drive.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Web Administration Panel Link Card */}
      <div className="p-5 rounded-2xl border border-accent/25 bg-accent/5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-ink font-semibold text-sm">
            <ShieldIcon size={17} className="text-accent" />
            Web Administration Console
          </div>
          <p className="text-xs text-muted max-w-xl leading-relaxed">
            Open the complete <strong>Smaran HFS Web Administration Panel</strong> in your browser to manage virtual folders (VFS), assign user accounts and permissions, adjust upload/download limits, and configure plugins.
          </p>
        </div>
        <Button
          size="md"
          variant="primary"
          onClick={() => handleOpenUrl(adminUrl)}
          disabled={!isRunning}
          className="shrink-0 shadow-sm"
        >
          Open Web Admin Panel ↗
        </Button>
      </div>

      {/* 4. Two-Column Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Admin Credentials Control */}
        <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
          <div className="border-b border-line pb-3">
            <h2 className="text-sm font-semibold text-ink">Admin Credentials Control</h2>
            <p className="text-xs text-muted mt-0.5">
              Configure server administrator credentials for Web Admin &amp; WebDAV
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Admin Username</label>
              <Input
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="smaran"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted">Admin Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-accent hover:underline cursor-pointer"
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
        </div>

        {/* Basic Settings */}
        <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
          <div className="border-b border-line pb-3">
            <h2 className="text-sm font-semibold text-ink">Storage &amp; Server Settings</h2>
            <p className="text-xs text-muted mt-0.5">Configure storage directory and server port</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Storage Root Path</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={rootStoragePath}
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
                  <FolderIcon size={14} className="text-accent" />
                </IconButton>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">HTTP Server Port</label>
              <Input
                type="number"
                defaultValue={currentPort}
                onBlur={handlePortChange}
                min={1024}
                max={65535}
              />
            </div>

            <div className="pt-1 space-y-1">
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
        </div>
      </div>

      {/* 5. Danger Zone / Reset to Factory Defaults */}
      <div className="p-5 rounded-2xl border border-rose-950/40 bg-rose-950/10 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-rose-300">Reset Server to Defaults</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Revert port to 5901, reset credentials to smaran / smaran, and restore 19 default plugins. Shared files remain safe.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowResetDialog(true)}
            disabled={actionLoading !== null || resetting}
          >
            {resetting ? 'Resetting...' : 'Reset to Defaults'}
          </Button>
        </div>
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
            <p className="font-mono text-xs text-accent break-all text-center">{qrModalUrl}</p>
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
              <div>• Port: <span className="text-accent">5901</span></div>
              <div>• Admin Username: <span className="text-accent">smaran</span></div>
              <div>• Admin Password: <span className="text-accent">smaran</span></div>
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
