import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { SetupInit } from '@shared/setup';
import { SetupCard } from './SetupCard';
import '../theme.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

const root = document.getElementById('root');
if (!root) throw new Error('Setup root element is missing.');

// The installer and uninstaller have no right-click menu.
window.addEventListener('contextmenu', (e) => e.preventDefault());

// Main sends the details once the page has loaded.
let started = false;
window.smaranSetup.onInit((init: SetupInit) => {
  if (started) return;
  started = true;
  document.documentElement.classList.toggle('dark', init.dark);
  createRoot(root).render(
    <StrictMode>
      <SetupCard init={init} />
    </StrictMode>,
  );
});
