import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import type { AppInfo, BackupResult } from '@shared/ipc';
import { CORNERS, type Settings as SettingsT } from '@shared/schema';
import { cx } from '../cx';
import { useApp } from '../store';
import { FontPicker } from '../components/FontPicker';
import { Select } from '../components/Select';
import { TimeField } from '../components/TimeField';
import { Button, Card, Row, Segmented, Switch } from '../ui';

const CORNER_LABEL: Record<SettingsT['notification']['corner'], string> = {
  'top-right': 'Top right',
  'bottom-right': 'Bottom right',
  'top-left': 'Top left',
  'bottom-left': 'Bottom left',
  'top-center': 'Top centre',
};

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

export function Settings() {
  const config = useApp((s) => s.config);
  const { setSettings } = useApp.getState();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

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

  return (
    <div className="mx-auto max-w-[760px] space-y-5 px-7 pt-8 pb-16">
      <header className="animate-enter">
        <h1 className="font-serif text-[26px] leading-tight">Settings</h1>
        <p className="mt-1 font-serif text-[14.5px] text-muted italic">
          Changes are saved as you make them.
        </p>
      </header>

      <Card title="General" className="animate-enter [animation-delay:30ms]">
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

      <Card
        title="Notifications"
        description="How reminders appear on your screen."
        className="animate-enter [animation-delay:60ms]"
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
        <Row
          label="Stay on screen for"
          hint="Normal reminders. Important ones stay until you act."
          htmlFor="set-hide"
        >
          <Select
            id="set-hide"
            className="w-36"
            value={n.hideAfterSec}
            options={[...new Set([5, 8, 12, 20, 30, 60, 120, n.hideAfterSec])]
              .sort((a, b) => a - b)
              .map((sec) => ({
                value: sec,
                label: sec < 60 ? `${sec} seconds` : `${sec / 60} minute${sec === 60 ? '' : 's'}`,
              }))}
            onChange={(hideAfterSec) => setN({ hideAfterSec })}
          />
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

      <Card
        title="Focus"
        description="Keep reminders out of the way when you need to concentrate."
        className="animate-enter [animation-delay:90ms]"
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

      <Card
        title="Your data"
        description="Reminders are stored on this computer only."
        className="animate-enter [animation-delay:120ms]"
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

      {info && (
        <p className="animate-enter pt-2 text-center text-[12px] text-faint [animation-delay:150ms]">
          Smaran {info.version}
          {info.portable ? ' · portable' : ''}
        </p>
      )}
    </div>
  );
}
