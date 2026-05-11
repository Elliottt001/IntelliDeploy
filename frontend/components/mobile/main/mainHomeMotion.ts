import { Animated, Easing } from 'react-native';

export const mainHomeMotion = {
  introFast: 420,
  introMedium: 560,
  introSlow: 680,
  miboSlide: 600,
  cardExpand: 639,
  gentleState: 1022,
  routeSlide: 300,
  arrowSpring: {
    mass: 1,
    stiffness: 145,
    damping: 11.4,
  },
};

export function gentleEase(value: number) {
  return Easing.out(Easing.cubic)(value);
}

export function runPressPulse(value: Animated.Value) {
  value.stopAnimation();
  value.setValue(0);
  Animated.sequence([
    Animated.timing(value, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.timing(value, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]).start();
}
