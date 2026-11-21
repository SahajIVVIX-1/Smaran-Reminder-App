import React, { useEffect, useState } from 'react';
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
import { cx } from '../cx';
import {
  ActivityIcon,
  CopyIcon,
  GearIcon,
  GlobeIcon,
  MonitorIcon,
  NetworkIcon,
  PlayIcon,
  PlusIcon,
  PowerIcon,
  RefreshIcon,
  TrashIcon,
} from '../icons';
import { useApp } from '../store';
import { Button, Dialog, Input, Switch } from '../ui';

type SubTab = 'overview' | 'streams' | 'devices' | 'users';

function Badge({
  variant = 'neutral',
  children,
}: {
  variant?: 'success' | 'danger' | 'accent' | 'neutral';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide',
        variant === 'success' && 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
        variant === 'danger' && 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
        variant === 'accent' && 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
        variant === 'neutral' && 'bg-sheet text-muted border border-line',
      )}
    >
      {children}
    </span>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={cx(
        'h-8 w-full rounded-lg border border-line bg-surface px-2 text-[13px] text-ink transition focus:border-accent focus:outline-none',
        className,
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function RemoteHub() {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [overview, setOverview] = useState<RemoteHubOverview | null>(null);
  const [settings, setSettings] = useState<RemoteHubSettings | null>(null);
  const [streams, setStreams] = useState<RemoteHubStream[]>([]);
  const [devices, setDevices] = useState<RemoteHubDevice[]>([]);
  const [users, setUsers] = useState<RemoteHubUser[]>([]);
  const [sources, setSources] = useState<AvailableScreenSource[]>([]);
  const [logs, setLogs] = useState<RemoteHubLogEntry[]>([]);

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showNewStreamModal, setShowNewStreamModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showAdminInitModal, setShowAdminInitModal] = useState(false);
  const [pairCodeInfo, setPairCodeInfo] = useState<{ code: string; expiresAt: number } | null>(
    null,
  );

  // Form states
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [streamName, setStreamName] = useState('');
  const [streamResolution, setStreamResolution] = useState('1080p');
  const [streamFps, setStreamFps] = useState(30);
  const [streamSrtMode, setStreamSrtMode] = useState<'caller' | 'listener'>('listener');
  const [streamSrtPort, setStreamSrtPort] = useState(6000);
  const [streamSrtLatency, setStreamSrtLatency] = useState(120);

  // User form states
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('operator');

  // Loading/action states
  const [loading, setLoading] = useState(false);
  const { toastMsg } = useApp.getState();

  const loadAllData = async () => {
    try {
      const [ov, st, dev, us, lg] = await Promise.all([
        window.smaran.remotehub.overview(),
        window.smaran.remotehub.getStreams(),
        window.smaran.remotehub.getDevices(),
        window.smaran.remotehub.getUsers(),
        window.smaran.remotehub.logs.get(),
      ]);
      setOverview(ov);
      setStreams(st);
      setDevices(dev);
      setUsers(us);
      setLogs(lg);
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
      window.smaran.remotehub.logs.get(),
    ])
      .then(([ov, st, dev, us, lg]) => {
        if (!mounted) return;
        setOverview(ov);
        setStreams(st);
        setDevices(dev);
        setUsers(us);
        setLogs(lg);
        if (!ov.adminCreated) {
          setShowAdminInitModal(true);
        }
      })
      .catch((err) => {
        console.warn('[RemoteHub] Error loading initial data:', err);
      });

    const unsubOverview = window.smaran.remotehub.onOverviewChanged((newOv) => {
      if (mounted) setOverview(newOv);
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
    }, 5000);

    return () => {
      mounted = false;
      unsubOverview();
      unsubLog();
      clearInterval(timer);
    };
  }, []);

  const handleStartServer = async () => {
    setLoading(true);
    const res = await window.smaran.remotehub.start();
    setLoading(false);
    if (!res.ok) {
      toastMsg(res.error || 'Failed to start Remote Hub Server', 'error');
    } else {
      toastMsg('Remote Hub Server started on port ' + (overview?.port || 5902));
      void loadAllData();
    }
  };

  const handleStopServer = async () => {
    setLoading(true);
    await window.smaran.remotehub.stop();
    setLoading(false);
    toastMsg('Remote Hub Server stopped.');
    void loadAllData();
  };

  const handleRestartServer = async () => {
    setLoading(true);
    const res = await window.smaran.remotehub.restart();
    setLoading(false);
    if (!res.ok) {
      toastMsg(res.error || 'Failed to restart server', 'error');
    } else {
      toastMsg('Remote Hub Server restarted.');
      void loadAllData();
    }
  };

  const openWebDashboard = () => {
    if (overview?.lanUrl) {
      window.open(overview.lanUrl, '_blank');
    }
  };

  const copyLanUrl = () => {
    if (overview?.lanUrl) {
      navigator.clipboard.writeText(overview.lanUrl);
      toastMsg('Access URL copied to clipboard: ' + overview.lanUrl);
    }
  };

  const openNewStreamModal = async () => {
    try {
      const srcList = await window.smaran.remotehub.getSources();
      setSources(srcList);
      if (srcList[0]) {
        setSelectedSourceId(srcList[0].id);
        setStreamName(srcList[0].name);
      }
      setShowNewStreamModal(true);
    } catch {
      toastMsg('Failed to enumerate screen sources.', 'error');
    }
  };

  const handleCreateStream = async () => {
    if (!selectedSourceId) return;
    setLoading(true);
    try {
      await window.smaran.remotehub.startStream({
        sourceId: selectedSourceId,
        name: streamName,
        resolution: streamResolution,
        fps: streamFps,
        enableSrt: true,
        srtMode: streamSrtMode,
        srtPort: streamSrtPort,
        srtLatencyMs: streamSrtLatency,
      });
      setShowNewStreamModal(false);
      toastMsg('Stream broadcast started with independent SRT output.');
      void loadAllData();
    } catch (err) {
      toastMsg('Error starting stream: ' + String(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStopStream = async (id: string) => {
    await window.smaran.remotehub.stopStream(id);
    toastMsg('Stream stopped.');
    void loadAllData();
  };

  const handleGeneratePairCode = async () => {
    const codeData = await window.smaran.remotehub.requestPairCode();
    setPairCodeInfo(codeData);
    setShowPairModal(true);
  };

  const handleRevokeDevice = async (id: string) => {
    try {
      const ok = await window.smaran.remotehub.revokeDevice(id);
      if (ok) {
        toastMsg('Device revoked.');
        void loadAllData();
      }
    } catch (err) {
      toastMsg(String(err), 'error');
    }
  };

  const handleCreateUser = async () => {
    try {
      await window.smaran.remotehub.createUser({
        username: newUsername,
        password: newPassword,
        displayName: newDisplayName,
        role: newUserRole,
      });
      setShowNewUserModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      toastMsg(`User "${newUsername}" created.`);
      void loadAllData();
    } catch (err) {
      toastMsg(String(err), 'error');
    }
  };

  const handleCreateAdmin = async () => {
    try {
      await window.smaran.remotehub.createAdmin({
        username: newUsername,
        password: newPassword,
        displayName: newDisplayName || 'Administrator',
      });
      setShowAdminInitModal(false);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      toastMsg('Administrator account initialized.');
      void loadAllData();
    } catch (err) {
      toastMsg(String(err), 'error');
    }
  };

  const isRunning = overview?.status === 'running';

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 text-ink">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <NetworkIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight">Remote Hub</h1>
              <Badge
                variant={
                  overview?.status === 'running'
                    ? 'success'
                    : overview?.status === 'error'
                      ? 'danger'
                      : 'neutral'
                }
              >
                ● {overview?.status?.toUpperCase() || 'STOPPED'}
              </Badge>
            </div>
            <p className="font-serif text-[13.5px] text-muted italic">
              Multi-screen live streaming, independent SRT pipelines & controlled remote desktop.
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {isRunning ? (
            <>
              <Button variant="ghost" size="sm" onClick={openWebDashboard}>
                <GlobeIcon size={14} /> Web Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={copyLanUrl}>
                <CopyIcon size={14} /> Copy URL
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRestartServer} disabled={loading}>
                <RefreshIcon size={14} /> Restart
              </Button>
              <Button variant="danger" size="sm" onClick={handleStopServer} disabled={loading}>
                <PowerIcon size={14} /> Stop Server
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={handleStartServer} disabled={loading}>
              <PlayIcon size={14} /> Start Server (TCP 5902)
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void window.smaran.remotehub.getSettings().then((s) => {
                setSettings(s);
                setShowSettingsModal(true);
              });
            }}
          >
            <GearIcon size={14} /> Settings
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void window.smaran.remotehub.logs.get().then((lg) => {
                setLogs(lg);
                setShowLogsModal(true);
              });
            }}
          >
            <ActivityIcon size={14} /> Logs
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-line gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={cx(
            'px-3.5 py-2 text-[13px] font-medium border-b-2 transition -mb-px',
            activeTab === 'overview'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          Overview & Status
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('streams')}
          className={cx(
            'px-3.5 py-2 text-[13px] font-medium border-b-2 transition -mb-px',
            activeTab === 'streams'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          Active Streams ({streams.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('devices')}
          className={cx(
            'px-3.5 py-2 text-[13px] font-medium border-b-2 transition -mb-px',
            activeTab === 'devices'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          Devices ({devices.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={cx(
            'px-3.5 py-2 text-[13px] font-medium border-b-2 transition -mb-px',
            activeTab === 'users'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-ink',
          )}
        >
          Users & Roles ({users.length})
        </button>
      </div>

      {/* TAB CONTENT: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-line bg-sheet/40 p-4 flex flex-col justify-between">
              <span className="text-[12px] font-medium tracking-wider text-muted uppercase">
                Server Status
              </span>
              <div className="my-2 flex items-baseline gap-2">
                <span
                  className={cx(
                    'text-2xl font-bold',
                    isRunning ? 'text-emerald-500' : 'text-muted',
                  )}
                >
                  {isRunning ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>
              <span className="text-[12px] text-muted">
                Port {overview?.port || 5902} · {overview?.bindAddress || '0.0.0.0'}
              </span>
            </div>

            <div className="rounded-xl border border-line bg-sheet/40 p-4 flex flex-col justify-between">
              <span className="text-[12px] font-medium tracking-wider text-muted uppercase">
                Active Streams
              </span>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink">{overview?.activeStreams ?? 0}</span>
                <span className="text-xs text-muted">outputs</span>
              </div>
              <span className="text-[12px] text-muted">Independent SRT ports starting at 6000</span>
            </div>

            <div className="rounded-xl border border-line bg-sheet/40 p-4 flex flex-col justify-between">
              <span className="text-[12px] font-medium tracking-wider text-muted uppercase">
                Registered Devices
              </span>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-ink">
                  {overview?.connectedDevices ?? 0}
                </span>
                <span className="text-xs text-muted">paired</span>
              </div>
              <span className="text-[12px] text-muted">Host PC + Sharing Agents</span>
            </div>

            <div className="rounded-xl border border-line bg-sheet/40 p-4 flex flex-col justify-between">
              <span className="text-[12px] font-medium tracking-wider text-muted uppercase">
                Remote Desktop
              </span>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-sky-400">
                  {overview?.activeSessions ? '1 Active' : 'Idle'}
                </span>
              </div>
              <span className="text-[12px] text-muted">
                Control limited strictly to Smaran Host
              </span>
            </div>
          </div>

          {/* Access URL Banner */}
          {isRunning && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/20 text-sky-400">
                  <GlobeIcon size={18} />
                </div>
                <div>
                  <div className="text-[13.5px] font-medium text-ink">Local Network Access URL</div>
                  <div className="font-mono text-[13px] text-sky-400 font-semibold">
                    {overview?.lanUrl}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={copyLanUrl}>
                  <CopyIcon size={14} /> Copy URL
                </Button>
                <Button size="sm" variant="primary" onClick={openWebDashboard}>
                  Open in Browser
                </Button>
              </div>
            </div>
          )}

          {/* Streams Quick View */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink">Current Broadcast Streams</h2>
              <Button size="sm" variant="primary" onClick={openNewStreamModal}>
                <PlusIcon size={14} /> Broadcast Screen / Window
              </Button>
            </div>

            {streams.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-sheet/20 p-8 text-center text-muted">
                <MonitorIcon size={32} className="mb-2 opacity-50" />
                <p className="text-[14px] font-medium text-ink">No Active Streams</p>
                <p className="mt-1 max-w-sm text-[12.5px]">
                  Share your full monitor or any open application window. Every source gets its own
                  independent SRT endpoint for OBS Studio or vMix.
                </p>
                <Button size="sm" variant="primary" className="mt-4" onClick={openNewStreamModal}>
                  <PlusIcon size={14} /> Broadcast Screen Now
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {streams.map((stream) => (
                  <StreamCard
                    key={stream.id}
                    stream={stream}
                    onStop={() => handleStopStream(stream.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Streams & Screens */}
      {activeTab === 'streams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold">Active Screen & Window Feeds</h2>
              <p className="font-serif text-[13px] text-muted italic">
                Independent SRT stream output is generated for each display and application window.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={openNewStreamModal}>
              <PlusIcon size={14} /> Add Screen / Window Stream
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {streams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                onStop={() => handleStopStream(stream.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Devices */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold">Registered Devices</h2>
              <p className="font-serif text-[13px] text-muted italic">
                Only the host PC with full Smaran installation is eligible for Remote Desktop
                Control. Participant PCs use the lightweight Sharing Agent.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={handleGeneratePairCode}>
              <PlusIcon size={14} /> Pair New Device (6-Digit Code)
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-sheet/40 p-0">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line bg-sheet/50 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Device Name</th>
                  <th className="px-4 py-3">IP / Hostname</th>
                  <th className="px-4 py-3">OS</th>
                  <th className="px-4 py-3">Smaran Host</th>
                  <th className="px-4 py-3">Remote Control</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {devices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-sheet/20">
                    <td className="px-4 py-3 font-medium text-ink">{dev.name}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-muted">
                      {dev.ip} ({dev.hostname})
                    </td>
                    <td className="px-4 py-3 text-muted">{dev.os}</td>
                    <td className="px-4 py-3">
                      <Badge variant={dev.isSmaranInstalled ? 'success' : 'neutral'}>
                        {dev.isSmaranInstalled ? 'Full Smaran PC' : 'Sharing Agent'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={dev.canRemoteControl ? 'accent' : 'neutral'}>
                        {dev.canRemoteControl ? 'Eligible' : 'Not Permitted'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span
                          className={cx(
                            'h-2 w-2 rounded-full',
                            dev.status === 'online' ? 'bg-emerald-500' : 'bg-muted',
                          )}
                        />
                        {dev.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {dev.id !== 'host-local' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeDevice(dev.id)}
                        >
                          <TrashIcon size={13} /> Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Users & Auth */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold">User Accounts & Access Control</h2>
              <p className="font-serif text-[13px] text-muted italic">
                Role-based platform protection: Owners (Full Control), Operators (Stream & Control
                Smaran Host), Viewers (Watch Feeds).
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={() => setShowNewUserModal(true)}>
              <PlusIcon size={14} /> Add User Account
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-sheet/40 p-0">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line bg-sheet/50 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Display Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Logins</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-sheet/20">
                    <td className="px-4 py-3 font-mono font-medium text-ink">{u.username}</td>
                    <td className="px-4 py-3 text-muted">{u.displayName}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          u.role === 'owner'
                            ? 'accent'
                            : u.role === 'operator'
                              ? 'success'
                              : 'neutral'
                        }
                      >
                        {u.role.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.enabled ? 'success' : 'danger'}>
                        {u.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">{u.loginCount}</td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'owner' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await window.smaran.remotehub.deleteUser(u.id);
                            toastMsg(`User "${u.username}" deleted.`);
                            void loadAllData();
                          }}
                        >
                          <TrashIcon size={13} /> Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Broadcast New Screen / Window */}
      <Dialog
        open={showNewStreamModal}
        title="Broadcast Screen or Application Window"
        onClose={() => setShowNewStreamModal(false)}
        size="wide"
        actions={
          <>
            <Button variant="ghost" onClick={() => setShowNewStreamModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateStream}
              disabled={loading || !selectedSourceId}
            >
              Start Broadcast & SRT Output
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] text-muted">
            Select a physical display or application window to stream. Each broadcast creates an
            independent SRT stream with configurable latency and port for OBS/vMix.
          </p>

          <div>
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-muted">
              Select Capture Source ({sources.length} available)
            </label>
            <div className="grid max-h-56 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {sources.map((src) => (
                <div
                  key={src.id}
                  onClick={() => {
                    setSelectedSourceId(src.id);
                    setStreamName(src.name);
                  }}
                  className={cx(
                    'cursor-pointer rounded-lg border p-2 transition',
                    selectedSourceId === src.id
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-sheet/40 hover:border-muted',
                  )}
                >
                  <div className="aspect-video w-full overflow-hidden rounded bg-black">
                    <img
                      src={src.thumbnailUrl}
                      alt={src.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="mt-1.5 truncate text-[12px] font-medium text-ink">{src.name}</div>
                  <div className="text-[10px] text-muted uppercase tracking-wider">{src.type}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">Stream Name</label>
              <Input
                value={streamName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStreamName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">Resolution</label>
              <Select
                value={streamResolution}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStreamResolution(e.target.value)
                }
                options={[
                  { value: '720p', label: '720p (HD)' },
                  { value: '1080p', label: '1080p (Full HD)' },
                  { value: '1440p', label: '1440p (2K)' },
                ]}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">Target FPS</label>
              <Select
                value={String(streamFps)}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStreamFps(parseInt(e.target.value, 10) || 30)
                }
                options={[
                  { value: '30', label: '30 FPS' },
                  { value: '60', label: '60 FPS' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">SRT Mode</label>
              <Select
                value={streamSrtMode}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStreamSrtMode(e.target.value as 'caller' | 'listener')
                }
                options={[
                  { value: 'listener', label: 'Listener (Smaran listens)' },
                  { value: 'caller', label: 'Caller (Smaran connects)' },
                ]}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">SRT Port</label>
              <Input
                type="number"
                value={streamSrtPort}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStreamSrtPort(parseInt(e.target.value, 10) || 6000)
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink">Latency (ms)</label>
              <Input
                type="number"
                value={streamSrtLatency}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStreamSrtLatency(parseInt(e.target.value, 10) || 120)
                }
              />
            </div>
          </div>
        </div>
      </Dialog>

      {/* MODAL: Pair New Device */}
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
          <p className="text-[13px] text-muted">
            Enter this 6-digit one-time code on the remote PC's Smaran Connect Sharing Agent to pair
            securely with this Remote Hub:
          </p>

          <div className="my-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 py-6">
            <span className="font-mono text-4xl font-extrabold tracking-widest text-sky-400">
              {pairCodeInfo?.code}
            </span>
          </div>

          <p className="text-[12px] text-muted">
            Code expires in 5 minutes. Only one device can be paired per code.
          </p>
        </div>
      </Dialog>

      {/* MODAL: Create User */}
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUsername(e.target.value)}
              placeholder="e.g. operator1"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">Display Name</label>
            <Input
              value={newDisplayName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewDisplayName(e.target.value)
              }
              placeholder="e.g. Video Switcher"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">
              Password (min 8 chars)
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">Role</label>
            <Select
              value={newUserRole}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setNewUserRole(e.target.value as UserRole)
              }
              options={[
                { value: 'operator', label: 'Operator (Stream & Remote Control)' },
                { value: 'viewer', label: 'Viewer (Watch Only)' },
                { value: 'owner', label: 'Owner (Full Platform Access)' },
              ]}
            />
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
            onClick={handleCreateAdmin}
            disabled={!newUsername || !newPassword}
          >
            Initialize Administrator
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-muted">
            The Remote Hub platform is fully password-protected. Please set up the primary Owner /
            Administrator account:
          </p>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink">
              Administrator Username
            </label>
            <Input
              value={newUsername}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUsername(e.target.value)}
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
      </Dialog>

      {/* MODAL: Logs */}
      <Dialog
        open={showLogsModal}
        title="Remote Hub Diagnostic & Security Audit Log"
        onClose={() => setShowLogsModal(false)}
        size="wide"
        actions={
          <>
            <Button
              variant="ghost"
              onClick={async () => {
                await window.smaran.remotehub.logs.clear();
                setLogs([]);
              }}
            >
              Clear Logs
            </Button>
            <Button variant="primary" onClick={() => setShowLogsModal(false)}>
              Close
            </Button>
          </>
        }
      >
        <div className="max-h-96 space-y-2 overflow-y-auto font-mono text-[11.5px]">
          {logs.length === 0 ? (
            <div className="text-muted">No log entries recorded.</div>
          ) : (
            logs.map((lg) => (
              <div
                key={lg.id}
                className={cx(
                  'rounded p-1.5',
                  lg.level === 'error'
                    ? 'bg-rose-500/10 text-rose-500'
                    : lg.level === 'security'
                      ? 'bg-sky-500/10 text-sky-400'
                      : lg.level === 'warn'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'text-muted',
                )}
              >
                <span className="text-ink/60">[{lg.timestamp.slice(11, 19)}]</span>{' '}
                <span className="font-semibold uppercase">[{lg.category}]</span> {lg.message}
              </div>
            ))
          )}
        </div>
      </Dialog>

      {/* MODAL: Settings */}
      {settings && (
        <Dialog
          open={showSettingsModal}
          title="Remote Hub Platform Settings"
          onClose={() => setShowSettingsModal(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setShowSettingsModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  await window.smaran.remotehub.saveSettings(settings);
                  setShowSettingsModal(false);
                  toastMsg('Remote Hub settings saved.');
                  void loadAllData();
                }}
              >
                Save Settings
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink">
                  TCP Control Port
                </label>
                <Input
                  type="number"
                  value={settings.port}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSettings({ ...settings, port: parseInt(e.target.value, 10) || 5902 })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink">SRT Base Port</label>
                <Input
                  type="number"
                  value={settings.srtBasePort}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSettings({ ...settings, srtBasePort: parseInt(e.target.value, 10) || 6000 })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <div>
                <div className="text-[13px] font-medium text-ink">Allow Local Network Access</div>
                <div className="text-[12px] text-muted">
                  Bind to 0.0.0.0 allowing access from other PCs/LAN
                </div>
              </div>
              <Switch
                label="Allow Local Network Access"
                checked={settings.allowLan}
                onChange={(checked) => setSettings({ ...settings, allowLan: checked })}
              />
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <div>
                <div className="text-[13px] font-medium text-ink">
                  Require Host Approval for Remote Control
                </div>
                <div className="text-[12px] text-muted">
                  Host must click Approve before control activates
                </div>
              </div>
              <Switch
                label="Require Host Approval for Remote Control"
                checked={settings.requireControlApproval}
                onChange={(checked) =>
                  setSettings({ ...settings, requireControlApproval: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <div>
                <div className="text-[13px] font-medium text-ink">Auto-Start on Smaran Launch</div>
                <div className="text-[12px] text-muted">Starts the hub whenever Smaran opens</div>
              </div>
              <Switch
                label="Auto-Start on Smaran Launch"
                checked={settings.autoStart}
                onChange={(checked) => setSettings({ ...settings, autoStart: checked })}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function StreamCard({ stream, onStop }: { stream: RemoteHubStream; onStop: () => void }) {
  const { toastMsg } = useApp.getState();

  const copySrt = () => {
    if (stream.srt?.obsSourceString) {
      navigator.clipboard.writeText(stream.srt.obsSourceString);
      toastMsg('OBS/vMix connection string copied!');
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-sheet/40 p-0">
      <div className="relative aspect-video w-full bg-black">
        {stream.thumbnailUrl ? (
          <img
            src={stream.thumbnailUrl}
            alt={stream.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted">
            <MonitorIcon size={24} />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge variant="success">● LIVE</Badge>
          <Badge variant="neutral">{stream.resolution}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-[14px] font-semibold text-ink">{stream.name}</h3>
          <span className="text-[11px] text-muted">{stream.fps} FPS</span>
        </div>
        <div className="text-[11.5px] text-muted">
          Source: {stream.sourceTitle} ({stream.sourceType})
        </div>

        {stream.srt?.enabled && (
          <div className="mt-2.5 rounded bg-sheet/60 p-2 font-mono text-[11px] text-sky-400">
            <div className="text-[10px] text-muted uppercase font-sans font-semibold">
              SRT {stream.srt.mode.toUpperCase()} · Port {stream.srt.port}
            </div>
            <div className="truncate">{stream.srt.obsSourceString}</div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
          <Button size="sm" variant="ghost" onClick={copySrt}>
            <CopyIcon size={13} /> Copy SRT
          </Button>
          <Button size="sm" variant="danger" onClick={onStop}>
            <PowerIcon size={13} /> Stop Feed
          </Button>
        </div>
      </div>
    </div>
  );
}
