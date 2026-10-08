import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { createDefaultConfig } from '@shared/defaults';
import type { AppInfo } from '@shared/ipc';
import type { AppSettings } from '@shared/schema';
import { Button, Field, Modal, Section, Select, Toggle } from '../components/ui';
import { useSettings } from '../store';

function pauseLabel(pausedUntil: string | null): string | null {
  if (!pausedUntil || new Date(pausedUntil) <= new Date()) return null;
  const until = new Date(pausedUntil);
  return until.getFullYear() >= 9000
    ? 'Paused until you resume'
    : `Paused until ${format(until, 'HH:mm')}`;
}

export function AppPage() {
  const draft = useSettings((s) => s.draft);
  const { edit, showToast } = useSettings.getState();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    void window.smaran.app.info().then(setInfo);
  }, []);

  if (!draft) return null;
  const app = draft.app;
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    edit((c) => ({ ...c, app: { ...c.app, [key]: value } }));
  const paused = pauseLabel(app.pausedUntil);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-lg font-semibold">App</h2>

        <Section title="Reminders">
          <Field label="Status">
            <div className="flex items-center gap-2">
              <span className="text-sm">{paused ?? 'Running'}</span>
              {paused ? (
                <Button small onClick={() => void window.smaran.app.resume()}>
                  Resume
                </Button>
              ) : (
                <>
                  <Button small onClick={() => void window.smaran.app.pause(30)}>
                    Pause 30 min
                  </Button>
                  <Button small onClick={() => void window.smaran.app.pause(60)}>
                    Pause 1 hour
                  </Button>
                  <Button small onClick={() => void window.smaran.app.pause()}>
                    Pause until resumed
                  </Button>
                </>
              )}
            </div>
          </Field>
          <Field
            label="Quiet when busy"
            htmlFor="app-focus"
            hint="Skip reminders while a full-screen app, game or presentation is showing, or Windows reports quiet time."
          >
            <Toggle
              id="app-focus"
              label="Quiet when busy"
              checked={app.respectFocusAssist}
              onChange={(v) => set('respectFocusAssist', v)}
            />
          </Field>
        </Section>

        <Section title="Startup">
          <Field
            label="Start at login"
            htmlFor="app-login"
            hint="Smaran starts quietly in the tray when you sign in to Windows."
          >
            <Toggle
              id="app-login"
              label="Start at login"
              checked={app.startAtLogin}
              onChange={(v) => set('startAtLogin', v)}
            />
          </Field>
          <Field
            label="Remind on startup"
            htmlFor="app-startup"
            hint="Show the next reminder as soon as Smaran starts."
          >
            <Toggle
              id="app-startup"
              label="Remind on startup"
              checked={app.showOnStartup}
              onChange={(v) => set('showOnStartup', v)}
            />
          </Field>
        </Section>

        <Section title="Appearance">
          <Field label="Theme" htmlFor="app-theme">
            <Select
              id="app-theme"
              value={app.theme}
              onChange={(e) => set('theme', e.currentTarget.value as AppSettings['theme'])}
            >
              <option value="system">Same as Windows</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </Select>
          </Field>
        </Section>

        <Section title="Data">
          <Field label="Settings folder" hint={info?.dataFolder}>
            <Button small onClick={() => void window.smaran.app.openDataFolder()}>
              Open folder
            </Button>
          </Field>
          <Field
            label="Start over"
            hint="Replaces your messages, styles and schedules with the defaults. You can still undo by not saving."
          >
            <Button small tone="danger" onClick={() => setConfirmReset(true)}>
              Reset to defaults
            </Button>
          </Field>
        </Section>

        {info && (
          <p className="text-xs text-muted">
            Smaran {info.version}
            {info.portable ? ' (portable)' : ''} · Electron {info.electron}
          </p>
        )}
      </div>

      {confirmReset && (
        <Modal
          title="Reset to defaults?"
          actions={
            <>
              <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button
                tone="danger"
                onClick={() => {
                  const fresh = createDefaultConfig();
                  edit((c) => ({
                    ...fresh,
                    app: { ...fresh.app, onboarded: true, pausedUntil: c.app.pausedUntil },
                    runtime: c.runtime,
                  }));
                  setConfirmReset(false);
                  showToast('Defaults loaded. Press Save to keep them, or Discard to go back.');
                }}
              >
                Reset
              </Button>
            </>
          }
        >
          All messages, styles and schedules are replaced. Nothing is saved until you press Save.
        </Modal>
      )}
    </div>
  );
}
