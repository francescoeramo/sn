import { defineConfig, devices } from '@playwright/test';
const port = process.env.E2E_PORT ?? '3100';
const baseURL = `http://127.0.0.1:${port}`;
const webServerCommand = process.env.E2E_DEV_SERVER
  ? `npm run dev -- --port ${port}`
  : 'node scripts/prepare-standalone.mjs && node .next/standalone/server.js';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: process.env.CI ? {} : { executablePath: '/usr/bin/chromium' },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      APP_ORIGIN: baseURL,
      HOSTNAME: '127.0.0.1',
      PORT: port,
    },
  },
});
