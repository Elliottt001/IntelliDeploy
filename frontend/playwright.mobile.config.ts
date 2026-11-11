import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8086',
    trace: 'retain-on-failure',
    viewport: { height: 812, width: 375 },
  },
  webServer: {
    command: 'npm run web -- --port 8086',
    env: {
      CI: '1',
      EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:9199',
      EXPO_PUBLIC_MOBILE_UI_PREVIEW: '1',
    },
    reuseExistingServer: false,
    url: 'http://127.0.0.1:8086',
  },
});
