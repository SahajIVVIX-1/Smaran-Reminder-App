import { useEffect, useState } from 'react';
import type {
  AvailableScreenSource,
  RemoteHubDevice,
  RemoteHubLogEntry,
  RemoteHubOverview,
  RemoteHubSettings,
  RemoteHubStream,
  RemoteHubUser,
  UserRole,
} from '@shared/remotehub';
import { copyToClipboard } from '../clipboard';
import { cx } from '../cx';
import {
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  MonitorIcon,
  NetworkIcon,
  PlayIcon,
  PlusIcon,
  PowerIcon,
  QrIcon,
  RefreshIcon,
  ShieldIcon,
  TrashIcon,
  XIcon,
} from '../icons';
import { Button, Card, Dialog, IconButton, Input, Row, Switch } from '../ui';

export function RemoteHub() {
  const [overview, setOverview] = useState<RemoteHubOverview | null>(null);
  const [streams, setStreams] = useState<RemoteHubStream[]>([]);
  const [devices, setDevices] = useState<RemoteHubDevice[]>([]);
  const [users, setUsers] = useState<RemoteHubUser[]>([]);
  const [settings, setSettings] = useState<RemoteHubSettings | null>(null);
  const [logs, setLogs] = useState<RemoteHubLogEntry[]>([]);

  // Server Port State
  const [portInput, setPortInput] = useState('5902');
  const [portSaving, setPortSaving] = useState(false);
  const [portFeedback, setPortFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Administrator Credentials State
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credFeedback, setCredFeedback] = useState<{
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

  // New Stream Modal
  const [showNewStreamModal, setShowNewStreamModal] = useState(false);
  const [sources, setSources] = useState<AvailableScreenSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [streamName, setStreamName] = useState('');
  const [streamResolution, setStreamResolution] = useState('1080p');
  const [streamFps, setStreamFps] = useState(30);
  const [streamSrtMode, setStreamSrtMode] = useState<'caller' | 'listener'>('listener');
  const [streamSrtPort, setStreamSrtPort] = useState(6000);
  const [streamSrtLatency, setStreamSrtLatency] = useState(120);

  // Pair Modal
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairCodeInfo, setPairCodeInfo] = useState<{ code: string; expiresAt: number } | null>(
    null,
  );

  // User Accounts Modal & State
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('operator');

  // First Run Admin Init Modal
  const [showAdminInitModal, setShowAdminInitModal] = useState(false);

  // Loading indicator for stream operations
  const [streamActionLoading, setStreamActionLoading] = useState(false);

  const loadAllData = async () => {
    try {
      const [ov, st, dev, us, setts, lg] = await Promise.all([
        window.smaran.remotehub.overview(),
        window.smaran.remotehub.getStreams(),
        window.smaran.remotehub.getDevices(),
        window.smaran.remotehub.getUsers(),
        window.smaran.remotehub.getSettings(),
        window.smaran.remotehub.logs.get(),
      ]);
      setOverview(ov);
      setStreams(st);
      setDevices(dev);
      setUsers(us);
      setSettings(setts);
      setLogs(lg);
      if (ov.port) setPortInput(String(ov.port));
      if (!ov.adminCreated) {
        setShowAdminInitModal(true);
      }
    } catch (err) {
      console.warn('[RemoteHub] Error loading data:', err);
    }
  };

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      window.smaran.remotehub.overview(),
      window.smaran.remotehub.getStreams(),
      window.smaran.remotehub.getDevices(),
      window.smaran.remotehub.getUsers(),
      window.smaran.remotehub.getSettings(),
      window.smaran.remotehub.logs.get(),
    ])
      .then(([ov, st, dev, us, setts, lg]) => {
        if (!mounted) return;
        setOverview(ov);
        setStreams(st);
        setDevices(dev);
        setUsers(us);
        setSettings(setts);
        setLogs(lg);
        if (ov.port) setPortInput(String(ov.port));
        if (!ov.adminCreated) {
          setShowAdminInitModal(true);
        }
      })
      .catch((err) => {
        console.warn('[RemoteHub] Error loading initial data:', err);
      });

    const unsubOverview = window.smaran.remotehub.onOverviewChanged((newOv) => {
      if (mounted) {
        setOverview(newOv);
        if (newOv.port) setPortInput(String(newOv.port));
      }
    });

    const unsubLog = window.smaran.remotehub.onLogAdded((log) => {
      if (mounted) setLogs((prev) => [log, ...prev.slice(0, 499)]);
    });

    const timer = setInterval(() => {
      void window.smaran.remotehub.getStreams().then((s) => {
        if (mounted) setStreams(s);
      });
      void window.smaran.remotehub.getDevices().then((d) => {
        if (mounted) setDevices(d);
      });
    }, 4000);

    return () => {
      mounted = false;
      unsubOverview();
      unsubLog();
      clearInterval(timer);
    };
  }, []);

  const isRunning = overview?.status === 'running';
  const isStarting = actionLoading === 'starting' || overview?.status === 'starting';
  const isStopping = actionLoading === 'stopping' || overview?.status === 'stopping';
  const isRestarting = actionLoading === 'restarting';
  const isApplying = actionLoading === 'applying';
  const isPending = isStarting || isStopping || isRestarting || isApplying;
  const isError = overview?.status === 'error';
  const currentPort = overview?.port ?? 5902;
  const primaryLanUrl = overview?.lanUrl || `http://127.0.0.1:${currentPort}/`;

  const handleStart = async () => {
    setActionLoading('starting');
    setServerError(null);
    try {
      const res = await window.smaran.remotehub.start();
      if (!res.ok) {
        setServerError(res.error || 'Failed to start Remote Hub Server');
      }
      await loadAllData();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading('stopping');
    try {
      await window.smaran.remotehub.stop();
      await loadAllData();
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
      const res = await window.smaran.remotehub.restart();
      if (!res.ok) {
        setServerError(res.error || 'Failed to restart Remote Hub Server');
      }
      await loadAllData();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank');
  };

  const handleCopyUrl = async (url: string) => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const handleShowQr = async (url: string) => {
    try {
      const qrData = await window.smaran.fileserver.generateQr(url);
      setQrCodeData(qrData);
    } catch {
      setQrCodeData(null);
    }
    setQrModalUrl(url);
  };

  const handleApplyPort = async () => {
    const p = parseInt(portInput.trim(), 10);
    if (Number.isNaN(p) || p < 1024 || p > 65535) {
      setPortFeedback({
        type: 'error',
        message: 'Port must be a valid number between 1024 and 65535.',
      });
      return;
    }
    setPortSaving(true);
    setPortFeedback(null);
    if (isRunning) {
      setActionLoading('applying');
    }
    try {
      const updated = await window.smaran.remotehub.saveSettings({ port: p });
      setSettings(updated);
      setPortFeedback({
        type: 'success',
        message: `Port updated to ${p}.${isRunning ? ' Server restarted with new port.' : ''}`,
      });
      await loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPortFeedback({ type: 'error', message: msg });
      setServerError(msg);
    } finally {
      setPortSaving(false);
      setActionLoading(null);
      setTimeout(() => setPortFeedback(null), 6000);
    }
  };

  const handleSaveCredentials = async () => {
    if (!adminUsername.trim()) {
      setCredFeedback({
        type: 'error',
        message: 'Admin username cannot be empty.',
      });
      return;
    }
    if (!adminPassword.trim()) {
      setCredFeedback({
        type: 'error',
        message: 'Admin password cannot be empty.',
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
    setCredSaving(true);
    setCredFeedback(null);
    try {
      await window.smaran.remotehub.createAdmin({
        username: adminUsername.trim(),
        password: adminPassword.trim(),
        displayName: 'Administrator',
      });
      setCredFeedback({
        type: 'success',
        message: 'Administrator credentials updated and secured.',
      });
      setAdminPassword('');
      await loadAllData();
    } catch (err: unknown) {
      setCredFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCredSaving(false);
      setTimeout(() => setCredFeedback(null), 6000);
    }
  };

  const handleOpenStreamModal = async () => {
    try {
      const srcList = await window.smaran.remotehub.getSources();
      setSources(srcList);
      if (srcList.length > 0 && srcList[0]) {
        setSelectedSourceId(srcList[0].id);
        setStreamName(srcList[0].name);
      }
      setShowNewStreamModal(true);
    } catch (err) {
      setServerError('Failed to fetch capture sources: ' + String(err));
    }
  };

  const handleStartStream = async () => {
    if (!selectedSourceId) return;
    setStreamActionLoading(true);
    try {
      await window.smaran.remotehub.startStream({
        sourceId: selectedSourceId,
        name: streamName || 'Display Feed',
        resolution: streamResolution,
        fps: streamFps,
        enableSrt: true,
        srtMode: streamSrtMode,
        srtPort: streamSrtPort,
        srtLatencyMs: streamSrtLatency,
      });
      setShowNewStreamModal(false);
      await loadAllData();
    } catch (err) {
      setServerError('Error starting stream: ' + String(err));
    } finally {
      setStreamActionLoading(false);
    }
  };

  const handleStopStream = async (id: string) => {
    try {
      await window.smaran.remotehub.stopStream(id);
      await loadAllData();
    } catch (err) {
      setServerError(String(err));
    }
  };

  const handleGeneratePairCode = async () => {
    const codeData = await window.smaran.remotehub.requestPairCode();
    setPairCodeInfo(codeData);
    setShowPairModal(true);
  };

  const handleRevokeDevice = async (id: string) => {
    try {
      await window.smaran.remotehub.revokeDevice(id);
      await loadAllData();
    } catch (err) {
      setServerError(String(err));
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    try {
      await window.smaran.remotehub.createUser({
        username: newUsername.trim(),
        password: newPassword.trim(),
        displayName: newDisplayName.trim() || newUsername.trim(),
        role: newUserRole,
      });
      setShowNewUserModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      await loadAllData();
    } catch (err) {
      setServerError(String(err));
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await window.smaran.remotehub.deleteUser(id);
      await loadAllData();
    } catch (err) {
      setServerError(String(err));
    }
  };

  const handleEmergencyRevokeControl = async () => {
    try {
      await window.smaran.remotehub.revokeControl();
      await loadAllData();
    } catch (err) {
      setServerError(String(err));
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Canonical Smaran Header (Exact FileServer structure) */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Remote Hub</h1>
          <p className="mt-1 font-serif text-[13px] text-muted italic">
            Multi-screen streaming, independent SRT outputs, and password-protected remote control.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="flex items-center gap-2 animate-fade transition-all duration-300">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpenUrl(primaryLanUrl)}
                title="Open Remote Hub Web Dashboard in browser"
              >
                <GlobeIcon size={13} />
                Open Browser
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRestart}
                disabled={actionLoading !== null}
                title="Restart Remote Hub Server"
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
                {actionLoading === 'stopping' ? (
                  <RefreshIcon size={14} className="animate-spin text-white" />
                ) : (
                  <PowerIcon size={14} />
                )}
                {actionLoading === 'stopping' ? 'Stopping…' : 'Stop Server'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 animate-fade transition-all duration-300">
              <Button
                variant="primary"
                size="sm"
                onClick={handleStart}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'starting' ? (
                  <RefreshIcon size={14} className="animate-spin text-on-accent" />
                ) : (
                  <PlayIcon size={14} />
                )}
                {actionLoading === 'starting' ? 'Starting Server…' : 'Start Server'}
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Global Error Banner */}
      {serverError && (
        <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs shadow-xs animate-fade transition-all duration-300">
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

      {/* Hero / Live Server Status Card (Exact FileServer structure) */}
      <div className="animate-enter rounded-xl border border-line bg-surface p-4.5 space-y-4 [animation-delay:40ms] transition-all duration-500 ease-in-out">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent transition-transform duration-300">
              <NetworkIcon size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-medium text-ink text-[15px]">Smaran Remote Hub Engine</span>
                <span
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-all duration-300 ease-out',
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
                Central multi-screen broadcast server, independent SRT feeds, and secure host remote
                control.
              </p>
            </div>
          </div>
        </div>

        {/* Collapsible 4-column metric badges strip */}
        <div
          className={cx(
            'transition-all duration-500 ease-in-out overflow-hidden',
            isRunning
              ? 'max-h-60 opacity-100 pt-3 border-t border-line translate-y-0'
              : 'max-h-0 opacity-0 pt-0 border-t-0 -translate-y-2 pointer-events-none',
          )}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-lg border border-line bg-raised p-2.5 space-y-0.5 transition-all duration-300">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                TCP Port
              </span>
              <span className="font-mono text-[13px] font-semibold text-accent">{currentPort}</span>
            </div>
            <div className="rounded-lg border border-line bg-raised p-2.5 space-y-0.5 transition-all duration-300">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                Connected Users
              </span>
              <span className="font-mono text-[13px] font-semibold text-ink">
                {overview?.connectedUsers ?? 0}{' '}
                <span className="text-[11px] text-muted font-normal font-sans">
                  {(overview?.connectedUsers ?? 0) === 1 ? 'user' : 'users'}
                </span>
              </span>
            </div>
            <div className="rounded-lg border border-line bg-raised p-2.5 space-y-0.5 transition-all duration-300">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                Network Access
              </span>
              <span
                className="text-[12px] font-medium text-emerald-400 flex items-center gap-1.5"
                title="Localhost and local Wi-Fi / LAN devices can connect."
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                LAN &amp; Localhost
              </span>
            </div>
            <div className="rounded-lg border border-line bg-raised p-2.5 space-y-0.5 transition-all duration-300">
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                Active Streams
              </span>
              <span className="font-mono text-[13px] font-semibold text-sky-400">
                {overview?.activeStreams ?? 0}{' '}
                <span className="text-[11px] text-muted font-normal font-sans">
                  {(overview?.activeStreams ?? 0) === 1 ? 'feed' : 'feeds'}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Network Access & Mobile Sharing (Exact FileServer structure) */}
      <Card
        title="Local Network & Mobile Sharing"
        description="Connect smartphones, tablets, or other computers on your Wi-Fi network to view live feeds or control the host PC."
        className="animate-enter [animation-delay:80ms]"
      >
        <Row
          label="Wi-Fi Connection Link"
          hint={
            isRunning
              ? 'Open on any phone or browser connected to the same Wi-Fi network.'
              : 'Start the server above to enable Wi-Fi sharing.'
          }
        >
          <div className="min-h-[32px] flex items-center transition-all duration-300">
            {isRunning ? (
              <div className="flex items-center gap-2 animate-fade transition-all duration-300">
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
              <span className="text-[12.5px] text-faint italic font-serif animate-fade transition-opacity duration-300">
                Server Offline
              </span>
            )}
          </div>
        </Row>
      </Card>

      {/* Active Screen & Window Broadcasts */}
      <Card
        title="Active Screen & Window Broadcasts"
        description="Share multiple displays and individual application windows concurrently. Every feed gets an independent SRT stream for OBS Studio or vMix."
        className="animate-enter [animation-delay:120ms]"
      >
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Live Broadcast Feeds ({streams.length})
            </span>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleOpenStreamModal}
            disabled={!isRunning}
            title={isRunning ? 'Broadcast new screen or window' : 'Start server to broadcast'}
          >
            <PlusIcon size={13} /> Broadcast Screen / Window
          </Button>
        </div>

        {streams.length === 0 ? (
          <div className="py-6 text-center">
            <MonitorIcon size={28} className="mx-auto mb-2 opacity-40 text-muted" />
            <p className="text-xs text-faint font-serif italic">
              No active broadcast feeds. Click &quot;Broadcast Screen / Window&quot; above to begin
              streaming.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3">
            {streams.map((st) => (
              <div
                key={st.id}
                className="overflow-hidden rounded-xl border border-line bg-raised/40 p-0 flex flex-col"
              >
                <div className="relative aspect-video w-full bg-black/80 flex items-center justify-center">
                  {st.thumbnailUrl ? (
                    <img
                      src={st.thumbnailUrl}
                      alt={st.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <MonitorIcon size={32} className="text-muted/50" />
                  )}
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <span className="rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ● LIVE
                    </span>
                    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                      {st.resolution} · {st.fps} FPS
                    </span>
                  </div>
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-[13.5px] font-semibold text-ink truncate">{st.name}</h4>
                      <span className="font-mono text-[11px] text-sky-400">UDP {st.srt?.port}</span>
                    </div>
                    <p className="text-[11.5px] text-muted truncate">
                      Source: {st.sourceTitle} ({st.sourceType})
                    </p>
                  </div>

                  {st.srt?.obsSourceString && (
                    <div className="rounded bg-sheet/80 p-2 font-mono text-[11px] text-accent flex items-center justify-between gap-2">
                      <span className="truncate">{st.srt.obsSourceString}</span>
                      <IconButton
                        aria-label="Copy OBS SRT string"
                        title="Copy OBS SRT string"
                        onClick={() => st.srt?.obsSourceString && handleCopyUrl(st.srt.obsSourceString)}
                      >
                        {copiedUrl === st.srt.obsSourceString ? (
                          <CheckIcon size={12} className="text-emerald-500" />
                        ) : (
                          <CopyIcon size={12} />
                        )}
                      </IconButton>
                    </div>
                  )}

                  <div className="flex items-center justify-end pt-1">
                    <Button size="sm" variant="danger" onClick={() => handleStopStream(st.id)}>
                      Stop Stream
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* SRT Stream Outputs for OBS Studio & vMix */}
      <Card
        title="SRT Stream Outputs (OBS Studio & vMix)"
        description="Low-latency broadcast streams formatted for OBS Studio, vMix, and SRT hardware decoders."
        className="animate-enter [animation-delay:140ms]"
      >
        <Row
          label="SRT Base Port"
          hint="Ports start here and increment automatically for each active display or window."
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-accent px-2.5 py-1 rounded-md bg-raised border border-line select-all">
              {settings?.srtBasePort ?? 6000}
            </span>
            <span className="text-xs text-muted">
              (Default Latency: {settings?.srtDefaultLatencyMs ?? 120}ms)
            </span>
          </div>
        </Row>
      </Card>

      {/* Remote Desktop Control Security */}
      <Card
        title="Remote Desktop Control & Host Security"
        description="Only PCs with the full Smaran application installed can be remotely controlled. Participant PCs using the lightweight Sharing Agent are restricted to screen broadcasting."
        className="animate-enter [animation-delay:160ms]"
      >
        <Row
          label="Host PC Control Eligibility"
          hint="Security invariant strictly enforced at the protocol engine level."
        >
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Host PC (This Computer) — Eligible for Remote Control
          </span>
        </Row>

        <Row
          label="Require Host Approval for Remote Control"
          hint="Host must click Approve before any mouse or keyboard input from remote operators is accepted."
          htmlFor="set-remote-approval"
        >
          <Switch
            id="set-remote-approval"
            label="Require Host Approval"
            checked={settings?.requireControlApproval ?? true}
            onChange={async (checked) => {
              const updated = await window.smaran.remotehub.saveSettings({
                requireControlApproval: checked,
              });
              setSettings(updated);
            }}
          />
        </Row>

        <Row
          label="Emergency Host Revocation"
          hint="Instantly terminates all active remote desktop sessions and returns full mouse/keyboard ownership to the host."
        >
          <Button size="sm" variant="danger" onClick={handleEmergencyRevokeControl}>
            Emergency Revoke Control
          </Button>
        </Row>
      </Card>

      {/* Registered Devices & Sharing Agents */}
      <Card
        title="Registered Devices & Sharing Agents"
        description="Computers paired with this Remote Hub. Remote PCs use the standalone Sharing Agent to broadcast feeds."
        className="animate-enter [animation-delay:180ms]"
      >
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Paired Devices ({devices.length})
            </span>
          </div>
          <Button size="sm" variant="primary" onClick={handleGeneratePairCode}>
            <PlusIcon size={13} /> Pair New Device (6-Digit Code)
          </Button>
        </div>

        <div className="divide-y divide-line/60 rounded-xl border border-line bg-raised/40 overflow-hidden mt-3">
          {devices.map((dev) => (
            <div
              key={dev.id}
              className="flex flex-wrap items-center justify-between p-3 text-xs gap-2"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cx(
                    'h-2 w-2 rounded-full shrink-0',
                    dev.status === 'online' ? 'bg-emerald-400' : 'bg-faint',
                  )}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{dev.name}</span>
                    <span className="font-mono text-[11px] text-muted">{dev.ip}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10.5px] px-1.5 py-0.2 rounded bg-surface border border-line text-muted">
                      {dev.isSmaranInstalled ? 'Full Smaran PC' : 'Sharing Agent'}
                    </span>
                    <span
                      className={cx(
                        'text-[10.5px] px-1.5 py-0.2 rounded font-medium',
                        dev.canRemoteControl
                          ? 'bg-accent/10 text-accent border border-accent/20'
                          : 'bg-surface text-muted border border-line',
                      )}
                    >
                      {dev.canRemoteControl ? 'Eligible for Control' : 'No Remote Control'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                {dev.id !== 'host-local' && (
                  <Button size="sm" variant="ghost" onClick={() => handleRevokeDevice(dev.id)}>
                    <TrashIcon size={12} /> Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* User Accounts & Role Permissions */}
      <Card
        title="User Accounts & Access Control"
        description="Manage password-protected platform accounts, role permissions, and session authorization."
        className="animate-enter [animation-delay:200ms]"
      >
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Registered Accounts ({users.length})
            </span>
          </div>
          <Button size="sm" variant="primary" onClick={() => setShowNewUserModal(true)}>
            <PlusIcon size={13} /> Add User
          </Button>
        </div>

        <div className="divide-y divide-line/60 rounded-xl border border-line bg-raised/40 overflow-hidden mt-3">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{u.username}</span>
                  <span className="text-muted">({u.displayName})</span>
                  <span
                    className={cx(
                      'text-[10.5px] px-1.5 py-0.2 rounded font-medium uppercase',
                      u.role === 'owner'
                        ? 'bg-accent/10 text-accent border border-accent/25'
                        : u.role === 'operator'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/25'
                          : 'bg-surface text-muted border border-line',
                    )}
                  >
                    {u.role}
                  </span>
                </div>
              </div>

              <div>
                {u.role !== 'owner' && (
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u.id)}>
                    <TrashIcon size={12} /> Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Administrator Credentials Card (Exact FileServer structure) */}
      <Card
        title="Administrator Credentials"
        description="Manage the primary Owner / Administrator login credentials used for full platform administration."
        className="animate-enter [animation-delay:220ms]"
      >
        <Row
          label="Admin Username"
          hint="Primary administrator account name for server administration and WebRTC control."
          htmlFor="set-remote-admin-username"
        >
          <Input
            id="set-remote-admin-username"
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            placeholder="admin"
            className="w-48 font-mono text-[13px]"
          />
        </Row>

        <Row
          label="Admin Password"
          hint="Must be at least 8 characters. Avoid common or default passwords."
          htmlFor="set-remote-admin-password"
        >
          <div className="flex items-center gap-2">
            <Input
              id="set-remote-admin-password"
              type={showPassword ? 'text' : 'password'}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="•••••••• (enter new password)"
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

      {/* Storage & Server Configuration Card (Exact FileServer structure) */}
      <Card
        title="Server & Network Configuration"
        description="Configure TCP control port and startup options."
        className="animate-enter [animation-delay:240ms]"
      >
        <Row
          label="TCP Control Port"
          hint="Default port 5902. Applying automatically restarts the running server."
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
              placeholder="5902"
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
          label="Allow Local Network (LAN) Access"
          hint="Binds to 0.0.0.0 allowing access from other computers on your Wi-Fi/LAN."
          htmlFor="set-remote-allow-lan"
        >
          <Switch
            id="set-remote-allow-lan"
            label="Allow LAN Access"
            checked={settings?.allowLan ?? true}
            onChange={async (checked) => {
              const updated = await window.smaran.remotehub.saveSettings({ allowLan: checked });
              setSettings(updated);
            }}
          />
        </Row>

        <Row
          label="Start Remote Hub when Smaran opens"
          hint="Silently launches the Remote Hub engine when the Smaran desktop application starts."
          htmlFor="set-remote-autostart"
        >
          <Switch
            id="set-remote-autostart"
            label="Auto-start Remote Hub"
            checked={settings?.autoStart ?? false}
            onChange={async (checked) => {
              const updated = await window.smaran.remotehub.saveSettings({ autoStart: checked });
              setSettings(updated);
            }}
          />
        </Row>
      </Card>

      {/* Security & Activity Audit Log */}
      <Card
        title="Security & Activity Audit Log"
        description="Live audit events, login attempts, device pairings, and stream lifecycles."
        className="animate-enter [animation-delay:260ms]"
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Recent Audit Events ({logs.length})
          </h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await window.smaran.remotehub.logs.clear();
              setLogs([]);
            }}
          >
            Clear Log
          </Button>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-faint font-serif italic py-2">No audit events recorded yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {logs.slice(0, 15).map((lg) => (
              <div
                key={lg.id}
                className="flex items-center justify-between rounded-lg border border-line bg-raised/40 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="shrink-0">
                    <ShieldIcon
                      size={14}
                      className={
                        lg.level === 'error'
                          ? 'text-danger'
                          : lg.level === 'security'
                            ? 'text-sky-400'
                            : 'text-accent'
                      }
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink truncate">
                        [{lg.category.toUpperCase()}]
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface text-muted">
                        {lg.timestamp.slice(11, 19)}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted truncate">{lg.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* QR Code Modal for Phone / Tablet Access (Exact FileServer structure) */}
      {qrModalUrl && (
        <Dialog
          open={Boolean(qrModalUrl)}
          title="Scan QR Code to Connect"
          onClose={() => setQrModalUrl(null)}
          actions={
            <Button variant="secondary" onClick={() => setQrModalUrl(null)}>
              Close
            </Button>
          }
        >
          <div className="flex flex-col items-center justify-center space-y-4 py-2">
            <p className="text-center text-xs text-muted leading-relaxed">
              Scan with your smartphone camera or QR reader to connect on your local Wi-Fi.
            </p>
            {qrCodeData ? (
              <div className="rounded-xl border border-line bg-surface p-3 shadow-md">
                <img
                  src={qrCodeData}
                  alt="QR Code"
                  className="h-56 w-56 object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-line bg-surface">
                <RefreshIcon size={24} className="animate-spin text-accent" />
              </div>
            )}
            <span className="font-mono text-xs text-accent text-center break-all select-all px-2">
              {qrModalUrl}
            </span>
          </div>
        </Dialog>
      )}

      {/* MODAL: Broadcast Screen / Window */}
      <Dialog
        open={showNewStreamModal}
        title="Broadcast Screen / Window"
        onClose={() => setShowNewStreamModal(false)}
        size="wide"
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowNewStreamModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleStartStream}
              disabled={!selectedSourceId || streamActionLoading}
            >
              {streamActionLoading ? 'Starting Stream...' : 'Start Broadcast'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
              Select Display or Window
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {sources.map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => {
                    setSelectedSourceId(src.id);
                    setStreamName(src.name);
                  }}
                  className={cx(
                    'flex flex-col items-center rounded-xl border p-2 text-left transition-all cursor-pointer',
                    selectedSourceId === src.id
                      ? 'border-accent bg-accent/10 shadow-sm'
                      : 'border-line bg-raised/40 hover:bg-raised',
                  )}
                >
                  <img
                    src={src.thumbnailUrl}
                    alt={src.name}
                    className="aspect-video w-full rounded object-contain bg-black/60 mb-1.5"
                  />
                  <div className="truncate text-xs font-medium text-ink w-full text-center">
                    {src.name}
                  </div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">{src.type}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">Stream Name</label>
              <Input value={streamName} onChange={(e) => setStreamName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">Resolution</label>
              <select
                value={streamResolution}
                onChange={(e) => setStreamResolution(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:outline-accent"
              >
                <option value="720p">720p (HD)</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="1440p">1440p (2K)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">Target FPS</label>
              <select
                value={String(streamFps)}
                onChange={(e) => setStreamFps(parseInt(e.target.value, 10) || 30)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:outline-accent"
              >
                <option value="30">30 FPS</option>
                <option value="60">60 FPS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">SRT Mode</label>
              <select
                value={streamSrtMode}
                onChange={(e) => setStreamSrtMode(e.target.value as 'caller' | 'listener')}
                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:outline-accent"
              >
                <option value="listener">Listener (Smaran listens)</option>
                <option value="caller">Caller (Smaran connects)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">SRT Port</label>
              <Input
                type="number"
                value={streamSrtPort}
                onChange={(e) => setStreamSrtPort(parseInt(e.target.value, 10) || 6000)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">Latency (ms)</label>
              <Input
                type="number"
                value={streamSrtLatency}
                onChange={(e) => setStreamSrtLatency(parseInt(e.target.value, 10) || 120)}
              />
            </div>
          </div>
        </div>
      </Dialog>

      {/* MODAL: Pair Device with 6-Digit Code */}
      <Dialog
        open={showPairModal}
        title="Pair Remote Device / Sharing Agent"
        onClose={() => setShowPairModal(false)}
        actions={
          <Button variant="primary" onClick={() => setShowPairModal(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-4 text-center">
          <p className="text-xs text-muted leading-relaxed">
            Enter this 6-digit one-time code on the remote PC&apos;s Smaran Connect Sharing Agent to
            pair securely with this Remote Hub:
          </p>

          <div className="my-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 py-5">
            <span className="font-mono text-4xl font-extrabold tracking-widest text-sky-400">
              {pairCodeInfo?.code}
            </span>
          </div>

          <p className="text-[11.5px] text-muted italic">
            Code expires in 5 minutes. Participant PC will be registered for screen sharing only.
          </p>
        </div>
      </Dialog>

      {/* MODAL: Add User */}
      <Dialog
        open={showNewUserModal}
        title="Create New User Account"
        onClose={() => setShowNewUserModal(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowNewUserModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateUser}
              disabled={!newUsername || !newPassword}
            >
              Create User
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">Username</label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="e.g. operator1"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">Display Name</label>
            <Input
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Operator One"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">Role</label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:outline-accent"
            >
              <option value="operator">Operator (Stream &amp; Remote Control)</option>
              <option value="viewer">Viewer (Watch Only)</option>
              <option value="owner">Owner (Full Platform Access)</option>
            </select>
          </div>
        </div>
      </Dialog>

      {/* MODAL: First Run Admin Creation */}
      <Dialog
        open={showAdminInitModal}
        title="Initialize Remote Hub Administrator"
        onClose={() => setShowAdminInitModal(false)}
        actions={
          <Button
            variant="primary"
            onClick={async () => {
              if (!newUsername || !newPassword) return;
              try {
                await window.smaran.remotehub.createAdmin({
                  username: newUsername,
                  password: newPassword,
                  displayName: newDisplayName || 'Administrator',
                });
                setShowAdminInitModal(false);
                setNewUsername('');
                setNewPassword('');
                await loadAllData();
              } catch (err) {
                setServerError(String(err));
              }
            }}
            disabled={!newUsername || !newPassword}
          >
            Initialize Administrator
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-muted leading-relaxed">
            The Remote Hub platform is fully password-protected. Please set up the primary Owner /
            Administrator account:
          </p>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">
              Administrator Username
            </label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="admin"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">
              Password (min 8 chars)
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
