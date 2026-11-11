import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { mobileColors, mobileSpacing } from '../../theme/tokens';

export type CircleActionProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: 'glass' | 'primary';
};

export function CircleAction({
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
  style,
  testID,
  variant = 'glass',
}: CircleActionProps) {
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.target, disabled && styles.disabled, style]}
      testID={testID}
    >
      <LinearGradient
        colors={
          primary
            ? ['#C05CF6', mobileColors.primary]
            : ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.38)']
        }
        style={[styles.surface, primary && styles.primarySurface]}
      >
        {icon}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: mobileSpacing.controlMin,
    minWidth: mobileSpacing.controlMin,
  },
  disabled: {
    opacity: 0.45,
  },
  surface: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1.5,
    height: 34,
    justifyContent: 'center',
    shadowColor: '#BABABA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.3,
    width: 34,
  },
  primarySurface: {
    borderRadius: 20,
    borderWidth: 0,
    height: 40,
    shadowColor: '#939393',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    width: 40,
  },
});
