import type { components } from '@intellideploy/api-client';
import { Stack, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppBackground,
  BottomNav,
  CircleAction,
  EmptyState,
  ErrorState,
} from '../../components/mobile';
import { phase1Api } from '../../services/api';
import { mobileColors, mobileRadii, mobileSpacing } from '../../theme/tokens';
import { mobileFontFamilies, mobileTypography } from '../../theme/typography';
import {
  mergePublicationPages,
  sortByRecentUpdate,
  type Publication,
} from './publicationViewModel';

type PublicationPage = components['schemas']['PublicationPage'];

export default function StoreRankingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Publication[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const page = await phase1Api.listPublications();
      setItems(page.items);
      setNextCursor(page.next_cursor ?? null);
    } catch {
      setError('热门榜单暂时无法加载');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const ranked = useMemo(() => sortByRecentUpdate(items), [items]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page: PublicationPage = await phase1Api.listPublications(nextCursor);
      setItems((current) => mergePublicationPages(current, page.items));
      setNextCursor(page.next_cursor ?? null);
    } catch {
      setError('更多应用加载失败');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AppBackground
        contentStyle={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            paddingTop: Math.max(insets.top, 20),
          },
        ]}
        insets={insets}
        testID="mobile-store-ranking"
      >
        <View style={styles.header}>
          <CircleAction
            accessibilityLabel="返回应用商店"
            icon="back"
            onPress={() => router.replace('/store')}
          />
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.headerTitle}>
              热门榜单
            </Text>
            <Text style={styles.headerSubtitle}>按最近更新时间排序</Text>
          </View>
          <CircleAction
            accessibilityLabel="分享暂未开放"
            disabled
            icon="share"
            onPress={() => undefined}
          />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>公开应用近期更新</Text>
          <Text style={styles.heroCopy}>
            排序依据仅为公开记录的最近更新时间。
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={mobileColors.primary} size="large" />
            <Text style={styles.loadingText}>正在准备热门榜单…</Text>
          </View>
        ) : error && items.length === 0 ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : ranked.length === 0 ? (
          <EmptyState title="暂时没有公开应用" />
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            style={styles.list}
          >
            {ranked.map((item, index) => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() =>
                  router.push({ pathname: '/community/[id]', params: { id: item.id } })
                }
                style={styles.row}
                testID={`store-ranking-row-${item.id}`}
              >
                <Text style={styles.position}>{index + 1}</Text>
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.creator}>
                    {item.creator}
                  </Text>
                </View>
                <Text style={styles.availability}>
                  {item.available ? '可使用' : '暂不可用'}
                </Text>
              </Pressable>
            ))}
            {error ? <Text style={styles.inlineError}>{error}</Text> : null}
            {nextCursor ? (
              <View style={styles.moreBlock}>
                <Text style={styles.boundary}>榜单仅排序当前已加载的应用</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={loadingMore}
                  onPress={() => void loadMore()}
                  style={[styles.loadMore, loadingMore && styles.disabled]}
                  testID="store-ranking-load-more"
                >
                  <Text style={styles.loadMoreLabel}>
                    {loadingMore ? '加载中…' : '加载更多'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        )}

        <BottomNav
          active="store"
          onNavigate={(href) => router.push(href as Href)}
          testID="store-ranking-bottom-nav"
        />
      </AppBackground>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: mobileSpacing.controlMin,
  },
  headerCopy: {
    alignItems: 'center',
  },
  headerTitle: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 16,
    lineHeight: 22,
  },
  headerSubtitle: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 10,
    lineHeight: 14,
  },
  hero: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    height: 123,
    justifyContent: 'center',
    paddingHorizontal: 22,
    shadowColor: '#ADA6C4',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    width: '91%',
  },
  heroTitle: {
    ...mobileTypography.title,
    color: mobileColors.primary,
    fontSize: 20,
  },
  heroCopy: {
    ...mobileTypography.caption,
    color: mobileColors.muted,
    marginTop: 4,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  loadingText: {
    ...mobileTypography.body,
    color: mobileColors.muted,
  },
  list: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#A78BFA',
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    width: '91%',
  },
  listContent: {
    padding: 5,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#EFEBFB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 55.813331604003906,
    paddingHorizontal: 10,
  },
  position: {
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 16,
    textAlign: 'center',
    width: 28,
  },
  rowCopy: {
    flex: 1,
    paddingHorizontal: 8,
  },
  name: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 14,
  },
  creator: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 11,
    marginTop: 2,
  },
  availability: {
    backgroundColor: '#EFEBFB',
    borderRadius: mobileRadii.pill,
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 11,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  moreBlock: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  boundary: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 11,
  },
  loadMore: {
    alignItems: 'center',
    borderColor: mobileColors.primary,
    borderRadius: mobileRadii.action,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: mobileSpacing.controlMin,
    paddingHorizontal: 20,
  },
  loadMoreLabel: {
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 13,
  },
  inlineError: {
    color: mobileColors.danger,
    fontFamily: mobileFontFamilies.body,
    fontSize: 12,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
