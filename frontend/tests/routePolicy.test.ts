import { expect, test } from 'vitest';

import { isPublicPath, sanitizeNextPath } from '../features/navigation/routePolicy';
import mobilePlaywrightConfig from '../playwright.mobile.config';

test('only approved browsing routes are public', () => {
  for (const path of [
    '/login',
    '/register',
    '/store',
    '/store/ranking',
    '/community',
    '/community/shared',
  ]) {
    expect(isPublicPath(path), path).toBe(true);
  }

  for (const path of [
    '/',
    '/chatbot',
    '/app-gallery',
    '/library/favorites',
    '/billing',
    '/app-detail/app',
    '/community/',
    '/community/shared/extra',
    '/community/../billing',
    '/community/shared?preview=1',
  ]) {
    expect(isPublicPath(path), path).toBe(false);
  }
});

test('next accepts only known in-app paths', () => {
  for (const path of [
    '/',
    '/app-detail/app_1',
    '/library/favorites',
    '/library/recent',
    '/store',
    '/store/ranking',
    '/community',
    '/community/shared',
    '/chatbot',
    '/app-gallery',
    '/billing',
  ]) {
    expect(sanitizeNextPath(path), path).toBe(path);
  }
});

test('next rejects open redirects and malformed route values', () => {
  for (const value of [
    '//evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    '/%2F%2Fevil.example',
    '/app-detail/app%2F..',
    '/app-detail\\app',
    '/app-detail/app?next=//evil.example',
    '/community/shared#https://evil.example',
    '/community/../billing',
    '/community/shared/extra',
    ['/store'],
    null,
    undefined,
    1,
    {},
  ]) {
    expect(sanitizeNextPath(value), JSON.stringify(value)).toBe('/');
  }
});

test('mobile Playwright only discovers mock mobile specs and starts one Expo server', () => {
  expect(Array.isArray(mobilePlaywrightConfig.testMatch)).toBe(true);
  const testMatch = mobilePlaywrightConfig.testMatch as RegExp[];
  const matches = (path: string) => testMatch.some((pattern) => pattern.test(path));

  for (const path of [
    'e2e/mobile-store.spec.ts',
    'e2e/mobile-routing.spec.ts',
    'e2e/community.spec.ts',
    'e2e/workspace.spec.ts',
  ]) {
    expect(matches(path), path).toBe(true);
  }

  for (const path of [
    'e2e/cross-client.spec.ts',
    'e2e/community-cross-client.spec.ts',
  ]) {
    expect(matches(path), path).toBe(false);
  }

  expect(Array.isArray(mobilePlaywrightConfig.webServer)).toBe(false);
  expect(mobilePlaywrightConfig.webServer).toMatchObject({
    command: 'npm run web -- --port 8086',
    env: {
      CI: '1',
      EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:9199',
      EXPO_PUBLIC_MOBILE_UI_PREVIEW: '1',
    },
    url: 'http://127.0.0.1:8086',
  });
});
