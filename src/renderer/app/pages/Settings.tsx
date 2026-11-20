import { format } from 'date-fns';
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { AppInfo, BackupResult } from '@shared/ipc';
import type { FileServerSettings, ServerStatus } from '@shared/fileserver';
import { CORNERS, type Settings as SettingsT } from '@shared/schema';
import { tabVariants } from '../animations';
import { cx } from '../cx';
import { useApp } from '../store';
import { CardShape } from '../components/CardShape';
import { FontPicker } from '../components/FontPicker';
import { NotificationMotionSettings } from '../components/NotificationMotionSettings';
import { Select } from '../components/Select';
import { LogoSettingsCard } from '../components/LogoSettings';
import { TimeField } from '../components/TimeField';
import { Button, Card, NumberField, Row, Segmented, Slider, Switch } from '../ui';
import {
  BellIcon,
  GearIcon,
  ServerIcon,
  SparkIcon,
} from '../icons';

const CORNER_LABEL: Record<SettingsT['notification']['corner'], string> = {
  'top-right': 'Top right',
  'bottom-right': 'Bottom right',
  'top-left': 'Top left',
  'bottom-left': 'Bottom left',
  'top-center': 'Top centre',
};

function thicknessLabel(px: number): string {
  if (px <= 1) return 'Hairline (Ultra Thin)';
  if (px <= 2) return 'Very Thin';
  if (px <= 4) return 'Thin';
  if (px <= 8) return 'Medium';
  if (px <= 14) return 'Thick';
  return 'Very Thick';
}

type SettingsTab = 'system' | 'reminders' | 'automations' | 'fileserver';

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: (props: { size?: number; className?: string }) => ReactNode;
}

const SETTINGS_TABS: readonly TabItem[] = [
  { id: 'system', label: 'System', icon: GearIcon },
  { id: 'reminders', label: 'Reminders', icon: BellIcon },
  { id: 'automations', label: 'Automations', icon: SparkIcon },
  { id: 'fileserver', label: 'File Server', icon: ServerIcon },
];

/** A little screen with the five places a notification can appear. */
function CornerPicker({
  value,
  onChange,
}: {
  value: SettingsT['notification']['corner'];
  onChange: (c: SettingsT['notification']['corner']) => void;
}) {
  const place: Record<SettingsT['notification']['corner'], string> = {
    'top-left': 'top-2 left-2',
    'top-center': 'top-2 left-1/2 -translate-x-1/2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };
  return (
    <div
      className="relative h-[92px] w-[150px] rounded-lg border border-line bg-raised"
      role="radiogroup"
      aria-label="Position"
    >
      {CORNERS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={CORNER_LABEL[c]}
          title={CORNER_LABEL[c]}
          onClick={() => onChange(c)}
          className={cx(
            'absolute h-4 w-9 rounded-[5px] transition-colors duration-150',
            place[c],
            value === c ? 'bg-accent' : 'bg-line hover:bg-faint/60',
          )}
        />
      ))}
    </div>
  );
}

const STAY_PRESETS = [5, 8, 12, 20, 30, 60, 120];

