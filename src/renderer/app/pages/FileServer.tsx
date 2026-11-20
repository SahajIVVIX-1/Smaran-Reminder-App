import { useEffect, useState } from 'react';
import type { FileServerSecurityEvent, FileServerSettings } from '@shared/fileserver';
import { timeOf } from '../format';
import { cx } from '../cx';
import {
  ArrowDownIcon,
  BoltIcon,
  CheckIcon,
  CopyIcon,
  FolderIcon,
  GlobeIcon,
  PlayIcon,
  PowerIcon,
  QrIcon,
  RefreshIcon,
  ServerIcon,
  ShieldIcon,
  XIcon,
} from '../icons';
import { Button, Card, Dialog, IconButton, Input, Row, Switch } from '../ui';
import { useApp } from '../store';

export function FileServer() {
  const status = useApp((s) => s.fileServerStatus);
  const [settings, setSettings] = useState<FileServerSettings | null>(null);

  // Administrator Credentials State
  const [adminUsername, setAdminUsername] = useState('smaran');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfigured, setAdminPasswordConfigured] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credFeedback, setCredFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Server Port State
  const [portInput, setPortInput] = useState('5901');
  const [portSaving, setPortSaving] = useState(false);
  const [portFeedback, setPortFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Storage Root State
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageFeedback, setStorageFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // General Lifecycle State
  const [actionLoading, setActionLoading] = useState<
    'starting' | 'stopping' | 'restarting' | 'applying' | null
  >(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // QR Modal
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

  // WebDAV Drive Mount State
  const [driveMounting, setDriveMounting] = useState(false);
  const [driveFeedback, setDriveFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isEnablingWebClient, setIsEnablingWebClient] = useState(false);
  const [isExportingMountScript, setIsExportingMountScript] = useState(false);

  // Reset Modal
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Security & Connected Sessions State
  const [sessions, setSessions] = useState<Array<{ id: string; ip: string; speed?: number }>>([]);
  const [securityEvents, setSecurityEvents] = useState<FileServerSecurityEvent[]>([]);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const refreshSessions = async () => {
    try {
      const active = await window.smaran.fileserver.getSessions();
      setSessions(active || []);
    } catch {
      // transient
    }
  };

  const refreshSecurityEvents = async () => {
    try {
      const events = await window.smaran.fileserver.getSecurityEvents({ limit: 50 });
      setSecurityEvents(events || []);
    } catch {
      // transient
    }
  };

  const handleDisconnect = async (id: string) => {
    setDisconnectingId(id);
    try {
      await window.smaran.fileserver.disconnectSession(id);
      await refreshSessions();
    } finally {
      setDisconnectingId(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      try {
        const [active, events, s, setts, creds] = await Promise.all([
          window.smaran.fileserver.getSessions(),
          window.smaran.fileserver.getSecurityEvents({ limit: 50 }),
          window.smaran.fileserver.status(),
          window.smaran.fileserver.getSettings(),
          window.smaran.fileserver.getAdminCredentials(),
        ]);
        if (!mounted) return;
        setSessions(active || []);
        setSecurityEvents(events || []);
        if (s) useApp.getState().setFileServerStatus(s);
        if (s?.error) setServerError(s.error);
        setSettings(setts);
        if (setts.adminUsername) setAdminUsername(setts.adminUsername);
        if (setts.port) setPortInput(String(setts.port));
        if (creds.username) setAdminUsername(creds.username);
        setAdminPasswordConfigured(Boolean(creds.hasPassword));
      } catch {
        // Handled in UI
      }
    };

    void loadInitialData();

    const interval = setInterval(() => {
      void refreshSessions();
    }, 4000);
    const off = window.smaran.notifications.onChanged(() => {
      void refreshSecurityEvents();
    });

    const offStatus = window.smaran.fileserver.onStatusChanged((s) => {
      if (s) useApp.getState().setFileServerStatus(s);
      if (s?.error) setServerError(s.error);
      else if (s?.running) setServerError(null);
      if (s?.port) setPortInput(String(s.port));
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      off();
      offStatus();
    };
  }, []);

  const handleStart = async () => {
    setActionLoading('starting');
    setServerError(null);
    try {
      const res = await window.smaran.fileserver.start();
      const s = await window.smaran.fileserver.status();
      if (s) useApp.getState().setFileServerStatus(s);
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
      if (s) useApp.getState().setFileServerStatus(s);
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
      if (s) useApp.getState().setFileServerStatus(s);
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

  // Section: Server Port Apply
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
      if (s) useApp.getState().setFileServerStatus(s);
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
      const updated = await window.smaran.fileserver.saveSettings({
        autoStart,
        autoStartConfigured: true,
      });
      setSettings(updated);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    }
  };

  // Section: Storage Root Directory
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
        if (curStatus) useApp.getState().setFileServerStatus(curStatus);
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
      if (curStatus) useApp.getState().setFileServerStatus(curStatus);
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

  // Section: WebDAV Mounting & Unmounting
  const handleMountDrive = async () => {
    setDriveMounting(true);
    setDriveFeedback(null);
    try {
      const res = await window.smaran.fileserver.mountLocalDrive({
        driveLetter: 'Z:',
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
          message:
            'Windows WebDAV service (WebClient) & registry configured successfully! You can now click "Mount as Drive Z:".',
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

  // Section: Administrator Credentials
  const handleSaveCredentials = async () => {
    if (!adminUsername.trim()) {
      setCredFeedback({
        type: 'error',
        message: 'Admin username cannot be empty.',
      });
      return;
    }
    if (!adminPassword.trim() && !adminPasswordConfigured) {
      setCredFeedback({
        type: 'error',
        message: 'Admin password cannot be empty.',
      });
      return;
    }
    if (adminPassword.trim()) {
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
          message:
            'Password cannot be a common default or weak password (e.g. smaran, admin, password).',
        });
        return;
      }
    }
    setCredSaving(true);
    setCredFeedback(null);
    if (status?.running) {
      setActionLoading('applying');
    }
    try {
      let res: { ok: boolean; error?: string };
      if (adminPassword.trim()) {
        res = await window.smaran.fileserver.setAdminCredentials({
          username: adminUsername.trim(),
          password: adminPassword.trim(),
        });
      } else {
        await window.smaran.fileserver.saveSettings({
          adminUsername: adminUsername.trim(),
        });
        res = { ok: true };
      }
      if (res.ok) {
        setAdminPassword('');
        setAdminPasswordConfigured(true);
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

  // Section: Browser & Admin Launch
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
        setAdminPassword('');
        setAdminPasswordConfigured(Boolean(creds.hasPassword));
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
  const isStarting = actionLoading === 'starting' || status?.state === 'starting';
  const isStopping = actionLoading === 'stopping' || status?.state === 'stopping';
  const isRestarting = actionLoading === 'restarting';
  const isApplying = actionLoading === 'applying';
  const isError = status?.state === 'error' && !isRunning;
  const isPending = isStarting || isStopping || isRestarting || isApplying;

  const currentPort = status?.port ?? settings?.port ?? 5901;
  const adminUrl = `http://localhost:${currentPort}/~/admin/`;
  const webdavLocalUrl = `http://127.0.0.1:${currentPort}/`;
  const primaryLanUrl = status?.lanUrls?.[0] || `http://127.0.0.1:${currentPort}`;
  const rootStoragePath =
    status?.rootDir || settings?.rootDir || 'Default (Documents\\Smaran Files)';
  const displayFolderName = rootStoragePath.split(/[/\\]/).filter(Boolean).pop() || 'Smaran Files';

  return (
    <div className="mx-auto max-w-[820px] px-7 pt-8 pb-16 space-y-6">
      {/* Canonical Smaran Header */}
      <header className="flex animate-enter items-end gap-4">
        <div className="flex-1">
          <h1 className="font-serif text-[26px] leading-tight">File Server</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Self-hosted local file server &amp; WebDAV storage for Windows, macOS and mobile
            devices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => handleOpenUrl(adminUrl)}>
                <ShieldIcon size={14} />
                Admin Panel ↗
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRestart}
                disabled={actionLoading !== null}
                title="Restart File Server"
              >
                <RefreshIcon
                  size={13}
                  className={actionLoading === 'restarting' ? 'animate-spin text-accent' : ''}
                />
                Restart
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleStop}
                disabled={actionLoading !== null}
              >
                <PowerIcon size={14} />
                Stop Server
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStart}
              disabled={actionLoading !== null}
            >
              <PlayIcon size={14} />
              {actionLoading === 'starting' ? 'Starting...' : 'Start Server'}
            </Button>
          )}
        </div>
      </header>

      {/* Global Error Banner */}
      {serverError && (
        <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs shadow-xs animate-fade">
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

      {/* Hero / Live Server Status Card */}
      <div className="animate-enter rounded-xl border border-line bg-surface p-4.5 space-y-4 [animation-delay:40ms]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <ServerIcon size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-medium text-ink text-[15px]">Smaran HFS Engine</span>
                <span
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border',
                    isPending
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : isRunning
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                        : isError
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                          : 'border-line bg-raised text-muted',
                  )}
                >
                  {isPending ? (
                    <RefreshIcon size={11} className="animate-spin text-accent" />
                  ) : isRunning ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                  )}
                  {isStarting && 'Starting Server...'}
                  {isStopping && 'Stopping Server...'}
                  {isRestarting && 'Restarting Server...'}
                  {isApplying && 'Applying Configuration...'}
                  {!isPending &&
                    (isRunning
                      ? `Running on port ${currentPort}`
                      : isError
                        ? 'Server Error'
                        : 'Server Offline')}
                </span>
              </div>
              <p className="mt-0.5 font-serif text-[13px] text-muted italic">
                Self-hosted local file server with WebDAV drive mapping and Wi-Fi mobile sharing.
              </p>
            </div>
          </div>
        </div>

        {isRunning && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-line">
            <div className="rounded-lg border border-line bg-raised p-2.5 space-y-0.5">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                HTTP Port
              </span>
              <span className="font-mono text-[13px] font-semibold text-accent">{currentPort}</span>
            </div>
            <div className="rounded-lg border border-line bg-raised p-2.5 space-y-0.5">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                Active Clients
              </span>
              <span className="font-mono text-[13px] font-semibold text-ink">
                {status?.liveConnections ?? 0}{' '}
                <span className="text-[11px] text-muted font-normal font-sans">
                  {(status?.liveConnections ?? 0) === 1 ? 'conn' : 'conns'}
                </span>
              </span>
            </div>
            <div className="rounded-lg border border-line bg-raised p-2.5 space-y-0.5">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                Web Access
              </span>
              <span className="text-[12px] font-medium text-emerald-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                LAN &amp; Localhost
              </span>
            </div>
            <div className="rounded-lg border border-line bg-raised p-2.5 space-y-0.5">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                Storage Folder
              </span>
              <button
                type="button"
                onClick={handleOpenStorageFolder}
                className="text-[12px] font-medium text-ink hover:text-accent truncate flex items-center gap-1 cursor-pointer transition-colors max-w-full"
                title={rootStoragePath}
              >
                <FolderIcon size={12} className="text-accent shrink-0" />
                <span className="truncate">{displayFolderName}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* WebDAV Network Storage */}
      <Card
        title="WebDAV Network Storage"
        description="Access your Smaran files directly from Windows File Explorer, macOS Finder, or mobile WebDAV apps as a native network drive."
        className="animate-enter [animation-delay:80ms]"
      >
        <Row
          label="Windows Drive Mapping"
          hint="Mount your Smaran files as local drive Z: in Windows Explorer with verified connectivity."
        >
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleMountDrive}
              disabled={!isRunning || driveMounting}
            >
              <FolderIcon size={13} />
              {driveMounting ? 'Mounting Drive...' : 'Mount as Drive Z:'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleUnmountDrive} disabled={driveMounting}>
              Unmount
            </Button>
          </div>
        </Row>

        <Row
          label="WebDAV Connection URL"
          hint="Endpoint URL for WebDAV clients (supports read, write, rename, folder creation, and delete)."
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-accent px-2.5 py-1 rounded-md bg-raised border border-line select-all">
              {webdavLocalUrl}
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
        </Row>

        <Row
          label="Windows WebClient Service & Network Mount"
          hint="Fix Windows WebDAV connectivity (starts WebClient service & sets BasicAuthLevel=2) or export a batch script for other PCs."
        >
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleEnableWebClient}
              disabled={isEnablingWebClient}
              title="Configures Windows WebClient service & BasicAuthLevel=2 in registry"
            >
              <BoltIcon size={12} />
              {isEnablingWebClient ? 'Configuring...' : 'Enable WebDAV on this PC'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExportMountScript}
              disabled={isExportingMountScript}
              title="Export a standalone .bat script to mount this server from any Windows computer on the network"
            >
              <ArrowDownIcon size={12} />
              {isExportingMountScript ? 'Exporting...' : 'Export Mount Script (.bat)'}
            </Button>
          </div>
        </Row>

        {driveFeedback && (
          <div
            className={cx(
              'my-2 rounded-lg border p-3 text-xs space-y-2',
              driveFeedback.type === 'success'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/25 bg-rose-500/10 text-rose-300',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="leading-relaxed flex-1">{driveFeedback.message}</p>
              <button
                type="button"
                onClick={() => setDriveFeedback(null)}
                className="text-muted hover:text-ink text-xs cursor-pointer"
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
                      : 'Fix Windows WebDAV Service (Run as Admin)'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleExportMountScript}
                    disabled={isExportingMountScript}
                    className="text-xs text-muted hover:text-ink"
                  >
                    <ArrowDownIcon size={12} />
                    Export Mount Script (.bat)
                  </Button>
                </div>
              )}
          </div>
        )}
      </Card>

      {/* Storage & Server Configuration */}
      <Card
        title="Storage & Server Configuration"
        description="Select the shared folder and configure HTTP port and startup options."
        className="animate-enter [animation-delay:120ms]"
      >
        <Row
          label="Storage Directory"
          hint={
            <span
              className="truncate block font-mono text-[12px] text-ink select-all"
              title={rootStoragePath}
            >
              {rootStoragePath}
            </span>
          }
        >
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePickRootDir}
              disabled={storageLoading || actionLoading !== null}
            >
              <FolderIcon size={13} />
              Browse...
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
                className="text-xs text-muted hover:text-rose-400"
              >
                Reset Default
              </Button>
            )}
          </div>
        </Row>
        {storageFeedback && (
          <div
            className={cx(
              'my-1 rounded-lg border p-2 text-xs',
              storageFeedback.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-300',
            )}
          >
            {storageFeedback.message}
          </div>
        )}

        <Row
          label="HTTP Server Port"
          hint="Standard ports 1024–65535. Applying automatically restarts the running server."
        >
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
              className="w-24 font-mono text-center"
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
        </Row>
        {portFeedback && (
          <div
            className={cx(
              'my-1 rounded-lg border p-2 text-xs',
              portFeedback.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-300',
            )}
          >
            {portFeedback.message}
          </div>
        )}

        <Row
          label="Start File Server when Smaran opens"
          hint="Silently launches the file server engine when the Smaran desktop application starts."
          htmlFor="set-fs-autostart"
        >
          <Switch
            id="set-fs-autostart"
            label="Auto-start File Server"
            checked={settings?.autoStart ?? false}
            onChange={handleAutoStartChange}
          />
        </Row>

        <Row
          label="Automatically open Admin Panel after server starts"
          hint="Disabled by default. When enabled, your default browser opens the Admin Panel whenever the file server starts."
          htmlFor="set-fs-autoadmin"
        >
          <Switch
            id="set-fs-autoadmin"
            label="Auto-open Admin Panel"
            checked={settings?.autoOpenAdminOnStart ?? false}
            onChange={handleAutoOpenAdminChange}
          />
        </Row>
      </Card>

      {/* Administrator Credentials */}
      <Card
        title="Administrator Credentials"
        description="Manage the login credentials used for the Web Admin Panel and WebDAV authentication."
        className="animate-enter [animation-delay:160ms]"
      >
        <Row
          label="Admin Username"
          hint="Administrator account name for server console and WebDAV clients."
          htmlFor="set-admin-username"
        >
          <Input
            id="set-admin-username"
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            placeholder="smaran"
            className="w-48 font-mono text-[13px]"
          />
        </Row>

        <Row
          label="Admin Password"
          hint="Must be at least 8 characters. Avoid common or default passwords."
          htmlFor="set-admin-password"
        >
          <div className="flex items-center gap-2">
            <Input
              id="set-admin-password"
              type={showPassword ? 'text' : 'password'}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder={
                adminPasswordConfigured
                  ? '•••••••• (configured — enter new)'
                  : 'Enter password...'
              }
              className="w-44 font-mono text-[13px]"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[12px] text-muted hover:text-ink"
            >
              {showPassword ? 'Hide' : 'Show'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSaveCredentials}
              disabled={credSaving || actionLoading !== null}
            >
              {credSaving ? 'Saving...' : 'Save & Sync'}
            </Button>
          </div>
        </Row>
        {credFeedback && (
          <div
            className={cx(
              'my-1 rounded-lg border p-2 text-xs',
              credFeedback.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-300',
            )}
          >
            {credFeedback.message}
          </div>
        )}
      </Card>

      {/* Network Access & Mobile Sharing */}
      <Card
        title="Local Network & Mobile Sharing"
        description="Connect smartphones, tablets, or other computers on your Wi-Fi network."
        className="animate-enter [animation-delay:200ms]"
      >
        <Row
          label="Wi-Fi Connection Link"
          hint={
            isRunning
              ? 'Open on any phone or browser connected to the same Wi-Fi network.'
              : 'Start the server above to enable Wi-Fi sharing.'
          }
        >
          {isRunning ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent px-2.5 py-1 rounded-md bg-raised border border-line select-all">
                {primaryLanUrl}
              </span>
              <Button size="sm" variant="secondary" onClick={() => handleShowQr(primaryLanUrl)}>
                <QrIcon size={13} />
                QR Code
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleOpenUrl(primaryLanUrl)}>
                <GlobeIcon size={13} />
                Open Web ↗
              </Button>
              <IconButton
                aria-label="Copy Wi-Fi URL"
                title="Copy Wi-Fi URL"
                onClick={() => handleCopyUrl(primaryLanUrl)}
              >
                {copiedUrl === primaryLanUrl ? (
                  <CheckIcon size={14} className="text-emerald-500" />
                ) : (
                  <CopyIcon size={14} />
                )}
              </IconButton>
            </div>
          ) : (
            <span className="text-[12.5px] text-faint italic font-serif">Server Offline</span>
          )}
        </Row>

        {isRunning && status?.lanUrls && status.lanUrls.length > 1 && (
          <Row
            label="Other Network IPs"
            hint="Additional local IP addresses detected on your network interfaces."
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {status.lanUrls.slice(1).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => handleCopyUrl(u)}
                  className="rounded border border-line bg-raised px-2 py-0.5 font-mono text-[11px] text-muted hover:text-accent transition-colors cursor-pointer"
                  title="Click to copy"
                >
                  {u}
                </button>
              ))}
            </div>
          </Row>
        )}
      </Card>

      {/* Security & Connected Clients Monitoring */}
      <Card
        title="Security & Live Connected Sessions"
        description="Active clients, recent logins, and rejected authentication attempts."
        className="animate-enter [animation-delay:220ms]"
      >
        {/* Active Connected Clients */}
        <div className="border-b border-line pb-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Live Connected Clients ({sessions.length})
            </h4>
            <Button size="sm" variant="ghost" onClick={refreshSessions}>
              <RefreshIcon size={13} /> Refresh
            </Button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-faint font-serif italic py-2">
              No client devices currently connected.
            </p>
          ) : (
            <div className="divide-y divide-line/60 rounded-xl border border-line bg-raised/40 overflow-hidden">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="font-mono font-medium text-ink">{s.ip}</span>
                    <span className="text-faint font-mono text-[11px]">
                      (ID: {s.id.slice(0, 8)})
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={disconnectingId === s.id}
                    onClick={() => handleDisconnect(s.id)}
                  >
                    {disconnectingId === s.id ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Security & Activity Events */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Recent Security Events ({securityEvents.length})
            </h4>
            <Button size="sm" variant="ghost" onClick={() => useApp.getState().go('history')}>
              View in History →
            </Button>
          </div>
          {securityEvents.length === 0 ? (
            <p className="text-xs text-faint font-serif italic py-2">
              No recent security events recorded.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {securityEvents.slice(0, 10).map((ev) => {
                const isWarning = ev.type === 'failedLogin';
                let eventTitle = '';
                let eventDesc = '';
                if (ev.type === 'login') {
                  eventTitle = `User “${ev.username}” Logged In`;
                  eventDesc = `${ev.clientIp} (${ev.accessType || 'LAN'})`;
                } else if (ev.type === 'failedLogin') {
                  const rep = (ev.repeatCount ?? 1) > 1 ? ` (Attempt #${ev.repeatCount})` : '';
                  eventTitle = `Failed Login: ${ev.username}${rep}`;
                  eventDesc = `${ev.clientIp} – Reason: ${ev.reason || 'Invalid credentials'}`;
                } else if (ev.type === 'logout') {
                  eventTitle = `User “${ev.username}” Logged Out`;
                  eventDesc = `${ev.clientIp}`;
                } else if (ev.type === 'adminActivity') {
                  eventTitle = 'Administrator Action';
                  eventDesc = ev.details || 'Configuration modified';
                }

                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between rounded-lg border border-line bg-raised/40 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="shrink-0">
                        {isWarning ? (
                          <ShieldIcon size={14} className="text-danger" />
                        ) : (
                          <ServerIcon size={14} className="text-accent" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-ink truncate">{eventTitle}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface text-muted">
                            {timeOf(new Date(ev.timestamp))}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-muted truncate">{eventDesc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Danger Zone: Reset to Factory Defaults */}
      <Card
        title="Reset File Server to Defaults"
        description="Revert port to 5901, reset credentials, and restore 19 default plugins. Shared files remain safe."
        className="animate-enter [animation-delay:240ms] border-danger/30 bg-danger/5"
      >
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-[13px] text-ink font-medium">Factory Defaults</span>
            <p className="mt-0.5 font-serif text-[12.5px] text-muted italic">
              Restore original server configuration without affecting your shared files or
              documents.
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
      </Card>

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
            <p className="text-xs text-muted text-center max-w-xs font-serif italic">
              Scan with your phone or tablet camera to open Smaran HFS on your local network:
            </p>
            <p className="font-mono text-xs text-accent break-all text-center select-all">
              {qrModalUrl}
            </p>
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
              <Button variant="danger" size="sm" onClick={handleResetDefaults} disabled={resetting}>
                {resetting ? 'Resetting...' : 'Confirm Reset to Defaults'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs text-muted">
            <p className="text-ink">
              Are you sure you want to reset all Smaran HFS settings back to factory defaults?
            </p>
            <div className="p-3 rounded-lg bg-surface border border-line space-y-1.5 font-mono text-[11px]">
              <div>
                • Port: <span className="text-accent">5901</span>
              </div>
              <div>
                • Admin Username: <span className="text-accent">admin</span>
              </div>
              <div>
                • Admin Password:{' '}
                <span className="text-accent">A unique, high-entropy password is generated</span>
              </div>
              <div>
                • Default Plugins:{' '}
                <span className="text-emerald-400">19 bundled plugins enabled</span>
              </div>
            </div>
            <p className="text-amber-400/90 text-[11px] font-serif italic">
              Note: Files stored in your shared directories will remain safe and untouched.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
