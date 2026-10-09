import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const alias = { '@shared': resolve(__dirname, 'src/shared') };

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      rollupOptions: {
        input: {
          app: resolve(__dirname, 'src/preload/app.ts'),
          notification: resolve(__dirname, 'src/preload/notification.ts'),
          menu: resolve(__dirname, 'src/preload/menu.ts'),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          app: resolve(__dirname, 'src/renderer/app/index.html'),
          notification: resolve(__dirname, 'src/renderer/notification/index.html'),
          menu: resolve(__dirname, 'src/renderer/menu/index.html'),
        },
      },
    },
  },
});
