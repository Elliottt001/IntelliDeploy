import { Animated, StyleSheet, View } from 'react-native';

import { lightTokens } from './mainHomeTokens';

type MainHomeBackgroundProps = {
  floatY: Animated.AnimatedInterpolation<number | string>;
  inverseFloatY: Animated.AnimatedInterpolation<number | string>;
};

export default function MainHomeBackground({ floatY, inverseFloatY }: MainHomeBackgroundProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.base} />
      <View style={styles.topWash} />
      <View style={styles.centerWash} />
      <View style={styles.whiteGlow} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: lightTokens.colors.frameStart,
  },
  topWash: {
    position: 'absolute',
    left: 84,
    top: -78,
    width: 420,
    height: 360,
    borderRadius: 210,
    backgroundColor: 'rgba(255,255,255,0.40)',
  },
  centerWash: {
    position: 'absolute',
    left: -46,
    top: 180,
    width: 510,
    height: 360,
    borderRadius: 255,
    backgroundColor: 'rgba(255,255,255,0.23)',
  },
  whiteGlow: {
    position: 'absolute',
    left: 40,
    top: 525,
    width: 236,
    height: 66,
    borderRadius: 118,
    backgroundColor: 'rgba(255,255,255,0.50)',
  },
});
