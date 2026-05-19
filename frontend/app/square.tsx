import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const ARTBOARD_WIDTH = 375;
const ARTBOARD_HEIGHT = 812;

export default function Square() {
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const artboardScale =
    Platform.OS === 'web'
      ? 1
      : Math.min(viewportWidth / ARTBOARD_WIDTH, viewportHeight / ARTBOARD_HEIGHT);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      NativeStatusBar.setHidden(true, 'none');
      NativeStatusBar.setTranslucent(true);
      NativeStatusBar.setBackgroundColor('transparent', false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        NativeStatusBar.setHidden(true, 'none');
        NativeStatusBar.setTranslucent(true);
        NativeStatusBar.setBackgroundColor('transparent', false);
      }
    }, [])
  );

  return (
    <View style={styles.shell}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" hidden translucent backgroundColor="transparent" />
      <View
        style={[
          styles.artboardShell,
          {
            width: ARTBOARD_WIDTH * artboardScale,
            height: ARTBOARD_HEIGHT * artboardScale,
          },
        ]}
      >
      <View style={[styles.artboard, { transform: [{ scale: artboardScale }] }]}>
        <PageHeader title="广场" onBack={() => router.back()} />

        <View style={styles.hero}>
          <Text style={styles.heading}>探索社区广场</Text>
          <Text style={styles.subheading}>左右滑动解锁新的发现与灵感</Text>
          <View style={styles.tools}>
            <View style={styles.todayPill}>
              <Text style={styles.todayText}>今日十大</Text>
            </View>
            <CircleTool kind="search" />
            <CircleTool kind="bell" />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cardsViewport}
          contentContainerStyle={styles.cardsRow}
        >
          <View style={[styles.communityCard, styles.communityCardLarge]}>
            <View>
              <View style={styles.authorRow}>
                <View style={[styles.avatar, styles.avatarBlue]} />
                <View>
                  <Text style={styles.author}>Li Wei</Text>
                  <Text style={styles.meta}>10分钟前</Text>
                </View>
              </View>
              <Text style={styles.postTitle}>刚尝试了 IntelliDeploy 的新多云发布功能，速度超乎想象！🚀 简直是生产力神器。</Text>
            </View>
            <View style={styles.mockShot} />
            <View style={styles.metrics}>
              <Text style={styles.metricStrong}>❤ 1.2k</Text>
              <Text style={styles.metricStrong}>▣ 84</Text>
            </View>
          </View>

          <View style={styles.rightColumn}>
            <View style={[styles.communityCard, styles.communityCardWide]}>
              <View style={styles.authorRow}>
                <View style={[styles.avatar, styles.avatarPink]} />
                <View>
                  <Text style={styles.author}>Chen Mo</Text>
                  <Text style={styles.meta}>2小时前</Text>
                </View>
              </View>
              <Text style={styles.postTitleSmall}>有没有人遇到过 K8s 集群部署冲突？求助！🙏</Text>
              <View style={styles.codeLine} />
              <View style={styles.metrics}>
                <Text style={styles.metric}>♡ 45</Text>
                <Text style={styles.metric}>▣ 12</Text>
              </View>
            </View>
            <View style={[styles.communityCard, styles.communityCardWide, styles.noticeCard]}>
              <Text style={styles.noticeIcon}>◖</Text>
              <Text style={styles.noticeTitle}>系统升级{'\n'}维护公告</Text>
              <View style={styles.noticeButton}>
                <Text style={styles.noticeButtonText}>查看详情</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.featured}>
          <View style={styles.featuredLabel}>
            <Text style={styles.featuredBolt}>↯</Text>
            <Text style={styles.featuredLabelText}>精选话题</Text>
          </View>
          <Text style={styles.featuredTitle}>2024 云原生趋势白皮书发布</Text>
          <Text style={styles.featuredBody}>
            探索 Serverless、边缘计算以及 AI 赋能的运维如何改变我们的工作方式。
          </Text>
          <Text style={styles.featuredReaders}>◌  +24k 人正在阅读</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
      </View>
      </View>
    </View>
  );
}

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.circleButton} onPress={onBack}>
        <BackGlyph />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable style={styles.circleButton}>
        <ShareGlyph />
      </Pressable>
    </View>
  );
}

function BackGlyph() {
  return (
    <View style={styles.backGlyph}>
      <View style={styles.backShaft} />
      <View style={[styles.backWing, styles.backWingTop]} />
      <View style={[styles.backWing, styles.backWingBottom]} />
    </View>
  );
}

function ShareGlyph() {
  return (
    <View style={styles.shareGlyph}>
      <View style={[styles.shareNode, styles.shareNodeTop]} />
      <View style={[styles.shareNode, styles.shareNodeLeft]} />
      <View style={[styles.shareNode, styles.shareNodeRight]} />
      <View style={[styles.shareLink, styles.shareLinkLeft]} />
      <View style={[styles.shareLink, styles.shareLinkRight]} />
    </View>
  );
}

function CircleTool({ kind }: { kind: 'search' | 'bell' }) {
  return (
    <View style={styles.toolCircle}>
      {kind === 'search' ? <SearchGlyph /> : <BellGlyph />}
    </View>
  );
}

function SearchGlyph() {
  return (
    <View style={styles.searchGlyph}>
      <View style={styles.searchRing} />
      <View style={styles.searchHandle} />
    </View>
  );
}

