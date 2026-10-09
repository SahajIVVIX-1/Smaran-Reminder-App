import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../theme.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

const root = document.getElementById('root');
if (!root) throw new Error('App root element is missing.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
