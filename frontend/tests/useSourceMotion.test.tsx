/**
 * @vitest-environment happy-dom
 */
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { SourceMotion } from '../design/sourceMotionEvidence';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const native = vi.hoisted(() => {
  type AppStateListener = (state: string) => void;
  type ReduceMotionListener = (enabled: boolean) => void;

  class MockAnimatedValue {
    private listenerId = 0;
    private listeners = new Map<string, (event: { value: number }) => void>();
    value: number;
    addListener: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
    setValue: ReturnType<typeof vi.fn>;

    constructor(value: number) {
      this.value = value;
      this.addListener = vi.fn((listener: (event: { value: number }) => void) => {
        const id = String(++this.listenerId);
        this.listeners.set(id, listener);
        return id;
      });
      this.removeListener = vi.fn((id: string) => {
        this.listeners.delete(id);
      });
      this.setValue = vi.fn((next: number) => {
        this.value = next;
        this.listeners.forEach((listener) => listener({ value: next }));
      });
    }
  }

  const appStateListeners = new Set<AppStateListener>();
  const reduceMotionListeners = new Set<ReduceMotionListener>();
  const animations: Array<{
    config: Record<string, unknown>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    value: MockAnimatedValue;
  }> = [];

  const store = {
    animations,
    appStateListeners,
    appStateRemoveCalls: [] as Array<ReturnType<typeof vi.fn>>,
    platform: { OS: 'ios' },
    reduceMotionListeners,
    reduceMotionRemoveCalls: [] as Array<ReturnType<typeof vi.fn>>,
    reduceMotionPromise: Promise.resolve(false),
    timing: vi.fn(
      (value: MockAnimatedValue, config: Record<string, unknown>) => {
        const animation = {
          config,
          start: vi.fn(),
          stop: vi.fn(),
          value,
        };
        animations.push(animation);
        return animation;
      },
    ),
    reset() {
      animations.splice(0);
      appStateListeners.clear();
      reduceMotionListeners.clear();
      this.appStateRemoveCalls.splice(0);
      this.reduceMotionRemoveCalls.splice(0);
      this.platform.OS = 'ios';
      this.reduceMotionPromise = Promise.resolve(false);
      this.timing.mockClear();
    },
  };

  return { MockAnimatedValue, store };
});

vi.mock('react-native', () => ({
  AccessibilityInfo: {
    addEventListener: vi.fn(
      (event: 'reduceMotionChanged', listener: (enabled: boolean) => void) => {
        native.store.reduceMotionListeners.add(listener);
        const remove = vi.fn(() => {
          native.store.reduceMotionListeners.delete(listener);
        });
        native.store.reduceMotionRemoveCalls.push(remove);
        return { remove };
      },
    ),
    isReduceMotionEnabled: vi.fn(() => native.store.reduceMotionPromise),
  },
  Animated: {
    Value: native.MockAnimatedValue,
    timing: native.store.timing,
  },
  AppState: {
    addEventListener: vi.fn(
      (event: 'change', listener: (state: string) => void) => {
        native.store.appStateListeners.add(listener);
        const remove = vi.fn(() => {
          native.store.appStateListeners.delete(listener);
        });
        native.store.appStateRemoveCalls.push(remove);
        return { remove };
      },
    ),
  },
  Platform: native.store.platform,
}));

import { useSourceMotion } from '../components/mobile/useSourceMotion';

type SourceMotionApi = ReturnType<typeof useSourceMotion>;
type MediaListener = (event: { matches: boolean }) => void;

const motion = (overrides: Partial<SourceMotion> = {}): SourceMotion => ({
  nodeId: '846:3544',
  interactionId: '852:4337',
  event: 'AFTER_TIMEOUT',
  navigation: 'NAVIGATE',
  targetNodeId: '849:3608',
  transition: 'SMART_ANIMATE',
  durationMs: 1250.1229047775269,
  prototypeDelayMs: 300.00001192092896,
  easingType: 'SPRING_PRESET_THREE',
  easingFunction: [1, 80, 20, 0],
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function flushPromises() {
  return Promise.resolve();
}

function renderHookHarness(sourceMotion: SourceMotion | null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let latest!: SourceMotionApi;

  function Harness({ currentMotion }: { currentMotion: SourceMotion | null }) {
    const api = useSourceMotion(currentMotion);
    useEffect(() => {
      latest = api;
    }, [api]);
    return null;
  }

  const render = (nextMotion: SourceMotion | null) =>
    act(() => {
      root.render(createElement(Harness, { currentMotion: nextMotion }));
    });
  const unmount = () =>
    act(() => {
      root.unmount();
    });

  render(sourceMotion);
  return {
    get api() {
      return latest;
    },
    render,
    unmount,
  };
}

function installMatchMedia(matches = false) {
  const listeners = new Set<MediaListener>();
  const addEventListener = vi.fn((event: 'change', listener: MediaListener) => {
    listeners.add(listener);
  });
  const removeEventListener = vi.fn(
    (event: 'change', listener: MediaListener) => {
      listeners.delete(listener);
    },
  );
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    addEventListener,
    matches,
    removeEventListener,
  })));
  return {
    addEventListener,
    emit(nextMatches: boolean) {
      act(() => {
        listeners.forEach((listener) => listener({ matches: nextMatches }));
      });
    },
    listenerCount: () => listeners.size,
    removeEventListener,
  };
}

