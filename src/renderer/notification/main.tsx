import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { NotificationInit } from '@shared/ipc';
import { NotificationCard } from './NotificationCard';
import '../theme.css';

const root = document.getElementById('root');
if (!root) throw new Error('Notification root element is missing.');

// Main sends the content once the page has loaded.
window.smaranNotification.onInit((init: NotificationInit) => {
  document.documentElement.classList.toggle('dark', init.look.theme === 'dark');
  createRoot(root).render(
    <StrictMode>
      <NotificationCard request={init.request} size={init.look.size} />
    </StrictMode>,
  );
});
