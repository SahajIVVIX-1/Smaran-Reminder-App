import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { AppNotification } from '@shared/notifications';
import { timeOf } from '../format';
import { cx } from '../cx';
import {
  BellIcon,
  ServerIcon,
  ShieldIcon,
  SparkIcon,
  XIcon,
} from '../icons';
import { Button, Dialog } from '../ui';

interface NotificationCenterDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationCenterDrawer({ open, onClose }: NotificationCenterDrawerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    void window.smaran.notifications.list().then(setNotifications);
    const off = window.smaran.notifications.onChanged(setNotifications);
    return () => off();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return notifications;
    return notifications.filter((n) => n.category === categoryFilter);
  }, [notifications, categoryFilter]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="notification-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.05 : 0.2 }}
          className="fixed top-9 bottom-0 left-0 right-0 z-40 flex justify-end bg-black/65 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            key="notification-drawer-panel"
            initial={{
              x: reducedMotion ? 0 : '100%',
              opacity: reducedMotion ? 1 : 0.4,
            }}
            animate={{
              x: 0,
              opacity: 1,
            }}
            exit={{
              x: reducedMotion ? 0 : '100%',
              opacity: reducedMotion ? 1 : 0.2,
            }}
            transition={{
              duration: reducedMotion ? 0.05 : 0.26,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#131317] dark:bg-[#111116] shadow-[-16px_0_40px_rgba(0,0,0,0.65)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: explicitly positioned below the 36px title bar */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#17171e] px-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#22222c] text-accent">
                  <BellIcon size={17} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-[15.5px] font-semibold text-white tracking-tight">
                      Notifications
                    </h2>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white font-mono leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-[#9a9aa8]">
                    {unreadCount > 0
                      ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`
                      : 'All caught up'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void window.smaran.notifications.markAllRead()}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/15 transition-colors"
                    title="Mark all as read"
                  >
                    Mark Read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#9a9aa8] hover:bg-white/10 hover:text-white transition-colors"
                    title="Clear inbox (history remains)"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-8 w-8 place-items-center rounded-lg text-[#9a9aa8] hover:bg-white/10 hover:text-white transition-colors ml-1"
                  aria-label="Close notifications"
                >
                  <XIcon size={16} />
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-[#15151c] px-4 py-2.5 scrollbar-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'security', label: 'Security' },
                { id: 'fileserver', label: 'File Server' },
                { id: 'automations', label: 'Automations' },
                { id: 'reminders', label: 'Reminders' },
              ].map((cat) => {
                const active = categoryFilter === cat.id;
                const count =
                  cat.id === 'all'
                    ? notifications.length
                    : notifications.filter((n) => n.category === cat.id).length;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={cx(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                      active
                        ? 'bg-accent text-white shadow-sm'
                        : 'bg-[#202029] text-[#9b9ba8] hover:bg-[#282834] hover:text-white',
                    )}
                  >
                    <span>{cat.label}</span>
                    {count > 0 && (
                      <span className={cx('text-[10.5px] font-mono', active ? 'text-white/80' : 'text-[#7a7a88]')}>
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Notification Items List - Opaque, high contrast cards */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {filtered.length === 0 ? (
                <div className="py-20 text-center text-[#8e8e9c] font-serif italic text-sm">
                  No notifications in this category.
                </div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    className={cx(
                      'group relative rounded-xl border p-3.5 transition-all',
                      item.read
                        ? 'border-white/5 bg-[#17171e]'
                        : 'border-white/15 bg-[#1e1e27] shadow-md ring-1 ring-white/5',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#252532]">
                        {item.category === 'security' ? (
                          <ShieldIcon size={14} className="text-rose-400" />
                        ) : item.category === 'fileserver' ? (
                          <ServerIcon size={14} className="text-teal-400" />
                        ) : item.category === 'automations' ? (
                          <SparkIcon size={14} className="text-indigo-400" />
                        ) : (
                          <BellIcon size={14} className="text-amber-400" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <h4
                            className={cx(
                              'text-[13px] font-semibold truncate',
                              item.read ? 'text-[#c6c6d2]' : 'text-white',
                            )}
                          >
                            {item.title}
                          </h4>
                          <span className="font-mono text-[10.5px] text-[#868694] shrink-0 tabular-nums">
                            {timeOf(new Date(item.timestamp))}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-[#a4a4b2] leading-relaxed line-clamp-3">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Metadata & Actions row */}
                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-[#808090]">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a9a]">
                        {item.category}
                      </span>
                      <div className="flex items-center gap-3">
                        {!item.read && (
                          <button
                            type="button"
                            onClick={() => void window.smaran.notifications.markRead(item.id)}
                            className="text-xs font-medium text-accent hover:underline"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void window.smaran.notifications.delete(item.id)}
                          className="text-xs text-[#808090] hover:text-rose-400 transition-colors"
                          title="Remove notification"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          <Dialog
            open={confirmClear}
            title="Clear Notification Inbox?"
            onClose={() => setConfirmClear(false)}
            actions={
              <>
                <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    void window.smaran.notifications.clear();
                    setConfirmClear(false);
                  }}
                >
                  Clear Inbox
                </Button>
              </>
            }
          >
            This clears all alerts from your notification inbox. Your permanent audit records in History will remain preserved.
          </Dialog>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
