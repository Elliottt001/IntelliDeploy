import type { PropsWithChildren } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { getMobileLayout } from '../../theme/responsive';
import { mobileColors } from '../../theme/tokens';

type AppBackgroundProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  insets?: { left: number; right: number };
  style?: StyleProp<ViewStyle>;
  testID?: string;
  width?: number;
}>;

export function AppBackground({
  children,
  contentStyle,
  insets = { left: 0, right: 0 },
  style,
  testID,
  width = 375,
}: AppBackgroundProps) {
  const layout = getMobileLayout(width, insets);

  return (
    <LinearGradient
      colors={[mobileColors.backgroundStart, mobileColors.backgroundEnd]}
      end={{ x: 0.72, y: 1 }}
      start={{ x: 0.15, y: 0 }}
      style={[styles.background, style]}
      testID={testID}
    >
      <View pointerEvents="none" style={styles.ambientPink} />
      <View pointerEvents="none" style={styles.ambientPurple} />
      <View
        style={[
          styles.content,
          { width: layout.contentWidth },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 560,
  },
  ambientPink: {
    backgroundColor: 'rgba(255, 175, 220, 0.20)',
    borderRadius: 272,
    height: 542,
    position: 'absolute',
    right: -290,
    top: 77,
    width: 412,
  },
  ambientPurple: {
    backgroundColor: 'rgba(124, 98, 255, 0.16)',
    borderRadius: 210,
    height: 418,
    position: 'absolute',
    right: -240,
    top: 270,
    width: 391,
  },
});
