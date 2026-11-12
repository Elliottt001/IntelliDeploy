import {afterEach, expect, test, vi} from 'vitest';

const defaultUrl = 'postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_test';
const isolatedUrl = 'postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_mobile_figma_20261112_c2?gssencmode=disable';
afterEach(() => {vi.unstubAllEnvs(); vi.resetModules();});
test('standard Playwright backend follows the explicit test-only isolated database override', async () => {
 vi.stubEnv('INTELLIDEPLOY_TEST_DATABASE_URL', isolatedUrl);
 vi.stubEnv('DATABASE_URL', 'postgresql+psycopg://prod:secret@production.invalid/app');
 vi.resetModules();
 const config = (await import('../playwright.config')).default;
 expect((config.webServer as {env: Record<string,string>}[])[0].env.DATABASE_URL).toBe(isolatedUrl);
});
test('ambient runtime DATABASE_URL cannot redirect ordinary local test configuration', async () => {
 vi.stubEnv('INTELLIDEPLOY_TEST_DATABASE_URL', undefined);
 vi.stubEnv('DATABASE_URL', 'postgresql+psycopg://prod:secret@production.invalid/app');
 vi.resetModules();
 const config = (await import('../playwright.config')).default;
 expect((config.webServer as {env: Record<string,string>}[])[0].env.DATABASE_URL).toBe(defaultUrl);
});
test('test-only overrides reject remote hosts and non-test database targets before server startup', async () => {
 for (const target of ['postgresql+psycopg://intellideploy:dev-only@production.invalid:55432/intellideploy_test', 'postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy','postgresql+psycopg://intellideploy:dev-only@127.0.0.1:55432/intellideploy_test?host=production.invalid','postgresql+psycopg://intellideploy:dev-only@127.0.0.1:5432/intellideploy_test']) {
  vi.stubEnv('INTELLIDEPLOY_TEST_DATABASE_URL', target);vi.resetModules();
  await expect(import('../playwright.config')).rejects.toThrow(/local test database/);
 }
});
