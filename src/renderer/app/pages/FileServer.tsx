import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  FileServerSettings,
  ServerLogEntry,
  ServerStatus,
} from '@shared/fileserver';
import { tabVariants } from '../animations';
import { cx } from '../cx';
import {
  ActivityIcon,
  CheckIcon,
  CopyIcon,
  FolderIcon,
  GearIcon,
  GlobeIcon,
  LockIcon,
  QrIcon,
  RefreshIcon,
  ServerIcon,
  TrashIcon,
} from '../icons';
import { Button, Card, Dialog, Input, Row, Switch } from '../ui';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function FileServer() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [settings, setSettings] = useState<FileServerSettings | null>(null);
  const [adminUsername, setAdminUsername] = useState('smaran');
  const [adminPassword, setAdminPassword] = useState('smaran@123');
  const [showPassword, setShowPassword] = useState(false);
  const [adminSaveMsg, setAdminSaveMsg] = useState<string | null>(null);
  const [adminSaveErr, setAdminSaveErr] = useState<string | null>(null);
  const [portInput, setPortInput] = useState('5900');
  const [portSaveMsg, setPortSaveMsg] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{ open: boolean; url: string; qrData: string } | null>(null);
  const [mountStatus, setMountStatus] = useState<string | null>(null);
  const [mountError, setMountError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ServerLogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    void window.smaran.fileserver.status().then(setStatus);
    void window.smaran.fileserver.getSettings().then((s) => {
      setSettings(s);
      setPortInput(String(s.port));
    });
    void window.smaran.fileserver.getAdminCredentials().then((creds) => {
      if (creds) {
        if (creds.username) setAdminUsername(creds.username);
        if (creds.password) setAdminPassword(creds.password);
      }
    });
    void window.smaran.fileserver.logs.get().then(setLogs);

    const offStatus = window.smaran.fileserver.onStatusChanged((s) => setStatus(s));
    const offLog = window.smaran.fileserver.onLogAdded((entry) => {
      setLogs((prev) => [entry, ...prev].slice(0, 500));
    });

    return () => {
      offStatus();
      offLog();
    };
  }, []);

  const isRunning = Boolean(status?.running);
  const effectivePort = settings?.port || status?.port || 5900;
  const primaryUrl =
    status?.lanUrls?.[0] || status?.localUrl || `http://localhost:${effectivePort}/`;
  const lanUrl = status?.lanUrls?.[0] || primaryUrl;
  const localUrl = status?.localUrl || `http://localhost:${effectivePort}/`;
  const adminUrl = primaryUrl.replace(/\/$/, '') + '/~/admin/';
  const lanAdminUrl = lanUrl.replace(/\/$/, '') + '/~/admin/';

  const handleStart = async () => {
    setBusyAction('start');
    try {
      await window.smaran.fileserver.start();
      const s = await window.smaran.fileserver.status();
      setStatus(s);
    } finally {
      setBusyAction(null);
    }
  };

  const handleStop = async () => {
    setBusyAction('stop');
    try {
      await window.smaran.fileserver.stop();
      const s = await window.smaran.fileserver.status();
      setStatus(s);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestart = async () => {
    setBusyAction('restart');
    try {
      await window.smaran.fileserver.restart();
      const s = await window.smaran.fileserver.status();
      setStatus(s);
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenBrowser = async (url: string) => {
    await window.smaran.fileserver.openUrl(url);
  };

  const handleCopy = (url: string) => {
    void navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleShowQr = async (url: string) => {
    const qrData = await window.smaran.fileserver.generateQr(url);
    setQrModal({ open: true, url, qrData });
  };

  const handleSaveAdminCredentials = async () => {
    setAdminSaveErr(null);
    setAdminSaveMsg(null);
    if (!adminUsername.trim()) {
      setAdminSaveErr('Admin username cannot be empty');
      return;
    }
    if (!adminPassword) {
      setAdminSaveErr('Admin password cannot be empty');
      return;
    }
    const res = await window.smaran.fileserver.setAdminCredentials({
      username: adminUsername.trim(),
      password: adminPassword,
    });
    if (!res.ok) {
      setAdminSaveErr(res.error || 'Failed to save admin credentials');
    } else {
      setAdminSaveMsg('Admin credentials updated! Use them to log in to the Web Admin Panel.');
      setTimeout(() => setAdminSaveMsg(null), 4000);
    }
  };

  const handleMountDrive = async () => {
    setMountError(null);
    setMountStatus('Mounting drive Z: ...');
    const res = await window.smaran.fileserver.mountLocalDrive({
      driveLetter: 'Z:',
      username: adminUsername,
      password: adminPassword,
    });
    if (!res.ok) {
      setMountError(res.error || 'Failed to mount WebDAV drive');
      setMountStatus(null);
    } else {
      setMountStatus(`Successfully mounted as Drive ${res.driveLetter || 'Z:'}! Windows Explorer opened.`);
      setTimeout(() => setMountStatus(null), 5000);
    }
  };

  const handleUnmountDrive = async () => {
    setMountError(null);
    setMountStatus('Unmounting drive Z: ...');
    const res = await window.smaran.fileserver.unmountLocalDrive('Z:');
    if (!res.ok) {
      setMountError(res.error || 'Failed to unmount drive');
      setMountStatus(null);
    } else {
      setMountStatus('Drive Z: unmounted successfully.');
      setTimeout(() => setMountStatus(null), 3000);
    }
  };

  const handlePickRootDir = async () => {
    const picked = await window.smaran.fileserver.pickRootDir();
    if (picked) {
      const updated = await window.smaran.fileserver.saveSettings({ rootDir: picked });
      setSettings(updated);
    }
  };

  const handleOpenRootFolder = async () => {
    await window.smaran.fileserver.openFolder('');
  };

  const handleSavePort = async () => {
    const num = parseInt(portInput, 10);
    if (isNaN(num) || num < 1 || num > 65535) {
      setPortSaveMsg('Port must be between 1 and 65535');
      return;
    }
    const updated = await window.smaran.fileserver.saveSettings({ port: num });
    setSettings(updated);
    setPortSaveMsg('Port updated');
    setTimeout(() => setPortSaveMsg(null), 3000);
  };

  const handleToggleAutoStart = async (enabled: boolean) => {
    const updated = await window.smaran.fileserver.saveSettings({ enabled });
    setSettings(updated);
  };

  const handleClearLogs = async () => {
    await window.smaran.fileserver.logs.clear();
    setLogs([]);
  };

  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-4xl mx-auto space-y-6 pb-12"
    >
      {/* 1. Header Hero Card with Master Controls */}
      <Card className="p-6 relative overflow-hidden bg-[#16161a] border border-[#26262b] rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className={cx(
                'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all',
                isRunning
                  ? 'bg-[#e06c43]/10 border-[#e06c43]/30 text-[#e06c43] shadow-[0_0_15px_rgba(224,108,67,0.25)]'
                  : 'bg-[#222226] border-[#333338] text-neutral-400',
              )}
            >
              <ServerIcon size={24} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-100">
                  Smaran HFS
                </h1>
                <span
                  className={cx(
                    'text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5',
                    isRunning
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700',
                  )}
                >
                  <span
                    className={cx(
                      'w-2 h-2 rounded-full',
                      isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500',
                    )}
                  />
                  {isRunning ? 'Server Online' : 'Server Offline'}
                </span>
                <span className="text-xs text-neutral-400 border border-[#2a2a30] px-2 py-0.5 rounded bg-[#1c1c20]">
                  HFS 3.4.1 Engine
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                LAN & Web HTTP File Server · Full web administration & file browsing
              </p>
            </div>
          </div>

          {/* Master Start / Stop / Restart Buttons */}
          <div className="flex items-center gap-2.5">
            {isRunning ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={Boolean(busyAction)}
                  onClick={handleRestart}
                  className="flex items-center gap-1.5 border-[#333338] hover:bg-[#26262b] text-neutral-200"
                >
                  <RefreshIcon
                    size={14}
                    className={busyAction === 'restart' ? 'animate-spin' : ''}
                  />
                  Restart
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={Boolean(busyAction)}
                  onClick={handleStop}
                  className="flex items-center gap-1.5 bg-red-950/40 text-red-400 border border-red-800/40 hover:bg-red-900/50"
                >
                  {busyAction === 'stop' ? 'Stopping...' : 'Stop Server'}
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                disabled={Boolean(busyAction)}
                onClick={handleStart}
                className="flex items-center gap-2 bg-[#e06c43] hover:bg-[#cf5b32] text-white font-medium px-5 shadow-[0_0_20px_rgba(224,108,67,0.3)]"
              >
                <ServerIcon size={16} />
                {busyAction === 'start' ? 'Starting...' : 'Start Server'}
              </Button>
            )}
          </div>
        </div>

        {/* Telemetry info bar when running */}
        {isRunning && (
          <div className="mt-5 pt-4 border-t border-[#26262b] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-neutral-400">
            <div>
              <span className="text-neutral-400 block text-[11px]">HTTP Port</span>
              <span className="font-mono text-neutral-200 font-medium">{effectivePort}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[11px]">Uptime</span>
              <span className="font-mono text-neutral-200 font-medium">
                {status ? formatUptime(status.uptimeSeconds) : '0s'}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[11px]">Connected Clients</span>
              <span className="font-mono text-neutral-200 font-medium">
                {status?.liveConnections?.length ?? 0} active
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[11px]">Storage Root</span>
              <span
                onClick={handleOpenRootFolder}
                className="text-[#e06c43] hover:underline cursor-pointer truncate block font-medium"
                title={settings?.rootDir}
              >
                Open in Explorer ↗
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* 2. Client Web Access Links Card */}
      <Card className="p-6 bg-[#16161a] border border-[#26262b] rounded-2xl shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
          <div className="flex items-center gap-2.5">
            <GlobeIcon size={18} className="text-[#e06c43]" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
              Client Links (Web File Manager)
            </h2>
          </div>
          <span className="text-xs text-neutral-400">For browsing, streaming & uploading files</span>
        </div>

        {/* Primary LAN URL Box */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-neutral-300 flex items-center justify-between">
            <span>Local Network (LAN) Link:</span>
            <span className="text-[11px] text-neutral-400">Share with other devices on your Wi-Fi/LAN</span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#0c0c0e] p-2 rounded-xl border border-[#2a2a30]">
            <input
              type="text"
              readOnly
              value={lanUrl}
              className="bg-transparent font-mono text-xs text-[#e06c43] px-2 py-1 flex-1 outline-none select-all cursor-text"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(lanUrl)}
                className="text-xs px-2.5 py-1 h-8 flex items-center gap-1 border-[#333338] hover:bg-[#222226]"
              >
                {copiedUrl === lanUrl ? (
                  <>
                    <CheckIcon size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={13} />
                    <span>Copy</span>
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleShowQr(lanUrl)}
                className="text-xs px-2.5 py-1 h-8 flex items-center gap-1 border-[#333338] hover:bg-[#222226]"
                title="Scan QR on mobile phone or tablet"
              >
                <QrIcon size={13} />
                <span>QR Code</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenBrowser(lanUrl)}
                className="text-xs px-3 py-1 h-8 bg-[#e06c43] hover:bg-[#cf5b32] text-white flex items-center gap-1 shadow-sm"
              >
                <span>Open File Manager ↗</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Localhost Link Box */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-[#111114] rounded-xl border border-[#222226] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">Local PC URL:</span>
            <span className="font-mono text-neutral-300">{localUrl}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(localUrl)}
              className="text-xs px-2 py-0.5 h-7 border-[#333338] hover:bg-[#222226]"
            >
              {copiedUrl === localUrl ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenBrowser(localUrl)}
              className="text-xs px-2.5 py-0.5 h-7 border-[#333338] text-neutral-200 hover:bg-[#222226]"
            >
              Open ↗
            </Button>
          </div>
        </div>

        {/* 1-Click WebDAV Windows Drive Mounter */}
        <div className="mt-2 p-3.5 bg-[#121216] border border-[#26262e] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-medium text-neutral-200 flex items-center gap-2">
              <FolderIcon size={14} className="text-[#e06c43]" />
              <span>Windows Explorer 1-Click WebDAV Drive (Drive Z:)</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Mount your Smaran file server as a local Windows drive letter for seamless desktop file access.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMountDrive}
              className="text-xs px-3 py-1 h-8 bg-[#202026] hover:bg-[#282830] text-neutral-200 border border-[#33333c]"
            >
              Mount as Drive Z:
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUnmountDrive}
              className="text-xs px-2.5 py-1 h-8 text-neutral-400 hover:text-red-400 border-[#33333c]"
              title="Disconnect Drive Z:"
            >
              Unmount
            </Button>
          </div>
        </div>
        {mountStatus && (
          <p className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 p-2 rounded-lg">
            {mountStatus}
          </p>
        )}
        {mountError && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 p-2 rounded-lg">
            {mountError}
          </p>
        )}
      </Card>

      {/* 3. Web Admin Panel Link Card (Full HFS 3.4.1 Control) */}
      <Card className="p-6 bg-[#16161a] border border-[#26262b] rounded-2xl shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
          <div className="flex items-center gap-2.5">
            <ActivityIcon size={18} className="text-[#e06c43]" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
              Web Admin Panel (Edit Everything from Browser)
            </h2>
          </div>
          <span className="text-xs text-[#e06c43] font-mono">/~/admin/</span>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          Open the complete <strong>Smaran HFS Web Administration Panel</strong> in your browser to edit all things:
          manage Virtual File System (VFS) folders, mapped drives, file permissions, user accounts, upload/download speed caps, real-time client monitors, streaming logs, and plugins.
        </p>

        {/* Primary Admin Link Box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#0c0c0e] p-2 rounded-xl border border-[#2a2a30]">
          <input
            type="text"
            readOnly
            value={adminUrl}
            className="bg-transparent font-mono text-xs text-amber-400 px-2 py-1 flex-1 outline-none select-all cursor-text"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(adminUrl)}
              className="text-xs px-2.5 py-1 h-8 border-[#333338] hover:bg-[#222226]"
            >
              {copiedUrl === adminUrl ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenBrowser(adminUrl)}
              className="text-xs px-4 py-1 h-8 bg-[#e06c43] hover:bg-[#cf5b32] text-white font-medium flex items-center gap-1.5 shadow-md"
            >
              <span>Open Web Admin Panel ↗</span>
            </Button>
          </div>
        </div>

        {/* LAN Admin URL notice */}
        <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
          <span>Access admin from other computers on LAN:</span>
          <span
            onClick={() => handleCopy(lanAdminUrl)}
            className="font-mono text-[#e06c43] hover:underline cursor-pointer"
            title="Click to copy LAN admin URL"
          >
            {lanAdminUrl}
          </span>
        </div>
      </Card>

      {/* 4. Admin Credentials Control Card */}
      <Card className="p-6 bg-[#16161a] border border-[#26262b] rounded-2xl shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
          <div className="flex items-center gap-2.5">
            <LockIcon size={18} className="text-[#e06c43]" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
              Admin Username & Password Control
            </h2>
          </div>
          <span className="text-xs text-neutral-400">Direct credential control from software</span>
        </div>

        <p className="text-xs text-neutral-400">
          Control your administrator username and password here. These credentials give you full admin authority to log in and edit everything inside the Web Admin Panel.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Admin Username</label>
            <Input
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="e.g. smaran or admin"
              className="bg-[#0c0c0e] border-[#2a2a30] text-neutral-200 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-300">Admin Password</label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[11px] text-[#e06c43] hover:underline"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter admin password"
              className="bg-[#0c0c0e] border-[#2a2a30] text-neutral-200 font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-neutral-400">
            {adminSaveMsg && (
              <span className="text-emerald-400 font-medium">{adminSaveMsg}</span>
            )}
            {adminSaveErr && (
              <span className="text-red-400 font-medium">{adminSaveErr}</span>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveAdminCredentials}
            className="text-xs px-4 py-1.5 bg-[#e06c43] hover:bg-[#cf5b32] text-white font-medium"
          >
            Save Admin Credentials
          </Button>
        </div>
      </Card>

      {/* 5. Essential Server Parameters Card */}
      <Card className="p-6 bg-[#16161a] border border-[#26262b] rounded-2xl shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-[#26262b] pb-3">
          <div className="flex items-center gap-2.5">
            <GearIcon size={18} className="text-[#e06c43]" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-neutral-300">
              Server Settings & Storage Folder
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Root Directory */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-300">Host Storage Directory</label>
            <div className="p-2.5 bg-[#0c0c0e] border border-[#2a2a30] rounded-xl font-mono text-[11px] text-neutral-300 truncate" title={settings?.rootDir}>
              {settings?.rootDir || 'Documents/Smaran Files'}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePickRootDir}
                className="text-xs px-3 py-1 h-7 border-[#333338] text-neutral-200 hover:bg-[#222226]"
              >
                Change Folder...
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenRootFolder}
                className="text-xs px-3 py-1 h-7 border-[#333338] text-neutral-400 hover:bg-[#222226]"
              >
                Open in Explorer ↗
              </Button>
            </div>
          </div>

          {/* Port and Auto-Start */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">HTTP Port</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  className="bg-[#0c0c0e] border-[#2a2a30] text-neutral-200 font-mono text-xs w-32"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSavePort}
                  className="text-xs px-3 py-1.5 h-8 border-[#333338] hover:bg-[#222226]"
                >
                  Save Port
                </Button>
                {portSaveMsg && (
                  <span className="text-xs text-emerald-400">{portSaveMsg}</span>
                )}
              </div>
            </div>

            <Row
              label="Start on App Launch"
              hint="Automatically start the HFS file server when Smaran launches."
            >
              <Switch
                label="Start on App Launch"
                checked={settings?.enabled ?? true}
                onChange={handleToggleAutoStart}
              />
            </Row>
          </div>
        </div>
      </Card>

      {/* 6. Live Activity & Logs (Collapsible) */}
      <Card className="p-4 bg-[#16161a] border border-[#26262b] rounded-2xl shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-neutral-300 hover:text-white"
          >
            <span>{showLogs ? '▼' : '▶'}</span>
            <span>Live Server Logs</span>
            <span className="text-neutral-400 font-mono text-[11px]">({logs.length} entries)</span>
          </button>
          {showLogs && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearLogs}
              className="text-xs px-2.5 py-0.5 h-7 text-neutral-400 hover:text-neutral-200 border-[#333338]"
            >
              <TrashIcon size={12} className="mr-1 inline" />
              Clear
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showLogs && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pt-3 border-t border-[#26262b] overflow-hidden"
            >
              <div className="bg-[#0c0c0e] rounded-xl p-3 border border-[#2a2a30] font-mono text-[11px] max-h-60 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <p className="text-neutral-400 text-center py-4">No log entries recorded yet.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-neutral-400 leading-tight">
                      <span className="text-neutral-400 shrink-0">
                        {log.timestamp.slice(11, 19)}
                      </span>
                      <span
                        className={cx(
                          'px-1 rounded text-[10px] uppercase font-bold shrink-0',
                          log.level === 'error'
                            ? 'bg-red-950 text-red-400'
                            : log.level === 'warn'
                              ? 'bg-amber-950 text-amber-400'
                              : 'bg-neutral-800 text-neutral-300',
                        )}
                      >
                        {log.level}
                      </span>
                      <span className="text-neutral-200 flex-1 break-all">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* QR Code Modal */}
      <Dialog
        open={Boolean(qrModal?.open)}
        onClose={() => setQrModal(null)}
        title="Mobile Quick Connect (LAN QR Code)"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setQrModal(null)}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-center py-2">
          <p className="text-xs text-neutral-400">
            Scan with your phone or tablet camera to open the Smaran HFS Web File Manager on your local network:
          </p>
          {qrModal?.qrData && (
            <div
              className="p-4 bg-white rounded-xl inline-block mx-auto shadow-lg"
              dangerouslySetInnerHTML={{ __html: qrModal.qrData }}
            />
          )}
          <p className="font-mono text-xs text-[#e06c43] break-all bg-[#111114] p-2 rounded-lg border border-[#26262b]">
            {qrModal?.url}
          </p>
        </div>
      </Dialog>
    </motion.div>
  );
}
