import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { mobileColors, mobileSpacing } from '../../theme/tokens';

export type MobileIconName =
  | 'arrow-right'
  | 'back'
  | 'bell'
  | 'compass'
  | 'house'
  | 'layout-grid'
  | 'microphone'
  | 'search'
  | 'send'
  | 'settings'
  | 'share'
  | 'user';

type MobileIconProps = {
  color?: string;
  name: MobileIconName;
  size?: number;
  strokeWidth?: number;
};

export function MobileIcon({
  color = mobileColors.text,
  name,
  size = 18,
  strokeWidth = 1.8,
}: MobileIconProps) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth,
  };

  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {name === 'settings' && (
        <>
          <Circle cx={12} cy={12} r={3} {...common} />
          <Path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4" {...common} />
        </>
      )}
      {name === 'back' && <Path d="m15 18-6-6 6-6" {...common} />}
      {name === 'share' && (
        <>
          <Circle cx={18} cy={5} r={2.5} {...common} />
          <Circle cx={6} cy={12} r={2.5} {...common} />
          <Circle cx={18} cy={19} r={2.5} {...common} />
          <Path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" {...common} />
        </>
      )}
      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={6.5} {...common} />
          <Path d="m16 16 4 4" {...common} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" {...common} />
          <Path d="M10 21h4" {...common} />
        </>
      )}
      {name === 'microphone' && (
        <>
          <Path d="M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Z" {...common} />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" {...common} />
        </>
      )}
      {name === 'send' && <Path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2" {...common} />}
      {name === 'arrow-right' && (
        <>
          <Path d="M5 12h14" {...common} />
          <Path d="m13 6 6 6-6 6" {...common} />
        </>
      )}
      {name === 'house' && (
        <>
          <Path d="m3 10.5 9-7.5 9 7.5" {...common} />
          <Path d="M5.5 9v11h13V9M9.5 20v-6h5v6" {...common} />
        </>
      )}
      {name === 'layout-grid' && (
        <Path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" {...common} />
      )}
      {name === 'compass' && (
        <>
          <Circle cx={12} cy={12} r={9} {...common} />
          <Path d="m15.7 8.3-2.1 5.3-5.3 2.1 2.1-5.3 5.3-2.1Z" {...common} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx={12} cy={8} r={3.2} {...common} />
          <Path d="M5.5 20c.7-3.5 3-5.5 6.5-5.5s5.8 2 6.5 5.5" {...common} />
        </>
      )}
    </Svg>
  );
}

export type CircleActionProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: MobileIconName;
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
      style={[
        styles.target,
        disabled && styles.disabled,
        style,
        styles.minimumTarget,
      ]}
      testID={testID}
    >
      <LinearGradient
        colors={
          primary
            ? ['#C05CF6', mobileColors.primary]
            : ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.20)']
        }
        style={[styles.surface, primary && styles.primarySurface]}
      >
        <MobileIcon
          color={primary ? '#FFFFFF' : mobileColors.text}
          name={icon}
          size={15}
        />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimumTarget: {
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
