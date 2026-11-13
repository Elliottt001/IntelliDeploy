/** @vitest-environment happy-dom */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const native = vi.hoisted(() => ({
  platform: { OS: 'web', select: (options: Record<string, unknown>) => options.web ?? options.default },
  panConfig: null as null | {
    onMoveShouldSetPanResponder: (_: unknown, gesture: { dx: number; dy: number }) => boolean;
    onPanResponderRelease: (_: unknown, gesture: { dx: number; dy: number }) => void;
    onPanResponderTerminate: () => void;
  },
  timing: vi.fn((_value: { setValue: (value: number) => void }, _config: { toValue: number; duration: number }) => ({ start: vi.fn(), stop: vi.fn() })),
}));

// Render the actual RN Web views and source-motion hook. Only native platform
// boundaries (PanResponder, animation driver, SVG/asset loading) are replaced.
vi.mock('react-native', async () => {
  const web = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {
    ...web,
    Animated: { ...web.Animated, timing: native.timing },
    Platform: native.platform,
    PanResponder: { create: (config: typeof native.panConfig) => { native.panConfig = config; return { panHandlers: {} }; } },
    AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
    AppState: { addEventListener: () => ({ remove() {} }) },
  };
});
vi.mock('react-native-svg', () => ({
  default: () => null, Defs: () => null, FeDropShadow: () => null, Filter: () => null,
  G: () => null, Path: () => null, Rect: () => null, ClipPath: () => null,
  LinearGradient: () => null, RadialGradient: () => null, Stop: () => null,
}));
vi.mock('../design/generated/mobileAssetManifest', () => ({ mobileAssets: { '845:3522:114': { source: 1 } } }));

import { CommunitySourceRail } from '../features/community/DiscoveryCard';

const roots = new Set<Root>();
beforeEach(() => {
  native.platform.OS = 'web';
  native.panConfig = null;
  native.timing.mockClear();
});
afterEach(() => {
  act(() => roots.forEach(root => root.unmount()));
  roots.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function renderRail() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.add(root);
  act(() => root.render(createElement(CommunitySourceRail, { cards: [{ id: 'body', copy: { author: null, time: null, body: 'scrollable copy' } }] })));
  const responder = container.querySelector<HTMLElement>('[data-testid="community-source-drag-responder"]')!;
  const body = container.querySelector<HTMLElement>('[data-testid="community-card-body"]')!;
  return { responder, body, unmount: () => { act(() => root.unmount()); roots.delete(root); } };
}

function pointer(target: EventTarget, type: string, x = 120, y = 30, pointerId = 7) {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId, isPrimary: true, button: 0 });
  act(() => target.dispatchEvent(event));
  return event;
}
function mouse(target: EventTarget, type: string, x = 120) {
  act(() => target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: 30, button: 0 })));
}
function capture(responder: HTMLElement) {
  const set = vi.fn(), release = vi.fn();
  Object.assign(responder, { setPointerCapture: set, releasePointerCapture: release });
  return { set, release };
}
function listenerSpies() {
  const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
  const gestureAdds = () => add.mock.calls.filter(([type]) => ['pointermove', 'pointerup', 'pointercancel', 'mousemove', 'mouseup'].includes(type));
  const expectClean = () => {
    const additions = gestureAdds();
    expect(additions.map(([type]) => type).sort()).toEqual(['pointercancel', 'pointermove', 'pointerup']);
    for (const [type, handler] of additions) expect(remove.mock.calls.filter(call => call[0] === type && call[1] === handler)).toHaveLength(1);
  };
  return { gestureAdds, expectClean };
}

test('rendered child pointer propagation and compatibility mouse delivery install one gesture and animate once', () => {
  const { responder, body } = renderRail(), listeners = listenerSpies(), handles = capture(responder);
  const phases: string[] = [];
  responder.addEventListener('pointerdown', () => phases.push('capture'), true);
  responder.addEventListener('pointerdown', () => phases.push('bubble'));
  handles.release.mockImplementation(() => pointer(responder, 'lostpointercapture'));
  pointer(body, 'pointerdown'); mouse(body, 'mousedown');
  pointer(body, 'pointerdown'); // A duplicate down for the same active pointer must be ignored.
  pointer(body, 'pointermove', 20); mouse(body, 'mousemove', 20);
  pointer(body, 'pointerup', 20); mouse(body, 'mouseup', 20);
  pointer(document, 'pointerup', 20);
  expect(phases).toEqual(['capture', 'bubble', 'capture', 'bubble']);
  expect(native.timing).toHaveBeenCalledTimes(1);
  expect(native.timing.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: 300.00001192092896 });
  expect(handles.set).toHaveBeenCalledTimes(1);
  expect(handles.release).toHaveBeenCalledExactlyOnceWith(7);
  listeners.expectClean();
});

