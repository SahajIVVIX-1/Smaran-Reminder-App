import { format } from 'date-fns';
import { useEffect, useState, type ReactNode } from 'react';
import { createReminder } from '@shared/defaults';
import { fontFaceCss, fontStack } from '@shared/fonts';
import type { Route } from '@shared/ipc';
import type { Settings as SettingsT } from '@shared/schema';
import { ContextMenuHost } from './components/ContextMenu';
import { ReminderEditor } from './components/ReminderEditor';
import { cx } from './cx';
import {
  ArrowUpIcon,
  BellIcon,
  ClockIcon,
  GearIcon,
  MoonIcon,
  PlusIcon,
  SparkIcon,
  SunIcon,
} from './icons';
import { History } from './pages/History';
import { Reminders } from './pages/Reminders';
import { Settings } from './pages/Settings';
import { Today } from './pages/Today';
import { defaultRule } from './rules';
import { selectBusy, useApp } from './store';
import type { SceneKey } from '@shared/dots/dotsScenes';
import type { LogoState } from '@shared/logoState';
import { SmaranDots } from '../dots';
import { useExit } from './useExit';
import { Button, Dialog, Switch } from './ui';

const NAV: { route: Route; label: string; icon: ReactNode }[] = [
  { route: 'today', label: 'Today', icon: <SunIcon size={16} /> },
  { route: 'reminders', label: 'Reminders', icon: <BellIcon size={16} /> },
  { route: 'history', label: 'History', icon: <ClockIcon size={16} /> },
];

