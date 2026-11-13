import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/components',
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8187',
    trace: 'retain-on-failure',
    viewport: { height: 812, width: 375 },
  },
  webServer: {
    command: 'npm run web -- --port 8187',
    env: { CI: '1', INTELLIDEPLOY_COMPONENT_FIXTURE: '1' },
    reuseExistingServer: false,
    url: 'http://127.0.0.1:8187',
  },
});
