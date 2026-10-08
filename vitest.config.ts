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
        'src/main/engine/**/*.ts',
        'src/main/windows/placement.ts',
        'src/main/system/dataFolder.ts',
        'src/main/tray/tooltip.ts',
      ],
      // Frozen 2.0 code, only kept for upgrades; exercised by the migration tests.
      exclude: ['src/shared/channels.ts', 'src/shared/legacy/**'],
      reporter: ['text', 'html'],
      thresholds: {
        // The pure logic the app relies on. A few defensive fallbacks stay uncovered.
        lines: 99,
        functions: 97,
        statements: 96,
        branches: 90,
      },
    },
  },
});
