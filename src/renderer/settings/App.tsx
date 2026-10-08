import { useEffect, useState } from 'react';
import type { Config } from '@shared/schema';

const PAGES = ['Messages', 'Styles', 'Schedules', 'App', 'Backup'] as const;

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

export function App() {
  const { electron } = window.smaran.versions;
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    void window.smaran.config.get().then(setConfig);
    return window.smaran.config.onChanged(setConfig);
  }, []);

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Settings pages">
        <div className="brand">Smaran</div>
        {PAGES.map((page) => (
          <button key={page} type="button" className="nav-item" disabled>
            {page}
          </button>
        ))}
      </nav>
      <main className="content">
        <h1>Settings</h1>
        {config && (
          <p data-testid="config-summary">
            {count(config.messages.length, 'message')} · {count(config.styles.length, 'style')} ·{' '}
            {count(config.schedules.length, 'schedule')}
          </p>
        )}
        <p className="muted">Pages arrive in Phase 5. Electron {electron}.</p>
      </main>
    </div>
  );
}
