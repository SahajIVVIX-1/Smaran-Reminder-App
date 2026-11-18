import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ActiveTransfer,
  DirectoryListing,
  FileItem,
  FileServerSettings,
  ServerLogEntry,
  ServerStatus,
  ShareLink,
  TransferHistoryEntry,
  UserAccount,
} from '@shared/fileserver';
import { tabVariants } from '../animations';
import { cx } from '../cx';
import {
  ActivityIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  GearIcon,
  LockIcon,
  PlusIcon,
  QrIcon,
  RefreshIcon,
  ServerIcon,
  ShareIcon,
  TrashIcon,
  UploadIcon,
  UsersIcon,
} from '../icons';
import { Button, Card, Dialog, Input, Pill, Row, Slider, Switch } from '../ui';

type FileServerTab =
  | 'overview'
  | 'manager'
  | 'transfers'
  | 'shares'
  | 'users'
  | 'settings'
  | 'logs';

interface TabItem {
  id: FileServerTab;
  label: string;
  icon: (props: { size?: number; className?: string }) => ReactNode;
}

const TABS: readonly TabItem[] = [
  { id: 'overview', label: 'Overview', icon: ServerIcon },
  { id: 'manager', label: 'File Manager', icon: FolderIcon },
  { id: 'transfers', label: 'Transfers', icon: ActivityIcon },
  { id: 'shares', label: 'Shared Links', icon: ShareIcon },
  { id: 'users', label: 'Users', icon: UsersIcon },
  { id: 'settings', label: 'Settings', icon: GearIcon },
  { id: 'logs', label: 'Logs', icon: FileIcon },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + (sizes[i] || 'B');
}

