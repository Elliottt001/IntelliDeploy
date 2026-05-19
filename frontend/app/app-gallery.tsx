import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const pawzzleIcon =
  'https://www.figma.com/api/mcp/asset/f036f1af-d83a-41a5-9a91-e1530060b2f0';
const pawzzlePreview =
  'https://www.figma.com/api/mcp/asset/830db541-d4e4-485a-9604-7a46681e892b';
const stellarIcon =
  'https://www.figma.com/api/mcp/asset/877a9930-f34e-4431-a33e-95209798d3a0';
const stellarPreview =
  'https://www.figma.com/api/mcp/asset/bf98ad3b-7e2a-4c2c-9c23-b18f2756b317';
const voraIcon =
  'https://www.figma.com/api/mcp/asset/46df2bcc-95af-485f-a560-13cf609e8450';
const voraPreview =
  'https://www.figma.com/api/mcp/asset/217ac8d7-4f3d-43f7-b5ed-5fb0b76894db';
const ARTBOARD_WIDTH = 375;
const ARTBOARD_HEIGHT = 812;

type GalleryAppId =
  | 'pawzzle'
  | 'stellar'
  | 'vora'
  | 'fastgpt'
  | 'keystats'
  | 'stolen-buttons'
  | 'fairyc';

type GalleryPreviewKind = 'pawzzle' | 'stellar' | 'vora' | 'fastgpt' | 'keystats' | 'buttons' | 'fairyc';

type GalleryApp = {
  id: GalleryAppId;
  name: string;
  rating: string;
  badge: string;
  meta: string;
  description: string;
  iconBackground: string;
  previewKind: GalleryPreviewKind;
  rotation: string;
  icon?: string;
  iconLabel?: string;
  iconAccent?: string;
  preview?: string;
};

const apps: GalleryApp[] = [
  {
    id: 'pawzzle',
    name: 'Pawzzle寻爪',
    rating: '4.8 · 1.2k 评价',
    badge: '金喵奖',
    meta: '编辑精选｜热度飙升',
    description:
      'Pawzzle是一款专注于宠物救助与关爱的应用，旨在帮助迷路的宠物找到新家并提供爱与关怀。在这个应用中，你可以浏览待领养的宠物，了解它们的故事，并为它们提供一个温暖的家。',
    icon: pawzzleIcon,
    iconBackground: '#FFEBD3',
    preview: pawzzlePreview,
    previewKind: 'pawzzle',
    rotation: '0deg',
  },
  {
    id: 'stellar',
    name: 'Stellar星耀',
    rating: '4.9 · 1.3k 评价',
    badge: '下载榜单Top10',
    meta: '下载榜单Top10',
    description:
      'Stellar星耀是一款专注于天文探索与星空观测的应用，利用AR实时识别夜空中的星座，了解星体背后的科学信息，把整个浩瀚宇宙装进口袋。',
    icon: stellarIcon,
    iconBackground: '#FFFFFF',
    preview: stellarPreview,
    previewKind: 'stellar',
    rotation: '0deg',
  },
  {
    id: 'vora',
    name: 'Vora食光',
    rating: '3.9 · 2.4k 评价',
    badge: '免费',
    meta: '免费｜下载榜单Top3',
    description:
      'Vora食光专注于智能膳食与健康管理，提供AI个性化食谱、拍照识别食物卡路里，并轻松掌握每日营养摄入。',
    icon: voraIcon,
    iconBackground: '#FFFFFF',
    preview: voraPreview,
    previewKind: 'vora',
    rotation: '0deg',
  },
  {
    id: 'fastgpt',
    name: 'FastGPT',
    rating: '4.9 · 8.6k 评价',
    badge: 'AI效率',
    meta: '知识库问答｜自动化助手',
    description:
      'FastGPT 面向团队知识库与业务流程，支持多轮问答、文档检索和自动化编排，让常见问题、内部资料和工作流都能被快速调用。',
    iconBackground: '#BDF8FF',
    iconLabel: 'F',
    iconAccent: '#5B7CFF',
    previewKind: 'fastgpt',
    rotation: '0deg',
  },
  {
    id: 'keystats',
    name: 'KeyStats',
    rating: '4.7 · 980 评价',
    badge: '数据看板',
    meta: '指标追踪｜团队周报',
    description:
      'KeyStats 用轻量看板聚合核心指标，帮助团队追踪增长、留存和项目状态，并把关键变化自动整理成可分享的报告。',
    iconBackground: '#E7D7FF',
    iconLabel: 'K',
    iconAccent: '#8B5CF6',
    previewKind: 'keystats',
    rotation: '0deg',
  },
  {
    id: 'stolen-buttons',
    name: 'STOLEN BUTTONS',
    rating: '4.6 · 740 评价',
    badge: '设计资源',
    meta: '按钮灵感｜组件收藏',
    description:
      'STOLEN BUTTONS 收集高质量按钮样式、交互动效和前端实现片段，适合快速寻找产品界面的行动按钮灵感。',
    iconBackground: '#C9FFC9',
    iconLabel: 'B',
    iconAccent: '#3F8F5B',
    previewKind: 'buttons',
    rotation: '0deg',
  },
  {
    id: 'fairyc',
    name: 'Fairyc',
    rating: '4.8 · 1.1k 评价',
    badge: '创作工具',
    meta: '灵感生成｜内容编排',
    description:
      'Fairyc 是面向创作者的灵感与内容编排工具，支持快速生成草稿、整理素材关系，并把零散想法变成清晰的创作计划。',
    iconBackground: '#FFD6DE',
    iconLabel: 'F',
    iconAccent: '#F0B44C',
    previewKind: 'fairyc',
    rotation: '0deg',
  },
];

