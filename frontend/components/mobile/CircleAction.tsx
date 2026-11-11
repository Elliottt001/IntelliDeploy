import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  type FigmaEffectEvidence,
  type FigmaVectorLayer,
  type FigmaPaintEvidence,
  figmaComponentEvidence,
  figmaMobileIcons,
  getFigmaMobileIcon,
} from '../../design/figmaComponentEvidence';
import { mobileColors, mobileSpacing } from '../../theme/tokens';

export type MobileIconName = keyof typeof figmaMobileIcons;

export type MobileIconProps = {
  color?: string;
  name: MobileIconName;
  size?: number;
  strokeWidth?: number;
};

function toShadowOffset(effect?: FigmaEffectEvidence) {
  return effect?.offset
    ? { height: effect.offset.y, width: effect.offset.x }
    : undefined;
}

function iconUsesSingleColor(name: MobileIconName) {
  const definition = getFigmaMobileIcon(name);
  const colors = new Set<string>();
  for (const layer of definition.layers as readonly FigmaVectorLayer[]) {
    if (layer.fill) {
      colors.add(layer.fill);
    }
    if (layer.stroke) {
      colors.add(layer.stroke);
    }
  }
  return colors.size <= 1;
}

export function MobileIcon({
  color = mobileColors.text,
  name,
  size = 18,
  strokeWidth = 1.8,
}: MobileIconProps) {
  const definition = getFigmaMobileIcon(name);
  const overrideColor = iconUsesSingleColor(name) ? color : undefined;
  const layers = definition.layers as readonly FigmaVectorLayer[];

  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      viewBox={definition.viewBox}
      width={size}
    >
      {layers.map((layer, index) => {
        return (
          <Path
            d={layer.path}
            fill={layer.fill ? overrideColor ?? layer.fill : 'none'}
            key={`${layer.sourceNodeId}-${index}`}
            opacity={layer.opacity}
            stroke={layer.stroke ? overrideColor ?? layer.stroke : undefined}
            strokeLinecap={layer.strokeLinecap}
            strokeLinejoin={layer.strokeLinejoin}
            strokeWidth={layer.strokeWidth ?? strokeWidth}
            transform={layer.transform}
          />
        );
      })}
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
  const shellEvidence = primary
    ? figmaComponentEvidence.send
    : figmaComponentEvidence.circleAction;
  const surfaceSize = primary ? 40 : 34;
  const shadow = (shellEvidence.effects as readonly FigmaEffectEvidence[]).find(
    (effect) => effect.type === 'DROP_SHADOW',
  );
  const shellStroke = (shellEvidence.strokes as readonly FigmaPaintEvidence[]).find(
    (paint) => 'color' in paint && paint.color,
  )?.color;

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
        style={[
          styles.surface,
          {
            borderColor: shellStroke ?? '#FFFFFF',
            borderRadius: surfaceSize / 2,
            height: surfaceSize,
            shadowColor: shadow?.color ?? (primary ? '#939393' : '#BABABA'),
            shadowOffset:
              toShadowOffset(shadow) ??
              (primary ? { height: 4, width: 0 } : { height: 2, width: 0 }),
            shadowRadius: shadow?.radius ?? (primary ? 10 : 3.3),
            width: surfaceSize,
          },
          primary && styles.primarySurface,
        ]}
      >
        <MobileIcon
          color={primary ? '#FFFFFF' : mobileColors.text}
          name={icon}
          size={primary ? 12 : 13}
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
    borderWidth: 1.5,
    justifyContent: 'center',
    shadowOpacity: 0.25,
  },
  primarySurface: {
    borderWidth: 0,
    shadowOpacity: 0.25,
  },
});
