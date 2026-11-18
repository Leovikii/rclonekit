import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:1420',
    viewport: { width: 760, height: 760 },
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 1420 --strictPort', url: 'http://127.0.0.1:1420', reuseExistingServer: false },
});
