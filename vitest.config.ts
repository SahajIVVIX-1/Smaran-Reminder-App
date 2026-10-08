import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // A zone with DST so date tests cover clock changes (US: 8 Mar and 1 Nov 2026).
    env: { TZ: 'America/New_York' },
    coverage: {
      provider: 'v8',
      // Pure logic only. Electron-bound code (windows, tray, IPC) is covered by the e2e tests.
      include: [
        'src/shared/**/*.ts',
        'src/main/store/**/*.ts',
        'src/main/scheduler/**/*.ts',
        'src/main/windows/placement.ts',
        'src/main/system/dataFolder.ts',
        'src/main/tray/tooltip.ts',
      ],
      exclude: ['src/shared/channels.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        // Shared logic and the store: everything (the plan's Phase 1–2 gate).
        'src/shared/**': { branches: 100, functions: 100, lines: 100, statements: 100 },
        'src/main/store/**': { branches: 100, functions: 100, lines: 100, statements: 100 },
        // Scheduler, placement, tray text: all lines; a few defensive fallbacks stay unbranched.
        lines: 100,
        functions: 100,
        branches: 90,
      },
    },
  },
});
