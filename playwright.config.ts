import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: {
    baseURL: process.env.ATLAS_TEST_URL || 'http://127.0.0.1:3000',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