function BellGlyph() {
  return (
    <View style={styles.bellGlyph}>
      <View style={styles.bellBody} />
      <View style={styles.bellClapper} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  artboardShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artboard: {
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    backgroundColor: '#F3F5FF',
    position: 'relative',
  },
  header: {
    position: 'absolute',
    top: 45,
    left: 27,
    right: 27,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    width: 16,
    height: 14,
    position: 'relative',
  },
  backShaft: {
    position: 'absolute',
    left: 3,
    top: 6,
    width: 12,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#494A64',
  },
  backWing: {
    position: 'absolute',
    left: 2,
    width: 8,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#494A64',
  },
  backWingTop: {
    top: 3,
    transform: [{ rotate: '-45deg' }],
  },
  backWingBottom: {
    top: 9,
    transform: [{ rotate: '45deg' }],
  },
  shareGlyph: {
    width: 18,
    height: 18,
    position: 'relative',
  },
  shareNode: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#494A64',
    zIndex: 2,
  },
  shareNodeTop: {
    top: 1,
    left: 10,
  },
  shareNodeLeft: {
    top: 10,
    left: 1,
  },
  shareNodeRight: {
    top: 12,
    left: 12,
  },
  shareLink: {
    position: 'absolute',
    height: 1.6,
    borderRadius: 1,
    backgroundColor: '#494A64',
  },
  shareLinkLeft: {
    top: 8,
    left: 4,
    width: 9,
    transform: [{ rotate: '-34deg' }],
  },
  shareLinkRight: {
    top: 10,
    left: 10,
    width: 7,
    transform: [{ rotate: '45deg' }],
  },
  headerTitle: {
    color: '#161823',
    fontSize: 18,
    fontWeight: '700',
  },
  hero: {
    position: 'absolute',
    left: 24,
    top: 107,
    right: 24,
  },
  heading: {
    color: '#24253B',
    fontSize: 24,
    fontWeight: '700',
  },
  subheading: {
    color: '#6F7394',
    fontSize: 12,
    marginTop: 5,
  },
  tools: {
    position: 'absolute',
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayPill: {
    width: 74,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#8F73FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: {
    color: '#7C62FF',
    fontSize: 11,
    fontWeight: '600',
  },
  toolCircle: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#8F73FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGlyph: {
    width: 14,
    height: 14,
    position: 'relative',
  },
  searchRing: {
    position: 'absolute',
    left: 1,
    top: 1,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.4,
    borderColor: '#7C62FF',
  },
  searchHandle: {
    position: 'absolute',
    right: 1,
    bottom: 2,
    width: 5,
    height: 1.4,
    borderRadius: 1,
    backgroundColor: '#7C62FF',
    transform: [{ rotate: '45deg' }],
  },
  bellGlyph: {
    width: 14,
    height: 14,
    position: 'relative',
    alignItems: 'center',
  },
  bellBody: {
    position: 'absolute',
    top: 2,
    width: 9,
    height: 9,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    borderWidth: 1.4,
    borderColor: '#7C62FF',
  },
  bellClapper: {
    position: 'absolute',
    bottom: 1,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#7C62FF',
  },
  cardsViewport: {
    position: 'absolute',
    left: 20,
    top: 184,
    right: 0,
    height: 330,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 14,
    paddingRight: 22,
  },
  communityCard: {
    width: 154,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    padding: 14,
  },
  communityCardLarge: {
    width: 176,
    height: 310,
    justifyContent: 'space-between',
  },
  communityCardWide: {
    width: 184,
  },
  rightColumn: {
    gap: 14,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarBlue: {
    backgroundColor: '#D8E8FF',
  },
  avatarPink: {
    backgroundColor: '#F3DFFF',
  },
  author: {
    color: '#22243A',
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    color: '#7F80A1',
    fontSize: 10,
  },
  postTitle: {
    color: '#23243A',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
  },
  postTitleSmall: {
    color: '#23243A',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  mockShot: {
    height: 118,
    borderRadius: 12,
    backgroundColor: '#EEF0FF',
  },
  codeLine: {
    height: 28,
    borderRadius: 12,
    backgroundColor: '#EEF0FF',
    marginTop: 14,
  },
  metrics: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  metric: {
    color: '#7A5BFF',
    fontSize: 10,
  },
  metricStrong: {
    color: '#23243A',
    fontSize: 10,
  },
  noticeCard: {
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeIcon: {
    color: '#7C62FF',
    fontSize: 28,
  },
  noticeTitle: {
    color: '#17182B',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  noticeButton: {
    width: 66,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  noticeButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  featured: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 528,
    height: 205,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 20,
  },
  featuredLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  featuredBolt: {
    color: '#FFFFFF',
    width: 23,
    height: 23,
    borderRadius: 12,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: '#7C62FF',
  },
  featuredLabelText: {
    color: '#6F58E8',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredTitle: {
    color: '#111426',
    fontSize: 21,
    fontWeight: '700',
    marginTop: 18,
  },
  featuredBody: {
    color: '#454863',
    fontSize: 13,
    lineHeight: 22,
    marginTop: 12,
  },
  featuredReaders: {
    color: '#7C62FF',
    fontSize: 12,
    marginTop: 22,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 22,
    left: 111,
    width: 152,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6D8E8',
  },
  progressFill: {
    width: 72,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#7C62FF',
  },
});
