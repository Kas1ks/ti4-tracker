import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 5174);
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${PORT}`,
    url: BASE,
    // Always start a dedicated server so ROOM_CREATE_SECRET matches the tests.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ROOM_CREATE_SECRET: process.env.ROOM_CREATE_SECRET || 'e2e-secret',
    },
  },
});
