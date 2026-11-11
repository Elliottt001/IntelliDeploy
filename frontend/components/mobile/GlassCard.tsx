import type { PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { mobileRadii } from '../../theme/tokens';

type GlassCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function GlassCard({ children, style, testID }: GlassCardProps) {
  return (
    <View style={[styles.card, style]} testID={testID}>
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
    shadowColor: '#1F2687',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 32,
  },
});
