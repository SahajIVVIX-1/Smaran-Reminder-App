import { useState } from 'react';
import type { BackupResult } from '@shared/ipc';
import { Button, Field, Section } from '../components/ui';
import { isDirty, useSettings } from '../store';

export function BackupPage() {
  const dirty = useSettings((s) => isDirty(s));
  const [result, setResult] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const run = async (action: () => Promise<BackupResult>, done: string) => {
    const r = await action();
    if (!r.ok) setResult({ tone: 'error', text: r.error });
    else if (r.path) setResult({ tone: 'info', text: r.detail ?? `${done} ${r.path}` });
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-lg font-semibold">Backup</h2>

        {dirty && (
          <p className="mb-4 rounded-md border border-line bg-raised p-3 text-sm">
            You have unsaved changes. Save or discard them before exporting or importing.
          </p>
        )}

        <Section title="Full backup (JSON)">
          <Field label="Export" hint="Everything: messages, styles, schedules and app settings.">
            <Button
              small
              disabled={dirty}
              onClick={() => void run(() => window.smaran.backup.export('json'), 'Saved to')}
            >
              Export backup…
            </Button>
          </Field>
          <Field label="Restore" hint="Replaces your current settings with the backup.">
            <Button
              small
              disabled={dirty}
              onClick={() => void run(() => window.smaran.backup.import('json'), 'Restored from')}
            >
              Restore backup…
            </Button>
          </Field>
        </Section>

        <Section title="Messages (CSV)">
          <Field label="Export" hint="Columns: text, tags (separated by ;), enabled.">
            <Button
              small
              disabled={dirty}
              onClick={() => void run(() => window.smaran.backup.export('csv'), 'Saved to')}
            >
              Export messages…
            </Button>
          </Field>
          <Field label="Import" hint="Adds the messages with the default style.">
            <Button
              small
              disabled={dirty}
              onClick={() => void run(() => window.smaran.backup.import('csv'), 'Imported')}
            >
              Import messages…
            </Button>
          </Field>
        </Section>

        <Section title="Smaran v1">
          <Field
            label="Import"
            hint="Adds messages, looks and the schedule from an old smaran_settings.json."
          >
            <Button
              small
              disabled={dirty}
              onClick={() => void run(() => window.smaran.backup.import('v1'), 'Imported')}
            >
              Import v1 settings…
            </Button>
          </Field>
        </Section>

        {result && (
          <p
            role="status"
            className={
              result.tone === 'error' ? 'text-sm whitespace-pre-wrap text-danger' : 'text-sm'
            }
          >
            {result.text}
          </p>
        )}
      </div>
    </div>
  );
}
