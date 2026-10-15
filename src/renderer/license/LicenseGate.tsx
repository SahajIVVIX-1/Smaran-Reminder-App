import { useEffect, useState } from 'react';
import type { LicenseInfo } from '@shared/license/info';
import { SmaranDots } from '../dots';

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** Shown instead of Smaran until a valid license image is imported. */
export function LicenseGate() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void window.smaranLicense.get().then(setInfo);
  }, []);

  const pick = async () => {
    setBusy(true);
    setError(null);
    const result = await window.smaranLicense.import();
    setBusy(false);
    if (result.ok) {
      setInfo(result.info);
      setDone(true); // main opens Smaran a moment later
    } else if (!('canceled' in result)) setError(result.error);
  };

  const status = done ? null : (error ?? info?.message ?? null);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg px-10 text-center text-ink select-none">
      <SmaranDots size={72} goo interactive={false} scene={done ? 'check' : 's-mark'} />
      <h1 className="mt-4 font-serif text-[28px] leading-tight font-semibold">
        {done ? 'Welcome to Smaran' : 'Activate Smaran'}
      </h1>
      <p className="mt-2 max-w-[380px] font-serif text-[14.5px] leading-snug text-muted italic">
        {done && info?.license
          ? `Licensed to ${info.license.name} until ${date(info.license.expires)}. Opening Smaran…`
          : 'Smaran needs a license to open. Import your license image.'}
      </p>

      {info?.license && !done && (
        <div className="mt-5 w-full max-w-[360px] rounded-xl border border-line bg-surface px-4 py-3 text-left text-[12.5px]">
          <div className="font-medium">{info.license.name}</div>
          <div className="mt-0.5 text-muted">
            {date(info.license.issued)} to {date(info.license.expires)}
          </div>
        </div>
      )}

      {status && (
        <p
          role="alert"
          className={`mt-5 max-w-[400px] text-[13px] leading-snug ${error || info?.status !== 'missing' ? 'text-danger' : 'text-muted'}`}
        >
          {status}
        </p>
      )}

      {!done && (
        <div className="mt-6 flex w-full max-w-[360px] flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void pick()}
            className="h-10 rounded-xl bg-accent text-[14px] font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Import License Image…'}
          </button>
          <button
            type="button"
            onClick={() => window.smaranLicense.quit()}
            className="h-10 rounded-xl text-[14px] font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            Quit
          </button>
        </div>
      )}
    </div>
  );
}
