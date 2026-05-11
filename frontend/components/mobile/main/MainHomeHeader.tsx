import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { lightLayout, lightTokens } from './mainHomeTokens';
import type { MainHomeTheme } from './mainHomeTypes';

type MainHomeHeaderProps = {
  theme: MainHomeTheme;
  intro: Animated.Value;
  onToggleTheme: () => void;
};

export default function MainHomeHeader({ theme, intro, onToggleTheme }: MainHomeHeaderProps) {
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
          <Text style={styles.logoGlyph}>∞</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>INTELLIDEPLOY</Text>
          <Text style={styles.brandSub}>Powered by Sealos | GitHub</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
        onPress={onToggleTheme}
        style={({ pressed }) => [styles.settings, pressed && styles.settingsPressed]}
      >
        <Text style={styles.settingsText}>{theme === 'light' ? '⚙' : '☼'}</Text>
      </Pressable>
    </Animated.View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 31.3,
    height: 31.3,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: lightTokens.colors.white,
    backgroundColor: lightTokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...lightTokens.shadow.soft,
  },
  logoGlyph: {
    color: lightTokens.colors.white,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: -2,
  },
  brandTitle: {
    color: lightTokens.colors.textSoft,
    fontSize: lightTokens.typography.brand,
    fontWeight: '800',
    letterSpacing: 0,
  },
  brandSub: {
    color: '#8E91AE',
    fontSize: lightTokens.typography.brandSub,
    marginTop: -1,
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
  settingsText: {
    color: '#595A74',
    fontSize: 16,
    fontWeight: '700',
  },
});
