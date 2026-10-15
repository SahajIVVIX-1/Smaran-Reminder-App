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

// Main sends the details once the page has loaded.
window.smaranSetup.onInit((init: SetupInit) => {
  document.documentElement.classList.toggle('dark', init.dark);
  createRoot(root).render(
    <StrictMode>
      <SetupCard init={init} />
    </StrictMode>,
  );
});
