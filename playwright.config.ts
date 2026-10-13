import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  webServer: process.env.ATLAS_TEST_URL
    ? undefined
    : {
        command: 'node tests/browser-server.mjs',
        url: 'http://127.0.0.1:3300/api/health',
        reuseExistingServer: false,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
        timeout: 120000,
      },
  use: {
    baseURL: process.env.ATLAS_TEST_URL || 'http://127.0.0.1:3300',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
