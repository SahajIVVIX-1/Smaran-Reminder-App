import { format } from 'date-fns';
import { useEffect, useState, type ReactNode } from 'react';
import type { AppInfo, BackupResult } from '@shared/ipc';
import { CORNERS, type Settings as SettingsT } from '@shared/schema';
import { cx } from '../cx';
import { useApp } from '../store';
import { CardShape } from '../components/CardShape';
import { FontPicker } from '../components/FontPicker';
import { NotificationMotionSettings } from '../components/NotificationMotionSettings';
import { Select } from '../components/Select';
import { LogoSettingsCard } from '../components/LogoSettings';
import { TimeField } from '../components/TimeField';
import { Button, Card, NumberField, Row, Segmented, Switch } from '../ui';
import { BellIcon, FileIcon, GearIcon, MoonIcon, SparkIcon } from '../icons';

const CORNER_LABEL: Record<SettingsT['notification']['corner'], string> = {
  'top-right': 'Top right',
  'bottom-right': 'Bottom right',
  'top-left': 'Top left',
  'bottom-left': 'Bottom left',
  'top-center': 'Top centre',
};

type SettingsTab = 'general' | 'notifications' | 'focus' | 'animations' | 'data';

interface TabItem {
  id: SettingsTab;
  label: string;
  icon: (props: { size?: number; className?: string }) => ReactNode;
}

const SETTINGS_TABS: readonly TabItem[] = [
  { id: 'general', label: 'General', icon: GearIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'focus', label: 'Focus', icon: MoonIcon },
  { id: 'animations', label: 'Animations', icon: SparkIcon },
  { id: 'data', label: 'Your Data', icon: FileIcon },
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
  const [tab, setTab] = useState<SettingsTab>('general');
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [customHideSec, setCustomHideSec] = useState(
    () =>
      config?.settings.notification.hideAfterSec !== null &&
      config?.settings.notification.hideAfterSec !== undefined &&
      !STAY_PRESETS.includes(config.settings.notification.hideAfterSec),
  );

  useEffect(() => {
    void window.smaran.app.info().then(setInfo);
  }, []);

  if (!config) return null;
  const s = config.settings;
  const n = s.notification;
  const setN = (patch: Partial<SettingsT['notification']>) =>
    setSettings((x) => ({ ...x, notification: { ...x.notification, ...patch } }));
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
          Changes are saved as you make them.
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

      <div
        key={tab}
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
        className="animate-enter [animation-delay:30ms]"
      >
        {tab === 'general' && (
          <Card title="General">
            <Row
              label="Start Smaran when I sign in"
              hint="It starts quietly in the tray."
              htmlFor="set-login"
            >
              <Switch
                id="set-login"
                label="Start at login"
                checked={s.startAtLogin}
                onChange={(v) => setSettings((x) => ({ ...x, startAtLogin: v }))}
              />
            </Row>
            <Row
              label="Text Font"
              hint="For text and buttons. Titles stay in Anthropic Serif, times in Anthropic Mono."
            >
              <FontPicker value={s.font} onChange={(font) => setSettings((x) => ({ ...x, font }))} />
            </Row>
            <Row label="Appearance">
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
          </Card>
        )}

        {tab === 'animations' && <LogoSettingsCard />}

        {tab === 'notifications' && (
          <Card
            title="Notifications"
            description="How reminders appear on your screen."
          >
            <Row label="Position" hint={CORNER_LABEL[n.corner]}>
              <CornerPicker value={n.corner} onChange={(corner) => setN({ corner })} />
            </Row>
            <Row label="Screen" htmlFor="set-screen">
              <Select
                id="set-screen"
                className="w-64"
                value={n.screen}
                options={[
                  { value: 'primary', label: 'Main Screen' },
                  { value: 'cursor', label: 'Screen with the Mouse Pointer' },
                ]}
                onChange={(screen) => setN({ screen })}
              />
            </Row>
            <Row label="Size">
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
              label="Stay on screen"
              hint={
                n.hideAfterSec === null
                  ? 'Notifications stay until you click Dismiss, Snooze, or Done.'
                  : 'Normal reminders hide after this time. Important ones stay until you act.'
              }
            >
              <div className="flex flex-col gap-2.5">
                <Segmented<'timed' | 'permanent'>
                  label="Display duration mode"
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
            <Row label="Sound" hint="A soft chime when a reminder appears." htmlFor="set-sound">
              <Switch
                id="set-sound"
                label="Sound"
                checked={n.sound}
                onChange={(sound) => setN({ sound })}
              />
            </Row>
            <Row label="Try It">
              <Button
                onClick={() =>
                  void window.smaran.reminders.test({
                    title: 'This is how reminders look',
                    body: 'Done, Snooze, or let it fade on its own.',
                    color: 'clay',
                    important: false,
                  })
                }
              >
                Send a Test Reminder
              </Button>
            </Row>
          </Card>
        )}

        {tab === 'focus' && (
          <Card
            title="Focus"
            description="Keep reminders out of the way when you need to concentrate."
          >
            <Row
              label="Quiet Hours"
              hint={
                s.quietHours.enabled
                  ? 'Repeating reminders are skipped; timed ones wait until quiet hours end. Important ones still come through.'
                  : 'Off'
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
              label="Wait while I’m in a full-screen app"
              hint="Games, videos and presentations. The reminder shows when you’re back."
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
              label="Pause all reminders"
              hint={
                paused && s.pausedUntil
                  ? new Date(s.pausedUntil).getFullYear() > 9000
                    ? 'Paused until you resume'
                    : `Paused until ${format(new Date(s.pausedUntil), 'HH:mm')}`
                  : 'Reminders are on'
              }
            >
              {paused ? (
                <Button onClick={() => void window.smaran.app.resume()}>Resume</Button>
              ) : (
                <>
                  <Button size="sm" onClick={() => void window.smaran.app.pause(60)}>
                    1 hour
                  </Button>
                  <Button size="sm" onClick={() => void window.smaran.app.pause(180)}>
                    3 hours
                  </Button>
                  <Button size="sm" onClick={() => void window.smaran.app.pause()}>
                    Until I Resume
                  </Button>
                </>
              )}
            </Row>
          </Card>
        )}

        {tab === 'data' && (
          <Card
            title="Your data"
            description="Reminders are stored on this computer only."
          >
            <Row label="Back up" hint="Save all reminders and settings to a file.">
              <Button onClick={() => void runBackup(() => window.smaran.backup.export())}>
                Back Up…
              </Button>
            </Row>
            <Row label="Restore" hint="Replace everything with a backup.">
              <Button onClick={() => void runBackup(() => window.smaran.backup.import('replace'))}>
                Restore…
              </Button>
            </Row>
            <Row
              label="Add from a file"
              hint="Add reminders from a backup, Smaran 2.0 or Smaran v1 (smaran_settings.json)."
            >
              <Button onClick={() => void runBackup(() => window.smaran.backup.import('add'))}>
                Choose File…
              </Button>
            </Row>
            <Row label="Data folder" hint={info?.dataFolder}>
              <Button variant="ghost" onClick={() => void window.smaran.app.openDataFolder()}>
                Open
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
        )}
      </div>

      {info && (
        <p className="animate-enter pt-2 text-center text-[12px] text-faint [animation-delay:60ms]">
          Smaran {info.version}
          {info.portable ? ' · portable' : ''}
        </p>
      )}
    </div>
  );
}