const rankingApps = [
  { name: 'Wonder Garden', meta: '你的随身植物养护管家', rating: '4.9', color: '#48D891', icon: '🌱' },
  { name: 'TapTap', meta: '超好用的音频编辑工具', rating: '4.8', color: '#161823', icon: '♪' },
  { name: 'Umi卡包', meta: '智能会员卡收纳助手', rating: '4.7', color: '#2F8DFF', icon: '▣' },
  { name: '人生轨迹', meta: '查看你的旅行规划与足迹', rating: '4.6', color: '#FF8A2A', icon: '✈' },
  { name: '妙颜', meta: '智能AI美妆助手', rating: '4.8', color: '#FF6FAE', icon: '◉' },
  { name: 'Heart! 拯救计划', meta: '智能记忆健康项目', rating: '4.7', color: '#FF5D7C', icon: '♥' },
  { name: '小账本', meta: '朋友上的生活管家', rating: '4.6', color: '#8E68FF', icon: '☁' },
];

export default function AppGallery() {
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ app?: string | string[] }>();
  const requestedAppId = Array.isArray(params.app) ? params.app[0] : params.app;
  const [activeIndex, setActiveIndex] = useState(() => getAppIndex(requestedAppId));
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const intro = useRef(new Animated.Value(0)).current;
  const floatLoop = useRef(new Animated.Value(0)).current;
  const cardFlip = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const drawerProgress = useRef(new Animated.Value(0)).current;
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

  useEffect(() => {
    setActiveIndex(getAppIndex(requestedAppId));
  }, [requestedAppId]);

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatLoop, {
          toValue: 1,
          duration: 2300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatLoop, {
          toValue: 0,
          duration: 2300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatLoop, intro]);

  useEffect(() => {
    cardFlip.setValue(0);
    Animated.timing(cardFlip, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, cardFlip]);

  useEffect(() => {
    Animated.timing(drawerProgress, {
      toValue: rankingOpen ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [drawerProgress, rankingOpen]);

  const activeApp = apps[activeIndex];
  const floatY = floatLoop.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  const switchCard = (direction: 1 | -1) => {
    Animated.timing(dragX, {
      toValue: direction * -420,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setActiveIndex((current) => (current + direction + apps.length) % apps.length);
      dragX.setValue(direction * 260);
      Animated.spring(dragX, {
        toValue: 0,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }).start();
    });
  };

  const nextCard = () => switchCard(1);
  const previousCard = () => switchCard(-1);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: Animated.event([null, { dx: dragX }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -70 || gesture.vx < -0.65) {
          nextCard();
          return;
        }

        if (gesture.dx > 70 || gesture.vx > 0.65) {
          previousCard();
          return;
        }

        Animated.spring(dragX, {
          toValue: 0,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragX, {
          toValue: 0,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const dragRotate = dragX.interpolate({
    inputRange: [-180, 0, 180],
    outputRange: ['-14deg', activeApp.rotation, '14deg'],
    extrapolate: 'clamp',
  });

  const dragScale = dragX.interpolate({
    inputRange: [-180, 0, 180],
    outputRange: [0.96, 1, 0.96],
    extrapolate: 'clamp',
  });

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
        <View style={styles.bg} />
        <Animated.View style={[styles.blobPink, { transform: [{ translateY: floatY }] }]} />
        <Animated.View
          style={[styles.blobPurple, { transform: [{ translateY: Animated.multiply(floatY, -0.6) }] }]}
        />

        <Animated.View
          style={[
            styles.topBar,
            {
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable style={styles.circleButton} onPress={() => router.back()}>
            <BackGlyph />
          </Pressable>
          <Text style={styles.pageTitle}>应用商店</Text>
          <Pressable style={styles.circleButton}>
            <ShareGlyph />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.main,
            {
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="搜索软件、工具、资源..."
              placeholderTextColor="#6B7280"
            />
            <Text style={styles.searchIcon}>⌕</Text>
          </View>

          <View style={styles.filterRow}>
            <Pressable style={[styles.filterPill, styles.filterHot]} onPress={() => setRankingOpen(true)}>
              <Text style={styles.filterText}>🔥 热门榜单</Text>
            </Pressable>
            <Pressable style={[styles.filterPill, styles.filterCategory]}>
              <Text style={styles.filterText}>APP分类</Text>
            </Pressable>
            <Pressable style={[styles.filterPill, styles.filterBlue]}>
              <Text style={styles.filterText}>筛选</Text>
            </Pressable>
          </View>

          <View style={styles.deck}>
            <View style={[styles.backCard, styles.backCardA]} />
            <View style={[styles.backCard, styles.backCardB]} />
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.featureCard,
                {
                  transform: [
                    {
                      translateX: dragX,
                    },
                    {
                      translateY: cardFlip.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                    {
                      scale: Animated.multiply(
                        dragScale,
                        cardFlip.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.96, 1],
                        })
                      ),
                    },
                    { rotate: dragRotate },
                  ],
                },
              ]}
            >
              <View style={[styles.appHeader, activeApp.previewKind === 'vora' && styles.voraAppHeader]}>
                <View style={[styles.appIconWrap, { backgroundColor: activeApp.iconBackground }]}>
                  <AppIcon app={activeApp} />
                </View>
                <View style={[styles.titleBlock, activeApp.previewKind === 'vora' && styles.voraTitleBlock]}>
                  <View style={[styles.titleLine, activeApp.id === 'stolen-buttons' && styles.titleLineStacked]}>
                    <Text style={styles.appName} numberOfLines={1}>
                      {activeApp.name}
                    </Text>
                    <View style={[styles.awardBadge, activeApp.id === 'stolen-buttons' && styles.awardBadgeStacked]}>
                      <Text style={styles.awardText}>{activeApp.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.stars}>★★★★★ <Text style={styles.rating}>{activeApp.rating}</Text></Text>
                  <View style={styles.divider} />
                  <Text style={styles.editorPick}>♕ {activeApp.meta}</Text>
                </View>
              </View>

              <Text
                style={[styles.description, activeApp.previewKind === 'vora' && styles.voraDescription]}
                numberOfLines={4}
              >
                {activeApp.description}
              </Text>
              <Pressable
                style={[styles.detailButton, activeApp.previewKind === 'vora' && styles.voraDetailButton]}
                onPress={nextCard}
              >
                <Text style={styles.detailButtonText}>查看详情</Text>
              </Pressable>

              <AppPreview app={activeApp} />

              <Pressable style={styles.pageDots} onPress={nextCard}>
                {apps.map((app, index) => (
                  <View
                    key={app.name}
                    style={[styles.dot, index === activeIndex && styles.dotActive]}
                  />
                ))}
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents={rankingOpen ? 'auto' : 'none'}
          style={[
            styles.drawerDim,
            {
              opacity: drawerProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRankingOpen(false)} />
        </Animated.View>

        <Animated.View
          pointerEvents={rankingOpen ? 'auto' : 'none'}
          style={[
            styles.rankingDrawer,
            {
              transform: [
                {
                  translateX: drawerProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [ARTBOARD_WIDTH, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.drawerHeader}>
            <Pressable style={styles.drawerBack} onPress={() => setRankingOpen(false)}>
              <BackGlyph />
            </Pressable>
            <Text style={styles.drawerTitle}>应用商店</Text>
            <Pressable style={styles.drawerShare}>
              <ShareGlyph />
            </Pressable>
          </View>
          <Text style={styles.drawerHeading}>热门榜单推荐</Text>
          <Text style={styles.drawerSubheading}>挑选你的造梦工具</Text>
          <View style={styles.drawerBanner}>
            <View style={styles.drawerBannerCopy}>
              <Text style={styles.drawerBannerSmall}>第13期</Text>
              <Text style={styles.drawerBannerTitle}>金喵奖新鲜出炉</Text>
              <Text style={styles.drawerBannerDesc}>发现优质应用 · 每季灵感上新</Text>
              <View style={styles.drawerBannerPill}>
                <Text style={styles.drawerBannerPillText}>立即查看</Text>
              </View>
            </View>
            <View style={[styles.bannerBubble, styles.bannerBubbleA]} />
            <View style={[styles.bannerBubble, styles.bannerBubbleB]} />
            <View style={[styles.bannerBubble, styles.bannerBubbleC]} />
            <View style={styles.goldCat}>
              <View style={[styles.goldCatEar, styles.goldCatEarLeft]} />
              <View style={[styles.goldCatEar, styles.goldCatEarRight]} />
              <View style={styles.goldCatHead}>
                <Text style={styles.goldCatFace}>⌯⌯</Text>
              </View>
              <View style={styles.goldCatBase} />
            </View>
            <Text style={styles.goldCatLabel}>金喵奖</Text>
          </View>
          <View style={styles.drawerSectionTitle}>
            <Text style={styles.drawerSpark}>✦</Text>
            <Text style={styles.drawerSectionText}>热门排行</Text>
            <Text style={styles.drawerViewAll}>查看全部</Text>
          </View>
          <View style={styles.rankingList}>
            {rankingApps.map((item, index) => (
                <View key={item.name} style={styles.rankingRow}>
                  <View style={styles.rankingRank}>
                    <Text style={styles.rankingCrown}>{index < 3 ? '♕' : ''}</Text>
                    <Text style={styles.rankingIndex}>{index + 1}</Text>
                  </View>
                  <View style={[styles.rankingAppIcon, { backgroundColor: item.color }]}>
                    <Text style={styles.rankingIconText}>{item.icon}</Text>
                  </View>
                  <View style={styles.rankingCopy}>
                    <Text style={styles.rankingName}>{item.name}</Text>
                    <Text style={styles.rankingMeta}>{item.meta}</Text>
                  </View>
                  <Text style={styles.rankingScore}>★ {item.rating}</Text>
                  <View style={styles.getButton}>
                    <Text style={styles.getButtonText}>获取</Text>
                  </View>
                </View>
              ))}
          </View>
        </Animated.View>

        <View style={styles.actionBar}>
          <GalleryAction active={liked} icon="♡" label={liked ? '已赞·2.1k' : '点赞·2.1k'} onPress={() => setLiked((value) => !value)} />
          <GalleryAction active={saved} icon="☆" label={saved ? '已收藏' : '收藏·1k'} onPress={() => setSaved((value) => !value)} />
          <GalleryAction icon="☵" label="评论·267" onPress={nextCard} />
        </View>
      </View>
      </View>
    </View>
  );
}

function getAppIndex(appId?: string) {
  const index = apps.findIndex((app) => app.id === appId);
  return index >= 0 ? index : 0;
}

function AppPreview({ app }: { app: GalleryApp }) {
  if (app.previewKind === 'pawzzle' && app.preview) {
    return (
      <View style={styles.previewClip}>
        <View style={styles.pawzzlePreviewCanvas}>
          <Image source={{ uri: app.preview }} style={styles.pawzzlePreviewImage} resizeMode="cover" />
        </View>
      </View>
    );
  }

  if (app.previewKind === 'vora' && app.preview) {
    return (
      <View style={[styles.previewClip, styles.voraPreviewClip]}>
        <View style={[styles.voraPhoneCrop, styles.voraPhoneLeft]}>
          <Image source={{ uri: app.preview }} style={styles.voraPhoneImageLeft} resizeMode="stretch" />
        </View>
        <View style={[styles.voraPhoneCrop, styles.voraPhoneRight]}>
          <Image source={{ uri: app.preview }} style={styles.voraPhoneImageRight} resizeMode="stretch" />
        </View>
      </View>
    );
  }

  if (app.previewKind === 'stellar' && app.preview) {
    return (
      <View style={styles.previewClip}>
        <Image source={{ uri: app.preview }} style={styles.stellarPreviewImage} resizeMode="contain" />
      </View>
    );
  }

  return <GeneratedAppPreview app={app} />;
}

function GeneratedAppPreview({ app }: { app: GalleryApp }) {
  if (app.previewKind === 'keystats') {
    return (
      <View style={[styles.previewClip, styles.generatedPreviewClip]}>
        <View style={[styles.generatedPreviewPanel, styles.keystatsPanel]}>
          <View style={styles.generatedPreviewHeader}>
            <View style={[styles.generatedPreviewMark, { backgroundColor: app.iconAccent }]} />
            <Text style={styles.generatedPreviewTitle}>Weekly metrics</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>82%</Text>
              <Text style={styles.statLabel}>Activation</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>+18</Text>
              <Text style={styles.statLabel}>Launches</Text>
            </View>
          </View>
          <View style={styles.chartRow}>
            {[44, 72, 56, 96, 68].map((height) => (
              <View key={height} style={[styles.chartBar, { height }]} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (app.previewKind === 'buttons') {
    return (
      <View style={[styles.previewClip, styles.generatedPreviewClip]}>
        <View style={[styles.generatedPreviewPanel, styles.buttonsPanel]}>
          <View style={styles.buttonPreviewPrimary}>
            <Text style={styles.buttonPreviewPrimaryText}>Deploy</Text>
          </View>
          <View style={styles.buttonPreviewRow}>
            <View style={styles.buttonPreviewSecondary} />
            <View style={styles.buttonPreviewGhost} />
          </View>
          <View style={styles.buttonPreviewCode}>
            <Text style={styles.buttonPreviewCodeText}>STOLEN BUTTONS</Text>
          </View>
        </View>
      </View>
    );
  }

  if (app.previewKind === 'fairyc') {
    return (
      <View style={[styles.previewClip, styles.generatedPreviewClip]}>
        <View style={[styles.generatedPreviewPanel, styles.fairycPanel]}>
          <View style={styles.fairycOrb}>
            <Text style={styles.fairycOrbText}>F</Text>
          </View>
          <View style={styles.fairycLineLong} />
          <View style={styles.fairycLineShort} />
          <View style={styles.fairycCard}>
            <Text style={styles.fairycCardText}>Idea board</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.previewClip, styles.generatedPreviewClip]}>
      <View style={[styles.generatedPreviewPanel, styles.fastgptPanel]}>
        <View style={styles.fastgptBubble}>
          <Text style={styles.fastgptBubbleText}>Ask your workspace</Text>
        </View>
        <View style={styles.fastgptAnswer}>
          <View style={styles.fastgptAnswerLineLong} />
          <View style={styles.fastgptAnswerLine} />
          <View style={styles.fastgptAnswerLineShort} />
        </View>
        <View style={styles.fastgptAction}>
          <Text style={styles.fastgptActionText}>Run</Text>
        </View>
      </View>
    </View>
  );
}

function AppIcon({ app }: { app: GalleryApp }) {
  if (app.previewKind === 'vora' && app.icon) {
    return (
      <View style={styles.voraIconMark}>
        <Image source={{ uri: app.icon }} style={styles.voraIconImage} resizeMode="stretch" />
      </View>
    );
  }

  if (app.icon) {
    return <Image source={{ uri: app.icon }} style={styles.appIcon} resizeMode="contain" />;
  }

  return (
    <View style={[styles.generatedIcon, { backgroundColor: app.iconBackground }]}>
      <Text style={[styles.generatedIconText, { color: app.iconAccent }]}>{app.iconLabel}</Text>
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

function BackGlyph() {
  return (
    <View style={styles.backGlyph}>
      <View style={styles.backShaft} />
      <View style={[styles.backWing, styles.backWingTop]} />
      <View style={[styles.backWing, styles.backWingBottom]} />
    </View>
  );
}

function GalleryAction({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.actionItem, active && styles.actionItemActive]} onPress={onPress}>
      <Text style={[styles.actionIcon, active && styles.actionIconActive]}>{icon}</Text>
      <Text style={[styles.actionLabel, active && styles.actionLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artboardShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artboard: {
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#EFF3FF',
    position: 'relative',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EFF3FF',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(199.43deg, rgb(239, 243, 255) 10.309%, rgb(255, 255, 255) 100%)',
        } as any)
      : {}),
  },
  blobPink: {
    position: 'absolute',
    width: 300,
    height: 360,
    right: -92,
    bottom: -34,
    borderRadius: 180,
    backgroundColor: 'rgba(246,184,255,0.28)',
  },
  blobPurple: {
    position: 'absolute',
    left: 39,
    top: 617,
    width: 278,
    height: 130,
    borderRadius: 140,
    backgroundColor: 'rgba(124,98,255,0.18)',
  },
  topBar: {
    position: 'absolute',
    top: 31,
    left: 14,
    right: 14,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 0.8,
    borderColor: '#DADAEA',
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
    backgroundColor: '#595A74',
  },
  backWing: {
    position: 'absolute',
    left: 2,
    width: 8,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#595A74',
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
    backgroundColor: '#595A74',
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
    backgroundColor: '#595A74',
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
  pageTitle: {
    color: '#151623',
    fontSize: 18,
    fontWeight: '700',
  },
  main: {
    position: 'absolute',
    top: 110,
    left: 19,
    width: 336,
    alignItems: 'center',
  },
  searchBox: {
    width: 295,
    height: 36,
    borderRadius: 55,
    borderWidth: 1.6,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.32)',
    shadowColor: '#BABABA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 14,
  },
  searchInput: {
    flex: 1,
    color: '#494A64',
    fontSize: 11,
    padding: 0,
  },
  searchIcon: {
    color: '#6B7280',
    fontSize: 16,
  },
  filterRow: {
    width: 282,
    marginTop: 27,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterPill: {
    height: 22,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  filterHot: {
    width: 100,
    backgroundColor: '#E3DAFF',
  },
  filterCategory: {
    width: 100,
    backgroundColor: 'rgba(255,203,255,0.7)',
  },
  filterBlue: {
    width: 62,
    backgroundColor: '#C5E6FF',
  },
  filterText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '600',
  },
  deck: {
    width: 336,
    height: 440,
    marginTop: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCard: {
    position: 'absolute',
    width: 271,
    height: 399,
    borderRadius: 30,
    backgroundColor: '#FCFCFC',
    shadowColor: '#897AB9',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  backCardA: {
    transform: [{ rotate: '10deg' }, { translateX: 10 }],
  },
  backCardB: {
    transform: [{ rotate: '-8deg' }, { translateX: -8 }],
    opacity: 0.86,
  },
  featureCard: {
    width: 271,
    height: 399,
    borderRadius: 30,
    backgroundColor: '#FCFCFC',
    shadowColor: '#897AB9',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    paddingTop: 33,
    paddingHorizontal: 27,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconWrap: {
    width: 57,
    height: 57,
    borderRadius: 15,
    backgroundColor: '#FFEBD3',
    shadowColor: '#928671',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: 57,
    height: 57,
  },
  voraAppHeader: {
    marginLeft: 5,
    marginTop: -3,
  },
  voraIconMark: {
    width: 39,
    height: 25,
    position: 'relative',
    overflow: 'hidden',
  },
  voraIconImage: {
    position: 'absolute',
    left: -1,
    top: -4,
    width: 41,
    height: 40,
  },
  titleBlock: {
    marginLeft: 14,
    flex: 1,
  },
  voraTitleBlock: {
    marginLeft: 12,
    marginTop: 2,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleLineStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  appName: {
    color: '#161823',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  awardBadge: {
    marginLeft: 8,
    height: 13,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  awardBadgeStacked: {
    marginLeft: 0,
  },
  awardText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '700',
  },
  stars: {
    color: '#F59E0B',
    fontSize: 12,
    marginTop: 5,
  },
  rating: {
    color: '#8B8FAF',
    fontSize: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D8D7E6',
    marginTop: 6,
    marginBottom: 4,
  },
  editorPick: {
    color: '#7F80A1',
    fontSize: 6.3,
  },
  description: {
    color: '#000000',
    fontSize: 8,
    lineHeight: 15,
    marginTop: 24,
    width: 208,
    height: 60,
  },
  voraDescription: {
    marginTop: 14,
    marginLeft: 5,
    width: 202,
  },
  detailButton: {
    position: 'absolute',
    right: 31,
    top: 151,
    height: 6,
    borderRadius: 11,
    backgroundColor: '#E6E6E6',
    paddingHorizontal: 7,
    justifyContent: 'center',
  },
  detailButtonText: {
    color: '#7F80A1',
    fontSize: 3,
    fontWeight: '700',
  },
  voraDetailButton: {
    top: 138,
    right: 27,
  },
  previewClip: {
    position: 'absolute',
    left: 26,
    bottom: 41.5,
    width: 214,
    height: 184,
    overflow: 'hidden',
  },
  voraPreviewClip: {
    left: 31,
    bottom: 53,
    width: 209,
    height: 170,
  },
  pawzzlePreviewCanvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 318,
    height: 184,
  },
  pawzzlePreviewImage: {
    position: 'absolute',
    left: -58,
    top: -236,
    width: 444,
    height: 576,
  },
  voraPhoneCrop: {
    position: 'absolute',
    top: 1,
    width: 81,
    height: 168,
    overflow: 'hidden',
  },
  voraPhoneLeft: {
    left: 20,
  },
  voraPhoneRight: {
    left: 115,
  },
  voraPhoneImageLeft: {
    position: 'absolute',
    left: -15,
    top: -45,
    width: 285,
    height: 243,
  },
  voraPhoneImageRight: {
    position: 'absolute',
    left: -102,
    top: -34,
    width: 285,
    height: 243,
  },
  stellarPreviewImage: {
    position: 'absolute',
    left: 13,
    top: -15.5,
    width: 299,
    height: 206,
  },
  generatedPreviewClip: {
    bottom: 48,
    borderRadius: 22,
  },
  generatedPreviewPanel: {
    width: 214,
    height: 184,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.74)',
    padding: 18,
  },
  generatedPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  generatedPreviewMark: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  generatedPreviewTitle: {
    color: '#4B4C67',
    fontSize: 9,
    fontWeight: '700',
  },
  fastgptPanel: {
    backgroundColor: '#EEF9FF',
  },
  fastgptBubble: {
    alignSelf: 'flex-start',
    maxWidth: 150,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 10,
    shadowColor: '#8AA3FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  fastgptBubbleText: {
    color: '#4B4C67',
    fontSize: 9,
    fontWeight: '700',
  },
  fastgptAnswer: {
    marginTop: 17,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 14,
  },
  fastgptAnswerLineLong: {
    width: 135,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A8DFFF',
  },
  fastgptAnswerLine: {
    width: 105,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C7C9FF',
    marginTop: 9,
  },
  fastgptAnswerLineShort: {
    width: 74,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDE5FF',
    marginTop: 9,
  },
  fastgptAction: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    height: 23,
    borderRadius: 14,
    backgroundColor: '#7C62FF',
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  fastgptActionText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  keystatsPanel: {
    backgroundColor: '#F7F1FF',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statTile: {
    width: 78,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.76)',
    padding: 10,
  },
  statValue: {
    color: '#4B4C67',
    fontSize: 14,
    fontWeight: '800',
  },
  statLabel: {
    color: '#8B8FAF',
    fontSize: 6,
    marginTop: 2,
  },
  chartRow: {
    height: 96,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    marginTop: 10,
    paddingLeft: 6,
  },
  chartBar: {
    width: 18,
    borderRadius: 9,
    backgroundColor: '#A78BFA',
  },
  buttonsPanel: {
    backgroundColor: '#F4FFF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPreviewPrimary: {
    width: 128,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#161823',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPreviewPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  buttonPreviewRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  buttonPreviewSecondary: {
    width: 67,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#9BF3B2',
  },
  buttonPreviewGhost: {
    width: 67,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#4B4C67',
  },
  buttonPreviewCode: {
    marginTop: 18,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  buttonPreviewCodeText: {
    color: '#4B4C67',
    fontSize: 8,
    fontWeight: '800',
  },
  fairycPanel: {
    backgroundColor: '#FFF2F9',
    alignItems: 'center',
  },
  fairycOrb: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFE3A3',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  fairycOrbText: {
    color: '#F0A83A',
    fontSize: 30,
    fontWeight: '800',
  },
  fairycLineLong: {
    width: 132,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFC6D5',
    marginTop: 18,
  },
  fairycLineShort: {
    width: 94,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F8D9FF',
    marginTop: 9,
  },
  fairycCard: {
    marginTop: 14,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  fairycCardText: {
    color: '#7F80A1',
    fontSize: 8,
    fontWeight: '700',
  },
  generatedIcon: {
    width: 57,
    height: 57,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatedIconText: {
    fontSize: 29,
    fontWeight: '900',
  },
  pageDots: {
    position: 'absolute',
    bottom: 18,
    left: 108,
    width: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D8D8',
  },
  dotActive: {
    backgroundColor: '#AFA8C8',
  },
  actionBar: {
    position: 'absolute',
    left: 19,
    top: 689,
    width: 336,
    height: 54,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1.3,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    shadowColor: '#BABABA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  actionItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1.8,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItemActive: {
    backgroundColor: '#7C62FF',
  },
  actionIcon: {
    color: '#8B8FAF',
    fontSize: 16,
    lineHeight: 17,
  },
  actionIconActive: {
    color: '#FFFFFF',
  },
  actionLabel: {
    color: '#7F80A1',
    fontSize: 7,
    marginTop: 2,
  },
  actionLabelActive: {
    color: '#FFFFFF',
  },
  drawerDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25, 27, 42, 0.20)',
    zIndex: 30,
  },
  rankingDrawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: ARTBOARD_WIDTH,
    height: 812,
    backgroundColor: '#F3F5FF',
    borderRadius: 40,
    paddingTop: 45,
    paddingHorizontal: 27,
    zIndex: 31,
  },
  drawerHeader: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBack: {
    position: 'absolute',
    left: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerShare: {
    position: 'absolute',
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerTitle: {
    color: '#161823',
    fontSize: 18,
    fontWeight: '700',
  },
  drawerHeading: {
    color: '#26273D',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 28,
  },
  drawerSubheading: {
    color: '#7F80A1',
    fontSize: 12,
    marginTop: 4,
  },
  drawerBanner: {
    height: 118,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 24,
    overflow: 'hidden',
    shadowColor: '#8B7CC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 4,
  },
  drawerBannerCopy: {
    position: 'absolute',
    left: 18,
    top: 18,
    zIndex: 3,
  },
  drawerBannerSmall: {
    color: '#7C62FF',
    fontSize: 15,
    fontWeight: '700',
  },
  drawerBannerTitle: {
    color: '#41435A',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  drawerBannerDesc: {
    color: '#8B8FAF',
    fontSize: 8,
    marginTop: 4,
  },
  drawerBannerPill: {
    width: 58,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#8E68FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  drawerBannerPillText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  bannerBubble: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(142,104,255,0.18)',
  },
  bannerBubbleA: {
    right: 18,
    top: 18,
    width: 22,
    height: 22,
  },
  bannerBubbleB: {
    right: 72,
    bottom: 12,
    width: 14,
    height: 14,
  },
  bannerBubbleC: {
    right: 5,
    bottom: 32,
    width: 34,
    height: 34,
  },
  goldCat: {
    position: 'absolute',
    right: 28,
    top: 11,
    width: 88,
    height: 92,
    alignItems: 'center',
  },
  goldCatEar: {
    position: 'absolute',
    top: 5,
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F6C566',
    transform: [{ rotate: '45deg' }],
  },
  goldCatEarLeft: {
    left: 17,
  },
  goldCatEarRight: {
    right: 17,
  },
  goldCatHead: {
    position: 'absolute',
    top: 13,
    width: 70,
    height: 66,
    borderRadius: 24,
    backgroundColor: '#FFD780',
    borderWidth: 2,
    borderColor: '#FFE9B6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C9973D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  goldCatFace: {
    color: '#A56B25',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  goldCatBase: {
    position: 'absolute',
    bottom: 0,
    width: 76,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D99B43',
  },
  goldCatLabel: {
    position: 'absolute',
    right: 36,
    bottom: 9,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  drawerSectionTitle: {
    height: 24,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerSpark: {
    color: '#7C62FF',
    fontSize: 12,
    marginRight: 6,
  },
  drawerSectionText: {
    color: '#44455A',
    fontSize: 14,
    fontWeight: '600',
  },
  drawerViewAll: {
    color: '#8B8FAF',
    fontSize: 12,
    marginLeft: 'auto',
  },
  rankingList: {
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#8B7CC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  rankingRow: {
    height: 55,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9EAF5',
  },
  rankingRank: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingCrown: {
    height: 11,
    color: '#D6A04A',
    fontSize: 9,
    lineHeight: 11,
  },
  rankingIndex: {
    color: '#7F80A1',
    fontSize: 10,
    lineHeight: 12,
  },
  rankingAppIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    marginLeft: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingIconText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  rankingCopy: {
    flex: 1,
    marginLeft: 10,
  },
  rankingName: {
    color: '#41435A',
    fontSize: 12,
    fontWeight: '600',
  },
  rankingMeta: {
    color: '#9A9CB8',
    fontSize: 10,
    marginTop: 2,
  },
  rankingScore: {
    color: '#D69D2C',
    fontSize: 10,
    marginRight: 7,
  },
  getButton: {
    width: 42,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B68FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getButtonText: {
    color: '#7C62FF',
    fontSize: 11,
    fontWeight: '600',
  },
});
