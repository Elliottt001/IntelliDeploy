/**
 * @vitest-environment happy-dom
 */
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const native = vi.hoisted(() => ({
  animateTo: vi.fn(),
  panConfig: null as null | { onPanResponderRelease?: (_: unknown, gesture: { dx: number; dy: number }) => void; onPanResponderTerminate?: () => void },
  platform: { OS: 'ios', select: (options: Record<string, string>) => options.ios ?? options.default },
  responderProps: null as null | Record<string, (...args: any[]) => void>,
  settle: vi.fn(),
}));

function MockView(props: { children?: ReactNode; testID?: string } & Record<string, any>) {
  if (props.testID === 'community-source-drag-responder') {
    native.responderProps = props;
  }
  return createElement('div', {}, props.children);
}

vi.mock('react-native', () => ({
  Animated: { View: MockView },
  Image: () => null,
  PanResponder: {
    create: vi.fn((config: { onPanResponderTerminate?: () => void }) => {
      native.panConfig = config;
      return { panHandlers: {} };
    }),
  },
  Platform: native.platform,
  Pressable: () => null,
  ScrollView: () => null,
  StyleSheet: {
    absoluteFill: {},
    create: <T,>(styles: T) => styles,
  },
  Text: () => null,
  View: MockView,
}));
vi.mock('react-native-svg', () => ({
  Defs: 'Defs',
  FeDropShadow: 'FeDropShadow',
  Filter: 'Filter',
  G: 'G',
  Path: 'Path',
  default: 'Svg',
}));
vi.mock('../components/mobile/FigmaTree', () => ({ FigmaTree: () => null }));
vi.mock('../design/generated/mobileAssetManifest', () => ({
  mobileAssets: { '845:3522:114': { source: 1 } },
}));
vi.mock('../components/mobile/useSourceMotion', () => ({
  useSourceMotion: () => ({
    animateTo: native.animateTo,
    progress: { addListener: vi.fn(() => 'listener'), interpolate: vi.fn(() => 0), removeListener: vi.fn() },
    settle: native.settle,
  }),
}));

import { CommunitySourceRail } from '../features/community/DiscoveryCard';

beforeEach(() => {
  native.animateTo.mockClear();
  native.settle.mockClear();
  native.panConfig = null;
  native.responderProps = null;
  native.platform.OS = 'ios';
});

afterEach(() => {
  document.body.innerHTML = '';
});

function renderRail() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(CommunitySourceRail, { cards: [] }));
  });
  return root;
}

test('native PanResponder termination settles through the source motion hook', () => {
  const root = renderRail();

  act(() => native.panConfig?.onPanResponderTerminate?.());

  expect(native.settle).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});

test('web PanResponder termination does not override pointer cancel handling', () => {
  native.platform.OS = 'web';
  const root = renderRail();

  act(() => native.panConfig?.onPanResponderTerminate?.());

  expect(native.settle).not.toHaveBeenCalled();
  act(() => root.unmount());
});

test('web pointer release is the only release authority', () => {
  native.platform.OS = 'web';
  const root = renderRail();

  act(() => {
    native.responderProps?.onPointerDown?.({ nativeEvent: { clientX: 120, clientY: 30 } });
    native.responderProps?.onPointerMove?.({ nativeEvent: { clientX: 20, clientY: 30 } });
    native.responderProps?.onPointerUp?.({ nativeEvent: { clientX: 20, clientY: 30 } });
    native.panConfig?.onPanResponderRelease?.({}, { dx: -100, dy: 0 });
  });

  expect(native.animateTo).toHaveBeenCalledTimes(1);
  expect(native.animateTo).toHaveBeenCalledWith(1);
  act(() => root.unmount());
});

test('native PanResponder release remains the native authority', () => {
  const root = renderRail();

  act(() => native.panConfig?.onPanResponderRelease?.({}, { dx: -100, dy: 0 }));

  expect(native.animateTo).toHaveBeenCalledTimes(1);
  expect(native.animateTo).toHaveBeenCalledWith(1);
  act(() => root.unmount());
});
