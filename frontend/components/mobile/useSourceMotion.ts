import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Platform,
} from 'react-native';

import type { SourceMotion } from '../../design/sourceMotionEvidence';
import { sampleSourceEasing } from '../../features/navigation/sourceMotionPolicy';

type AnimationHandle = {
  stop: () => void;
};

type MediaQueryHandle = {
  matches: boolean;
  addEventListener?: (
    event: 'change',
    listener: (event: { matches: boolean }) => void,
  ) => void;
  removeEventListener?: (
    event: 'change',
    listener: (event: { matches: boolean }) => void,
  ) => void;
  addListener?: (listener: (event: { matches: boolean }) => void) => void;
  removeListener?: (listener: (event: { matches: boolean }) => void) => void;
};

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function webReducedMotionSource(): MediaQueryHandle | null {
  const maybeWindow = globalThis as typeof globalThis & {
    matchMedia?: (query: string) => MediaQueryHandle;
  };
  return typeof maybeWindow.matchMedia === 'function'
    ? maybeWindow.matchMedia(reducedMotionQuery)
    : null;
}

export function useSourceMotion(motion: SourceMotion | null): {
  animateTo: (toValue: 0 | 1) => void;
  progress: Animated.Value;
  start: () => void;
  cancel: () => void;
} {
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<AnimationHandle | null>(null);
  const progressValueRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (Platform.OS !== 'web') {
      return false;
    }
    return webReducedMotionSource()?.matches ?? false;
  });

  const cancel = useCallback(() => {
    animationRef.current?.stop();
    animationRef.current = null;
  }, []);

  const setProgressValue = useCallback(
    (value: number) => {
      progressValueRef.current = value;
      progress.setValue(value);
    },
    [progress],
  );

  const animateTo = useCallback((toValue: 0 | 1) => {
    cancel();
    if (!motion || reducedMotion) {
      setProgressValue(toValue);
      return;
    }
    const distance = Math.abs(toValue - progressValueRef.current);
    if (distance === 0) {
      setProgressValue(toValue);
      return;
    }

    const animation = Animated.timing(progress, {
      toValue,
      duration: motion.durationMs * distance,
      easing: (t: number) =>
        toValue === 1
          ? sampleSourceEasing(motion, t)
          : 1 - sampleSourceEasing(motion, 1 - t),
      useNativeDriver: false,
    });
    animationRef.current = animation;
    animation.start(({ finished }) => {
      if (finished) {
        animationRef.current = null;
      }
    });
  }, [cancel, motion, progress, reducedMotion, setProgressValue]);

  const start = useCallback(() => animateTo(1), [animateTo]);

  useEffect(() => {
    cancel();
    setProgressValue(reducedMotion ? 1 : 0);
  }, [cancel, motion, reducedMotion, setProgressValue]);

  useEffect(() => {
    const listenerId = progress.addListener(({ value }) => {
      progressValueRef.current = value;
    });
    return () => {
      progress.removeListener(listenerId);
    };
  }, [progress]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const source = webReducedMotionSource();
      if (!source) {
        return undefined;
      }
      const listener = (event: { matches: boolean }) => {
        setReducedMotion(event.matches);
      };
      if (source.addEventListener) {
        source.addEventListener('change', listener);
      } else {
        source.addListener?.(listener);
      }
      return () => {
        if (source.removeEventListener) {
          source.removeEventListener('change', listener);
        } else {
          source.removeListener?.(listener);
        }
      };
    }

    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReducedMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state !== 'active') {
          cancel();
        }
      },
    );
    return () => {
      subscription.remove();
      cancel();
    };
  }, [cancel]);

  return { animateTo, progress, start, cancel };
}
