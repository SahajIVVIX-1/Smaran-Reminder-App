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
  VfsNode,
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
  GlobeIcon,
  LockIcon,
  PlusIcon,
  QrIcon,
  RefreshIcon,
  ServerIcon,
  ShareIcon,
  ShieldIcon,
  TrashIcon,
  UsersIcon,
} from '../icons';
import { Button, Card, Dialog, Input, Pill, Row, Switch } from '../ui';

type FileServerTab =
  | 'overview'
  | 'manager'
  | 'vfs'
  | 'connections'
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
  { id: 'vfs', label: 'VFS Mounts', icon: GlobeIcon },
  { id: 'connections', label: 'Connections', icon: ActivityIcon },
  { id: 'transfers', label: 'Transfers', icon: DownloadIcon },
  { id: 'shares', label: 'Shared Links', icon: ShareIcon },
  { id: 'users', label: 'Users & IP', icon: UsersIcon },
  { id: 'settings', label: 'Settings', icon: GearIcon },
  { id: 'logs', label: 'Logs', icon: FileIcon },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
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
  const [webdavModal, setWebdavModal] = useState(false);
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
    <div className="mx-auto max-w-[900px] space-y-5 px-7 pt-8 pb-16">
      <header className="animate-enter flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[26px] leading-tight flex items-center gap-2.5">
            <ServerIcon size={24} className="text-accent" />
            File Server (HFS)
          </h1>
          <p className="mt-1 font-serif text-[14px] text-muted italic">
            Self-hosted HTTP file server engine with VFS, WebDAV, streaming ZIP, and bandwidth throttling.
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
        className="flex items-center gap-1 rounded-xl border border-line bg-raised/70 p-1 animate-enter [animation-delay:20ms] overflow-x-auto"
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
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-[12px] font-medium transition-all duration-150 whitespace-nowrap min-w-[70px]',
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
              onOpenWebdav={() => setWebdavModal(true)}
              onCopy={copyToClipboard}
              copiedUrl={copiedUrl}
            />
          )}

          {tab === 'manager' && <FileManagerTab onShowQr={showQr} />}

          {tab === 'vfs' && <VfsTab />}

          {tab === 'connections' && <ConnectionsTab />}

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
            <img
              src={qrModal.qrData}
              alt="QR Code"
              className="h-56 w-56 rounded-xl border border-line bg-surface p-2 shadow-sm"
            />
            <p className="font-mono text-[13px] text-muted text-center break-all px-4 select-all">
              {qrModal.url}
            </p>
          </div>
        </Dialog>
      )}

      {/* WebDAV Drive Guidance Dialog */}
      {webdavModal && status && (
        <Dialog
          open={webdavModal}
          title="Mount as Windows Network Drive (WebDAV)"
          onClose={() => setWebdavModal(false)}
          actions={
            <Button variant="secondary" onClick={() => setWebdavModal(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3 py-2 text-[13px] text-muted leading-relaxed">
            <p>
              Smaran HFS includes a full native WebDAV server. You can mount your shared folders
              directly in Windows Explorer as a network drive letter (e.g. <code className="text-ink">Z:</code>).
            </p>
            <div className="rounded-lg border border-line bg-raised/50 p-3 font-mono text-[12px] text-ink select-all">
              net use Z: {status.localUrl}/
            </div>
            <div className="space-y-1 text-[12px]">
              <div className="font-semibold text-ink">In Windows File Explorer:</div>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Open File Explorer and right-click <strong>This PC</strong>.</li>
                <li>Select <strong>Map network drive…</strong></li>
                <li>Enter <code className="text-ink">{status.localUrl}/</code> in the Folder box.</li>
                <li>Click <strong>Finish</strong>. Your Smaran HFS is now accessible like a local drive!</li>
              </ol>
            </div>
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
  onRestart,
  onShowQr,
  onOpenWebdav,
  onCopy,
  copiedUrl,
}: {
  status: ServerStatus;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onShowQr: (url: string) => void;
  onOpenWebdav: () => void;
  onCopy: (url: string) => void;
  copiedUrl: string | null;
}) {
  return (
    <div className="space-y-5">
      <Card
        title="Server Status & Access Addresses"
        description="Share these addresses with devices connected to your Wi-Fi or local network."
      >
        <div className="space-y-3 py-1">
          {/* Status Bar Pills */}
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-line">
            <Pill tone={status.running ? 'ok' : 'neutral'}>
              {status.running ? 'HTTP Server Active' : 'Server Stopped'}
            </Pill>
            {status.upnpMapped ? (
              <Pill tone="accent">UPnP Port Forwarded ({status.publicIp || 'WAN'})</Pill>
            ) : (
              <Pill tone="neutral">UPnP Router: Inactive</Pill>
            )}
            <Button size="sm" variant="ghost" onClick={onOpenWebdav}>
              <GlobeIcon size={13} className="text-accent" />
              Mount as WebDAV Drive
            </Button>
            {status.running && (
              <Button size="sm" variant="ghost" onClick={onRestart}>
                <RefreshIcon size={13} />
                Restart
              </Button>
            )}
          </div>

          {/* URLs */}
          {status.running ? (
            <div className="space-y-2 pt-1">
              {/* Localhost */}
              <div className="flex items-center justify-between rounded-lg border border-line bg-raised/40 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-muted font-medium">
                    This PC (Localhost)
                  </div>
                  <div className="font-mono text-[13.5px] text-ink truncate select-all">
                    {status.localUrl}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  <Button size="sm" variant="ghost" onClick={() => onCopy(status.localUrl)}>
                    {copiedUrl === status.localUrl ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                    {copiedUrl === status.localUrl ? 'Copied' : 'Copy'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onShowQr(status.localUrl)}>
                    <QrIcon size={13} />
                    QR
                  </Button>
                </div>
              </div>

              {/* LAN URLs */}
              {status.lanUrls.map((url) => (
                <div
                  key={url}
                  className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wider text-accent font-semibold flex items-center gap-1.5">
                      Wi-Fi / LAN Network URL
                    </div>
                    <div className="font-mono text-[14px] font-semibold text-ink truncate select-all">
                      {url}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <Button size="sm" variant="ghost" onClick={() => onCopy(url)}>
                      {copiedUrl === url ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                      {copiedUrl === url ? 'Copied' : 'Copy'}
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => onShowQr(url)}>
                      <QrIcon size={13} />
                      QR
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-muted font-serif italic text-[13.5px]">
              Server is offline. Click &ldquo;Start&rdquo; above to begin sharing files.
            </p>
          )}
        </div>
      </Card>

      {/* Metrics Grid */}
      {status.running && (
        <Card title="Live Server Activity" description="Real-time bandwidth and connected network clients.">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-1">
            <MetricTile
              label="Uptime"
              value={formatUptime(status.uptimeSeconds)}
              sub={`Port :${status.port}`}
            />
            <MetricTile
              label="Connected Clients"
              value={String(status.connectedClients)}
              sub="Live sockets"
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
      <div className="text-[11px] uppercase tracking-wider text-muted font-medium">{label}</div>
      <div className="mt-1 font-mono text-[17px] font-semibold text-ink tabular-nums">{value}</div>
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

  const handleSetComment = async (item: FileItem) => {
    const comment = prompt(`Description for "${item.name}":`, item.comment || '');
    if (comment === null) return;
    await window.smaran.fileserver.setComment(item.relativePath, comment.trim());
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
            className="w-40 h-7 text-[12px]"
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
              <th className="py-2.5 px-4 w-40">Modified</th>
              <th className="py-2.5 px-4 text-right w-48">Actions</th>
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
                    <div className="flex items-center gap-2.5">
                      {item.isDirectory ? (
                        <FolderIcon size={16} className="text-accent shrink-0" />
                      ) : (
                        <FileIcon size={16} className="text-muted shrink-0" />
                      )}
                      <div className="min-w-0">
                        {item.isDirectory ? (
                          <button
                            type="button"
                            onClick={() => load(item.relativePath)}
                            className="font-medium text-ink hover:text-accent hover:underline text-left truncate block"
                          >
                            {item.name}
                          </button>
                        ) : (
                          <span className="font-medium text-ink truncate block">{item.name}</span>
                        )}
                        {item.comment && (
                          <span className="text-[11px] text-muted italic block truncate">
                            {item.comment}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[12px] text-muted tabular-nums">
                    {item.isDirectory ? '—' : formatBytes(item.size)}
                  </td>
                  <td className="py-2.5 px-4 text-[12px] text-muted">
                    {new Date(item.modifiedAt).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Set description / comment"
                        onClick={() => handleSetComment(item)}
                      >
                        Note
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShareDialog(item)}
                        title="Create Share Link"
                      >
                        <ShareIcon size={13} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRename(item)}
                        title="Rename"
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(item)}
                        title="Delete"
                      >
                        <TrashIcon size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {shareDialog && (
        <CreateShareDialog
          item={shareDialog}
          onClose={() => setShareDialog(null)}
          onCreated={async (s) => {
            setShareDialog(null);
            onShowQr(getShareUrl(s.token));
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// 3. VFS MOUNTS TAB
// ==========================================
function VfsTab() {
  const [nodes, setNodes] = useState<VfsNode[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [name, setName] = useState('');
  const [vfsPath, setVfsPath] = useState('');
  const [type, setType] = useState<'physical_dir' | 'virtual_dir' | 'link'>('physical_dir');
  const [physicalPath, setPhysicalPath] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [comment, setComment] = useState('');

  const load = async () => {
    const list = await window.smaran.fileserver.vfs.list();
    setNodes(list);
  };

  useEffect(() => {
    void window.smaran.fileserver.vfs.list().then(setNodes);
  }, []);

  const handlePickFolder = async () => {
    const chosen = await window.smaran.fileserver.vfs.pickPath(true);
    if (chosen) {
      setPhysicalPath(chosen);
      if (!name) setName(chosen.split(/[/\\]/).pop() || 'Folder');
      if (!vfsPath) setVfsPath('/' + (chosen.split(/[/\\]/).pop() || 'folder').toLowerCase());
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !vfsPath.trim()) return;

    const node: VfsNode = {
      id: crypto.randomUUID(),
      name: name.trim(),
      vfsPath: vfsPath.trim().startsWith('/') ? vfsPath.trim() : '/' + vfsPath.trim(),
      type,
      physicalPath: type === 'physical_dir' ? physicalPath.trim() : undefined,
      linkUrl: type === 'link' ? linkUrl.trim() : undefined,
      permissions: {
        canRead: true,
        canSee: !hidden,
        canUpload: !readOnly,
        canDelete: !readOnly,
        canList: true,
        canArchive: true,
      },
      allowedRoles: [],
      readOnly,
      hidden,
      comment: comment.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await window.smaran.fileserver.vfs.save(node);
    setAddModal(false);
    resetForm();
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this VFS mount? (Physical files will not be deleted)')) return;
    await window.smaran.fileserver.vfs.delete(id);
    await load();
  };

  const resetForm = () => {
    setName('');
    setVfsPath('');
    setType('physical_dir');
    setPhysicalPath('');
    setLinkUrl('');
    setReadOnly(false);
    setHidden(false);
    setComment('');
  };

  return (
    <Card
      title="Virtual File System (VFS) Tree"
      description="Mount physical drives, virtual folders, or external links anywhere in your HFS server path hierarchy."
    >
      <div className="flex justify-end pb-3">
        <Button size="sm" variant="primary" onClick={() => setAddModal(true)}>
          <PlusIcon size={13} />
          Add VFS Mount
        </Button>
      </div>

      {nodes.length === 0 ? (
        <div className="py-8 text-center text-muted font-serif italic text-[13px] border border-dashed border-line rounded-lg">
          No custom VFS mounts configured. The default storage root is mounted at <code className="text-ink">/</code>.
        </div>
      ) : (
        <div className="divide-y divide-line py-1 text-[13px]">
          {nodes.map((n) => (
            <div key={n.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink font-mono text-[13.5px]">{n.vfsPath}</span>
                  <Pill tone={n.type === 'physical_dir' ? 'accent' : 'neutral'}>{n.type}</Pill>
                  {n.readOnly && <Pill tone="neutral">Read-only</Pill>}
                  {n.hidden && <Pill tone="neutral">Hidden</Pill>}
                </div>
                <div className="mt-0.5 text-[12px] text-muted truncate">
                  {n.type === 'physical_dir' && `Mapped to: ${n.physicalPath}`}
                  {n.type === 'virtual_dir' && 'Pure virtual directory (in-memory)'}
                  {n.type === 'link' && `Redirects to: ${n.linkUrl}`}
                  {n.comment && ` · "${n.comment}"`}
                </div>
              </div>
              <Button size="sm" variant="danger" onClick={() => handleDelete(n.id)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      {addModal && (
        <Dialog
          open={addModal}
          title="Add VFS Mount Node"
          onClose={() => setAddModal(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setAddModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave}>
                Save Mount
              </Button>
            </>
          }
        >
          <div className="space-y-3 py-1">
            <div>
              <label className="block text-[12.5px] text-muted mb-1">Mount Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'physical_dir' | 'virtual_dir' | 'link')}
                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink outline-none"
              >
                <option value="physical_dir">Physical Directory (Map disk folder)</option>
                <option value="virtual_dir">Virtual Folder (Directory without disk folder)</option>
                <option value="link">Link Node (External URL or shortcut)</option>
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] text-muted mb-1">Display Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vacation Photos"
              />
            </div>
            <div>
              <label className="block text-[12.5px] text-muted mb-1">VFS URL Path</label>
              <Input
                value={vfsPath}
                onChange={(e) => setVfsPath(e.target.value)}
                placeholder="e.g. /photos or /shared/docs"
              />
            </div>
            {type === 'physical_dir' && (
              <div>
                <label className="block text-[12.5px] text-muted mb-1">Physical Disk Path</label>
                <div className="flex gap-2">
                  <Input
                    value={physicalPath}
                    onChange={(e) => setPhysicalPath(e.target.value)}
                    placeholder="e.g. D:\Pictures\Vacation"
                    className="flex-1"
                  />
                  <Button size="sm" variant="secondary" onClick={handlePickFolder}>
                    Browse…
                  </Button>
                </div>
              </div>
            )}
            {type === 'link' && (
              <div>
                <label className="block text-[12.5px] text-muted mb-1">Target URL</label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            )}
            <div>
              <label className="block text-[12.5px] text-muted mb-1">Description / Comment</label>
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional note shown in file listings"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[13px]">Read-only (prevent uploads & deletes)</span>
              <Switch checked={readOnly} onChange={setReadOnly} label="Read-only" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px]">Hidden (accessible only via direct link)</span>
              <Switch checked={hidden} onChange={setHidden} label="Hidden" />
            </div>
          </div>
        </Dialog>
      )}
    </Card>
  );
}

// ==========================================
// 4. LIVE CONNECTIONS INSPECTOR TAB
// ==========================================
function ConnectionsTab() {
  const [status, setStatus] = useState<ServerStatus | null>(null);

  useEffect(() => {
    void window.smaran.fileserver.status().then(setStatus);
    const off = window.smaran.fileserver.onStatusChanged(setStatus);
    return () => off();
  }, []);

  const handleDisconnect = async (id: string) => {
    await window.smaran.fileserver.killConnection(id);
    const s = await window.smaran.fileserver.status();
    setStatus(s);
  };

  const connections = status?.liveConnections || [];

  return (
    <Card
      title="Live Connected Clients & Sockets"
      description="Inspect active network connections to your HFS server with client software details and disconnect controls."
    >
      {connections.length === 0 ? (
        <p className="py-8 text-center text-muted font-serif italic text-[13px]">
          No active client connections right now.
        </p>
      ) : (
        <div className="divide-y divide-line py-1 text-[13px]">
          {connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-ink">{c.clientIp}</span>
                  <span className="font-mono text-[11px] text-faint">
                    Connected: {new Date(c.connectedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted truncate">
                  <span className="text-accent font-medium">Path:</span> {c.currentPath} ·{' '}
                  <span className="text-faint">{c.userAgent}</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted">
                  Transferred: {formatBytes(c.bytesSent + c.bytesReceived)}
                </div>
              </div>
              <Button size="sm" variant="danger" onClick={() => handleDisconnect(c.id)}>
                Disconnect
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ==========================================
// 5. TRANSFERS TAB
// ==========================================
function TransfersTab() {
  const [active, setActive] = useState<ActiveTransfer[]>([]);
  const [history, setHistory] = useState<TransferHistoryEntry[]>([]);

  useEffect(() => {
    void window.smaran.fileserver.transfers.active().then(setActive);
    void window.smaran.fileserver.transfers.history().then(setHistory);

    const off = window.smaran.fileserver.onTransfersUpdated((transfers) => {
      setActive(transfers);
    });
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
    <div className="space-y-5">
      <Card title="Active Transfers" description="Real-time uploads and downloads currently in progress.">
        {active.length === 0 ? (
          <p className="py-6 text-center text-muted font-serif italic text-[13px]">
            No active file transfers at the moment.
          </p>
        ) : (
          <div className="space-y-3 py-1">
            {active.map((t) => (
              <div key={t.id} className="rounded-lg border border-line bg-raised/50 p-3 space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <Pill tone={t.direction === 'upload' ? 'accent' : 'ok'}>
                      {t.direction.toUpperCase()}
                    </Pill>
                    <span className="font-medium text-ink">{t.fileName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[12px] text-muted">
                      {formatSpeed(t.speedBps)} · {t.percent}%
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(t.id)}>
                      Cancel
                    </Button>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-200"
                    style={{ width: `${t.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Transfer History"
        description="Log of recent completed and failed file transfers."
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
          <div className="divide-y divide-line text-[12.5px] max-h-80 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{h.fileName}</span>
                    <Pill tone={h.status === 'completed' ? 'ok' : 'neutral'}>{h.status}</Pill>
                  </div>
                  <div className="text-[11.5px] text-muted font-mono mt-0.5">
                    {h.direction} · {formatBytes(h.totalBytes)} · {h.clientIp} · {Math.round(h.durationMs / 1000)}s
                  </div>
                </div>
                <span className="font-mono text-[11px] text-faint">
                  {new Date(h.completedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ==========================================
// 6. SHARED LINKS TAB
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

  return (
    <Card
      title="Active Shared Links"
      description="Direct download links generated for files or folders, with optional password protection."
    >
      {shares.length === 0 ? (
        <p className="py-8 text-center text-muted font-serif italic text-[13px]">
          No shared links created yet. Create one from the File Manager tab.
        </p>
      ) : (
        <div className="divide-y divide-line py-1 text-[13px]">
          {shares.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-3">
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{s.name}</span>
                  {s.passwordProtected && (
                    <Pill tone="accent">
                      <LockIcon size={11} className="inline mr-1" />
                      Protected
                    </Pill>
                  )}
                  <Pill tone="neutral">{s.permission}</Pill>
                </div>
                <div className="mt-1 font-mono text-[11.5px] text-muted truncate">
                  {getShareUrl(s.token)}
                </div>
                <div className="mt-0.5 text-[11px] text-faint">
                  Downloads: {s.downloadCount}
                  {s.maxDownloads ? ` / ${s.maxDownloads}` : ''} · Created{' '}
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
// 7. USERS & IP SECURITY TAB
// ==========================================
function UsersTab() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [settings, setSettings] = useState<FileServerSettings | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user' | 'guest'>('user');
  const [canUpload, setCanUpload] = useState(true);
  const [canDelete, setCanDelete] = useState(false);

  // IP filter inputs
  const [newAllowIp, setNewAllowIp] = useState('');
  const [newBlockIp, setNewBlockIp] = useState('');

  const load = async () => {
    const list = await window.smaran.fileserver.users.list();
    setUsers(list);
    const s = await window.smaran.fileserver.getSettings();
    setSettings(s);
  };

  useEffect(() => {
    void window.smaran.fileserver.users.list().then(setUsers);
    void window.smaran.fileserver.getSettings().then(setSettings);
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

  const addAllowIp = async () => {
    if (!newAllowIp.trim() || !settings) return;
    const updated = [...settings.ipAllowlist, newAllowIp.trim()];
    const res = await window.smaran.fileserver.saveSettings({ ipAllowlist: updated });
    setSettings(res);
    setNewAllowIp('');
  };

  const removeAllowIp = async (ip: string) => {
    if (!settings) return;
    const updated = settings.ipAllowlist.filter((x) => x !== ip);
    const res = await window.smaran.fileserver.saveSettings({ ipAllowlist: updated });
    setSettings(res);
  };

  const addBlockIp = async () => {
    if (!newBlockIp.trim() || !settings) return;
    const updated = [...settings.ipBlocklist, newBlockIp.trim()];
    const res = await window.smaran.fileserver.saveSettings({ ipBlocklist: updated });
    setSettings(res);
    setNewBlockIp('');
  };

  const removeBlockIp = async (ip: string) => {
    if (!settings) return;
    const updated = settings.ipBlocklist.filter((x) => x !== ip);
    const res = await window.smaran.fileserver.saveSettings({ ipBlocklist: updated });
    setSettings(res);
  };

  return (
    <div className="space-y-5">
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

      {/* IP Firewall Card */}
      {settings && (
        <Card
          title="IP Firewall & Anti-Brute Force"
          description="Restrict connections by IP/CIDR masks and guard against password guessing."
        >
          <div className="space-y-4 py-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-ink">IP Filter Enabled</div>
                <div className="text-[11.5px] text-muted">Enforce allowlist and blocklist rules.</div>
              </div>
              <Switch
                checked={settings.ipFilterEnabled}
                onChange={async (v) => {
                  const s = await window.smaran.fileserver.saveSettings({ ipFilterEnabled: v });
                  setSettings(s);
                }}
                label="IP Filter Enabled"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-ink">Anti-Brute Force Protection</div>
                <div className="text-[11.5px] text-muted">Automatically lock out IPs after 5 failed login attempts.</div>
              </div>
              <Switch
                checked={settings.bruteForceProtection}
                onChange={async (v) => {
                  const s = await window.smaran.fileserver.saveSettings({ bruteForceProtection: v });
                  setSettings(s);
                }}
                label="Anti-Brute Force"
              />
            </div>

            {/* Blocklist */}
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="text-[12.5px] font-semibold text-danger flex items-center gap-1.5">
                <ShieldIcon size={14} />
                Blocked IP Addresses (Blocklist)
              </div>
              <div className="flex gap-2">
                <Input
                  value={newBlockIp}
                  onChange={(e) => setNewBlockIp(e.target.value)}
                  placeholder="e.g. 192.168.1.150 or 10.0.0.*"
                  className="flex-1 text-[12.5px]"
                />
                <Button size="sm" variant="danger" onClick={addBlockIp}>
                  Block IP
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {settings.ipBlocklist.map((ip) => (
                  <span
                    key={ip}
                    className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-0.5 font-mono text-[11.5px] text-danger"
                  >
                    {ip}
                    <button
                      type="button"
                      onClick={() => removeBlockIp(ip)}
                      className="hover:text-ink cursor-pointer ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Allowlist */}
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="text-[12.5px] font-semibold text-ok flex items-center gap-1.5">
                <ShieldIcon size={14} />
                Allowed IP Addresses (Allowlist - optional)
              </div>
              <div className="flex gap-2">
                <Input
                  value={newAllowIp}
                  onChange={(e) => setNewAllowIp(e.target.value)}
                  placeholder="e.g. 192.168.1.0/24"
                  className="flex-1 text-[12.5px]"
                />
                <Button size="sm" variant="secondary" onClick={addAllowIp}>
                  Allow IP
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {settings.ipAllowlist.map((ip) => (
                  <span
                    key={ip}
                    className="inline-flex items-center gap-1 rounded-md bg-ok/10 px-2 py-0.5 font-mono text-[11.5px] text-ok"
                  >
                    {ip}
                    <button
                      type="button"
                      onClick={() => removeAllowIp(ip)}
                      className="hover:text-ink cursor-pointer ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ==========================================
// 8. SERVER SETTINGS TAB
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
    <Card title="Server Settings" description="Configure network ports, bandwidth caps, and UPnP routing.">
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
        label="UPnP Router Port Forwarding"
        hint="Automatically maps your router's external port to this PC via UPnP NAT."
      >
        <Switch
          checked={settings.upnpEnabled}
          onChange={(upnpEnabled) => setSettings((s) => ({ ...s, upnpEnabled }))}
          label="UPnP Port Forwarding"
        />
      </Row>

      <Row
        label="WebDAV Server Protocol"
        hint="Allow mounting as a Windows Explorer network drive without browser."
      >
        <Switch
          checked={settings.webdavEnabled}
          onChange={(webdavEnabled) => setSettings((s) => ({ ...s, webdavEnabled }))}
          label="WebDAV Server"
        />
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

      {/* Bandwidth Limits */}
      <Row
        label="Download Speed Limit"
        hint={settings.maxKbpsDown > 0 ? `${settings.maxKbpsDown} KB/s cap` : 'Unlimited'}
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={settings.maxKbpsDown}
            onChange={(e) => setSettings((s) => ({ ...s, maxKbpsDown: Number(e.target.value) || 0 }))}
            className="w-24 font-mono text-center"
          />
          <span className="text-[12px] text-muted">KB/s (0 = unlimited)</span>
        </div>
      </Row>

      <Row
        label="Upload Speed Limit"
        hint={settings.maxKbpsUp > 0 ? `${settings.maxKbpsUp} KB/s cap` : 'Unlimited'}
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={settings.maxKbpsUp}
            onChange={(e) => setSettings((s) => ({ ...s, maxKbpsUp: Number(e.target.value) || 0 }))}
            className="w-24 font-mono text-center"
          />
          <span className="text-[12px] text-muted">KB/s (0 = unlimited)</span>
        </div>
      </Row>

      <Row
        label="Per-IP Speed Limit"
        hint={settings.maxKbpsPerIp > 0 ? `${settings.maxKbpsPerIp} KB/s per client` : 'Unlimited'}
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={settings.maxKbpsPerIp}
            onChange={(e) => setSettings((s) => ({ ...s, maxKbpsPerIp: Number(e.target.value) || 0 }))}
            className="w-24 font-mono text-center"
          />
          <span className="text-[12px] text-muted">KB/s (0 = unlimited)</span>
        </div>
      </Row>

      <Row
        label="Dynamic DNS (DDNS) Update URL"
        hint="DuckDNS, No-IP, or DynDNS webhook URL. Use {ip} for address."
      >
        <Input
          value={settings.ddnsUrl}
          onChange={(e) => setSettings((s) => ({ ...s, ddnsUrl: e.target.value }))}
          placeholder="https://www.duckdns.org/update?domains=MYDOMAIN&token=MYTOKEN&ip={ip}"
          className="w-72 text-[12px]"
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
// 9. LOGS TAB
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

// Helpers
function getShareUrl(token: string): string {
  return `${window.location.protocol}//${window.location.hostname}:5900/share/${token}`;
}

function CreateShareDialog({
  item,
  onClose,
  onCreated,
}: {
  item: FileItem;
  onClose: () => void;
  onCreated: (share: ShareLink) => void;
}) {
  const [password, setPassword] = useState('');
  const [permission, setPermission] = useState<'download' | 'read' | 'upload' | 'full'>('download');
  const [expiresHours, setExpiresHours] = useState<number>(24);

  const handleCreate = async () => {
    const expiresAt = expiresHours > 0 ? new Date(Date.now() + expiresHours * 3600 * 1000).toISOString() : null;
    const share = await window.smaran.fileserver.shares.create({
      relativePath: item.relativePath,
      permission,
      password: password.trim() || undefined,
      expiresAt,
    });
    onCreated(share);
  };

  return (
    <Dialog
      open
      title={`Share "${item.name}"`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            Create Link
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-1">
        <div>
          <label className="block text-[12.5px] text-muted mb-1">Permission</label>
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as 'download' | 'read' | 'upload' | 'full')}
            className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink outline-none"
          >
            <option value="download">Download Only</option>
            <option value="read">Read / View Only</option>
            <option value="upload">Upload Permitted</option>
            <option value="full">Full Access</option>
          </select>
        </div>
        <div>
          <label className="block text-[12.5px] text-muted mb-1">Expiration</label>
          <select
            value={expiresHours}
            onChange={(e) => setExpiresHours(Number(e.target.value))}
            className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink outline-none"
          >
            <option value={1}>1 Hour</option>
            <option value={24}>24 Hours</option>
            <option value={168}>7 Days</option>
            <option value={720}>30 Days</option>
            <option value={0}>Never Expire</option>
          </select>
        </div>
        <div>
          <label className="block text-[12.5px] text-muted mb-1">Password (Optional)</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Protect with a password"
          />
        </div>
      </div>
    </Dialog>
  );
}
