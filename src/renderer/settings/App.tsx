import { useEffect, useState } from 'react';
import type { Config } from '@shared/schema';
import { addOnPage, deleteSelected } from './actions';
import { Button, Modal, Toggle } from './components/ui';
import { cx } from './cx';
import { AppPage } from './pages/AppPage';
import { BackupPage } from './pages/BackupPage';
import { MessagesPage } from './pages/MessagesPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { StylesPage } from './pages/StylesPage';
import { isDirty, useSettings, type Page } from './store';

const PAGES: { id: Page; label: string }[] = [
  { id: 'messages', label: 'Messages' },
  { id: 'styles', label: 'Styles' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'app', label: 'App' },
  { id: 'backup', label: 'Backup' },
];

function useTheme(theme: Config['app']['theme'] | undefined) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme !== 'light' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  );
}

export function App() {
  const draft = useSettings((s) => s.draft);
  const saved = useSettings((s) => s.saved);
  const page = useSettings((s) => s.page);
  const saveErrors = useSettings((s) => s.saveErrors);
  const dirty = useSettings((s) => isDirty(s));
  const { init, external, setPage, select, save, discard } = useSettings.getState();

  useTheme(saved?.app.theme);

  // Load, then follow every write from main (popup drags, scheduler, imports).
  useEffect(() => {
    void window.smaran.config.get().then(init);
    const offChanged = window.smaran.config.onChanged(external);
    const offFocus = window.smaran.settings.onFocusMessage((id) => {
      setPage('messages');
      select('messages', id);
    });
    return () => {
      offChanged();
      offFocus();
    };
  }, [init, external, setPage, select]);

  // Main asks before closing the window with unsaved changes.
  useEffect(() => {
    window.smaran.settings.setDirty(dirty);
  }, [dirty]);

  // Ctrl+S save, Ctrl+N new, Delete removes the selected item.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { page: current } = useSettings.getState();
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        addOnPage(current);
      } else if (e.key === 'Delete' && !isTyping(e.target)) {
        if (current === 'messages' || current === 'schedules') deleteSelected(current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  if (!draft) return <div className="p-6 text-muted">Loading…</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <nav
          className="flex w-48 shrink-0 flex-col gap-0.5 border-r border-line bg-panel p-3"
          aria-label="Settings pages"
        >
          <div className="mb-4 px-2 text-lg font-semibold">Smaran</div>
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={page === p.id ? 'page' : undefined}
              onClick={() => setPage(p.id)}
              className={cx(
                'rounded-md px-3 py-2 text-left text-sm',
                page === p.id
                  ? 'bg-accent/15 font-medium text-ink'
                  : 'text-muted hover:bg-raised hover:text-ink',
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="mt-auto" />
        </nav>
        <main className="min-w-0 flex-1">
          {page === 'messages' && <MessagesPage />}
          {page === 'styles' && <StylesPage />}
          {page === 'schedules' && <SchedulesPage />}
          {page === 'app' && <AppPage />}
          {page === 'backup' && <BackupPage />}
        </main>
      </div>

      <footer className="flex items-center gap-3 border-t border-line bg-panel px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm text-muted" data-testid="save-state">
          <span
            aria-hidden
            className={cx('inline-block h-2.5 w-2.5 rounded-full', dirty ? 'bg-accent' : 'bg-line')}
          />
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        {saveErrors.length > 0 && (
          <span
            role="alert"
            className="min-w-0 flex-1 truncate text-sm text-danger"
            title={saveErrors.join('\n')}
          >
            Can’t save: {saveErrors[0]}
            {saveErrors.length > 1 ? ` (and ${saveErrors.length - 1} more)` : ''}
          </span>
        )}
        <span className="flex-1" />
        <Button disabled={!dirty} onClick={discard}>
          Discard
        </Button>
        <Button tone="primary" disabled={!dirty} onClick={() => void save()} title="Ctrl+S">
          Save
        </Button>
      </footer>

      <ToastView />
      {!draft.app.onboarded && <Onboarding />}
    </div>
  );
}

function ToastView() {
  const toast = useSettings((s) => s.toast);
  const { dismissToast } = useSettings.getState();
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(dismissToast, toast.undo ? 8000 : 2500);
    return () => window.clearTimeout(t);
  }, [toast, dismissToast]);
  if (!toast) return null;
  return (
    <div
      role="status"
      className={cx(
        'fixed right-4 bottom-16 z-40 flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-2.5 text-sm shadow-xl',
        toast.tone === 'error' && 'text-danger',
      )}
    >
      {toast.text}
      {toast.undo && (
        <Button
          small
          onClick={() => {
            toast.undo?.();
            dismissToast();
          }}
        >
          Undo
        </Button>
      )}
    </div>
  );
}

/** First run: a short welcome with the two choices that matter. Saves straight away. */
function Onboarding() {
  const draft = useSettings((s) => s.draft);
  const { edit, save, setPage } = useSettings.getState();
  const [startAtLogin, setStartAtLogin] = useState(draft?.app.startAtLogin ?? true);

  const finish = async (importV1: boolean) => {
    edit((c) => ({ ...c, app: { ...c.app, startAtLogin, onboarded: true } }));
    await save();
    if (importV1) {
      setPage('backup');
      await window.smaran.backup.import('v1');
    }
  };

  return (
    <Modal
      title="Welcome to Smaran"
      actions={
        <>
          <Button onClick={() => void finish(true)}>Import v1 settings…</Button>
          <Button tone="primary" onClick={() => void finish(false)}>
            Get started
          </Button>
        </>
      }
    >
      <p className="mb-3">
        Smaran shows your reminders as small popups on a schedule. It lives in the tray (bottom
        right of the taskbar): click the icon to open these settings, or right-click it to pause.
      </p>
      <label className="flex items-center gap-3 py-2">
        <Toggle label="Start at login" checked={startAtLogin} onChange={setStartAtLogin} />
        Start Smaran when I sign in to Windows
      </label>
      <p className="text-xs text-muted">
        Used Smaran v1? Import your old smaran_settings.json to bring your messages across.
      </p>
    </Modal>
  );
}
