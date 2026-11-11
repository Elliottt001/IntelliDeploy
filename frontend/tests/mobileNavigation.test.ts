import type { ReactElement } from 'react';
import { expect, test, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    select: (options: Record<string, string>) => options.default,
  },
  Pressable: 'Pressable',
  StyleSheet: {
    absoluteFillObject: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    create: <T,>(styles: T) => styles,
  },
  Text: 'Text',
  View: 'View',
}));
vi.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
vi.mock('react-native-svg', () => ({
  Circle: 'Circle',
  Path: 'Path',
  default: 'Svg',
}));

import { BottomNav } from '../components/mobile/BottomNav';
import { CircleAction } from '../components/mobile/CircleAction';
import { ErrorState } from '../components/mobile/ErrorState';
import {
  bottomNavItems,
  getBottomNavTarget,
} from '../features/navigation/mobileNavigation';

type ElementProps = Record<string, unknown> & {
  children?: ReactElement | ReactElement[];
  style?: unknown;
};

function propsOf(element: ReactElement) {
  return element.props as ElementProps;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (!Array.isArray(style)) {
    return (style ?? {}) as Record<string, unknown>;
  }
  return Object.assign({}, ...style.filter(Boolean));
}

test('bottom navigation has the approved four routes and 44pt targets', () => {
  expect(bottomNavItems.map(({ key, href }) => [key, href])).toEqual([
    ['home', '/'],
    ['store', '/store'],
    ['community', '/community'],
    ['products', '/app-gallery'],
  ]);
  expect(bottomNavItems.every((item) => item.minTarget === 44)).toBe(true);
  expect(getBottomNavTarget('store')).toBe('/store');
});

test('shared actions expose button semantics and at least 44pt hit targets', () => {
  const action = CircleAction({
    accessibilityLabel: '返回',
    icon: 'Icon',
    onPress: vi.fn(),
  });
  const actionProps = propsOf(action);
  const actionStyle = flattenStyle(actionProps.style);

  expect(actionProps.accessibilityRole).toBe('button');
  expect(actionProps.accessibilityLabel).toBe('返回');
  expect(actionStyle.minWidth).toBeGreaterThanOrEqual(44);
  expect(actionStyle.minHeight).toBeGreaterThanOrEqual(44);

  const error = ErrorState({ message: '网络连接失败', onRetry: vi.fn() });
  const errorChildren = propsOf(error).children as ReactElement[];
  const retry = errorChildren.find((child) => child.type === 'Pressable');
  expect(retry).toBeTruthy();
  const retryStyle = flattenStyle(propsOf(retry!).style);
  expect(retryStyle.minWidth).toBeGreaterThanOrEqual(44);
  expect(retryStyle.minHeight).toBeGreaterThanOrEqual(44);
});

test('bottom navigation renders four accessible tabs with 44pt targets', () => {
  const nav = BottomNav({ active: 'community', onNavigate: vi.fn() });
  const navProps = propsOf(nav);
  const tabs = navProps.children as ReactElement[];

  expect(navProps.accessibilityRole).toBe('tablist');
  expect(tabs).toHaveLength(4);
  for (const tab of tabs) {
    const tabProps = propsOf(tab);
    const tabStyle = flattenStyle(tabProps.style);
    expect(tabProps.accessibilityRole).toBe('tab');
    expect(tabStyle.minWidth).toBeGreaterThanOrEqual(44);
    expect(tabStyle.minHeight).toBeGreaterThanOrEqual(44);
  }
  expect(propsOf(tabs[2]).accessibilityState).toEqual({ selected: true });
});
