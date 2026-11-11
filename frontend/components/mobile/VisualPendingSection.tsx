import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export const visualPendingRoutes = ['/register', '/billing', '/app-detail/[id]:secondary', '/community/[id]'] as const;
export const visualAcceptanceStatus = 'VISUAL_PENDING' as const;

export function VisualPendingSection({ label, route, children }: PropsWithChildren<{ label: string; route: typeof visualPendingRoutes[number] }>) {
  return <View testID="visual-pending-section" accessibilityLabel={label} style={{ gap: 16 }}>
    <View testID={`${visualAcceptanceStatus}:${route}`} style={{ gap: 16 }}>{children}</View>
  </View>;
}
