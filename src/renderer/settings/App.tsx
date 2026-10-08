const PAGES = ['Messages', 'Styles', 'Schedules', 'App', 'Backup'] as const;

export function App() {
  const { electron } = window.smaran.versions;

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
        <p className="muted">Pages arrive in Phase 5. Electron {electron}.</p>
      </main>
    </div>
  );
}
