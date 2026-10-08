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
      include: ['src/shared/**/*.ts', 'src/main/store/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
});
