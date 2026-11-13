/**
 * @vitest-environment happy-dom
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const native = vi.hoisted(() => ({
  animateTo: vi.fn(),
  panConfig: null as null | { onPanResponderTerminate?: () => void },
  platform: { OS: 'ios', select: (options: Record<string, string>) => options.ios ?? options.default },
  settle: vi.fn(),
}));

vi.mock('react-native', () => ({
  Animated: { View: () => null },
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
  View: () => null,
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
