import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';

import { lightLayout, lightTokens } from './mainHomeTokens';
type MainHomeHeaderProps = {
  intro: Animated.Value;
  onPressSettings?: () => void;
};

const LOGO_IMAGE = require('../../../assets/images/login-logo.png');
const WORDMARK_IMAGE = require('../../../assets/images/login-wordmark.png');

export default function MainHomeHeader({ intro, onPressSettings }: MainHomeHeaderProps) {
  return (
    <Animated.View
      style={[
        styles.header,
        {
          opacity: intro,
          transform: [
            {
              translateY: intro.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.brand}>
        <View style={styles.logoCircle}>
          <Image source={LOGO_IMAGE} resizeMode="contain" style={styles.logoImage} />
        </View>
        <View style={styles.brandCopy}>
          <Image source={WORDMARK_IMAGE} resizeMode="contain" style={styles.wordmarkImage} />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="打开设置"
        onPress={onPressSettings}
        style={({ pressed }) => [styles.settings, pressed && styles.settingsPressed]}
      >
        <SettingsGlyph />
      </Pressable>
    </Animated.View>
  );
}

function SettingsGlyph() {
  return (
    <View style={styles.gearGlyph}>
      <View style={styles.gearRing} />
      <View style={styles.gearCore} />
      <View style={[styles.gearTooth, styles.gearToothTop]} />
      <View style={[styles.gearTooth, styles.gearToothRight]} />
      <View style={[styles.gearTooth, styles.gearToothBottom]} />
      <View style={[styles.gearTooth, styles.gearToothLeft]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    left: lightLayout.header.left,
    top: lightLayout.header.top,
    width: lightLayout.header.width,
    height: lightLayout.header.height,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    width: 170.609,
    paddingLeft: 6.783,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.74,
  },
  logoCircle: {
    width: 31.304,
    height: 31.304,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: lightTokens.colors.white,
    backgroundColor: lightTokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...lightTokens.shadow.soft,
  },
  logoMark: {
    width: 19,
    height: 14,
    position: 'relative',
  },
  logoNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: lightTokens.colors.white,
  },
  logoNodeLeft: {
    left: 1,
    top: 3,
  },
  logoNodeRight: {
    right: 1,
    top: 3,
  },
  logoBridge: {
    position: 'absolute',
    left: 7,
    top: 6,
    width: 5,
    height: 2,
    borderRadius: 1,
    backgroundColor: lightTokens.colors.white,
  },
  brandCopy: {
    width: 120,
    alignItems: 'center',
  },
  logoImage: {
    width: 19,
    height: 14,
    tintColor: '#FFFFFF',
  },
  wordmarkImage: {
    width: 120,
    height: 20,
  },
  settings: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: lightTokens.colors.white,
    backgroundColor: 'rgba(255,255,255,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    ...lightTokens.shadow.soft,
  },
  settingsPressed: {
    transform: [{ scale: 0.94 }],
  },
  gearGlyph: {
    width: 17,
    height: 17,
    position: 'relative',
  },
  gearRing: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.7,
    borderColor: '#595A74',
  },
  gearCore: {
    position: 'absolute',
    left: 7,
    top: 7,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#595A74',
  },
  gearTooth: {
    position: 'absolute',
    width: 2,
    height: 4,
    borderRadius: 1,
    backgroundColor: '#595A74',
  },
  gearToothTop: {
    left: 7.5,
    top: 0,
  },
  gearToothRight: {
    right: 0,
    top: 6.5,
    transform: [{ rotate: '90deg' }],
  },
  gearToothBottom: {
    left: 7.5,
    bottom: 0,
  },
  gearToothLeft: {
    left: 0,
    top: 6.5,
    transform: [{ rotate: '90deg' }],
  },
});
