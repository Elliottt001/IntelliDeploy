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
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppBackground,
  BottomNav,
  CircleAction,
  EmptyState,
  ErrorState,
} from '../../components/mobile';
import {formalMobileControls} from '../../design/formalMobileControls';
import {rankingRenderEvidence as rowSource} from '../../design/rankingRenderEvidence';
import {getMobileLayout} from '../../theme/responsive';
import { phase1Api } from '../../services/api';
import { mobileColors, mobileRadii, mobileSpacing } from '../../theme/tokens';
import { mobileFontFamilies, mobileTypography } from '../../theme/typography';
import {
  mergePublicationPages,
  sortByRecentUpdate,
  storeFigmaEvidence,
  type Publication,
} from './publicationViewModel';

type PublicationPage = components['schemas']['PublicationPage'];

export default function StoreRankingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewport=useWindowDimensions(),layout=getMobileLayout(viewport.width,insets),headerSource=formalMobileControls.productHeader,source=storeFigmaEvidence.ranking;
  const headerLeft=source.header.x-3+Math.max(0,(viewport.width-375)/2),headerWidth=Math.min(source.header.width+6,viewport.width-insets.left-insets.right-35);
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
            paddingTop: Math.max(insets.top, 44),
          },
        ]}
        insets={insets}
        testID="mobile-store-ranking"
      >
        <View style={[styles.header,{width:headerWidth,maxWidth:headerWidth,marginLeft:headerLeft-layout.gutter-insets.left}]}>
          <CircleAction
            accessibilityLabel="返回应用商店"
            icon="back"
            surfaceOffset={headerSource.back.surfaceOffset} iconOffset={headerSource.back.iconOffset}
            onPress={() => router.replace('/store')}
          />
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.headerTitle}>
              {rowSource.header.characters}
            </Text>
          </View>
          <CircleAction
            accessibilityLabel="分享暂未开放"
            disabled
            icon="share"
            surfaceOffset={headerSource.share.surfaceOffset} iconOffset={headerSource.share.iconOffset}
            onPress={() => undefined}
          />
        </View>

        <ScrollView style={{flex:1}} contentContainerStyle={{paddingTop:19,paddingBottom:24}}>
        <View style={{marginLeft:Math.max(0,source.header.x-layout.gutter)}}><Text style={{fontFamily:mobileFontFamilies.pingFang,fontWeight:'900',fontSize:rowSource.introTitle.fontSize,lineHeight:rowSource.introTitle.size.y,color:rowSource.introTitle.textColor}}>{rowSource.introTitle.characters}</Text><Text style={{fontFamily:mobileFontFamilies.pingFang,fontSize:rowSource.introSubtitle.fontSize,lineHeight:rowSource.introSubtitle.size.y,color:rowSource.introSubtitle.textColor}}>{rowSource.introSubtitle.characters}</Text></View>
        <View style={[styles.hero,{marginTop:26,width:Math.min(source.hero.width,layout.contentWidth)}]}>
          <Text style={styles.heroTitle}>公开应用近期更新</Text>
          <Text style={styles.heroCopy}>
            排序依据仅为公开记录的最近更新时间。
          </Text>
        </View>

        <View style={{height:44,marginTop:4,justifyContent:'center',marginLeft:Math.max(0,source.header.x-layout.gutter)}}><Text style={{fontFamily:mobileFontFamilies.pingFang,fontSize:12,lineHeight:18,color:mobileColors.muted}}>热门排行 · 按最近更新时间排序</Text></View>
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
            style={[styles.list,{marginTop:-3.42,marginLeft:13+Math.max(0,(viewport.width-375)/2),width:Math.min(source.listSurface.width,layout.contentWidth-13)}]}
            testID="store-ranking-list-surface"
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
                <View pointerEvents="none" accessibilityLabel={`${item.name}暂无应用预览`} style={styles.previewInitial}><Text style={styles.previewInitialText}>{Array.from(item.name.trim())[0]??'·'}</Text></View>
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.creator}>
                    {item.summary}
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

        </ScrollView>
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
    gap: 0,
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
    color: rowSource.header.textColor,
    fontFamily: mobileFontFamilies.pingFang,
    fontWeight:'500',
    fontSize: rowSource.header.fontSize,
    lineHeight: rowSource.header.size.y,
  },
  headerSubtitle: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 10,
    lineHeight: 14,
  },
  hero: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 0,
    height: 123,
    justifyContent: 'center',
    paddingHorizontal: 22,
    shadowColor: '#ADA6C4',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
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
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 0,
    flexGrow: 0,
    height: 400.42,
    shadowColor: '#8276A6',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
    width: '91%',
  },
  listContent: {
    paddingHorizontal: 5,
    paddingTop:6.28,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: rowSource.row.dividerColor,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 55.813331604003906,
    width:rowSource.row.size.x,
    maxWidth:'100%',
    position:'relative',
  },
  position: {
    position:'absolute',left:13.738615,top:19,
    color: '#6B7280',
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 12,
    textAlign: 'center',
    width: 24.042665,
  },
  rowCopy: {
    position:'absolute',
    left:rowSource.row.copy.x,
    top:rowSource.row.copy.y,
    width:rowSource.row.copy.size.x,
  },
  name: {
    color: rowSource.name.textColor,
    fontFamily: mobileFontFamilies.pingFang,
    fontWeight:'500',
    fontSize: rowSource.name.fontSize,
    lineHeight:rowSource.name.size.y,
  },
  creator: {
    color: rowSource.summary.textColor,
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: rowSource.summary.fontSize,
    lineHeight:rowSource.summary.size.y,
  },
  availability: {
    position:'absolute',
    left:rowSource.row.availability.transform.m02,
    top:rowSource.row.availability.transform.m12,
    width:rowSource.row.availability.size.x,
    height:rowSource.row.availability.size.y,
    backgroundColor: 'rgba(223,140,255,0.1)',
    borderColor:rowSource.row.availability.borderColor,
    borderWidth:1,
    borderRadius: mobileRadii.pill,
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 10,
    lineHeight:20.325333,
    textAlign:'center',
    overflow: 'hidden',
  },
  previewInitial:{position:'absolute',left:rowSource.row.preview.transform.m02,top:rowSource.row.preview.transform.m12,width:rowSource.row.preview.size.x,height:rowSource.row.preview.size.y,borderRadius:rowSource.row.preview.cornerRadius,backgroundColor:'#F4F2FA',justifyContent:'center',alignItems:'center'},
  previewInitialText:{fontFamily:mobileFontFamilies.pingFang,fontSize:16,color:'#7F80A1'},
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
