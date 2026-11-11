import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 15000, workers: 1,
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node e2e/fixture-api.mjs', url: 'http://127.0.0.1:9100/health', reuseExistingServer: false, timeout: 30000 },
    { command: 'npm run build && mkdir -p .next/standalone/web/public .next/standalone/web/.next/static && cp -R public/. .next/standalone/web/public/ && cp -R .next/static/. .next/standalone/web/.next/static/ && PORT=3100 HOSTNAME=127.0.0.1 node .next/standalone/web/server.js', url: 'http://127.0.0.1:3100/api/auth/me', reuseExistingServer: false, timeout: 120000,
      env: { API_BASE_URL: 'http://127.0.0.1:9100', SESSION_SECRET: 'test-only-session-secret-with-over-32-chars', WEB_ORIGIN: 'http://127.0.0.1:3100' } },
  ],
});
