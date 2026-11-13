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
  progress: Animated.Value;
  start: () => void;
  cancel: () => void;
} {
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<AnimationHandle | null>(null);
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

  const start = useCallback(() => {
    cancel();
    if (!motion || reducedMotion) {
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.durationMs,
      easing: (t: number) => sampleSourceEasing(motion, t),
      useNativeDriver: false,
    });
    animationRef.current = animation;
    animation.start(({ finished }) => {
      if (finished) {
        animationRef.current = null;
      }
    });
  }, [cancel, motion, progress, reducedMotion]);

  useEffect(() => {
    cancel();
    progress.setValue(reducedMotion ? 1 : 0);
  }, [cancel, motion, progress, reducedMotion]);

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

  return { progress, start, cancel };
}
