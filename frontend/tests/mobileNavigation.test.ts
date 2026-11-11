import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

const windowMetrics = vi.hoisted(() => ({ width: 375 }));

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
  useWindowDimensions: () => ({
    fontScale: 1,
    height: 812,
    scale: 1,
    width: windowMetrics.width,
  }),
  View: 'View',
}));
vi.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
vi.mock('react-native-svg', () => ({
  Circle: 'Circle',
  Path: 'Path',
  default: 'Svg',
}));

import { AppBackground } from '../components/mobile/AppBackground';
import { BottomNav } from '../components/mobile/BottomNav';
import {
  CircleAction,
  type CircleActionProps,
} from '../components/mobile/CircleAction';
import { ErrorState } from '../components/mobile/ErrorState';
import { BrandHeader, GlassCard, MobileIcon } from '../components/mobile';
import {
  figmaComponentEvidence,
  getFigmaMobileIcon,
} from '../design/figmaComponentEvidence';
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

function walkRenderedTree(node: ReactNode, visit: (element: ReactElement) => void) {
  if (!isValidElement(node)) {
    return;
  }
  if (typeof node.type === 'function') {
    const render = node.type as (props: unknown) => ReactNode;
    walkRenderedTree(render(node.props), visit);
    return;
  }
  visit(node);
  const children = propsOf(node).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      walkRenderedTree(child, visit);
    }
  } else {
    walkRenderedTree(children, visit);
  }
}

function getBackgroundLayout(width: number, insets: { left: number; right: number }) {
  windowMetrics.width = width;
  const background = AppBackground({ children: 'content', insets });
  const children = propsOf(background).children as ReactElement[];
  const safeArea = children[2];
  const content = propsOf(safeArea).children;

  return {
    content: isValidElement(content) ? flattenStyle(propsOf(content).style) : {},
    safeArea: flattenStyle(propsOf(safeArea).style),
  };
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
    icon: 'settings',
    onPress: vi.fn(),
    style: { minHeight: 0, minWidth: 0 },
  });
  const actionProps = propsOf(action);
  const actionStyle = flattenStyle(actionProps.style);

  expect(actionProps.accessibilityRole).toBe('button');
  expect(actionProps.accessibilityLabel).toBe('返回');
  expect(actionStyle.minWidth).toBeGreaterThanOrEqual(44);
  expect(actionStyle.minHeight).toBeGreaterThanOrEqual(44);

  const renderedTypes: unknown[] = [];
  const bareTextChildren: string[] = [];
  walkRenderedTree(action, (element) => {
    renderedTypes.push(element.type);
    const children = propsOf(element).children;
    if (typeof children === 'string') {
      bareTextChildren.push(children);
    }
  });
  expect(renderedTypes).toContain('Svg');
  expect(bareTextChildren).toEqual([]);

  const surface = propsOf(action).children as ReactElement;
  expect(propsOf(surface).colors).toEqual([
    'rgba(255,255,255,0.20)',
    'rgba(255,255,255,0.20)',
  ]);

  const error = ErrorState({ message: '网络连接失败', onRetry: vi.fn() });
  const errorChildren = propsOf(error).children as ReactElement[];
  const retry = errorChildren.find((child) => child.type === 'Pressable');
  expect(retry).toBeTruthy();
  const retryStyle = flattenStyle(propsOf(retry!).style);
  expect(retryStyle.minWidth).toBeGreaterThanOrEqual(44);
  expect(retryStyle.minHeight).toBeGreaterThanOrEqual(44);
});

test('circle action only accepts approved mobile icon names', () => {
  const icon: CircleActionProps['icon'] = 'arrow-right';
  // @ts-expect-error unsupported names must fail the TypeScript contract
  const unsupported: CircleActionProps['icon'] = 'emoji-or-text';

  expect(icon).toBe('arrow-right');
  expect(unsupported).toBe('emoji-or-text');
});

test('app background follows window width and asymmetric safe-area insets', () => {
  const compact = getBackgroundLayout(320, { left: 10, right: 30 });
  expect(compact.safeArea).toMatchObject({
    paddingLeft: 26,
    paddingRight: 46,
    width: 320,
  });
  expect(compact.content.width).toBe(248);

  const wide = getBackgroundLayout(430, { left: 24, right: 8 });
  expect(wide.safeArea).toMatchObject({
    paddingLeft: 48,
    paddingRight: 32,
    width: 430,
  });
  expect(wide.content.width).toBe(350);
});

test('app background explicit width is reserved for tests and screenshots', () => {
  windowMetrics.width = 900;
  const background = AppBackground({
    children: 'content',
    insets: { left: 0, right: 0 },
    width: 320,
  });
  const children = propsOf(background).children as ReactElement[];
  const safeArea = children[2];

  expect(flattenStyle(propsOf(safeArea).style)).toMatchObject({
    paddingLeft: 16,
    paddingRight: 16,
    width: 320,
  });
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

test('MobileIcon renders the audited Figma layers', () => {
  const definition = getFigmaMobileIcon('settings');
  const icon = MobileIcon({ name: 'settings', size: 18 });
  const renderedPaths: string[] = [];

  walkRenderedTree(icon, (element) => {
    if (element.type === 'Path' && typeof propsOf(element).d === 'string') {
      renderedPaths.push(propsOf(element).d as string);
    }
  });

  expect(renderedPaths).toEqual(definition.layers.map((layer) => layer.path));
});

test('corrected shared shells preserve accessibility, hit targets, and Figma source sizes', () => {
  const nav = BottomNav({ active: 'home', onNavigate: vi.fn() });
  const tabs = propsOf(nav).children as ReactElement[];

  expect(tabs).toHaveLength(4);
  expect(
    tabs.every((tab) => {
      const style = flattenStyle(propsOf(tab).style);
      return Number(style.minWidth) >= 44 && Number(style.minHeight) >= 44;
    }),
  ).toBe(true);
  expect(figmaComponentEvidence.bottomNav.size).toMatchObject({
    height: 54,
    width: 335,
  });
  expect(BrandHeader({}).type).toBe('View');
  expect(GlassCard({ children: 'content' }).type).toBe('View');
});
