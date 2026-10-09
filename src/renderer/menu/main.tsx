import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { fontFaceCss, fontStack } from '@shared/fonts';
import { MenuRoot } from './MenuRoot';
import '../theme.css';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

const root = document.getElementById('root');
if (!root) throw new Error('Menu root element is missing.');

const faces = document.createElement('style');
document.head.appendChild(faces);

const reactRoot = createRoot(root);
let serial = 0;
window.smaranMenu.onInit((init) => {
  serial += 1;
  document.documentElement.classList.toggle('dark', init.theme === 'dark');
  document.documentElement.style.setProperty('--font-app', fontStack(init.font));
  faces.textContent = fontFaceCss(init.faces);
  reactRoot.render(
    <StrictMode>
      <MenuRoot key={serial} init={init} serial={serial} />
    </StrictMode>,
  );
});
