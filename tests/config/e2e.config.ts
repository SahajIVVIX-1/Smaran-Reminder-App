import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

/**
 * Smaran E2E Testing Configuration
 * Launches the real Electron desktop application in an isolated environment.
 */
export default defineConfig({
  testDir: resolve(__dirname, '../e2e'),
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1, // Single worker prevents Electron window/profile collisions
  retries: 0,
  outputDir: resolve(__dirname, '../../test-results/artifacts'),
  reporter: [
    ['list'],
    ['html', { outputFolder: resolve(__dirname, '../../test-results/html'), open: 'never' }],
    ['json', { outputFile: resolve(__dirname, '../../test-results/results.json') }],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});