/** Applies light/dark to the page and tells main, so the window's caption buttons match. */
function useTheme(theme: SettingsT['theme'] | undefined) {
  useEffect(() => {
    if (!theme) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      window.smaran.app.setTheme(dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

export function App() {
  const config = useApp((s) => s.config);
  const route = useApp((s) => s.route);
  const { init, external, setHistory, go, edit, refreshNext } = useApp.getState();

  useTheme(config?.settings.theme);

  // The chosen font, and @font-face rules for font files the user added.
  const font = config?.settings.font;
  const custom = useApp((s) => s.fonts?.custom);
  useEffect(() => {
    if (font) document.documentElement.style.setProperty('--font-app', fontStack(font));
  }, [font]);
  useEffect(() => {
    let style = document.getElementById('smaran-faces');
    if (!style) {
      style = document.createElement('style');
      style.id = 'smaran-faces';
      document.head.appendChild(style);
    }
    style.textContent = fontFaceCss(custom ?? []);
  }, [custom]);
  useEffect(() => {
    void useApp.getState().loadFonts();
  }, []);

  // Windows 11: the window has an acrylic backdrop, so the page goes translucent.
  useEffect(() => {
    void window.smaran.app
      .info()
      .then((info) => document.documentElement.classList.toggle('glass', info.glass));
  }, []);

  useEffect(() => {
    void Promise.all([window.smaran.config.get(), window.smaran.history.get()]).then(([c, h]) =>
      init(c, h),
    );
    const offs = [
      window.smaran.config.onChanged(external),
      window.smaran.history.onChanged(setHistory),
      window.smaran.app.onNavigate(go),
    ];
    const timer = window.setInterval(() => void refreshNext(), 30_000);
    return () => {
      offs.forEach((off) => off());
      window.clearInterval(timer);
    };
  }, [init, external, setHistory, go, refreshNext]);

  // Ctrl+N: new reminder from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        edit({ mode: 'new', draft: createReminder({ title: '', rule: defaultRule('daily') }) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edit]);

  return (
    <div className="flex h-full flex-col bg-side text-ink">
      {/* Title bar: draggable; Windows draws the caption buttons on the right. */}
      <div className="drag flex h-9 shrink-0 items-center gap-2 pl-4 select-none">
        <Logo />
        <span className="font-serif text-[14px] font-semibold text-muted">Smaran</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-w-0 flex-1 overflow-hidden rounded-tl-xl border-t border-l border-line bg-bg">
          <div key={route} className="h-full animate-fade overflow-y-auto">
            {!config ? null : route === 'today' ? (
              <Today />
            ) : route === 'reminders' ? (
              <Reminders />
            ) : route === 'history' ? (
              <History />
            ) : (
              <Settings />
            )}
          </div>
        </main>
      </div>

      <ReminderEditor />
      <ToastView />
      <ContextMenuHost />
      <Welcome open={!!config && !config.settings.onboarded} />
    </div>
  );
}

/** What the title-bar dots show for each app state; idle lets them dance and form shapes. */
const TITLE_SCENES: Record<LogoState, SceneKey | undefined> = {
  alert: 'bell-ring',
  done: 'check',
  snoozed: 'hourglass',
  startup: 's-mark',
  paused: 'moon',
  quiet: 'moon',
  soon: 'clock',
  idle: undefined,
};

/** The Smaran dots in the title bar, following the same state as the tray icon. */
function Logo() {
  const busy = useApp(selectBusy);
  const [state, setState] = useState<LogoState>('startup');
  useEffect(() => {
    void window.smaran.logo.get().then(setState);
    return window.smaran.logo.onState(setState);
  }, []);
  return <SmaranDots size={24} scene={busy ? 'bounce' : TITLE_SCENES[state]} />;
}

function Sidebar() {
  const route = useApp((s) => s.route);
  const config = useApp((s) => s.config);
  const { go, edit } = useApp.getState();
  const pausedUntil = config?.settings.pausedUntil;
  const paused = pausedUntil ? new Date(pausedUntil) > new Date() : false;

  return (
    <nav className="flex w-[208px] shrink-0 flex-col px-2.5 pt-1.5 pb-2.5" aria-label="Main">
      <button
        type="button"
        onClick={() =>
          edit({ mode: 'new', draft: createReminder({ title: '', rule: defaultRule('daily') }) })
        }
        className="mb-3 flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-accent transition-colors duration-150 hover:bg-accent-soft"
        title="New Reminder (Ctrl+N)"
      >
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-accent text-on-accent">
          <PlusIcon size={14} strokeWidth={2.4} />
        </span>
        New Reminder
      </button>

      {NAV.map((item) => (
        <NavItem
          key={item.route}
          active={route === item.route}
          onClick={() => go(item.route)}
          icon={item.icon}
        >
          {item.label}
        </NavItem>
      ))}

      <div className="mt-auto space-y-1">
        <div className="mb-1 rounded-lg px-2.5 py-2 text-[12px]">
          {paused && pausedUntil ? (
            <div className="flex items-center gap-2">
              <MoonIcon size={15} className="shrink-0 text-accent" />
              <span className="flex-1 leading-tight text-muted">
                Paused
                {new Date(pausedUntil).getFullYear() > 9000
                  ? ''
                  : ` until ${format(new Date(pausedUntil), 'HH:mm')}`}
              </span>
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => void window.smaran.app.resume()}
              >
                Resume
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/40 [animation-duration:2.4s]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
              </span>
              Reminders are on
            </div>
          )}
        </div>
        <NavItem
          active={route === 'settings'}
          onClick={() => go('settings')}
          icon={<GearIcon size={16} />}
        >
          Settings
        </NavItem>
      </div>
    </nav>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cx(
        'flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150',
        active ? 'bg-hover font-medium text-ink' : 'text-muted hover:bg-hover hover:text-ink',
      )}
    >
      <span className={active ? 'text-ink' : 'text-faint'}>{icon}</span>
      {children}
    </button>
  );
}

function ToastView() {
  const current = useApp((s) => s.toast);
  const { dismissToast } = useApp.getState();
  // The last toast stays on screen while it animates away.
  const [toast, setToast] = useState(current);
  if (current && current !== toast) setToast(current);
  const { mounted, closing } = useExit(current !== null, 180);
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(dismissToast, current.undo ? 7000 : 3200);
    return () => window.clearTimeout(t);
  }, [current, dismissToast]);
  if (!mounted || !toast) return null;
  return (
    // Centred by the wrapper, so the slide animation can use transform freely.
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center">
      <div
        key={toast.id}
        role="status"
        className={cx(
          'pointer-events-auto flex items-center gap-4 rounded-xl border border-line bg-sheet px-4 py-2 text-[12.5px] text-ink shadow-xl backdrop-blur-xl',
          closing ? 'animate-sink' : 'animate-rise',
          toast.tone === 'error' && 'text-danger',
        )}
      >
        <span className="max-w-[520px] truncate">{toast.text}</span>
        {toast.undo && (
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={() => {
              toast.undo?.();
              dismissToast();
            }}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

/** First run: a short, friendly welcome. */
function Welcome({ open }: { open: boolean }) {
  const config = useApp((s) => s.config);
  const { setSettings, go } = useApp.getState();
  const [login, setLogin] = useState(config?.settings.startAtLogin ?? true);

  const finish = (importFile: boolean) => {
    setSettings((s) => ({ ...s, startAtLogin: login, onboarded: true }));
    if (importFile) {
      go('settings');
      window.setTimeout(() => void window.smaran.backup.import('add'), 500);
    }
  };

  return (
    <Dialog
      open={open}
      title="Welcome to Smaran"
      wide
      actions={
        <>
          <Button variant="ghost" onClick={() => finish(true)}>
            Import Older Reminders…
          </Button>
          <Button variant="primary" onClick={() => finish(false)}>
            Get Started
          </Button>
        </>
      }
    >
      <p className="-mt-1 font-serif text-[15.5px] text-muted italic">
        Gentle reminders, on your schedule.
      </p>
      <ul className="mt-5 space-y-4">
        <WelcomePoint icon={<SparkIcon size={15} />} title="Type it the way you’d say it">
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Example>stretch every 45 min</Example>
            <Example>call mom at 6pm</Example>
          </span>
        </WelcomePoint>
        <WelcomePoint icon={<BellIcon size={15} />} title="Reminders come to you">
          They slide in on your screen. Press <b className="font-semibold text-ink">Done</b>, or{' '}
          <b className="font-semibold text-ink">Snooze</b> for later.
        </WelcomePoint>
        <WelcomePoint icon={<ArrowUpIcon size={15} />} title="Smaran stays in the tray">
          Closing this window keeps your reminders running.
        </WelcomePoint>
      </ul>
      <div className="mt-5 flex items-center gap-4 border-t border-line pt-4">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium text-ink">Start When I Sign In</div>
          <div className="font-serif text-[13px] text-muted italic">
            Smaran opens quietly in the tray with Windows.
          </div>
        </div>
        <Switch label="Start Smaran when I sign in" checked={login} onChange={setLogin} />
      </div>
      <p className="mt-4 font-serif text-[13px] text-faint italic">
        Two example reminders are ready for you. Edit or delete them any time.
      </p>
    </Dialog>
  );
}

/** One point on the welcome screen: an icon tile, a short title and a line under it. */
function WelcomePoint({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
        {icon}
      </span>
      <div className="min-w-0 pt-px">
        <div className="text-[13.5px] font-semibold text-ink">{title}</div>
        <div className="text-[13px] leading-snug text-muted">{children}</div>
      </div>
    </li>
  );
}

const Example = ({ children }: { children: ReactNode }) => (
  <code className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-[11.5px] text-ink">
    {children}
  </code>
);
