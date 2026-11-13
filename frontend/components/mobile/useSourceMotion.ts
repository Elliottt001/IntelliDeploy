import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Platform } from "react-native";

import type { SourceMotion } from "../../design/sourceMotionEvidence";
import { sampleSourceEasing } from "../../features/navigation/sourceMotionPolicy";

type AnimationHandle = {
  stop: () => void;
};

type AnimatedValueWithStop = Animated.Value & {
  stopAnimation?: (callback?: (value: number) => void) => void;
};

type MediaQueryHandle = {
  matches: boolean;
  addEventListener?: (
    event: "change",
    listener: (event: { matches: boolean }) => void,
  ) => void;
  removeEventListener?: (
    event: "change",
    listener: (event: { matches: boolean }) => void,
  ) => void;
  addListener?: (listener: (event: { matches: boolean }) => void) => void;
  removeListener?: (listener: (event: { matches: boolean }) => void) => void;
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function webReducedMotionSource(): MediaQueryHandle | null {
  const maybeWindow = globalThis as typeof globalThis & {
    matchMedia?: (query: string) => MediaQueryHandle;
  };
  return typeof maybeWindow.matchMedia === "function"
    ? maybeWindow.matchMedia(reducedMotionQuery)
    : null;
}

export function useSourceMotion(motion: SourceMotion | null): {
  animateTo: (toValue: 0 | 1, onComplete?: () => void) => void;
  progress: Animated.Value;
  start: (onComplete?: () => void) => void;
  cancel: () => void;
  getCurrentValue: () => number;
} {
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<AnimationHandle | null>(null);
  const progressValueRef = useRef(0);
  const targetValueRef = useRef<0 | 1>(0);
  const appStateCancelledRef = useRef(false);
  const completionRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (Platform.OS !== "web") {
      return false;
    }
    return webReducedMotionSource()?.matches ?? false;
  });
  const reducedMotionRef = useRef(reducedMotion);

  const stop = useCallback((discardCompletion: boolean) => {
    generationRef.current += 1;
    animationRef.current?.stop();
    animationRef.current = null;
    if (discardCompletion) completionRef.current = null;
  }, []);
  const cancel = useCallback(() => stop(true), [stop]);

  const setProgressValue = useCallback(
    (value: number) => {
      progressValueRef.current = value;
      progress.setValue(value);
    },
    [progress],
  );

  const syncProgressValue = useCallback(() => {
    (progress as AnimatedValueWithStop).stopAnimation?.((value) => {
      progressValueRef.current = value;
    });
  }, [progress]);

  const finishCurrent = useCallback(() => {
    const complete = completionRef.current;
    completionRef.current = null;
    complete?.();
  }, []);

  const runTo = useCallback(
    (toValue: 0 | 1) => {
      targetValueRef.current = toValue;
      syncProgressValue();
      stop(false);
      if (!motion || reducedMotionRef.current) {
        setProgressValue(toValue);
        finishCurrent();
        return;
      }
      const distance = Math.abs(toValue - progressValueRef.current);
      if (distance === 0) {
        setProgressValue(toValue);
        finishCurrent();
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
      const generation = generationRef.current;
      animationRef.current = animation;
      animation.start(({ finished }) => {
        if (
          finished &&
          animationRef.current === animation &&
          generationRef.current === generation
        ) {
          animationRef.current = null;
          finishCurrent();
        }
      });
    },
    [
      finishCurrent,
      motion,
      progress,
      setProgressValue,
      stop,
      syncProgressValue,
    ],
  );

  const animateTo = useCallback(
    (toValue: 0 | 1, onComplete?: () => void) => {
      completionRef.current = onComplete ?? null;
      runTo(toValue);
    },
    [runTo],
  );

  const start = useCallback(
    (onComplete?: () => void) => animateTo(1, onComplete),
    [animateTo],
  );

  useEffect(() => {
    cancel();
    targetValueRef.current = 0;
    setProgressValue(0);
  }, [cancel, motion, setProgressValue]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    stop(false);
    setProgressValue(targetValueRef.current);
    if (reducedMotion) finishCurrent();
  }, [finishCurrent, reducedMotion, setProgressValue, stop]);

  useEffect(() => {
    const listenerId = progress.addListener(({ value }) => {
      progressValueRef.current = value;
    });
    return () => {
      progress.removeListener(listenerId);
    };
  }, [progress]);

  useEffect(() => {
    if (Platform.OS === "web") {
      const source = webReducedMotionSource();
      if (!source) {
        return undefined;
      }
      const listener = (event: { matches: boolean }) => {
        setReducedMotion(event.matches);
      };
      if (source.addEventListener) {
        source.addEventListener("change", listener);
      } else {
        source.addListener?.(listener);
      }
      return () => {
        if (source.removeEventListener) {
          source.removeEventListener("change", listener);
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
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        appStateCancelledRef.current = true;
        syncProgressValue();
        stop(false);
        return;
      }
      if (appStateCancelledRef.current) {
        appStateCancelledRef.current = false;
        runTo(targetValueRef.current);
      }
    });
    return () => {
      subscription.remove();
      cancel();
    };
  }, [cancel, runTo, stop, syncProgressValue]);

  const getCurrentValue = useCallback(() => {
    let current = progressValueRef.current;
    (progress as AnimatedValueWithStop).stopAnimation?.((value) => {
      current = value;
      progressValueRef.current = value;
    });
    stop(true);
    return current;
  }, [progress, stop]);
  return { animateTo, progress, start, cancel, getCurrentValue };
}