export function Settings() {
  const config = useApp((s) => s.config);
  const { setSettings } = useApp.getState();
  const [tab, setTab] = useState<SettingsTab>('system');
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [customHideSec, setCustomHideSec] = useState(
    () =>
      config?.settings.notification.hideAfterSec !== null &&
      config?.settings.notification.hideAfterSec !== undefined &&
      !STAY_PRESETS.includes(config.settings.notification.hideAfterSec),
  );

  // File Server Settings state
  const [fsSettings, setFsSettings] = useState<FileServerSettings | null>(null);
  const [fsStatus, setFsStatus] = useState<ServerStatus | null>(null);
  const [fsFeedback, setFsFeedback] = useState<string | null>(null);

  useEffect(() => {
    void window.smaran.app.info().then(setInfo);
    void window.smaran.fileserver.getSettings().then(setFsSettings);
    void window.smaran.fileserver.status().then(setFsStatus);

    const offStatus = window.smaran.fileserver.onStatusChanged((status) => {
      setFsStatus(status);
    });

    return () => {
      offStatus();
    };
  }, []);

  if (!config) return null;
  const s = config.settings;
  const n = s.notification;
  const a = s.automation ?? {
    enabled: true,
    paused: false,
    notifyPreExecution: true,
    preExecutionCountdownSec: 5,
    notifyOnFailure: true,
    notifyOnSuccess: false,
    sound: true,
  };

  const setN = (patch: Partial<SettingsT['notification']>) =>
    setSettings((x) => ({ ...x, notification: { ...x.notification, ...patch } }));

  const setA = (patch: Partial<SettingsT['automation']>) =>
    setSettings((x) => ({ ...x, automation: { ...(x.automation ?? a), ...patch } }));

  const updateFs = async (patch: Partial<FileServerSettings>) => {
    try {
      const updated = await window.smaran.fileserver.saveSettings(patch);
      setFsSettings(updated);
      setFsFeedback('Saved');
      setTimeout(() => setFsFeedback(null), 2000);
    } catch (err: unknown) {
      setFsFeedback(err instanceof Error ? err.message : 'Error updating server settings');
    }
  };

  const paused = s.pausedUntil && new Date(s.pausedUntil) > new Date();

  const runBackup = async (action: () => Promise<BackupResult>) => {
    const r = await useApp.getState().track(action());
    if (!r.ok) setBackupMsg({ tone: 'error', text: r.error });
    else if (r.detail) setBackupMsg({ tone: 'ok', text: r.detail });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = SETTINGS_TABS.findIndex((t) => t.id === tab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = SETTINGS_TABS[(currentIndex + 1) % SETTINGS_TABS.length];
      if (next) setTab(next.id);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = SETTINGS_TABS[(currentIndex - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length];
      if (prev) setTab(prev.id);
    }
  };

  return (
    <div className="mx-auto max-w-[760px] space-y-5 px-7 pt-8 pb-16">
      <header className="animate-enter">
        <h1 className="font-serif text-[26px] leading-tight">Settings</h1>
        <p className="mt-1 font-serif text-[14.5px] text-muted italic">
          Unified system, reminders, automation and file server preferences.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Settings categories"
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 rounded-xl border border-line bg-raised/70 p-1 animate-enter [animation-delay:20ms]"
      >
        {SETTINGS_TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`settings-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`settings-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={cx(
                'flex flex-1 items-center justify-center gap-2 rounded-lg py-1.5 px-3 text-[13px] font-medium transition-all duration-150 whitespace-nowrap',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                active
                  ? 'bg-surface text-ink shadow-sm ring-1 ring-line'
                  : 'text-muted hover:bg-hover/60 hover:text-ink',
              )}
            >
              <Icon size={15} className={active ? 'text-accent' : 'text-faint'} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          role="tabpanel"
          id={`settings-panel-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
          variants={tabVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {/* ==================== A. SYSTEM SETTINGS ==================== */}
          {tab === 'system' && (
            <div className="space-y-6">
              <Card title="Application Startup & Behavior" description="System integration and appearance.">
                <Row
                  label="Start with Windows"
                  hint="Smaran starts automatically in the system tray when you sign in."
                  htmlFor="set-login"
                >
                  <Switch
                    id="set-login"
                    label="Start with Windows"
                    checked={s.startAtLogin}
                    onChange={(v) => setSettings((x) => ({ ...x, startAtLogin: v }))}
                  />
                </Row>
                <Row
                  label="Appearance Theme"
                  hint="Select light, dark, or follow your Windows system color scheme."
                >
                  <Segmented
                    label="Appearance"
                    value={s.theme}
                    onChange={(theme) => setSettings((x) => ({ ...x, theme }))}
                    options={[
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                      { value: 'system', label: 'System' },
                    ]}
                  />
                </Row>
                <Row
                  label="Text Font"
                  hint="For text and buttons. Titles stay in Anthropic Serif, times in Anthropic Mono."
                >
                  <FontPicker value={s.font} onChange={(font) => setSettings((x) => ({ ...x, font }))} />
                </Row>
              </Card>

              <Card
                title="Data Storage & Backup"
                description="Your reminders, automations, and settings are stored locally on this PC."
              >
                <Row label="Export backup" hint="Save complete configuration and reminders to a JSON file.">
                  <Button onClick={() => void runBackup(() => window.smaran.backup.export())}>
                    Back Up…
                  </Button>
                </Row>
                <Row label="Restore backup" hint="Replace your current reminders and configuration with a backup.">
                  <Button onClick={() => void runBackup(() => window.smaran.backup.import('replace'))}>
                    Restore…
                  </Button>
                </Row>
                <Row label="Import & Merge" hint="Add reminders from an external file without replacing current ones.">
                  <Button onClick={() => void runBackup(() => window.smaran.backup.import('add'))}>
                    Choose File…
                  </Button>
                </Row>
                <Row label="Data folder" hint={info?.dataFolder || 'Local data storage directory'}>
                  <Button variant="ghost" onClick={() => void window.smaran.app.openDataFolder()}>
                    Open Folder
                  </Button>
                </Row>
                {backupMsg && (
                  <p
                    role="status"
                    className={cx(
                      'animate-fade py-2 text-[12.5px] whitespace-pre-wrap',
                      backupMsg.tone === 'error' ? 'text-danger' : 'text-ok',
                    )}
                  >
                    {backupMsg.text}
                  </p>
                )}
              </Card>

              <Card title="Diagnostics & System Information" description="Runtime environment and versions.">
                <Row label="Smaran Version" hint={`Version ${info?.version ?? '3.4.0'} · ${info?.portable ? 'Portable Edition' : 'Installed Application'}`}>
                  <span className="font-mono text-xs text-muted">v{info?.version ?? '3.4.0'}</span>
                </Row>
                <Row label="Electron Framework" hint={`Chromium & Node.js runtime (v${info?.electron ?? 'process'})`}>
                  <span className="font-mono text-xs text-muted">Electron {info?.electron ?? ''}</span>
                </Row>
              </Card>
            </div>
          )}

          {/* ==================== B. REMINDER SETTINGS ==================== */}
          {tab === 'reminders' && (
            <div className="space-y-6">
              <Card
                title="Focus & Quiet Hours"
                description="Keep reminders gentle and non-disruptive when you need to concentrate."
              >
                <Row
                  label="Quiet Hours"
                  hint={
                    s.quietHours.enabled
                      ? 'Repeating reminders are skipped; timed ones wait until quiet hours end.'
                      : 'Disabled'
                  }
                  htmlFor="set-quiet"
                >
                  {s.quietHours.enabled && (
                    <span className="flex items-center gap-2 text-[13px] text-muted">
                      <TimeField
                        label="Quiet from"
                        value={s.quietHours.from}
                        onChange={(from) =>
                          setSettings((x) => ({ ...x, quietHours: { ...x.quietHours, from } }))
                        }
                      />
                      to
                      <TimeField
                        label="Quiet until"
                        value={s.quietHours.to}
                        onChange={(to) =>
                          setSettings((x) => ({ ...x, quietHours: { ...x.quietHours, to } }))
                        }
                      />
                    </span>
                  )}
                  <Switch
                    id="set-quiet"
                    label="Quiet Hours"
                    checked={s.quietHours.enabled}
                    onChange={(enabled) =>
                      setSettings((x) => ({ ...x, quietHours: { ...x.quietHours, enabled } }))
                    }
                  />
                </Row>
                <Row
                  label="Wait while in full-screen apps"
                  hint="Games, videos and presentations: hold reminder until you return."
                  htmlFor="set-busy"
                >
                  <Switch
                    id="set-busy"
                    label="Hold while busy"
                    checked={s.holdWhenBusy}
                    onChange={(holdWhenBusy) => setSettings((x) => ({ ...x, holdWhenBusy }))}
                  />
                </Row>
                <Row
                  label="Global Reminder Pause"
                  hint={
                    paused && s.pausedUntil
                      ? new Date(s.pausedUntil).getFullYear() > 9000
                        ? 'Paused until you resume'
                        : `Paused until ${format(new Date(s.pausedUntil), 'HH:mm')}`
                      : 'Reminders are active'
                  }
                >
                  {paused ? (
                    <Button onClick={() => void window.smaran.app.resume()}>Resume</Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void window.smaran.app.pause(60)}>
                        1 hour
                      </Button>
                      <Button size="sm" onClick={() => void window.smaran.app.pause(180)}>
                        3 hours
                      </Button>
                      <Button size="sm" onClick={() => void window.smaran.app.pause()}>
                        Until Resumed
                      </Button>
                    </div>
                  )}
                </Row>
              </Card>

              <Card
                title="Reminder Notification Appearance"
                description="Customize how notification cards and attention effects display."
              >
                <Row label="Screen Corner" hint={CORNER_LABEL[n.corner]}>
                  <CornerPicker value={n.corner} onChange={(corner) => setN({ corner })} />
                </Row>
                <Row label="Target Screen" htmlFor="set-screen">
                  <Select
                    id="set-screen"
                    className="w-64"
                    value={n.screen}
                    options={[
                      { value: 'primary', label: 'Primary Monitor' },
                      { value: 'cursor', label: 'Screen with Mouse Cursor' },
                    ]}
                    onChange={(screen) => setN({ screen })}
                  />
                </Row>
                <Row label="Card Size">
                  <Segmented
                    label="Size"
                    value={n.size}
                    onChange={(size) => setN({ size })}
                    options={[
                      { value: 'compact', label: 'Compact' },
                      { value: 'comfortable', label: 'Comfortable' },
                      { value: 'large', label: 'Large' },
                    ]}
                  />
                </Row>
                <NotificationMotionSettings
                  motion={n.motion}
                  onChange={(motion) => setN({ motion })}
                />
                <CardShape n={n} onChange={(card) => setN({ card })} />
                <Row
                  label="Display Duration"
                  hint={
                    n.hideAfterSec === null
                      ? 'Cards stay on screen until dismissed, snoozed, or completed.'
                      : 'Hides automatically after the configured duration.'
                  }
                >
                  <div className="flex flex-col gap-2.5">
                    <Segmented<'timed' | 'permanent'>
                      label="Duration Mode"
                      value={n.hideAfterSec === null ? 'permanent' : 'timed'}
                      options={[
                        { value: 'timed', label: 'Timed' },
                        { value: 'permanent', label: 'Permanent' },
                      ]}
                      onChange={(mode) =>
                        setN({ hideAfterSec: mode === 'permanent' ? null : 8 })
                      }
                    />
                    {n.hideAfterSec !== null && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Select<number>
                          id="set-hide"
                          className="w-36"
                          value={
                            customHideSec || !STAY_PRESETS.includes(n.hideAfterSec)
                              ? -1
                              : n.hideAfterSec
                          }
                          options={[
                            { value: 5, label: '5 seconds' },
                            { value: 8, label: '8 seconds' },
                            { value: 12, label: '12 seconds' },
                            { value: 20, label: '20 seconds' },
                            { value: 30, label: '30 seconds' },
                            { value: 60, label: '1 minute' },
                            { value: 120, label: '2 minutes' },
                            { value: -1, label: 'Custom…' },
                          ]}
                          onChange={(sec) => {
                            if (sec === -1) {
                              setCustomHideSec(true);
                            } else {
                              setCustomHideSec(false);
                              setN({ hideAfterSec: sec });
                            }
                          }}
                        />
                        {(customHideSec || !STAY_PRESETS.includes(n.hideAfterSec)) && (
                          <NumberField
                            label="Seconds on screen"
                            value={n.hideAfterSec}
                            min={3}
                            max={600}
                            suffix="seconds"
                            onChange={(hideAfterSec) => setN({ hideAfterSec })}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </Row>
                <Row label="Notification Sound" hint="Gentle audible chime on appearance." htmlFor="set-sound">
                  <Switch
                    id="set-sound"
                    label="Sound chime"
                    checked={n.sound}
                    onChange={(sound) => setN({ sound })}
                  />
                </Row>
                <div className="border-b border-line py-2.5 last:border-b-0">
                  <div className="flex min-h-12 items-center gap-6">
                    <div className="min-w-0 flex-1">
                      <label htmlFor="set-border-light" className="block text-[13px]">
                        Screen border light beam
                      </label>
                      <p className="mt-0.5 font-serif text-[13px] leading-snug text-muted italic">
                        Glowing accent along your display edge while notifications are active.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {(n.borderLight ?? true) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void window.smaran.reminders.previewBorderLight()}
                        >
                          Preview Beam
                        </Button>
                      )}
                      <Switch
                        id="set-border-light"
                        label="Screen border light"
                        checked={n.borderLight ?? true}
                        onChange={(borderLight) => setN({ borderLight })}
                      />
                    </div>
                  </div>
                  {(n.borderLight ?? true) && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span>Beam thickness ({n.borderLightThickness ?? 4} px)</span>
                          <span>{thicknessLabel(n.borderLightThickness ?? 4)}</span>
                        </div>
                        <Slider
                          label="Thickness"
                          value={n.borderLightThickness ?? 4}
                          min={1}
                          max={24}
                          step={1}
                          suffix=" px"
                          onChange={(borderLightThickness) => setN({ borderLightThickness })}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span>Brightness intensity</span>
                          <span>{n.borderLightBrightness ?? 150}%</span>
                        </div>
                        <Segmented<'100' | '150' | '200'>
                          label="Brightness"
                          value={String(n.borderLightBrightness ?? 150) as '100' | '150' | '200'}
                          onChange={(b) => setN({ borderLightBrightness: Number(b) })}
                          options={[
                            { value: '100', label: 'Normal (100%)' },
                            { value: '150', label: 'Vivid (150%)' },
                            { value: '200', label: 'Ultra (200%)' },
                          ]}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <Row label="Preview Notification">
                  <Button
                    onClick={() =>
                      void window.smaran.reminders.test({
                        title: 'Reminder Preview',
                        body: 'This is how your customized notification appears.',
                        color: 'clay',
                        important: false,
                      })
                    }
                  >
                    Send Test Notification
                  </Button>
                </Row>
              </Card>

              <LogoSettingsCard />
            </div>
          )}

          {/* ==================== C. AUTOMATION SETTINGS ==================== */}
          {tab === 'automations' && (
            <div className="space-y-6">
              <Card
                title="Automation Execution"
                description="Automate apps, links, scripts, and power actions based on schedules and system events."
              >
                <Row
                  label="Enable Automations"
                  hint="Master switch to activate or pause all configured background automations."
                  htmlFor="set-auto-enable"
                >
                  <Switch
                    id="set-auto-enable"
                    label="Enable automations"
                    checked={a.enabled}
                    onChange={(enabled) => setA({ enabled })}
                  />
                </Row>
                <Row
                  label="Global Automation Pause"
                  hint="Temporarily stop all scheduled automations without disabling individual items."
                  htmlFor="set-auto-pause"
                >
                  <Switch
                    id="set-auto-pause"
                    label="Pause automations"
                    checked={a.paused}
                    onChange={(paused) => setA({ paused })}
                  />
                </Row>
              </Card>

              <Card
                title="Smart Pre-Execution Notification System"
                description="Display desktop countdown cards before any automation action is executed."
              >
                <Row
                  label="Pre-execution countdown notification"
                  hint="Shows a notification before executing the action, giving you time to cancel or run immediately."
                  htmlFor="set-auto-notify-pre"
                >
                  <Switch
                    id="set-auto-notify-pre"
                    label="Pre-execution notification"
                    checked={a.notifyPreExecution}
                    onChange={(notifyPreExecution) => setA({ notifyPreExecution })}
                  />
                </Row>
                {a.notifyPreExecution && (
                  <div className="border-b border-line py-3 last:border-b-0">
                    <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                      <span className="font-medium text-ink">Countdown Duration</span>
                      <span className="font-mono tabular-nums text-accent font-semibold">
                        {a.preExecutionCountdownSec} seconds
                      </span>
                    </div>
                    <Slider
                      label="Countdown duration"
                      value={a.preExecutionCountdownSec}
                      min={1}
                      max={60}
                      step={1}
                      suffix=" sec"
                      onChange={(preExecutionCountdownSec) => setA({ preExecutionCountdownSec })}
                    />
                    <p className="mt-1 font-serif text-[12.5px] text-muted italic">
                      Default is 5 seconds. The automation executes only after the countdown completes or when you click Run Now.
                    </p>
                  </div>
                )}
                <Row
                  label="Countdown Notification Sound"
                  hint="Play subtle audio chime when the pre-execution card appears."
                  htmlFor="set-auto-sound"
                >
                  <Switch
                    id="set-auto-sound"
                    label="Audio chime"
                    checked={a.sound}
                    onChange={(sound) => setA({ sound })}
                  />
                </Row>
                <Row
                  label="Failed Automation Alerts"
                  hint="Receive immediate desktop alert if any automation script or action encounters an error."
                  htmlFor="set-auto-notify-fail"
                >
                  <Switch
                    id="set-auto-notify-fail"
                    label="Failure alerts"
                    checked={a.notifyOnFailure}
                    onChange={(notifyOnFailure) => setA({ notifyOnFailure })}
                  />
                </Row>
              </Card>
            </div>
          )}

          {/* ==================== D. FILE SERVER SETTINGS ==================== */}
          {tab === 'fileserver' && (
            <div className="space-y-6">
              <Card
                title="Server Status & Network"
                description="Fast, zero-trust local file server and WebDAV storage for PC, phones, and LAN devices."
              >
                <Row
                  label="File Server Enabled"
                  hint={
                    fsStatus?.running
                      ? `Running on port ${fsStatus.port}. LAN addresses accessible.`
                      : 'File server is currently offline.'
                  }
                  htmlFor="set-fs-enable"
                >
                  <Switch
                    id="set-fs-enable"
                    label="Enable File Server"
                    checked={fsSettings?.enabled ?? false}
                    onChange={(enabled) => void updateFs({ enabled })}
                  />
                </Row>
                <Row
                  label="Start with Smaran"
                  hint="Automatically launch the file server whenever Smaran starts."
                  htmlFor="set-fs-autostart"
                >
                  <Switch
                    id="set-fs-autostart"
                    label="Auto-start with app"
                    checked={fsSettings?.autoStart ?? false}
                    onChange={(autoStart) => void updateFs({ autoStart, autoStartConfigured: true })}
                  />
                </Row>
                <Row
                  label="Server Port"
                  hint="Unprivileged local TCP port (1024–65535, default 5901)."
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-raised border border-line">
                      {fsSettings?.port ?? 5901}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => useApp.getState().go('fileserver')}
                    >
                      Configure Port & Root Folder…
                    </Button>
                  </div>
                </Row>
                {fsFeedback && (
                  <p className="text-xs text-accent font-medium py-1">{fsFeedback}</p>
                )}
              </Card>

              <Card
                title="Real-Time Security & Activity Notifications"
                description="Receive instant alerts on your desktop whenever clients interact with the file server."
              >
                <Row
                  label="Successful Login Alerts"
                  hint="Notify whenever a user signs into Smaran HFS with IP address, device, and LAN/External tag."
                  htmlFor="set-fs-notify-login"
                >
                  <Switch
                    id="set-fs-notify-login"
                    label="Login alerts"
                    checked={fsSettings?.notifyOnLogin ?? true}
                    onChange={(notifyOnLogin) => void updateFs({ notifyOnLogin })}
                  />
                </Row>
                <Row
                  label="Failed Login Security Alerts"
                  hint="Alerts immediately when unauthorized or incorrect credentials are submitted, tracking repeat attempts."
                  htmlFor="set-fs-notify-failed"
                >
                  <Switch
                    id="set-fs-notify-failed"
                    label="Failed login alerts"
                    checked={fsSettings?.notifyOnFailedLogin ?? true}
                    onChange={(notifyOnFailedLogin) => void updateFs({ notifyOnFailedLogin })}
                  />
                </Row>
                <Row
                  label="Administrator Activity Alerts"
                  hint="Alerts when server port, storage root, administrator account, or lifecycle changes."
                  htmlFor="set-fs-notify-admin"
                >
                  <Switch
                    id="set-fs-notify-admin"
                    label="Admin alerts"
                    checked={fsSettings?.notifyOnAdminActivity ?? true}
                    onChange={(notifyOnAdminActivity) => void updateFs({ notifyOnAdminActivity })}
                  />
                </Row>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {info && (
        <p className="animate-enter pt-2 text-center text-[12px] text-faint [animation-delay:60ms]">
          Smaran {info.version}
          {info.portable ? ' · portable' : ''}
        </p>
      )}
    </div>
  );
}
