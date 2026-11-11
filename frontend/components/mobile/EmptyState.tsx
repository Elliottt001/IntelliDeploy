import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { mobileColors, mobileSpacing } from '../../theme/tokens';
import { mobileFontFamilies, mobileTypography } from '../../theme/typography';
import { GlassCard } from './GlassCard';

type EmptyStateProps = {
  actionLabel?: string;
  description?: string;
  icon?: ReactNode;
  onAction?: () => void;
  testID?: string;
  title: string;
};

export function EmptyState({
  actionLabel,
  description,
  icon,
  onAction,
  testID,
  title,
}: EmptyStateProps) {
  return (
    <GlassCard style={styles.card} testID={testID}>
      {icon}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={styles.action}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  title: {
    ...mobileTypography.title,
    color: mobileColors.text,
    textAlign: 'center',
  },
  description: {
    ...mobileTypography.body,
    color: mobileColors.muted,
    textAlign: 'center',
  },
  action: {
    alignItems: 'center',
    backgroundColor: mobileColors.primary,
    borderRadius: 22,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: mobileSpacing.controlMin,
    minWidth: mobileSpacing.controlMin,
    paddingHorizontal: 24,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 15,
    lineHeight: 20,
  },
});
