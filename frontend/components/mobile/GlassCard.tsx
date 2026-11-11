import type { PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  type FigmaEffectEvidence,
  figmaComponentEvidence,
} from '../../design/figmaComponentEvidence';
import { mobileRadii } from '../../theme/tokens';

type GlassCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function GlassCard({ children, style, testID }: GlassCardProps) {
  const shadow = (
    figmaComponentEvidence.glassCard.effects as readonly FigmaEffectEvidence[]
  ).find(
    (effect) => effect.type === 'DROP_SHADOW',
  );

  return (
    <View
      style={[
        styles.card,
        {
          minHeight: figmaComponentEvidence.glassCard.size.height,
          shadowColor: shadow?.color ?? '#1F2687',
          shadowOffset: shadow?.offset
            ? { height: shadow.offset.y, width: shadow.offset.x }
            : { width: 0, height: 8 },
          shadowRadius: shadow?.radius ?? 32,
        },
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
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.40)',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 3,
    padding: mobileRadii.card.min,
    shadowOpacity: 0.07,
  },
});
