import { defineConfig } from '@playwright/test';
import {resolveTestDatabaseUrl} from './e2e/testDatabase';

export default defineConfig({
  testDir: './e2e', testIgnore: /(?:^|[/\\])mobile-complete-motion\.spec\.ts$/, timeout: 45000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8085', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: [
    { command: 'PYTHONPATH=../backend ../.venv/bin/python ../tests/phase1/payment_browser_api.py 9105', url: 'http://127.0.0.1:9105/', reuseExistingServer: false,
      env: { DATABASE_URL: resolveTestDatabaseUrl(), SECRET_KEY: 'test-only-cross-client-auth-secret', CORS_ORIGINS: '["http://127.0.0.1:8085"]' } },
    { command: 'npm --workspace web run build && npm --workspace web run start -- --port 3105', url: 'http://127.0.0.1:3105/api/auth/me', reuseExistingServer: false, timeout: 120000,
      env: { API_BASE_URL: 'http://127.0.0.1:9105', WEB_ORIGIN: 'http://127.0.0.1:3105', SESSION_SECRET: 'test-only-cross-client-session-secret-32-chars' } },
    { command: 'npm run web -- --port 8085', url: 'http://127.0.0.1:8085', reuseExistingServer: false, timeout: 120000,
      env: { CI: '1', EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:9105' } },
  ],
});
