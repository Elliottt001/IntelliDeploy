import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StatusBar as NativeStatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

const CAT_IMAGE = require('../assets/images/login-cat.png');
const ARTBOARD_WIDTH = 375;
const ARTBOARD_HEIGHT = 812;

export default function Splash() {
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const intro = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const artboardScale =
    Platform.OS === 'web'
      ? 1
      : Math.min(viewportWidth / ARTBOARD_WIDTH, viewportHeight / ARTBOARD_HEIGHT);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      NativeStatusBar.setHidden(true, 'none');
    }

    Animated.parallel([
      Animated.timing(intro, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ripple, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(ripple, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();

    const timer = setTimeout(() => {
      router.replace('/login');
    }, 2200);

    return () => clearTimeout(timer);
  }, [intro, ripple, router]);

  return (
    <View style={styles.shell}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" hidden translucent backgroundColor="transparent" />
      <View
        style={[
          styles.artboardShell,
          {
            width: ARTBOARD_WIDTH * artboardScale,
            height: ARTBOARD_HEIGHT * artboardScale,
          },
        ]}
      >
      <View style={[styles.artboard, { transform: [{ scale: artboardScale }] }]}>
        <View style={styles.bg} />
        <Animated.View
          style={[
            styles.rippleOuter,
            {
              opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] }),
              transform: [
                {
                  scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.rippleInner,
            {
              opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.42] }),
              transform: [
                {
                  scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.04] }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.catWrap,
            {
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
                },
                {
                  scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
                },
              ],
            },
          ]}
        >
          <Image source={CAT_IMAGE} resizeMode="contain" style={styles.cat} />
        </Animated.View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  artboardShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artboard: {
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    backgroundColor: '#F4F6FF',
    position: 'relative',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F4F6FF',
  },
  rippleOuter: {
    position: 'absolute',
    left: 66,
    top: 315,
    width: 244,
    height: 88,
    borderRadius: 122,
    backgroundColor: 'rgba(221, 213, 255, 0.65)',
  },
  rippleInner: {
    position: 'absolute',
    left: 107,
    top: 334,
    width: 162,
    height: 46,
    borderRadius: 81,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  catWrap: {
    position: 'absolute',
    left: 129,
    top: 296,
    width: 117,
    height: 107,
  },
  cat: {
    width: '100%',
    height: '100%',
    opacity: 0.86,
    transform: [{ rotate: '-6deg' }],
  },
});
