import { defineConfig } from '@playwright/test';
import e2eConfig from './tests/config/e2e.config';

// E2E tests launch the built app in out/, so build first. `npm run test:e2e` does both.
export default defineConfig({
  ...e2eConfig,
});
