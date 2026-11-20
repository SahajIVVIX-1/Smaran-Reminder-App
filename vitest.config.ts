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
      // Frozen 2.0 code is exercised by the migration tests; the dots logo package (animation
      // scenes full of defensive fallbacks) has its own tests in dots.test.ts.
      exclude: [
        'src/shared/channels.ts',
        'src/shared/legacy/**',
        'src/shared/dots/**',
        'src/shared/setup.ts',
        'src/shared/license/info.ts',
        'src/shared/logoArt.ts',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        // The pure logic the app relies on. A few defensive fallbacks stay uncovered.
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
});