test.each(['absent', 'throws'])('document pointer fallback handles an outside release once when capture %s', (mode) => {
  const { responder } = renderRail(), listeners = listenerSpies();
  if (mode === 'throws') Object.assign(responder, { setPointerCapture() { throw new DOMException('no capture'); } });
  pointer(responder, 'pointerdown');
  pointer(document.body, 'pointermove', 20);
  pointer(document.body, 'pointerup', 20);
  pointer(document.body, 'pointerup', 20); mouse(document.body, 'mouseup', 20);
  expect(native.timing).toHaveBeenCalledTimes(1);
  listeners.expectClean();
});

test.each(['pointercancel', 'lostpointercapture'])('%s cleans handles and settles to the latest stable target once', (event) => {
  const { responder } = renderRail();
  pointer(responder, 'pointerdown'); pointer(responder, 'pointermove', 20); pointer(responder, 'pointerup', 20);
  expect(native.timing).toHaveBeenCalledTimes(1);
  // A real source animation is in flight toward 60; cancel the next gesture at 30%.
  act(() => native.timing.mock.calls[0][0].setValue(0.3));
  const listeners = listenerSpies(), handles = capture(responder);
  pointer(responder, 'pointerdown'); pointer(responder, 'pointermove', 220);
  pointer(responder, event, 220);
  pointer(document, 'pointerup', 220); pointer(responder, event, 220);
  expect(native.timing).toHaveBeenCalledTimes(2);
  expect(native.timing.mock.calls[1][1]).toMatchObject({ toValue: 1, duration: 210.00000834465027 });
  expect(handles.release).toHaveBeenCalledExactlyOnceWith(7);
  listeners.expectClean();
});

test('unmount removes document listeners and releases capture without late animation', () => {
  const { responder, unmount } = renderRail(), listeners = listenerSpies(), handles = capture(responder);
  pointer(responder, 'pointerdown'); pointer(document, 'pointermove', 20);
  unmount();
  pointer(document, 'pointerup', 20); pointer(document, 'pointercancel', 20);
  expect(native.timing).not.toHaveBeenCalled();
  expect(handles.release).toHaveBeenCalledExactlyOnceWith(7);
  listeners.expectClean();
});

test('vertical body gesture stays uncaptured and unprevented, and another pointer cannot end it', () => {
  const { responder, body } = renderRail(), listeners = listenerSpies(), handles = capture(responder);
  pointer(body, 'pointerdown');
  expect(pointer(body, 'pointermove', 125, 160).defaultPrevented).toBe(false);
  pointer(document, 'pointerup', 20, 30, 8);
  expect(listeners.gestureAdds()).toHaveLength(3);
  expect(handles.set).not.toHaveBeenCalled();
  pointer(document, 'pointerup', 125, 160);
  expect(native.timing).not.toHaveBeenCalled();
  expect(handles.release).not.toHaveBeenCalled();
  listeners.expectClean();
});

test('native PanResponder keeps horizontal release and terminate while rejecting vertical claim', async () => {
  native.platform.OS = 'ios';
  renderRail();
  await act(async () => {});
  expect(native.panConfig?.onMoveShouldSetPanResponder({}, { dx: 8, dy: 130 })).toBe(false);
  act(() => native.panConfig?.onPanResponderRelease({}, { dx: -100, dy: 0 }));
  expect(native.timing).toHaveBeenCalledTimes(1);
  act(() => native.timing.mock.calls[0][0].setValue(0.4));
  act(() => native.panConfig?.onPanResponderRelease({}, { dx: 100, dy: 0 }));
  expect(native.timing.mock.calls[1][1]).toMatchObject({ toValue: 0 });
  act(() => native.panConfig?.onPanResponderTerminate());
  expect(native.timing).toHaveBeenCalledTimes(3);
  expect(native.timing.mock.calls[2][1]).toMatchObject({ toValue: 0 });
});
