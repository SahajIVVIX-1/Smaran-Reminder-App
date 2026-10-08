import { defineConfig } from '@playwright/test';

// E2E tests launch the built app in out/, so build first. `npm run test:e2e` does both.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
});
