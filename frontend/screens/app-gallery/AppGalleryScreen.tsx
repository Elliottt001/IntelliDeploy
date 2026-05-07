import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

const pawzzleIcon =
  'https://www.figma.com/api/mcp/asset/63e6374b-b674-41ee-8d63-b7c980904e01';
const pawzzlePreview =
  'https://www.figma.com/api/mcp/asset/73dd314d-194e-43ef-88d5-a9b700bdebef';
const stellarIcon =
  'https://www.figma.com/api/mcp/asset/63e6374b-b674-41ee-8d63-b7c980904e01';
const stellarPreview =
  'https://www.figma.com/api/mcp/asset/742b060e-4dd6-4b4b-b578-67b2d5d02d18';
const voraPreview =
  'https://www.figma.com/api/mcp/asset/c00c1b16-5a79-472e-a5da-4c7495cdd1d5';

const apps = [
  {
    name: 'Pawzzle寻爪',
    rating: '4.8 · 1.2k 评价',
    badge: '金喵奖',
    meta: '编辑精选｜热度飙升',
    description:
      'Pawzzle是一款专注于宠物救助与关爱的应用，旨在帮助迷路的宠物找到新家并提供爱与关怀。在这个应用中，你可以浏览待领养的宠物，了解它们的故事，并为它们提供一个温暖的家。',
    icon: pawzzleIcon,
    preview: pawzzlePreview,
    rotation: '0deg',
  },
  {
    name: 'Stellar星耀',
    rating: '4.9 · 1.3k 评价',
    badge: '下载榜单Top10',
    meta: '下载榜单Top10',
    description:
      'Stellar星耀是一款专注于天文探索与星空观测的应用，利用AR实时识别夜空中的星座，了解星体背后的科学信息，把整个浩瀚宇宙装进口袋。',
    icon: stellarIcon,
    preview: stellarPreview,
    rotation: '10deg',
  },
  {
    name: 'Vora食光',
    rating: '3.9 · 2.4k 评价',
    badge: '免费',
    meta: '免费｜下载榜单Top3',
    description:
      'Vora食光专注于智能膳食与健康管理，提供AI个性化食谱、拍照识别食物卡路里，并轻松掌握每日营养摄入。',
    icon: pawzzleIcon,
    preview: voraPreview,
    rotation: '5deg',
  },
];

export default function AppGallery() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const intro = useRef(new Animated.Value(0)).current;
  const floatLoop = useRef(new Animated.Value(0)).current;
  const cardFlip = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;

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
      <View style={styles.artboard}>
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
          <Pressable style={styles.logoWrap} onPress={() => router.back()}>
            <View style={styles.logoDot}>
              <Text style={styles.logoGlyph}>✎</Text>
            </View>
            <View>
              <Text style={styles.logoTitle}>INTELLIDEPLOY</Text>
              <Text style={styles.logoSub}>Powered by Sealos | GitHub</Text>
            </View>
          </Pressable>
          <Pressable style={styles.settings}>
            <Text style={styles.settingsIcon}>⚙</Text>
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
            <Pressable style={[styles.filterPill, styles.filterHot]}>
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
              <View style={styles.appHeader}>
                <View style={styles.appIconWrap}>
                  <Image source={{ uri: activeApp.icon }} style={styles.appIcon} resizeMode="cover" />
                </View>
                <View style={styles.titleBlock}>
                  <View style={styles.titleLine}>
                    <Text style={styles.appName}>{activeApp.name}</Text>
                    <View style={styles.awardBadge}>
                      <Text style={styles.awardText}>{activeApp.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.stars}>★★★★★ <Text style={styles.rating}>{activeApp.rating}</Text></Text>
                  <View style={styles.divider} />
                  <Text style={styles.editorPick}>♕ {activeApp.meta}</Text>
                </View>
              </View>

              <Text style={styles.description}>{activeApp.description}</Text>
              <Pressable style={styles.detailButton} onPress={nextCard}>
                <Text style={styles.detailButtonText}>查看详情</Text>
              </Pressable>

              <View style={styles.previewRow}>
                <Image source={{ uri: activeApp.preview }} style={styles.previewPhone} resizeMode="cover" />
                <Image source={{ uri: activeApp.preview }} style={styles.previewPhone} resizeMode="cover" />
              </View>

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

        <View style={styles.actionBar}>
          <GalleryAction active={liked} icon="♡" label={liked ? '已赞·2.1k' : '点赞·2.1k'} onPress={() => setLiked((value) => !value)} />
          <GalleryAction active={saved} icon="☆" label={saved ? '已收藏' : '收藏·1k'} onPress={() => setSaved((value) => !value)} />
          <GalleryAction icon="☵" label="评论·267" onPress={nextCard} />
        </View>
      </View>
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
  artboard: {
    width: 375,
    height: 812,
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
          background:
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
    top: 47,
    left: 14,
    right: 14,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoDot: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#7C62FF',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  logoTitle: {
    color: '#4B4C67',
    fontSize: 18,
    fontWeight: '800',
  },
  logoSub: {
    color: '#9A9CB8',
    fontSize: 4.7,
    marginTop: 1,
  },
  settings: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 0.8,
    borderColor: '#DADAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    color: '#595A74',
    fontSize: 15,
  },
  main: {
    position: 'absolute',
    top: 105,
    left: 14,
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
    width: 295,
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
    marginTop: 27,
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
  },
  appIcon: {
    width: 57,
    height: 57,
  },
  titleBlock: {
    marginLeft: 14,
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    color: '#161823',
    fontSize: 14,
    fontWeight: '600',
  },
  awardBadge: {
    marginLeft: 8,
    height: 13,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    justifyContent: 'center',
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
  previewRow: {
    position: 'absolute',
    left: 26,
    bottom: 42,
    width: 214,
    height: 184,
    flexDirection: 'row',
    gap: 16,
    overflow: 'hidden',
  },
  previewPhone: {
    width: 91,
    height: 184,
    borderRadius: 18,
    backgroundColor: '#FFF5EA',
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
    left: 20,
    top: 690,
    width: 335,
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
});