function formatSpeed(bps: number): string {
  return formatBytes(bps) + '/s';
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function FileServer() {
  const [tab, setTab] = useState<FileServerTab>('overview');
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [settings, setSettings] = useState<FileServerSettings | null>(null);
  const [qrModal, setQrModal] = useState<{ open: boolean; url: string; qrData: string } | null>(
    null,
  );
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    void window.smaran.fileserver.status().then(setStatus);
    void window.smaran.fileserver.getSettings().then(setSettings);

    const offStatus = window.smaran.fileserver.onStatusChanged((s) => setStatus(s));
    return () => {
      offStatus();
    };
  }, []);

  const handleStart = async () => {
    await window.smaran.fileserver.start();
    const s = await window.smaran.fileserver.status();
    setStatus(s);
  };

  const handleStop = async () => {
    await window.smaran.fileserver.stop();
    const s = await window.smaran.fileserver.status();
    setStatus(s);
  };

  const handleRestart = async () => {
    await window.smaran.fileserver.restart();
    const s = await window.smaran.fileserver.status();
    setStatus(s);
  };

  const showQr = async (url: string) => {
    const qrData = await window.smaran.fileserver.generateQr(url);
    setQrModal({ open: true, url, qrData });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="mx-auto max-w-[860px] space-y-5 px-7 pt-8 pb-16">
      <header className="animate-enter flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[26px] leading-tight flex items-center gap-2.5">
            <ServerIcon size={24} className="text-accent" />
            File Server (HFS)
          </h1>
          <p className="mt-1 font-serif text-[14.5px] text-muted italic">
            Self-hosted local HTTP file server for Wi-Fi & LAN sharing.
          </p>
        </div>

        {status && (
          <div className="flex items-center gap-2.5">
            <span
              className={cx(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                status.running ? 'bg-ok/15 text-ok ring-1 ring-ok/30' : 'bg-line text-muted',
              )}
            >
              <span
                className={cx(
                  'h-2 w-2 rounded-full',
                  status.running ? 'bg-ok animate-pulse' : 'bg-muted',
                )}
              />
              {status.running ? `Online :${status.port}` : 'Offline'}
            </span>
            {status.running ? (
              <Button size="sm" variant="danger" onClick={handleStop}>
                Stop
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={handleStart}>
                Start
              </Button>
            )}
          </div>
        )}
      </header>

      {/* Tabs */}
      <div
        role="tablist"
        className="flex items-center gap-1 rounded-xl border border-line bg-raised/70 p-1 animate-enter [animation-delay:20ms]"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cx(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-2.5 text-[12.5px] font-medium transition-all duration-150 whitespace-nowrap',
                active
                  ? 'bg-surface text-ink shadow-sm ring-1 ring-line'
                  : 'text-muted hover:bg-hover/60 hover:text-ink',
              )}
            >
              <Icon size={14} className={active ? 'text-accent' : 'text-faint'} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          role="tabpanel"
          variants={tabVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {tab === 'overview' && status && (
            <OverviewTab
              status={status}
              onStart={handleStart}
              onStop={handleStop}
              onRestart={handleRestart}
              onShowQr={showQr}
              onCopy={copyToClipboard}
              copiedUrl={copiedUrl}
            />
          )}

          {tab === 'manager' && <FileManagerTab onShowQr={showQr} />}

          {tab === 'transfers' && <TransfersTab />}

          {tab === 'shares' && <SharesTab onShowQr={showQr} />}

          {tab === 'users' && <UsersTab />}

          {tab === 'settings' && settings && (
            <SettingsTab initialSettings={settings} onUpdated={(s) => setSettings(s)} />
          )}

          {tab === 'logs' && <LogsTab />}
        </motion.div>
      </AnimatePresence>

      {/* QR Code Dialog */}
      {qrModal && (
        <Dialog
          open={qrModal.open}
          title="Scan to Open on Mobile"
          onClose={() => setQrModal(null)}
          actions={
            <Button variant="secondary" onClick={() => setQrModal(null)}>
              Close
            </Button>
          }
        >
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-xl border border-line bg-surface p-3 shadow-md">
              <img src={qrModal.qrData} alt="Server QR Code" className="h-56 w-56 rounded-lg" />
            </div>
            <p className="font-mono text-[12.5px] text-muted text-center break-all select-all">
              {qrModal.url}
            </p>
            <p className="text-center font-serif text-[13px] text-muted italic">
              Connect your phone or tablet to the same Wi-Fi, open your camera, and scan to browse
              files.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ==========================================
// 1. OVERVIEW TAB
// ==========================================
function OverviewTab({
  status,
  onStart,
  onStop,
  onRestart,
  onShowQr,
  onCopy,
  copiedUrl,
}: {
  status: ServerStatus;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onShowQr: (url: string) => void;
  onCopy: (url: string) => void;
  copiedUrl: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Server Status Card */}
      <Card title="Server Access" description="Connect other devices on your local network.">
        <Row
          label="Server State"
          hint={
            status.running
              ? `Uptime: ${formatUptime(status.uptimeSeconds)} · Port ${status.port}`
              : 'Server is currently stopped'
          }
        >
          <div className="flex items-center gap-2">
            {status.running ? (
              <>
                <Button size="sm" variant="secondary" onClick={onRestart}>
                  Restart
                </Button>
                <Button size="sm" variant="danger" onClick={onStop}>
                  Stop Server
                </Button>
              </>
            ) : (
              <Button size="sm" variant="primary" onClick={onStart}>
                Start Server
              </Button>
            )}
          </div>
        </Row>

        {status.running && (
          <>
            {/* Primary LAN URL */}
            {status.lanUrls.length > 0 && (
              <Row
                label="LAN Web Address"
                hint="Share this URL with phones, tablets, or laptops on your Wi-Fi."
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12.5px] text-ink bg-raised px-2.5 py-1 rounded-md border border-line select-all">
                    {status.lanUrls[0]}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => status.lanUrls[0] && onCopy(status.lanUrls[0])}
                  >
                    {copiedUrl === status.lanUrls[0] ? (
                      <CheckIcon size={14} className="text-ok" />
                    ) : (
                      <CopyIcon size={14} />
                    )}
                    {copiedUrl === status.lanUrls[0] ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => status.lanUrls[0] && onShowQr(status.lanUrls[0])}
                  >
                    <QrIcon size={14} />
                    QR Code
                  </Button>
                </div>
              </Row>
            )}

            {/* Localhost */}
            <Row label="Local PC Address" hint="Open on this computer">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-muted bg-raised px-2 py-0.5 rounded border border-line select-all">
                  {status.localUrl}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(status.localUrl, '_blank')}
                >
                  Open in Browser
                </Button>
              </div>
            </Row>

            <Row
              label="Root Storage Directory"
              hint={status.rootDir}
            >
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void window.smaran.fileserver.openFolder()}
              >
                Open Folder
              </Button>
            </Row>
          </>
        )}
      </Card>

      {/* Live Monitoring Metrics */}
      {status.running && (
        <Card title="Live Statistics" description="Real-time network throughput and transfer metrics.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
            <MetricTile
              label="Connected Clients"
              value={String(status.connectedClients)}
              sub="Active sockets"
            />
            <MetricTile
              label="Active Transfers"
              value={String(status.activeTransfers.length)}
              sub="In flight"
            />
            <MetricTile
              label="Upload Speed"
              value={formatSpeed(status.currentUploadSpeedBps)}
              sub={`Total: ${formatBytes(status.totalBytesUploaded)}`}
            />
            <MetricTile
              label="Download Speed"
              value={formatSpeed(status.currentDownloadSpeedBps)}
              sub={`Total: ${formatBytes(status.totalBytesDownloaded)}`}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-raised/50 p-3">
      <div className="text-[11.5px] uppercase tracking-wider text-muted font-medium">{label}</div>
      <div className="mt-1 font-mono text-[18px] font-semibold text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

// ==========================================
// 2. FILE MANAGER TAB
// ==========================================
function FileManagerTab({ onShowQr }: { onShowQr: (url: string) => void }) {
  const [currentPath, setCurrentPath] = useState('');
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareDialog, setShareDialog] = useState<FileItem | null>(null);

  const load = async (path = currentPath) => {
    setLoading(true);
    try {
      const res = await window.smaran.fileserver.listDir(path);
      setListing(res);
      setCurrentPath(path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void window.smaran.fileserver.listDir('').then((res) => {
      setListing(res);
      setCurrentPath('');
    });
  }, []);

  const handleMkdir = async () => {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;
    await window.smaran.fileserver.mkdir(currentPath, name.trim());
    await load();
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await window.smaran.fileserver.delete(item.relativePath);
    await load();
  };

  const handleRename = async (item: FileItem) => {
    const newName = prompt('New name:', item.name);
    if (!newName?.trim() || newName.trim() === item.name) return;
    await window.smaran.fileserver.rename(item.relativePath, newName.trim());
    await load();
  };

  const filteredItems = (listing?.items || []).filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase().trim()),
  );

  return (
    <div className="space-y-3">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 flex-wrap text-[13px]">
          {(listing?.breadcrumbs || []).map((b, idx, arr) => (
            <span key={b.path} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => load(b.path)}
                className={cx(
                  'rounded px-1.5 py-0.5 transition-colors',
                  idx === arr.length - 1
                    ? 'font-semibold text-ink bg-raised'
                    : 'text-muted hover:text-ink hover:bg-hover',
                )}
              >
                {b.name}
              </button>
              {idx < arr.length - 1 && <span className="text-faint">/</span>}
            </span>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-44 h-7 text-[12px]"
          />
          <Button size="sm" variant="secondary" onClick={handleMkdir}>
            <PlusIcon size={13} />
            New Folder
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void window.smaran.fileserver.openFolder(currentPath)}
          >
            Open in Explorer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => load()}>
            <RefreshIcon size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* File Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-raised/40 text-[11px] uppercase tracking-wider text-muted font-semibold">
              <th className="py-2.5 px-4">Name</th>
              <th className="py-2.5 px-4 w-28">Size</th>
              <th className="py-2.5 px-4 w-44">Modified</th>
              <th className="py-2.5 px-4 text-right w-36">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted italic font-serif">
                  {search ? 'No matching files found.' : 'This folder is empty.'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.relativePath} className="hover:bg-hover/50 transition-colors group">
                  <td className="py-2.5 px-4">
                    <button
                      type="button"
                      onClick={() =>
                        item.isDirectory
                          ? load(item.relativePath)
                          : window.smaran.fileserver.openFolder(item.relativePath)
                      }
                      className="flex items-center gap-2.5 text-left font-medium text-ink hover:text-accent transition-colors"
                    >
                      {item.isDirectory ? (
                        <FolderIcon size={16} className="text-accent shrink-0" />
                      ) : (
                        <FileIcon size={16} className="text-muted shrink-0" />
                      )}
                      <span className="truncate max-w-[340px]">{item.name}</span>
                    </button>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[12px] text-muted tabular-nums">
                    {item.isDirectory ? '—' : formatBytes(item.size)}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] text-muted">
                    {new Date(item.modifiedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        type="button"
                        title="Create Share Link"
                        onClick={() => setShareDialog(item)}
                        className="rounded p-1 text-muted hover:text-accent hover:bg-raised transition-colors"
                      >
                        <ShareIcon size={14} />
                      </button>
                      <button
                        type="button"
                        title="Rename"
                        onClick={() => handleRename(item)}
                        className="rounded p-1 text-muted hover:text-ink hover:bg-raised transition-colors"
                      >
                        <CopyIcon size={14} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => handleDelete(item)}
                        className="rounded p-1 text-muted hover:text-danger hover:bg-raised transition-colors"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Share Dialog */}
      {shareDialog && (
        <CreateShareDialog
          item={shareDialog}
          onClose={() => setShareDialog(null)}
          onShowQr={onShowQr}
        />
      )}
    </div>
  );
}

