import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { PopupInit } from '@shared/ipc';
import { Popup } from './Popup';

const root = document.getElementById('root');
if (!root) throw new Error('Popup root element is missing.');

// Main sends the content once the page has loaded.
window.smaranPopup.onInit((init: PopupInit) => {
  createRoot(root).render(
    <StrictMode>
      <Popup text={init.text} style={init.style} />
    </StrictMode>,
  );
});
