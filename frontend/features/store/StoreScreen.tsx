import { ApiError, type components } from '@intellideploy/api-client';
import { Stack, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppBackground,
  BottomNav,
  BrandHeader,
  CircleAction,
  EmptyState,
  ErrorState,
  MobileIcon,
} from '../../components/mobile';
import { authAPI, phase1Api } from '../../services/api';
import { mobileColors, mobileRadii, mobileSpacing } from '../../theme/tokens';
import { mobileFontFamilies, mobileTypography } from '../../theme/typography';
import { PublicationCarousel } from './PublicationCarousel';
import {
  filterLoadedPublications,
  mergePublicationPages,
  toStoreCard,
  type Publication,
} from './publicationViewModel';

type PublicationPage = components['schemas']['PublicationPage'];

async function readFavoriteIds() {
  const ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await phase1Api.listFavorites(cursor);
    for (const item of page.items) ids.add(item.id);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  return ids;
}

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Publication[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const page = await phase1Api.listPublications();
      setItems(page.items);
      setNextCursor(page.next_cursor ?? null);
      setSelectedId(page.items[0]?.id ?? null);
    } catch {
      setError('公开应用暂时无法加载');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void load();
    void authAPI
      .getToken()
      .then(async (token) => {
        if (!active || !token) return;
        const ids = await readFavoriteIds();
        if (active) setFavoriteIds(ids);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(
    () => filterLoadedPublications(items, query),
    [items, query],
  );

  useEffect(() => {
    if (!filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]?.id ?? null);
    }
  }, [filteredItems, selectedId]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page: PublicationPage = await phase1Api.listPublications(nextCursor);
      setItems((current) => mergePublicationPages(current, page.items));
      setNextCursor(page.next_cursor ?? null);
    } catch {
      setError('更多应用加载失败，可稍后重试');
    } finally {
      setLoadingMore(false);
    }
  };

  const setFavorite = async (id: string, enabled: boolean) => {
    if (favoriteBusy) return;
    setFavoriteBusy(id);
    setError('');
    try {
      await phase1Api.setFavorite(id, enabled);
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (enabled) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.push({ pathname: '/login', params: { next: '/store' } });
      } else {
        setError('收藏状态更新失败');
      }
    } finally {
      setFavoriteBusy(null);
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
            paddingTop: Math.max(insets.top, 44),
          },
        ]}
        insets={insets}
        testID="mobile-store"
      >
        <BrandHeader
          action={
            <CircleAction
              accessibilityLabel="设置暂未开放"
              disabled
              icon="settings"
              onPress={() => undefined}
            />
          }
        />

        <View style={styles.main}>
          <View style={styles.searchShell} testID="store-search-surface">
            <TextInput
              accessibilityLabel="搜索已加载的应用"
              onChangeText={setQuery}
              placeholder="搜索已加载的应用"
              placeholderTextColor={mobileColors.muted}
              style={styles.searchInput}
              testID="store-search"
              value={query}
            />
            <MobileIcon color={mobileColors.muted} name="search" size={14} />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/store/ranking')}
            style={styles.rankingLink}
            testID="store-ranking-open"
          >
            <Text style={styles.rankingLabel}>热门榜单</Text>
            <Text style={styles.rankingHint}>按最近更新时间排序</Text>
          </Pressable>

          {error && items.length > 0 ? (
            <Text accessibilityRole="alert" style={styles.inlineError}>
              {error}
            </Text>
          ) : null}
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={mobileColors.primary} size="large" />
              <Text style={styles.loadingText}>正在加载公开应用…</Text>
            </View>
          ) : error && items.length === 0 ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              description="搜索只检查当前已加载的页面"
              title="已加载的应用中没有匹配项"
            />
          ) : (
            <PublicationCarousel
              favoriteBusyId={favoriteBusy}
              favoriteIds={favoriteIds}
              items={filteredItems.map(toStoreCard)}
              onFavorite={(id, enabled) => void setFavorite(id, enabled)}
              onOpen={(id) =>
                router.push({ pathname: '/community/[id]', params: { id } })
              }
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          )}

          {nextCursor ? (
            <View style={styles.paging}>
              <Text style={styles.pagingHint}>
                还有更多应用，可继续加载
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={loadingMore}
                onPress={() => void loadMore()}
                style={[styles.loadMore, loadingMore && styles.disabled]}
                testID="store-load-more"
              >
                <Text style={styles.loadMoreLabel}>
                  {loadingMore ? '加载中…' : '加载更多'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <BottomNav
          active="store"
          onNavigate={(href) => router.push(href as Href)}
          testID="store-bottom-nav"
        />
      </AppBackground>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
  },
  main: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    minHeight: 0,
  },
  searchShell: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
    borderRadius: mobileRadii.pill,
    borderWidth: 1.6521741151809692,
    flexDirection: 'row',
    height: mobileSpacing.controlMin,
    minHeight: mobileSpacing.controlMin,
    paddingHorizontal: 16,
    shadowColor: '#BABABA',
    shadowOffset: { width: 0, height: 2.2028987407684326 },
    shadowOpacity: 0.25,
    shadowRadius: 3.3043482303619385,
    width: '88%',
  },
  searchInput: {
    color: mobileColors.text,
    flex: 1,
    fontFamily: mobileFontFamilies.body,
    fontSize: 14,
    minHeight: mobileSpacing.controlMin,
  },
  rankingLink: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: mobileSpacing.controlMin,
    paddingHorizontal: 14,
    width: '88%',
  },
  rankingLabel: {
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 14,
  },
  rankingHint: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 11,
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
  inlineError: {
    color: mobileColors.danger,
    fontFamily: mobileFontFamilies.body,
    fontSize: 12,
  },
  paging: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -35,
    width: '92%',
    zIndex: 3,
  },
  pagingHint: {
    color: mobileColors.muted,
    flex: 1,
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
    minWidth: 88,
    paddingHorizontal: 12,
  },
  loadMoreLabel: {
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 13,
  },
  disabled: {
    opacity: 0.5,
  },
});
