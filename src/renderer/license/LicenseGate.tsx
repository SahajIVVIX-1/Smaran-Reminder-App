import { useEffect, useState } from 'react';
import type { LicenseInfo } from '@shared/license/info';
import { SmaranDots } from '../dots';

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

type GatePhase = 'idle' | 'verifying' | 'success' | 'error';

/** Shown instead of Smaran until a valid license image is imported. */
export function LicenseGate() {
  const [initialInfo, setInitialInfo] = useState<LicenseInfo | null>(null);
  const [phase, setPhase] = useState<GatePhase>('idle');
  const [activeInfo, setActiveInfo] = useState<LicenseInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('Inspecting license image…');

  useEffect(() => {
    void window.smaranLicense.get().then(setInitialInfo);
  }, []);

  const pick = async () => {
    setErrorMsg(null);
    setPhase('verifying');
    setProgress(50);
    setStepText('Validating digital signature and offline license…');

    const result = await window.smaranLicense.import();
    if ('canceled' in result && result.canceled) {
      setPhase('idle');
      return;
    }

    if (result.ok) {
      setProgress(100);
      setActiveInfo(result.info);
      setPhase('success');
      void window.smaranLicense.activate();
    } else {
      const err = 'error' in result ? result.error : 'This license is invalid.';
      setErrorMsg(err);
      setPhase('error');
    }
  };

  const scene =
    phase === 'verifying'
      ? 'material-spinner'
      : phase === 'success'
        ? 'check'
        : phase === 'error'
          ? 'cross'
          : 's-mark';

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg px-10 text-center text-ink select-none">
      <style>{`
        @keyframes gateShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .gate-shake {
          animation: gateShake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>

      <SmaranDots size={76} goo interactive={false} scene={scene} />

      <h1 className="mt-4 font-serif text-[28px] leading-tight font-semibold">
        {phase === 'verifying'
          ? 'Verifying License…'
          : phase === 'success'
            ? 'Welcome to Smaran'
            : phase === 'error'
              ? 'Invalid License'
              : 'Activate Smaran'}
      </h1>

      <p className="mt-2 max-w-[400px] font-serif text-[14.5px] leading-snug text-muted italic">
        {phase === 'verifying'
          ? 'Performing cryptographic verification and offline credential check…'
          : phase === 'success' && activeInfo?.license
            ? `Licensed to ${activeInfo.license.name} until ${date(activeInfo.license.expires)}. Opening Smaran…`
            : phase === 'error'
              ? 'The selected file could not be verified as a valid Smaran license.'
              : 'Smaran needs a license to open. Import your license image.'}
      </p>

      {/* 10-Second Loading Progress Indicator */}
      {phase === 'verifying' && (
        <div className="mt-6 flex w-full max-w-[360px] flex-col gap-2.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-raised ring-1 ring-line">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[12px] font-mono text-muted">
            <span className="truncate pr-2">{stepText}</span>
            <span className="tabular-nums font-semibold text-accent">{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {/* Error Display with Shake Animation */}
      {phase === 'error' && errorMsg && (
        <div className="gate-shake mt-5 w-full max-w-[360px] rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-left">
          <div className="text-[13px] font-semibold text-danger">Verification Failed</div>
          <div className="mt-1 text-[12.5px] text-danger/90">{errorMsg}</div>
        </div>
      )}

      {/* Initial license message if previously expired or damaged */}
      {phase === 'idle' && initialInfo?.message && initialInfo.status !== 'missing' && (
        <p role="alert" className="mt-5 max-w-[400px] text-[13px] leading-snug text-danger">
          {initialInfo.message}
        </p>
      )}

      {/* Action Buttons */}
      {phase !== 'verifying' && phase !== 'success' && (
        <div className="mt-6 flex w-full max-w-[360px] flex-col gap-2">
          <button
            type="button"
            onClick={() => void pick()}
            className="h-10 rounded-xl bg-accent text-[14px] font-medium text-on-accent transition-colors hover:bg-accent-hover shadow-sm"
          >
            {phase === 'error' ? 'Try Another License Image…' : 'Import License Image…'}
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
