import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { NotificationInit } from '@shared/ipc';
import { NotificationCard } from './NotificationCard';
import '../theme.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { fontFaceCss, fontStack } from '@shared/fonts';

const root = document.getElementById('root');
if (!root) throw new Error('Notification root element is missing.');

// Main sends the content once the page has loaded.
window.smaranNotification.onInit((init: NotificationInit) => {
  document.documentElement.classList.toggle('dark', init.look.theme === 'dark');
  document.documentElement.style.setProperty('--font-app', fontStack(init.look.font));
  const faces = document.createElement('style');
  faces.textContent = fontFaceCss(init.look.faces);
  document.head.appendChild(faces);
  createRoot(root).render(
    <StrictMode>
      <NotificationCard request={init.request} card={init.look.card} />
    </StrictMode>,
  );
});
