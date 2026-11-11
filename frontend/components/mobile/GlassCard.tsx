import type { PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  type FigmaEffectEvidence,
  type FigmaPaintEvidence,
  figmaComponentEvidence,
} from '../../design/figmaComponentEvidence';
import { mobileRadii } from '../../theme/tokens';

type GlassCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

function toRgba(color?: string, opacity = 1) {
  if (!color) {
    return undefined;
  }
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) {
    return color;
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity.toFixed(2)})`;
}

export function GlassCard({ children, style, testID }: GlassCardProps) {
  const shell = figmaComponentEvidence.glassCard;
  const surfaceFills = shell.surfaceFills as readonly FigmaPaintEvidence[] | undefined;
  const surfaceStrokes = shell.surfaceStrokes as readonly FigmaPaintEvidence[] | undefined;
  const surfaceEffects =
    shell.surfaceEffects as readonly FigmaEffectEvidence[] | undefined;
  const shadow = (surfaceEffects ?? []).find(
    (effect) => effect.type === 'DROP_SHADOW',
  );
  const solidFill = surfaceFills?.find(
    (paint) => paint.type === 'SOLID' && paint.color,
  );
  const solidStroke = surfaceStrokes?.find(
    (paint) => paint.type === 'SOLID' && paint.color,
  );
  const evidenceStyle: ViewProps['style'] = {
    backgroundColor: toRgba(solidFill?.color, solidFill?.opacity),
    borderColor: toRgba(solidStroke?.color, solidStroke?.opacity),
    borderRadius: shell.cornerRadii?.topLeft,
    borderWidth: shell.borderWidths?.top,
    minHeight: shell.size.height,
    shadowColor: shadow?.color,
    shadowOffset: shadow?.offset
      ? { height: shadow.offset.y, width: shadow.offset.x }
      : undefined,
    shadowOpacity: shadow?.opacity,
    shadowRadius: shadow?.radius,
  };

  return (
    <View
      style={[
        styles.card,
        evidenceStyle,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: mobileRadii.card.min,
  },
});
