import {SourceGlassSurface,sourceSurfacePaintStyle} from '../../components/mobile/glass/SourceGlassSurface';
import { ApiError, type components } from '@intellideploy/api-client';
import { Stack, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
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
import { fitSourceWidth, getMobileLayout } from '../../theme/responsive';
import { storeCardRenderEvidence as source } from '../../design/storeCardRenderEvidence';
import { PublicationCarousel } from './PublicationCarousel';
import {
  filterLoadedPublications,
  mergePublicationPages,
  toStoreCard,
  type Publication,
} from './publicationViewModel';

type PublicationPage = components['schemas']['PublicationPage'];

const rgba = (hex: string, alpha: number) => {
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
};

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
  const viewport = useWindowDimensions();
  const layout = getMobileLayout(viewport.width, insets);
  const searchWidth = fitSourceWidth(
    source.search.size.x,
    source.search.size.x,
    layout.contentWidth,
    'fixed',
  );
  const searchShadow = source.search.surface.effects.find(
    (effect) => effect.rawType === 'DROP_SHADOW',
  )!;
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

        <ScrollView
          contentContainerStyle={styles.main}
          style={styles.mainScroll}
          testID="store-main-scroll"
        >
          <View style={[styles.searchTarget, { width: searchWidth }]}>
            <View
              pointerEvents="none"
              style={[
                styles.searchSurface,
                {
                  backgroundColor: rgba(
                    source.search.surface.fill.color!.hex,
                    source.search.surface.fill.opacity,
                  ),
                  borderColor: rgba(
                    source.search.surface.strokes[0].color!.hex,
                    source.search.surface.strokes[0].opacity,
                  ),
                  borderRadius: source.search.surface.cornerRadius,
                  borderWidth: source.search.surface.strokeWeight,
                  height: source.search.size.y,
                  shadowColor: searchShadow.color!.hex,
                  shadowOffset: {
                    width: searchShadow.offset!.x,
                    height: searchShadow.offset!.y,
                  },
                  shadowOpacity: searchShadow.color!.alpha,
                  shadowRadius: searchShadow.radius!,
                  top: (mobileSpacing.controlMin - source.search.size.y) / 2,
                },
                sourceSurfacePaintStyle(source.search.surface.sourceNodeId),
              ]}
              testID="store-search-surface"
            ><SourceGlassSurface sourceNodeId={source.search.surface.sourceNodeId}/></View>
            <TextInput
              accessibilityLabel="搜索已加载的应用"
              onChangeText={setQuery}
              placeholder="搜索已加载的应用"
              placeholderTextColor={mobileColors.muted}
              style={styles.searchInput}
              testID="store-search"
              value={query}
            />
            <View pointerEvents="none" style={styles.searchIcon}>
              <MobileIcon color={mobileColors.muted} name="search" size={14} />
            </View>
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
              availableWidth={layout.contentWidth}
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
        </ScrollView>

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
    flexGrow: 1,
    gap: 6,
    paddingBottom: 8,
  },
  mainScroll: {
    flex: 1,
    width: '100%',
  },
  searchTarget: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    height: mobileSpacing.controlMin,
    justifyContent: 'center',
    minHeight: mobileSpacing.controlMin,
    position: 'relative',
  },
  searchSurface: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  searchInput: {
    color: mobileColors.text,
    flex: 1,
    fontFamily: mobileFontFamilies.body,
    fontSize: 14,
    minHeight: mobileSpacing.controlMin,
    paddingLeft: 16,
    paddingRight: 38,
  },
  searchIcon: {
    position: 'absolute',
    right: 16,
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