beforeEach(() => {
  native.store.reset();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('restart stops the active animation before starting a new source timing', () => {
  const harness = renderHookHarness(motion());

  act(() => harness.api.start());
  act(() => harness.api.start());

  expect(native.store.timing).toHaveBeenCalledTimes(2);
  expect(native.store.animations[0].stop).toHaveBeenCalledTimes(1);
  expect(native.store.animations[1].stop).not.toHaveBeenCalled();
  expect(native.store.animations[1].config).toMatchObject({
    duration: 1250.1229047775269,
    toValue: 1,
    useNativeDriver: false,
  });
});

test('animateTo reverses from the tracked current progress without private value reads', () => {
  const harness = renderHookHarness(motion({ durationMs: 1000 }));
  const api = harness.api as SourceMotionApi & {
    animateTo: (toValue: 0 | 1) => void;
  };
  const progress = api.progress as unknown as {
    __getValue?: () => number;
    setValue: (next: number) => void;
  };
  progress.setValue(0.25);
  progress.__getValue = vi.fn(() => {
    throw new Error('private value read');
  });

  act(() => api.animateTo(1));
  act(() => api.animateTo(0));

  expect(native.store.timing).toHaveBeenCalledTimes(2);
  expect(native.store.animations[1].config).toMatchObject({
    duration: 250,
    toValue: 0,
    useNativeDriver: false,
  });
});

test('motion changes cancel active animation and reset visual progress', () => {
  const harness = renderHookHarness(motion());

  act(() => harness.api.start());
  const firstProgress = harness.api.progress as unknown as {
    setValue: ReturnType<typeof vi.fn>;
  };
  firstProgress.setValue.mockClear();

  harness.render(motion({ durationMs: 800.000011920929 }));

  expect(native.store.animations[0].stop).toHaveBeenCalledTimes(1);
  expect(firstProgress.setValue).toHaveBeenCalledWith(0);

  act(() => harness.api.start());

  expect(native.store.animations[1].config).toMatchObject({
    duration: 800.000011920929,
  });
});

test('web reduced motion completes progress without creating timing', () => {
  native.store.platform.OS = 'web';
  installMatchMedia(true);
  const harness = renderHookHarness(motion());
  const progress = harness.api.progress as unknown as {
    setValue: ReturnType<typeof vi.fn>;
  };
  progress.setValue.mockClear();

  act(() => harness.api.start());

  expect(native.store.timing).not.toHaveBeenCalled();
  expect(progress.setValue).toHaveBeenCalledWith(1);
});

test('web media changes toggle reduced motion and cleanup the listener', () => {
  native.store.platform.OS = 'web';
  const media = installMatchMedia(false);
  const harness = renderHookHarness(motion());

  media.emit(true);
  const progress = harness.api.progress as unknown as {
    setValue: ReturnType<typeof vi.fn>;
  };
  progress.setValue.mockClear();

  act(() => harness.api.start());

  expect(native.store.timing).not.toHaveBeenCalled();
  expect(progress.setValue).toHaveBeenCalledWith(1);

  harness.unmount();

  expect(media.addEventListener).toHaveBeenCalledTimes(1);
  expect(media.removeEventListener).toHaveBeenCalledTimes(1);
  expect(media.listenerCount()).toBe(0);
});

test('native async reduced motion update completes progress without timing', async () => {
  const reduceMotion = deferred<boolean>();
  native.store.reduceMotionPromise = reduceMotion.promise;
  const harness = renderHookHarness(motion());
  const progress = harness.api.progress as unknown as {
    setValue: ReturnType<typeof vi.fn>;
  };
  progress.setValue.mockClear();

  await act(async () => {
    reduceMotion.resolve(true);
    await flushPromises();
  });
  act(() => harness.api.start());

  expect(native.store.timing).not.toHaveBeenCalled();
  expect(progress.setValue).toHaveBeenCalledWith(1);
});

test('background states cancel active animation but active state does not', () => {
  const harness = renderHookHarness(motion());

  act(() => harness.api.start());
  act(() => {
    native.store.appStateListeners.forEach((listener) => listener('active'));
  });

  expect(native.store.animations[0].stop).not.toHaveBeenCalled();

  act(() => {
    native.store.appStateListeners.forEach((listener) => listener('background'));
  });

  expect(native.store.animations[0].stop).toHaveBeenCalledTimes(1);
});

test('unmount removes native listeners, stops animation, and ignores late accessibility promises', async () => {
  const reduceMotion = deferred<boolean>();
  native.store.reduceMotionPromise = reduceMotion.promise;
  const harness = renderHookHarness(motion());

  act(() => harness.api.start());
  const progress = harness.api.progress as unknown as {
    setValue: ReturnType<typeof vi.fn>;
  };
  progress.setValue.mockClear();
  harness.unmount();

  expect(native.store.animations[0].stop).toHaveBeenCalledTimes(1);
  expect(native.store.appStateRemoveCalls[0]).toHaveBeenCalledTimes(1);
  expect(native.store.reduceMotionRemoveCalls[0]).toHaveBeenCalledTimes(1);
  expect(native.store.appStateListeners.size).toBe(0);
  expect(native.store.reduceMotionListeners.size).toBe(0);

  await act(async () => {
    reduceMotion.resolve(true);
    await flushPromises();
  });

  expect(progress.setValue).not.toHaveBeenCalled();
});
