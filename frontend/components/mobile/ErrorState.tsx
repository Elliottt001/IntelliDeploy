import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mobileColors, mobileSpacing } from '../../theme/tokens';
import { mobileFontFamilies, mobileTypography } from '../../theme/typography';

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  testID?: string;
  title?: string;
};

export function ErrorState({
  message,
  onRetry,
  retryLabel = '重试',
  testID,
  title = '暂时无法加载',
}: ErrorStateProps) {
  return (
    <View accessibilityRole="alert" style={styles.state} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryLabel}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.40)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  title: {
    ...mobileTypography.title,
    color: mobileColors.text,
    textAlign: 'center',
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.danger,
    textAlign: 'center',
  },
  retry: {
    alignItems: 'center',
    borderColor: mobileColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: mobileSpacing.controlMin,
    minWidth: mobileSpacing.controlMin,
    paddingHorizontal: 24,
  },
  retryLabel: {
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 15,
    lineHeight: 20,
  },
});