function CreateShareDialog({
  item,
  onClose,
  onShowQr,
}: {
  item: FileItem;
  onClose: () => void;
  onShowQr: (url: string) => void;
}) {
  const [permission, setPermission] = useState<'download' | 'read' | 'upload' | 'full'>('download');
  const [password, setPassword] = useState('');
  const [createdShare, setCreatedShare] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const res = await window.smaran.fileserver.shares.create({
      relativePath: item.relativePath,
      permission,
      password: password.trim() || undefined,
    });
    setCreatedShare(res);
  };

  const getShareUrl = (token: string) => {
    return `http://localhost:5900/share/${token}`;
  };

  return (
    <Dialog
      open={true}
      title={createdShare ? 'Share Link Created' : `Share "${item.name}"`}
      onClose={onClose}
      actions={
        createdShare ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              Generate Link
            </Button>
          </>
        )
      }
    >
      {createdShare ? (
        <div className="space-y-4 py-1">
          <p className="text-[13px] text-muted">Anyone with this link can access the shared file.</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={getShareUrl(createdShare.token)} className="text-[12px] font-mono" />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(getShareUrl(createdShare.token));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onShowQr(getShareUrl(createdShare.token))}
            >
              QR
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 py-1">
          <div>
            <label className="block text-[12.5px] text-muted mb-1">Permission Mode</label>
            <select
              value={permission}
              onChange={(e) =>
                setPermission(e.target.value as 'download' | 'read' | 'upload' | 'full')
              }
              className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink outline-none"
            >
              <option value="download">Download Only</option>
              <option value="read">View / Stream</option>
              {item.isDirectory && <option value="upload">Upload Only</option>}
              {item.isDirectory && <option value="full">Full Access</option>}
            </select>
          </div>

          <div>
            <label className="block text-[12.5px] text-muted mb-1">Password Protection (Optional)</label>
            <Input
              type="password"
              placeholder="Leave blank for public link"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ==========================================
// 3. TRANSFERS TAB
// ==========================================
function TransfersTab() {
  const [active, setActive] = useState<ActiveTransfer[]>([]);
  const [history, setHistory] = useState<TransferHistoryEntry[]>([]);

  useEffect(() => {
    void window.smaran.fileserver.transfers.active().then(setActive);
    void window.smaran.fileserver.transfers.history().then(setHistory);

    const off = window.smaran.fileserver.onTransfersUpdated(setActive);
    return () => off();
  }, []);

  const handleCancel = async (id: string) => {
    await window.smaran.fileserver.transfers.cancel(id);
    const updated = await window.smaran.fileserver.transfers.active();
    setActive(updated);
  };

  const handleClearHistory = async () => {
    await window.smaran.fileserver.transfers.clearHistory();
    setHistory([]);
  };

  return (
    <div className="space-y-4">
      {/* Active Transfers */}
      <Card title="Active Transfers" description="Transfers currently uploading or downloading.">
        {active.length === 0 ? (
          <p className="py-6 text-center text-muted font-serif italic text-[13px]">
            No transfers in progress.
          </p>
        ) : (
          <div className="space-y-2.5 py-2">
            {active.map((t) => (
              <div key={t.id} className="rounded-lg border border-line bg-raised/50 p-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 font-medium">
                    {t.direction === 'upload' ? (
                      <UploadIcon size={14} className="text-accent" />
                    ) : (
                      <DownloadIcon size={14} className="text-ok" />
                    )}
                    {t.fileName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-muted">{t.percent}%</span>
                    <Button size="sm" variant="danger" onClick={() => handleCancel(t.id)}>
                      Cancel
                    </Button>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-200"
                    style={{ width: `${t.percent}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-faint">
                  <span>Client: {t.clientIp}</span>
                  <span>
                    {formatBytes(t.bytesTransferred)} / {formatBytes(t.totalBytes)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Transfer History */}
      <Card
        title="Transfer History"
        description="Record of recent uploads and downloads."
      >
        <div className="flex justify-end pb-2">
          {history.length > 0 && (
            <Button size="sm" variant="ghost" onClick={handleClearHistory}>
              Clear History
            </Button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="py-6 text-center text-muted font-serif italic text-[13px]">
            No transfer history recorded yet.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-line divide-y divide-line text-[12.5px]">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-2.5 hover:bg-hover/40">
                <div className="flex items-center gap-2 min-w-0">
                  {h.direction === 'upload' ? (
                    <UploadIcon size={14} className="text-accent shrink-0" />
                  ) : (
                    <DownloadIcon size={14} className="text-ok shrink-0" />
                  )}
                  <span className="truncate font-medium">{h.fileName}</span>
                  <span className="text-muted font-mono text-[11px]">
                    ({formatBytes(h.totalBytes)})
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-muted text-[11.5px]">
                  <span>{h.clientIp}</span>
                  <Pill tone={h.status === 'completed' ? 'ok' : 'neutral'}>{h.status}</Pill>
                  <span>{new Date(h.completedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ==========================================
// 4. SHARED LINKS TAB
// ==========================================
function SharesTab({ onShowQr }: { onShowQr: (url: string) => void }) {
  const [shares, setShares] = useState<ShareLink[]>([]);

  const load = async () => {
    const list = await window.smaran.fileserver.shares.list();
    setShares(list);
  };

  useEffect(() => {
    void window.smaran.fileserver.shares.list().then(setShares);
  }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this share link?')) return;
    await window.smaran.fileserver.shares.revoke(id);
    await load();
  };

  const getShareUrl = (token: string) => `http://localhost:5900/share/${token}`;

  return (
    <Card title="Active Share Links" description="Manage generated download links and public tokens.">
      {shares.length === 0 ? (
        <p className="py-8 text-center text-muted font-serif italic text-[13px]">
          No active share links. Generate one from the File Manager tab.
        </p>
      ) : (
        <div className="divide-y divide-line py-2">
          {shares.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[13.5px]">{s.name}</span>
                  <Pill tone="accent">{s.permission}</Pill>
                  {s.passwordProtected && (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <LockIcon size={11} /> Password
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[11.5px] text-muted select-all">
                  {getShareUrl(s.token)}
                </div>
                <div className="mt-0.5 text-[11.5px] text-faint">
                  Downloads: {s.downloadCount}
                  {s.maxDownloads ? ` / ${s.maxDownloads}` : ''} · Created:{' '}
                  {new Date(s.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onShowQr(getShareUrl(s.token))}
                >
                  <QrIcon size={13} />
                  QR
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigator.clipboard.writeText(getShareUrl(s.token))}
                >
                  <CopyIcon size={13} />
                  Copy
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleRevoke(s.id)}>
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ==========================================
// 5. USERS & PERMISSIONS TAB
// ==========================================
function UsersTab() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user' | 'guest'>('user');
  const [canUpload, setCanUpload] = useState(true);
  const [canDelete, setCanDelete] = useState(false);

  const load = async () => {
    const list = await window.smaran.fileserver.users.list();
    setUsers(list);
  };

  useEffect(() => {
    void window.smaran.fileserver.users.list().then(setUsers);
  }, []);

  const handleSave = async () => {
    if (!username.trim()) return;
    await window.smaran.fileserver.users.save({
      username: username.trim(),
      password: password.trim() || undefined,
      role,
      permissions: {
        read: true,
        upload: canUpload,
        delete: canDelete,
        rename: canDelete,
        mkdir: canUpload,
      },
    });
    setAddModal(false);
    setUsername('');
    setPassword('');
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this user account?')) return;
    await window.smaran.fileserver.users.delete(id);
    await load();
  };

  return (
    <Card title="User Accounts" description="Manage access credentials and upload/delete permissions.">
      <div className="flex justify-end pb-3">
        <Button size="sm" variant="primary" onClick={() => setAddModal(true)}>
          <PlusIcon size={13} />
          Add User
        </Button>
      </div>

      {users.length === 0 ? (
        <p className="py-6 text-center text-muted font-serif italic text-[13px]">
          No user accounts defined. Guest access is currently active.
        </p>
      ) : (
        <div className="divide-y divide-line py-1 text-[13px]">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{u.username}</span>
                  <Pill tone={u.role === 'admin' ? 'accent' : 'neutral'}>{u.role}</Pill>
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted">
                  Permissions: Read{u.permissions.upload ? ', Upload' : ''}
                  {u.permissions.delete ? ', Delete' : ''}
                </div>
              </div>
              <Button size="sm" variant="danger" onClick={() => handleDelete(u.id)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add User Dialog */}
      {addModal && (
        <Dialog
          open={addModal}
          title="Add User Account"
          onClose={() => setAddModal(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setAddModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave}>
                Save User
              </Button>
            </>
          }
        >
          <div className="space-y-3 py-1">
            <div>
              <label className="block text-[12.5px] text-muted mb-1">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. john"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[12.5px] text-muted mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a strong password"
              />
            </div>
            <div>
              <label className="block text-[12.5px] text-muted mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'user' | 'guest')}
                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink outline-none"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[13px]">Allow Uploads</span>
              <Switch checked={canUpload} onChange={setCanUpload} label="Allow Uploads" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px]">Allow Delete & Rename</span>
              <Switch checked={canDelete} onChange={setCanDelete} label="Allow Delete" />
            </div>
          </div>
        </Dialog>
      )}
    </Card>
  );
}

// ==========================================
// 6. SERVER SETTINGS TAB
// ==========================================
function SettingsTab({
  initialSettings,
  onUpdated,
}: {
  initialSettings: FileServerSettings;
  onUpdated: (s: FileServerSettings) => void;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const updated = await window.smaran.fileserver.saveSettings(settings);
    setSettings(updated);
    onUpdated(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePickRootDir = async () => {
    const chosen = await window.smaran.fileserver.pickRootDir();
    if (chosen) {
      setSettings((s) => ({ ...s, rootDir: chosen }));
    }
  };

  return (
    <Card title="Server Settings" description="Configure network ports, directories, and security.">
      <Row
        label="Auto-start Server"
        hint="Automatically start the HTTP file server when Smaran launches."
      >
        <Switch
          checked={settings.enabled}
          onChange={(enabled) => setSettings((s) => ({ ...s, enabled }))}
          label="Auto-start Server"
        />
      </Row>

      <Row label="Server Display Name" hint="Shown on the web file manager heading.">
        <Input
          value={settings.serverName}
          onChange={(e) => setSettings((s) => ({ ...s, serverName: e.target.value }))}
          className="w-60"
        />
      </Row>

      <Row label="HTTP Port" hint="Default is 5900.">
        <Input
          type="number"
          value={settings.port}
          onChange={(e) => setSettings((s) => ({ ...s, port: Number(e.target.value) || 5900 }))}
          className="w-24 text-center font-mono"
        />
      </Row>

      <Row label="Storage Directory" hint={settings.rootDir}>
        <Button size="sm" variant="secondary" onClick={handlePickRootDir}>
          Browse Folder…
        </Button>
      </Row>

      <Row
        label="Require Authentication"
        hint="Enforce username/password for file operations."
      >
        <Switch
          checked={settings.authEnabled}
          onChange={(authEnabled) => setSettings((s) => ({ ...s, authEnabled }))}
          label="Require Authentication"
        />
      </Row>

      <Row
        label="Allow Guest Browsing"
        hint="Allow devices to browse and download files without logging in."
      >
        <Switch
          checked={settings.guestAccess}
          onChange={(guestAccess) => setSettings((s) => ({ ...s, guestAccess }))}
          label="Allow Guest Browsing"
        />
      </Row>

      <Row
        label="Maximum Upload Size"
        hint={`${settings.uploadLimitMb} MB limit per file.`}
      >
        <Slider
          value={settings.uploadLimitMb}
          min={100}
          max={10240}
          step={100}
          suffix=" MB"
          label="Upload Limit"
          onChange={(uploadLimitMb) => setSettings((s) => ({ ...s, uploadLimitMb }))}
        />
      </Row>

      <div className="flex justify-end pt-4 pb-2">
        <Button variant="primary" onClick={handleSave}>
          {saved ? 'Settings Saved!' : 'Save Settings'}
        </Button>
      </div>
    </Card>
  );
}

// ==========================================
// 7. LOGS TAB
// ==========================================
function LogsTab() {
  const [logs, setLogs] = useState<ServerLogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn'>('all');

  useEffect(() => {
    void window.smaran.fileserver.logs.get().then(setLogs);
    const off = window.smaran.fileserver.onLogAdded((entry) => {
      setLogs((prev) => [entry, ...prev.slice(0, 500)]);
    });
    return () => off();
  }, []);

  const handleClear = async () => {
    await window.smaran.fileserver.logs.clear();
    setLogs([]);
  };

  const filteredLogs = logs.filter((l) => (filter === 'all' ? true : l.level === filter));

  return (
    <Card title="Server Access & Audit Logs" description="Live request events and server activity.">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={filter === 'all' ? 'primary' : 'ghost'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === 'error' ? 'primary' : 'ghost'}
            onClick={() => setFilter('error')}
          >
            Errors
          </Button>
          <Button
            size="sm"
            variant={filter === 'warn' ? 'primary' : 'ghost'}
            onClick={() => setFilter('warn')}
          >
            Warnings
          </Button>
        </div>
        <Button size="sm" variant="ghost" onClick={handleClear}>
          Clear Logs
        </Button>
      </div>

      {filteredLogs.length === 0 ? (
        <p className="py-8 text-center text-muted font-serif italic text-[13px]">
          No log events recorded yet.
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-line bg-raised/30 p-2 font-mono text-[11.5px] space-y-1">
          {filteredLogs.map((l) => (
            <div
              key={l.id}
              className={cx(
                'flex items-start gap-2 py-0.5 leading-tight',
                l.level === 'error'
                  ? 'text-danger'
                  : l.level === 'warn'
                    ? 'text-accent'
                    : 'text-muted',
              )}
            >
              <span className="text-faint shrink-0">
                {new Date(l.timestamp).toLocaleTimeString()}
              </span>
              <span className="shrink-0 uppercase font-semibold">[{l.level}]</span>
              <span className="shrink-0 text-ink">{l.clientIp}</span>
              {l.method && <span className="shrink-0 text-accent font-semibold">{l.method}</span>}
              <span className="truncate flex-1 text-ink">{l.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
