import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 15000,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: { command: 'npm run build && npm run start -- --port 3100', url: 'http://127.0.0.1:3100/api/auth/me', reuseExistingServer: false, timeout: 120000,
    env: { SESSION_SECRET: 'test-only-session-secret-with-over-32-chars', WEB_ORIGIN: 'http://127.0.0.1:3100' } },
});
