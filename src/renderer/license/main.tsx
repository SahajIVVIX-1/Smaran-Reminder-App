import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LicenseGate } from './LicenseGate';
import '../theme.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

const root = document.getElementById('root');
if (!root) throw new Error('License root element is missing.');

const media = window.matchMedia('(prefers-color-scheme: dark)');
const apply = () => document.documentElement.classList.toggle('dark', media.matches);
apply();
media.addEventListener('change', apply);

createRoot(root).render(
  <StrictMode>
    <LicenseGate />
  </StrictMode>,
);
