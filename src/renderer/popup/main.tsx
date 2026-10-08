import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Popup entry. Phase 3 renders the shared PopupCard here from popup:init.
const root = document.getElementById('root');
if (!root) throw new Error('Popup root element is missing.');

createRoot(root).render(
  <StrictMode>
    <div />
  </StrictMode>,
);
