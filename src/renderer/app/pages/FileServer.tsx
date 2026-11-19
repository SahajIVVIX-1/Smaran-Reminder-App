import { useEffect, useState } from 'react';
import type { FileServerSettings, ServerStatus } from '@shared/fileserver';
import {
  ArrowDownIcon,
  BoltIcon,
  CheckIcon,
  CopyIcon,
  FolderIcon,
  GlobeIcon,
  LinkIcon,
  LockIcon,
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

  // Administrator Credentials State
  const [adminUsername, setAdminUsername] = useState('smaran');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credFeedback, setCredFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Server Port State
  const [portInput, setPortInput] = useState('5901');
  const [portSaving, setPortSaving] = useState(false);
  const [portFeedback, setPortFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Storage Root State
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageFeedback, setStorageFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // General Lifecycle State
  const [actionLoading, setActionLoading] = useState<'starting' | 'stopping' | 'restarting' | 'applying' | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // QR Modal
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

  // WebDAV Drive Mount State
  const [driveMounting, setDriveMounting] = useState(false);
  const [driveFeedback, setDriveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isEnablingWebClient, setIsEnablingWebClient] = useState(false);
  const [isExportingMountScript, setIsExportingMountScript] = useState(false);

  // Reset Modal
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
      if (s.port) setPortInput(String(s.port));
    });
    void window.smaran.fileserver.getAdminCredentials().then((creds) => {
      if (creds.username) setAdminUsername(creds.username);
      if (creds.password) setAdminPassword(creds.password);
    });

    const offStatus = window.smaran.fileserver.onStatusChanged((s) => {
      setStatus(s);
      if (s?.error) setServerError(s.error);
      else if (s?.running) setServerError(null);
      if (s?.port) setPortInput(String(s.port));
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

  // Section 1: Server Port Apply
  const handleApplyPort = async () => {
    const num = parseInt(portInput.trim(), 10);
    if (isNaN(num) || num < 1024 || num > 65535) {
      setPortFeedback({
        type: 'error',
        message: 'Port must be a valid number between 1024 and 65535.',
      });
      return;
    }

    setPortSaving(true);
    setPortFeedback(null);
    setServerError(null);
    if (status?.running) {
      setActionLoading('applying');
    }

    try {
      const updated = await window.smaran.fileserver.saveSettings({ port: num });
      setSettings(updated);
      const s = await window.smaran.fileserver.status();
      setStatus(s);
      setPortFeedback({
        type: 'success',
        message: `Port updated to ${num}${s.running ? ' and server restarted successfully' : ''}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPortFeedback({ type: 'error', message: msg });
      setServerError(msg);
    } finally {
      setPortSaving(false);
      setActionLoading(null);
      setTimeout(() => setPortFeedback(null), 5000);
    }
  };

  const handleAutoStartChange = async (autoStart: boolean) => {
    try {
      const updated = await window.smaran.fileserver.saveSettings({ autoStart });
      setSettings(updated);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    }
  };

  // Section 2: Storage Root Directory
  const handlePickRootDir = async () => {
    setStorageLoading(true);
    setStorageFeedback(null);
    if (status?.running) {
      setActionLoading('applying');
    }
    try {
      const picked = await window.smaran.fileserver.pickRootDir();
      if (picked) {
        const s = await window.smaran.fileserver.getSettings();
        setSettings(s);
        const curStatus = await window.smaran.fileserver.status();
        setStatus(curStatus);
        setStorageFeedback({
          type: 'success',
          message: `Storage root updated to "${picked}".`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStorageFeedback({ type: 'error', message: msg });
      setServerError(msg);
    } finally {
      setStorageLoading(false);
      setActionLoading(null);
      setTimeout(() => setStorageFeedback(null), 5000);
    }
  };

  const handleResetDefaultFolder = async () => {
    setStorageLoading(true);
    setStorageFeedback(null);
    if (status?.running) {
      setActionLoading('applying');
    }
    try {
      const updated = await window.smaran.fileserver.saveSettings({ rootDir: '' });
      setSettings(updated);
      const curStatus = await window.smaran.fileserver.status();
      setStatus(curStatus);
      setStorageFeedback({
        type: 'success',
        message: 'Storage root restored to default directory.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStorageFeedback({ type: 'error', message: msg });
      setServerError(msg);
    } finally {
      setStorageLoading(false);
      setActionLoading(null);
      setTimeout(() => setStorageFeedback(null), 5000);
    }
  };

  const handleOpenStorageFolder = async () => {
    await window.smaran.fileserver.openFolder('');
  };

  // Section 3: WebDAV Mounting & Unmounting
  const handleMountDrive = async () => {
    setDriveMounting(true);
    setDriveFeedback(null);
    try {
      const res = await window.smaran.fileserver.mountLocalDrive({
        driveLetter: 'Z:',
        username: adminUsername,
        password: adminPassword,
      });
      if (res.ok) {
        setDriveFeedback({
          type: 'success',
          message: `Drive ${res.driveLetter || 'Z:'} successfully mounted & verified in Windows Explorer.`,
        });
        setTimeout(() => setDriveFeedback(null), 6000);
      } else {
        setDriveFeedback({
          type: 'error',
          message: res.error || 'Failed to mount WebDAV drive.',
        });
      }
    } catch (err: unknown) {
      setDriveFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDriveMounting(false);
    }
  };

  const handleUnmountDrive = async () => {
    setDriveMounting(true);
    setDriveFeedback(null);
    try {
      const res = await window.smaran.fileserver.unmountLocalDrive('Z:');
      if (res.ok) {
        setDriveFeedback({
          type: 'success',
          message: 'Drive Z: unmounted successfully.',
        });
        setTimeout(() => setDriveFeedback(null), 5000);
      } else {
        setDriveFeedback({
          type: 'error',
          message: res.error || 'Failed to unmount drive Z:.',
        });
      }
    } catch (err: unknown) {
      setDriveFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDriveMounting(false);
    }
  };

  const handleEnableWebClient = async () => {
    setIsEnablingWebClient(true);
    setDriveFeedback(null);
    try {
      const res = await window.smaran.fileserver.enableWebClient();
      if (res.ok) {
        setDriveFeedback({
          type: 'success',
          message: 'Windows WebDAV service (WebClient) & registry configured successfully! You can now click "Mount as Drive Z:".',
        });
        setTimeout(() => setDriveFeedback(null), 10000);
      } else {
        setDriveFeedback({
          type: 'error',
          message: res.error || 'Failed to configure Windows WebClient service.',
        });
      }
    } catch (err: unknown) {
      setDriveFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsEnablingWebClient(false);
    }
  };

  const handleExportMountScript = async () => {
    setIsExportingMountScript(true);
    try {
      const res = await window.smaran.fileserver.exportMountScript();
      if (res.ok && res.filePath) {
        setDriveFeedback({
          type: 'success',
          message: `Mount script successfully exported to ${res.filePath}. Run it as Administrator on any PC on your network.`,
        });
        setTimeout(() => setDriveFeedback(null), 10000);
      } else if (!res.ok && res.error) {
        setDriveFeedback({
          type: 'error',
          message: res.error,
        });
      }
    } catch (err: unknown) {
      setDriveFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsExportingMountScript(false);
    }
  };

  // Section 4: Administrator Credentials
  const handleSaveCredentials = async () => {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setCredFeedback({
        type: 'error',
        message: 'Admin username and password cannot be empty.',
      });
      return;
    }
    if (adminPassword.trim().length < 8) {
      setCredFeedback({
        type: 'error',
        message: 'Password must be at least 8 characters long.',
      });
      return;
    }
    const banned = ['smaran', 'admin', 'password', '12345678', '123456789'];
    if (banned.includes(adminPassword.trim().toLowerCase())) {
      setCredFeedback({
        type: 'error',
        message: 'Password cannot be a common default or weak password (e.g. smaran, admin, password).',
      });
      return;
    }
    setCredSaving(true);
    setCredFeedback(null);
    if (status?.running) {
      setActionLoading('applying');
    }
    try {
      const res = await window.smaran.fileserver.setAdminCredentials({
        username: adminUsername.trim(),
        password: adminPassword,
      });
      if (res.ok) {
        setCredFeedback({
          type: 'success',
          message: 'Admin credentials synchronized successfully to server & WebDAV.',
        });
      } else {
        setCredFeedback({
          type: 'error',
          message: res.error || 'Failed to synchronize credentials.',
        });
      }
    } catch (err: unknown) {
      setCredFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCredSaving(false);
      setActionLoading(null);
      setTimeout(() => setCredFeedback(null), 5000);
    }
  };

  // Section 5: Browser & Admin Launch
  const handleAutoOpenAdminChange = async (autoOpenAdminOnStart: boolean) => {
    try {
      const updated = await window.smaran.fileserver.saveSettings({ autoOpenAdminOnStart });
      setSettings(updated);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    }
  };

  // Reset Defaults Modal
  const handleResetDefaults = async () => {
    setResetting(true);
    try {
      const res = await window.smaran.fileserver.resetDefaults();
      if (res.ok) {
        const s = await window.smaran.fileserver.getSettings();
        setSettings(s);
        setPortInput(String(s.port || 5901));
        const creds = await window.smaran.fileserver.getAdminCredentials();
        setAdminUsername(creds.username || 'admin');
        setAdminPassword(creds.password || '');
        setShowResetDialog(false);
        setServerError(null);
        setPortFeedback({ type: 'success', message: 'Reset to factory defaults completed.' });
      } else {
        setServerError(res.error || 'Failed to reset file server');
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  };

  const isRunning = status?.running ?? false;
  const currentPort = status?.port ?? settings?.port ?? 5901;
  const adminUrl = `http://localhost:${currentPort}/~/admin/`;
  const webdavLocalUrl = `http://127.0.0.1:${currentPort}/`;
  const primaryLanUrl = status?.lanUrls?.[0] || `http://127.0.0.1:${currentPort}`;
  const webdavLanUrl = status?.lanUrls?.[0] ? `${status.lanUrls[0]}/` : webdavLocalUrl;
  const rootStoragePath = status?.rootDir || settings?.rootDir || 'Default (Smaran Files)';
  const displayFolderName = rootStoragePath.split(/[/\\]/).filter(Boolean).pop() || 'Smaran Files';

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Global Error Banner */}
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

      {/* Top Hero / Live Server Status Card */}
      <div className="p-5 sm:p-6 rounded-2xl border border-line bg-surface shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-xs shrink-0">
              <ServerIcon size={24} />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-ink">Smaran HFS</h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border tracking-wide transition-all ${
                    actionLoading
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : isRunning
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-zinc-700/60 bg-zinc-800/40 text-muted'
                  }`}
                >
                  {actionLoading ? (
                    <RefreshIcon size={11} className="animate-spin text-accent" />
                  ) : isRunning ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  )}
                  {actionLoading === 'starting' && 'Starting Server...'}
                  {actionLoading === 'stopping' && 'Stopping Server...'}
                  {actionLoading === 'restarting' && 'Restarting Server...'}
                  {actionLoading === 'applying' && 'Applying Configuration...'}
                  {!actionLoading && (isRunning ? `Running on port ${currentPort}` : 'Server Offline')}
                </span>
              </div>
              <p className="text-xs text-muted truncate">
                Fast, self-hosted local file server &amp; WebDAV storage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isRunning ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenUrl(adminUrl)}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <ShieldIcon size={13} className="text-muted" />
                  Admin Panel ↗
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRestart}
                  disabled={actionLoading !== null}
                  title="Restart Server"
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <RefreshIcon
                    size={13}
                    className={actionLoading === 'restarting' ? 'animate-spin text-accent' : ''}
                  />
                  Restart
                </Button>
                <button
                  type="button"
                  onClick={handleStop}
                  disabled={actionLoading !== null}
                  className="h-8 px-3 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 active:scale-[0.97] text-rose-300 hover:text-rose-100 text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  <PowerIcon size={13} />
                  Stop Server
                </button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStart}
                disabled={actionLoading !== null}
                className="h-8 px-4 gap-1.5 text-xs font-semibold shadow-xs"
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

      {/* SECTION 1: SERVER & SECTION 2: STORAGE (2-column on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Section 1: Server Settings */}
        <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
          <div className="border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <ServerIcon size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-ink">1. Server Configuration</h2>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Configure HTTP listener port and startup behavior
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">HTTP Server Port</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleApplyPort();
                  }}
                  min={1024}
                  max={65535}
                  placeholder="5901"
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleApplyPort}
                  disabled={portSaving || actionLoading !== null || portInput === String(currentPort)}
                >
                  {portSaving ? 'Applying...' : 'Apply Port'}
                </Button>
              </div>
              <p className="text-[11px] text-muted">
                Standard ports 1024–65535. Applying automatically restarts the running server.
              </p>
              {portFeedback && (
                <div
                  className={`text-xs p-2 rounded-lg ${
                    portFeedback.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                  }`}
                >
                  {portFeedback.message}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-line/60 space-y-1">
              <Switch
                checked={settings?.autoStart ?? true}
                onChange={handleAutoStartChange}
                label="Auto-start File Server when Smaran opens"
              />
              <p className="text-[12px] text-muted">
                Silently launches the file server engine when the Smaran desktop application starts.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Storage Settings */}
        <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
          <div className="border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <FolderIcon size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-ink">2. Storage Directory</h2>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Root directory served over HTTP and WebDAV
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Root Storage Path</label>
              <div className="p-2.5 rounded-lg border border-line bg-surface-raised font-mono text-xs text-ink truncate select-all" title={rootStoragePath}>
                {rootStoragePath}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handlePickRootDir}
                  disabled={storageLoading || actionLoading !== null}
                >
                  <FolderIcon size={13} />
                  Browse Folder...
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleOpenStorageFolder}
                  title="Open folder in Windows Explorer"
                >
                  Open Folder
                </Button>
                {settings?.rootDir && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetDefaultFolder}
                    disabled={storageLoading || actionLoading !== null}
                    className="text-xs text-muted hover:text-rose-400 ml-auto"
                  >
                    Reset to Default
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted">
                Selecting a new directory immediately updates HFS VFS configuration and reloads files.
              </p>
              {storageFeedback && (
                <div
                  className={`text-xs p-2 rounded-lg ${
                    storageFeedback.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                  }`}
                >
                  {storageFeedback.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: WEBDAV NETWORK STORAGE */}
      <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <LinkIcon size={17} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">3. WebDAV Network Storage</h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                isRunning
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning ? 'bg-emerald-400' : 'bg-zinc-500'
                }`}
              />
              {isRunning ? 'WebDAV Active' : 'WebDAV Inactive (Server Offline)'}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Access your Smaran files directly from <strong>Windows File Explorer</strong>, <strong>macOS Finder</strong>, or mobile WebDAV apps as a native network drive. Supports uploading, downloading, folder creation, renaming and deletion.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* WebDAV Connection URL Card */}
          <div className="p-4 rounded-xl border border-line bg-surface-raised space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                WebDAV Connection URL
              </span>
              <IconButton
                aria-label="Copy WebDAV URL"
                title="Copy WebDAV URL"
                onClick={() => handleCopyUrl(webdavLocalUrl)}
              >
                {copiedUrl === webdavLocalUrl ? (
                  <CheckIcon size={14} className="text-emerald-500" />
                ) : (
                  <CopyIcon size={14} />
                )}
              </IconButton>
            </div>
            <div className="p-2.5 rounded-lg border border-line/60 bg-surface font-mono text-xs font-semibold text-accent break-all select-all">
              {webdavLocalUrl}
            </div>
            {status?.lanUrls?.[0] && (
              <div className="text-[11px] text-muted flex items-center justify-between pt-1">
                <span>LAN WebDAV:</span>
                <button
                  type="button"
                  onClick={() => handleCopyUrl(webdavLanUrl)}
                  className="font-mono text-xs text-zinc-300 hover:text-accent transition-colors cursor-pointer"
                  title="Click to copy LAN WebDAV URL"
                >
                  {webdavLanUrl}
                </button>
              </div>
            )}
            <div className="pt-1 flex items-center justify-between">
              <Button
                size="sm"
                variant="ghost"
                className="text-[11px] text-zinc-300 hover:text-white px-2 py-1 h-auto"
                onClick={handleExportMountScript}
                disabled={isExportingMountScript}
                title="Export a standalone .bat script to mount this server from any Windows computer on the network"
              >
                <ArrowDownIcon size={12} />
                {isExportingMountScript ? 'Exporting...' : 'Export Mount Script (.bat)'}
              </Button>
            </div>
          </div>

          {/* Windows Drive Mount Card */}
          <div className="p-4 rounded-xl border border-line bg-surface-raised space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                Windows Drive Mapping
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">Drive Z:</span>
            </div>
            <p className="text-[11px] text-muted">
              Mount your Smaran files as local drive <strong>Z:</strong> in Windows Explorer with verified connectivity.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 justify-center"
                onClick={handleMountDrive}
                disabled={!isRunning || driveMounting}
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
            <div className="pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-center text-[11px] text-zinc-400 hover:text-accent px-2 py-1 h-auto border border-line/40 hover:border-accent/40"
                onClick={handleEnableWebClient}
                disabled={isEnablingWebClient}
                title="Configures Windows WebClient service & BasicAuthLevel=2 in registry for HTTP WebDAV mounting"
              >
                <BoltIcon size={12} />
                {isEnablingWebClient ? 'Configuring Windows WebDAV...' : 'Enable WebDAV on this PC (Run Admin Fix)'}
              </Button>
            </div>
          </div>
        </div>

        {driveFeedback && (
          <div
            className={`text-xs p-3.5 rounded-xl border space-y-2 ${
              driveFeedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/25'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="leading-relaxed flex-1">{driveFeedback.message}</p>
              <button
                type="button"
                onClick={() => setDriveFeedback(null)}
                className="text-zinc-400 hover:text-zinc-200 text-xs px-1"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
            {driveFeedback.type === 'error' &&
              (driveFeedback.message.includes('WebClient') ||
                driveFeedback.message.includes('BasicAuth') ||
                driveFeedback.message.includes('Enable WebDAV')) && (
                <div className="pt-1 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleEnableWebClient}
                    disabled={isEnablingWebClient}
                    className="bg-amber-500/20 text-amber-200 border-amber-500/30 hover:bg-amber-500/30 text-xs"
                  >
                    <BoltIcon size={12} />
                    {isEnablingWebClient
                      ? 'Configuring Windows WebDAV...'
                      : '⚡ Fix Windows WebDAV Service (Requires Admin)'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleExportMountScript}
                    disabled={isExportingMountScript}
                    className="text-xs text-zinc-300 hover:text-white"
                  >
                    <ArrowDownIcon size={12} />
                    Export Mount Script (.bat)
                  </Button>
                </div>
              )}
          </div>
        )}
      </div>

      {/* SECTION 4: ADMINISTRATOR CREDENTIALS & SECTION 5: BROWSER & ADMIN (2-column on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Section 4: Administrator Credentials */}
        <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
          <div className="border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <LockIcon size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-ink">4. Administrator Credentials</h2>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Credentials for Web Admin Panel and WebDAV authentication
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

            <div className="flex items-center justify-between pt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSaveCredentials}
                disabled={credSaving || actionLoading !== null}
              >
                {credSaving ? 'Saving & Syncing...' : 'Save Credentials'}
              </Button>
            </div>

            {credFeedback && (
              <div
                className={`text-xs p-2 rounded-lg ${
                  credFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                }`}
              >
                {credFeedback.message}
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Browser & Administration Launch */}
        <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
          <div className="border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <ShieldIcon size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-ink">5. Browser &amp; Administration</h2>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Browser launch preference and web administration console
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <Switch
                checked={settings?.autoOpenAdminOnStart ?? false}
                onChange={handleAutoOpenAdminChange}
                label="Automatically open Admin Panel after server starts"
              />
              <p className="text-[12px] text-muted">
                Disabled by default. When enabled, your default browser opens the Admin Panel whenever the file server starts.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-line bg-surface-raised space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                  Admin Console URL
                </span>
                <IconButton
                  aria-label="Copy Admin URL"
                  title="Copy Admin URL"
                  onClick={() => handleCopyUrl(adminUrl)}
                >
                  {copiedUrl === adminUrl ? (
                    <CheckIcon size={14} className="text-emerald-500" />
                  ) : (
                    <CopyIcon size={14} />
                  )}
                </IconButton>
              </div>
              <div className="p-2 rounded-lg border border-line/60 bg-surface font-mono text-xs text-ink truncate select-all">
                {adminUrl}
              </div>
              <Button
                size="sm"
                variant="primary"
                className="w-full justify-center shadow-xs"
                onClick={() => handleOpenUrl(adminUrl)}
                disabled={!isRunning}
              >
                <ShieldIcon size={13} />
                Open Web Admin Panel ↗
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Network Access & Endpoints (LAN Wi-Fi Links & QR Code) */}
      <div className="p-5 rounded-2xl border border-line bg-surface shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <GlobeIcon size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Network Access &amp; Mobile Sharing</h2>
          </div>
          <span className="text-xs text-muted">
            Connect phones, tablets, and smart TVs on your Wi-Fi network
          </span>
        </div>

        {isRunning ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="p-4 rounded-xl border border-line bg-surface-raised space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                  Quick Mobile Connection
                </span>
                <p className="text-xs text-muted leading-relaxed">
                  Open the camera on your smartphone or tablet connected to the same Wi-Fi network and scan the QR code to instantly browse, stream, and download files without cables.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleShowQr(primaryLanUrl)}
                className="w-full justify-center"
              >
                <QrIcon size={13} />
                Show Fullscreen QR Code
              </Button>
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

      {/* Danger Zone: Reset to Factory Defaults */}
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
              <div>• Admin Username: <span className="text-accent">admin</span></div>
              <div>• Admin Password: <span className="text-accent">A unique, high-entropy password is generated</span></div>
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