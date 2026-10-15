import { differenceInCalendarDays } from 'date-fns';
import { useEffect, useState, type ReactNode } from 'react';
import type { LicenseInfo, LicenseStatus } from '@shared/license/info';
import { useApp } from '../store';
import { Button, Card, Pill } from '../ui';

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

const STATUS: Record<LicenseStatus, { label: string; tone: 'ok' | 'accent' | 'neutral' }> = {
  valid: { label: 'Active', tone: 'ok' },
  expired: { label: 'Expired', tone: 'accent' },
  'not-yet-valid': { label: 'Not yet valid', tone: 'accent' },
  missing: { label: 'No license', tone: 'accent' },
  invalid: { label: 'Not valid', tone: 'accent' },
};

function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-h-11 items-center gap-6 border-b border-line py-2 last:border-b-0">
      <span className="w-32 shrink-0 text-[13px] text-muted">{label}</span>
      <span className={mono ? 'min-w-0 font-mono text-[12px] break-all' : 'text-[13.5px]'}>
        {children}
      </span>
    </div>
  );
}

/** Your Smaran license: who it's for, until when, and importing or replacing it. */
export function License() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const { toastMsg } = useApp.getState();

  useEffect(() => {
    void window.smaran.license.get().then(setInfo);
    return window.smaran.license.onChanged(setInfo);
  }, []);

  const replace = async () => {
    setBusy(true);
    const result = await window.smaran.license.import();
    setBusy(false);
    if (result.ok) {
      setInfo(result.info);
      toastMsg(`License imported for ${result.info.license?.name ?? 'you'}`);
    } else if (!('canceled' in result)) {
      // The current license stays as it was.
      toastMsg(result.error, 'error');
    }
  };

  if (!info) return null;
  const l = info.license;
  const left = l ? differenceInCalendarDays(new Date(l.expires), new Date()) : 0;
  const status = STATUS[info.status];

  return (
    <div className="mx-auto max-w-[760px] px-7 pt-8 pb-16">
      <header className="flex animate-enter items-end gap-4">
        <div className="flex-1">
          <h1 className="font-serif text-[26px] leading-tight">License</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {info.status === 'valid' && l
              ? left > 60
                ? `Licensed to ${l.name} until ${date(l.expires)}.`
                : `Your license ends in ${left} day${left === 1 ? '' : 's'}, on ${date(l.expires)}.`
              : (info.message ?? 'No license.')}
          </p>
        </div>
        <Button variant="primary" disabled={busy} onClick={() => void replace()}>
          {busy ? 'Checking…' : l ? 'Replace License…' : 'Import License…'}
        </Button>
      </header>

      <Card className="mt-6 animate-enter [animation-delay:40ms]" title="Your License">
        <Field label="Status">
          <Pill tone={status.tone}>{status.label}</Pill>
        </Field>
        {l && (
          <>
            <Field label="Licensed to">{l.name}</Field>
            <Field label="Duration">
              {l.years} year{l.years === 1 ? '' : 's'}
            </Field>
            <Field label="Issued">{date(l.issued)}</Field>
            <Field label="Expires">{date(l.expires)}</Field>
            <Field label="License ID" mono>
              {l.id}
            </Field>
            <Field label="Issued from IP" mono>
              {l.ip}
            </Field>
            {info.importedAt && <Field label="Imported">{date(info.importedAt)}</Field>}
          </>
        )}
      </Card>

      <div className="mt-6 animate-enter space-y-2 font-serif text-[13.5px] leading-snug text-muted italic [animation-delay:80ms]">
        <p>
          Your license is a picture with the license hidden inside it, signed so Smaran can tell if
          it was changed. It’s checked on this PC, so Smaran works without the internet.
        </p>
        <p>
          Keep the original PNG somewhere safe. Converting it to JPG, resizing or editing it can
          erase the license inside.
        </p>
      </div>
    </div>
  );
}
