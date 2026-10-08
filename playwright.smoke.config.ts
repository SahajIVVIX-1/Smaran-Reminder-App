import { defineConfig } from '@playwright/test';

// Smoke test of the packaged build: `npm run build:win`, then `npm run test:smoke`.
export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
});
