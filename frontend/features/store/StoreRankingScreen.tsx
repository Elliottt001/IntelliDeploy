import { Stack, useRouter, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppBackground,
  BottomNav,
  BrandHeader,
  CircleAction,
} from '../../components/mobile';
import { mobileColors } from '../../theme/tokens';
import { mobileTypography } from '../../theme/typography';

export default function StoreRankingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AppBackground
        contentStyle={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            paddingTop: Math.max(insets.top, 24),
          },
        ]}
        insets={insets}
      >
        <BrandHeader
          action={
            <CircleAction
              accessibilityLabel="分享暂未开放"
              disabled
              icon="share"
              onPress={() => undefined}
            />
          }
          logo={
            <CircleAction
              accessibilityLabel="返回应用商店"
              icon="back"
              onPress={() => router.replace('/store')}
            />
          }
          subtitle=""
          title="应用商店"
        />

        <View style={styles.loading}>
          <ActivityIndicator color={mobileColors.primary} size="large" />
          <Text style={styles.loadingText}>正在准备热门榜单…</Text>
        </View>

        <BottomNav
          active="store"
          onNavigate={(href) => router.push(href as Href)}
        />
      </AppBackground>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'space-between',
  },
  loading: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  loadingText: {
    ...mobileTypography.body,
    color: mobileColors.muted,
    textAlign: 'center',
  },
});
