import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('expo-router', () => ({
  Stack: { Screen: 'Stack.Screen' },
  useRouter: () => router,
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: {
    select: (options: Record<string, string>) => options.default,
  },
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  View: 'View',
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 20, left: 0, right: 0, top: 47 }),
}));
vi.mock('../components/mobile', () => ({
  AppBackground: 'AppBackground',
  BottomNav: 'BottomNav',
  BrandHeader: 'BrandHeader',
  CircleAction: 'CircleAction',
}));

import { isPublicPath, sanitizeNextPath } from '../features/navigation/routePolicy';
import StoreRankingScreen from '../features/store/StoreRankingScreen';
import StoreScreen from '../features/store/StoreScreen';
import mobilePlaywrightConfig from '../playwright.mobile.config';

type ElementProps = Record<string, unknown> & {
  children?: ReactNode;
};

function propsOf(element: ReactElement) {
  return element.props as ElementProps;
}

function collectElements(node: ReactNode, elements: ReactElement[] = []) {
  if (!isValidElement(node)) {
    return elements;
  }

  elements.push(node);
  const children = propsOf(node).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      collectElements(child, elements);
    }
  } else {
    collectElements(children, elements);
  }

  return elements;
}

function collectText(node: ReactNode, text: string[] = []) {
  if (typeof node === 'string') {
    text.push(node);
    return text;
  }
  if (!isValidElement(node)) {
    return text;
  }

  const children = propsOf(node).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      collectText(child, text);
    }
  } else {
    collectText(children, text);
  }

  return text;
}

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

test('store shells use the approved mobile frame structure without fixture data', () => {
  const screens = [
    {
      loadingText: '正在加载公开应用…',
      screen: StoreScreen(),
    },
    {
      loadingText: '正在准备热门榜单…',
      screen: StoreRankingScreen(),
    },
  ];

  for (const { loadingText, screen } of screens) {
    const elements = collectElements(screen);
    const elementTypes = elements.map((element) => element.type);
    const nav = elements.find((element) => element.type === 'BottomNav');

    expect(elementTypes).toContain('AppBackground');
    expect(elementTypes).toContain('BrandHeader');
    expect(elementTypes).toContain('ActivityIndicator');
    expect(elementTypes).toContain('BottomNav');
    expect(propsOf(nav!).active).toBe('store');
    expect(collectText(screen)).toEqual([loadingText]);
  }
});

test('store headers follow the page-03 and page-40 action layout', () => {
  const storeElements = collectElements(StoreScreen());
  const storeHeader = storeElements.find((element) => element.type === 'BrandHeader');
  const storeAction = propsOf(storeHeader!).action as ReactElement;
  expect(propsOf(storeAction)).toMatchObject({ disabled: true, icon: 'settings' });

  const rankingElements = collectElements(StoreRankingScreen());
  const rankingHeader = rankingElements.find((element) => element.type === 'BrandHeader');
  const rankingProps = propsOf(rankingHeader!);
  expect(rankingProps.title).toBe('应用商店');
  const back = propsOf(rankingProps.logo as ReactElement);
  expect(back).toMatchObject({ icon: 'back' });
  expect(propsOf(rankingProps.action as ReactElement)).toMatchObject({ icon: 'share' });

  (back.onPress as () => void)();
  expect(router.replace).toHaveBeenCalledWith('/store');
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
