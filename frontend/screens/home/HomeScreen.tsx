import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Web landing page components
import Navbar from '../../components/web/Navbar';
import HeroSection from '../../components/web/HeroSection';
import StatsSection from '../../components/web/StatsSection';
import FeatureSection from '../../components/web/FeatureSection';
import TestimonialSection from '../../components/web/TestimonialSection';
import PricingSection from '../../components/web/PricingSection';
import Footer from '../../components/web/Footer';

const featureChatImage = require('../../assets/images/feature-chat.png');
const featureAppstoreImage = require('../../assets/images/feature-appstore.png');
const featureCommunity1Image = require('../../assets/images/feature-community1.png');

const DESIGN_WIDTH = 375;
const DESIGN_HEIGHT = 812;

const mobileCatImage =
  'https://www.figma.com/api/mcp/asset/be3df654-ec89-4c35-a63a-f7e408efb85c';
const navHomeIcon =
  'https://www.figma.com/api/mcp/asset/abc5ee4d-2cbc-401a-8a0c-a2584c02701a';
const navAppsIcon =
  'https://www.figma.com/api/mcp/asset/cddd4d83-b1de-4cc5-92ba-65fe6e773250';
const navSquareIcon =
  'https://www.figma.com/api/mcp/asset/5570c849-8b38-4fed-b847-dc39f58f06a9';
const navUserIcon =
  'https://www.figma.com/api/mcp/asset/2f36f385-98cf-41db-9a3a-bc7a7318e801';

function WebHome() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hasManualTheme, setHasManualTheme] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (matchesDark: boolean) => {
      if (!hasManualTheme) {
        setTheme(matchesDark ? 'dark' : 'light');
      }
    };

    applyTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [hasManualTheme]);

  const handleToggleTheme = useCallback(() => {
    setHasManualTheme(true);
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const isDark = theme === 'dark';

  return (
    <ScrollView
      style={[webStyles.scrollView, isDark && webStyles.scrollViewDark]}
      contentContainerStyle={webStyles.scrollContent}
    >
      <View style={[webStyles.page, isDark && webStyles.pageDark]}>
        <Navbar theme={theme} onToggleTheme={handleToggleTheme} />
        <HeroSection theme={theme} />
        <StatsSection theme={theme} />

        <View style={webStyles.featuresContainer}>
          <FeatureSection
            theme={theme}
            title="领养你的专属Mibo 沉浸式vibecoding"
            description="Mibo是知界独有的电子宠物，也是个人专属的coding助手。你可以定制ta的形象、给ta分发任务，在这里，你与ta共成长。"
            buttonText="Mibo ChatBot"
            image={featureChatImage}
          />
          <FeatureSection
            theme={theme}
            title="各种有趣的开源项目一网打尽 打造专属项目库"
            description="地毯式集成了市面上优秀的开源项目，并打包集成为Appstore中的微软件，实现一键部署、即刻使用。你可以将软件下载到自己的库中，打造个人项目库！"
            buttonText="App Store"
            image={featureAppstoreImage}
            reverse
          />
          <FeatureSection
            theme={theme}
            title="社区乐园为用户提供交流机会 你的声音值得被听见"
            description="用户可以以个人身份在广场上发帖交流，包括但不限于求助、答疑、求资源、学知识，这里链接了有创意的用户和有技术的大牛，实现灵感与价值的转化。"
            buttonText="Community"
            image={featureCommunity1Image}
          />
        </View>

        <TestimonialSection theme={theme} />
        <PricingSection theme={theme} />
        <Footer theme={theme} />
      </View>
    </ScrollView>
  );
}

function MobileHome() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = screenWidth / DESIGN_WIDTH;
  const scaledHeight = DESIGN_HEIGHT * scale;
  const [expandedCard, setExpandedCard] = useState<
    'gallery' | 'products' | 'square' | 'profile' | null
  >(null);
  const [activeTab, setActiveTab] = useState('首页');
  const [cloudVariant, setCloudVariant] = useState(0);
  const [miboActive, setMiboActive] = useState(false);
  const navIntro = useRef(new Animated.Value(0)).current;
  const heroIntro = useRef(new Animated.Value(0)).current;
  const cloudIntro = useRef(new Animated.Value(0)).current;
  const cardsIntro = useRef(new Animated.Value(0)).current;
  const bottomIntro = useRef(new Animated.Value(0)).current;
  const floatLoop = useRef(new Animated.Value(0)).current;
  const miboPulse = useRef(new Animated.Value(0)).current;
  const galleryExpand = useRef(new Animated.Value(0)).current;
  const productsExpand = useRef(new Animated.Value(0)).current;
  const squareExpand = useRef(new Animated.Value(0)).current;
  const profileExpand = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(navIntro, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroIntro, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.back(1.15)),
        useNativeDriver: true,
      }),
      Animated.timing(cloudIntro, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardsIntro, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(bottomIntro, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatLoop, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatLoop, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [bottomIntro, cardsIntro, cloudIntro, floatLoop, heroIntro, navIntro]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(galleryExpand, {
        toValue: expandedCard === 'gallery' ? 1 : 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(productsExpand, {
        toValue: expandedCard === 'products' ? 1 : 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(squareExpand, {
        toValue: expandedCard === 'square' ? 1 : 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(profileExpand, {
        toValue: expandedCard === 'profile' ? 1 : 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [expandedCard, galleryExpand, productsExpand, profileExpand, squareExpand]);

  useEffect(() => {
    if (!miboActive) {
      miboPulse.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.timing(miboPulse, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(miboPulse, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [miboActive, miboPulse]);

  const floatY = floatLoop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });

  const baseTags = [
    { text: '小众网站', style: styles.tagSmallSite },
    { text: 'Notion 模版', style: styles.tagNotion },
    { text: '同声传译', style: styles.tagTranslate },
    { text: 'AI Copilot', style: styles.tagMain },
    { text: '复古像素风', style: styles.tagRetro },
    { text: 'Vibe Coding', style: styles.tagVibe },
    { text: '自动化工作流', style: styles.tagWorkflow },
    { text: '生物科技', style: styles.tagBio },
    { text: 'Web3.0', style: styles.tagWeb3 },
    { text: 'Prompt技巧', style: styles.tagPrompt },
    { text: '知识管理', style: styles.tagKnowledge },
    { text: '开源工具', style: styles.tagOpen },
    { text: '番茄钟', style: styles.tagPomodoro },
    { text: '灵感配色', style: styles.tagColor },
  ];
  const altTags = [
    { text: 'Sealos', style: styles.tagSmallSite },
    { text: '部署模板', style: styles.tagNotion },
    { text: '容器监控', style: styles.tagTranslate },
    { text: 'Vibe Coding', style: styles.tagMain },
    { text: '开源项目', style: styles.tagRetro },
    { text: 'AI Agent', style: styles.tagVibe },
    { text: '自动化部署', style: styles.tagWorkflow },
    { text: '云原生', style: styles.tagBio },
    { text: 'GitHub', style: styles.tagWeb3 },
    { text: 'Prompt技巧', style: styles.tagPrompt },
    { text: '知识库', style: styles.tagKnowledge },
    { text: '低代码', style: styles.tagOpen },
    { text: '效率工具', style: styles.tagPomodoro },
    { text: '灵感配色', style: styles.tagColor },
  ];
  const tags = cloudVariant === 0 ? baseTags : altTags;

  const toggleCard = (card: 'gallery' | 'products' | 'square' | 'profile') => {
    setExpandedCard((current) => (current === card ? null : card));
  };

  return (
    <View style={[styles.mobileShell, { backgroundColor: '#EFF3FF', paddingTop: insets.top }]}>
      <View
        style={[
          styles.mobileArtboard,
          { width: screenWidth, height: scaledHeight, borderRadius: 0, borderWidth: 0 },
        ]}
      >
        <View
          style={{
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            transform: [{ scale }],
            transformOrigin: 'top left',
          }}
        >
        <View style={styles.mobileBg} />
        <Animated.View style={[styles.mobileBlobPink, { transform: [{ translateY: floatY }] }]} />
        <Animated.View
          style={[
            styles.mobileBlobPurple,
            { transform: [{ translateY: Animated.multiply(floatY, -0.6) }] },
          ]}
        />

        <Animated.View
          style={[
            styles.mobileTopBar,
            {
              opacity: navIntro,
              transform: [
                {
                  translateY: navIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.mobileBrand}>
            <View style={styles.mobileLogoDot}>
              <Text style={styles.mobileLogoGlyph}>✎</Text>
            </View>
            <View>
              <Text style={styles.mobileLogoTitle}>INTELLIDEPLOY</Text>
              <Text style={styles.mobileLogoSub}>Powered by Sealos | GitHub</Text>
            </View>
          </View>
          <Pressable style={styles.mobileSettings}>
            <Text style={styles.mobileSettingsIcon}>⚙</Text>
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.mobileHero,
            {
              opacity: heroIntro,
              transform: [
                {
                  translateY: Animated.add(
                    floatY,
                    heroIntro.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    })
                  ),
                },
                {
                  scale: heroIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.avatarHalo}>
            <View style={styles.avatarInner}>
              <Image source={{ uri: mobileCatImage }} style={styles.avatarCat} resizeMode="contain" />
            </View>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroGreeting}>Hi！Oasis✨</Text>
            <Text style={styles.heroQuestion}>今天又有什么新想法？</Text>
            <Pressable
              onPress={() => {
                setMiboActive(true);
                setTimeout(() => setMiboActive(false), 620);
                router.push('/chatbot');
              }}
            >
              <Animated.Text
                style={[
                  styles.heroMiboLink,
                  {
                    transform: [
                      {
                        scale: miboPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.06],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {'<<< 点击此处与Mibo^^ AI对话'}
              </Animated.Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.sectionHeader,
            {
              opacity: cloudIntro,
              transform: [
                {
                  translateY: cloudIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.sectionIcon}>✦</Text>
          <Text style={styles.sectionTitle}>灵感池</Text>
          <Text style={styles.sectionMeta}>· 当日有什么新鲜好玩的</Text>
          <Pressable
            style={styles.refreshButton}
            onPress={() => setCloudVariant((current) => (current === 0 ? 1 : 0))}
          >
            <Text style={styles.refreshText}>换一批↻</Text>
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.wordCloud,
            {
              opacity: cloudIntro,
              transform: [
                {
                  translateY: cloudIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
                {
                  scale: cloudIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {tags.map((tag) => (
            <Text key={tag.text} style={[styles.wordTag, tag.style]}>
              {tag.text}
            </Text>
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.sectionHeader,
            styles.galleryHeader,
            {
              opacity: cardsIntro,
              transform: [
                {
                  translateY: cardsIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.sectionIcon}>✦</Text>
          <Text style={styles.sectionTitle}>功能广场</Text>
          <Text style={styles.sectionMeta}>· 立即探索你的新世界</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.mobileCard,
            styles.appGalleryCard,
            {
              height: galleryExpand.interpolate({
                inputRange: [0, 1],
                outputRange: [70, 195],
              }),
              opacity: cardsIntro,
              transform: [
                {
                  translateY: cardsIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            style={styles.cardHitArea}
            onPress={() => router.push('/app-gallery')}
            onLongPress={() => toggleCard('gallery')}
          >
          <View>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>App Gallery</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>上新！</Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>发现优秀应用，提升效率</Text>
          </View>
          <View style={styles.cardArrow}>
            <Text style={styles.cardArrowText}>{expandedCard === 'gallery' ? '↓' : '→'}</Text>
          </View>
          </Pressable>
          <Animated.View style={[styles.galleryDetail, { opacity: galleryExpand }]}>
            <AppPill label="Slack" color="#F6FEFF" icon="✣" />
            <AppPill label="Calendar" color="#FFFFFF" icon="31" />
            <AppPill label="Deploy" color="#F8F7FF" icon="△" />
            <AppPill label="FairyGUI" color="#FFFFFF" icon="F" />
            <View style={styles.galleryWave} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.mobileCard,
            styles.productCard,
            {
              height: productsExpand.interpolate({
                inputRange: [0, 1],
                outputRange: [69, 195],
              }),
              opacity: cardsIntro,
              transform: [
                {
                  translateY: cardsIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [32, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable style={styles.cardHitArea} onPress={() => toggleCard('products')}>
          <View style={styles.cardArrowSmall}>
            <Text style={styles.cardArrowText}>{expandedCard === 'products' ? '↓' : '→'}</Text>
          </View>
          <View style={styles.productIconStrip}>
            <View style={[styles.productIcon, styles.slackIcon]}>
              <Text style={styles.productEmoji}>✣</Text>
            </View>
            <View style={styles.productIcon}>
              <Text style={styles.productEmoji}>31</Text>
            </View>
            <View style={styles.productIcon}>
              <Text style={styles.productEmoji}>△</Text>
            </View>
          </View>
          <View style={styles.productText}>
            <Text style={styles.cardTitle}>我的产品</Text>
            <Text style={styles.cardSubtitle}>管理我的应用与工具</Text>
          </View>
          </Pressable>
          <Animated.View style={[styles.productDetail, { opacity: productsExpand }]}>
            <View style={styles.productBox} />
            <Text style={styles.productDetailText}>收藏进度：21/50 免费扩容</Text>
            <View style={[styles.productShard, styles.productShardA]} />
            <View style={[styles.productShard, styles.productShardB]} />
            <View style={[styles.productShard, styles.productShardC]} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.mobileCard,
            styles.squareCard,
            {
              height: squareExpand.interpolate({
                inputRange: [0, 1],
                outputRange: [69, 195],
              }),
              opacity: cardsIntro,
              transform: [
                {
                  translateY: cardsIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable style={styles.cardHitArea} onPress={() => toggleCard('square')}>
          <View>
            <Text style={styles.cardTitle}>广场</Text>
            <Text style={styles.cardSubtitle}>探索分享，交流成长</Text>
          </View>
          <View style={styles.metricRow}>
            <Metric icon="♡" count="99+" />
            <Metric icon="☆" count="99+" />
            <Metric icon="☵" count="99+" />
          </View>
          <View style={styles.cardArrow}>
            <Text style={styles.cardArrowText}>{expandedCard === 'square' ? '↓' : '→'}</Text>
          </View>
          </Pressable>
          <Animated.View style={[styles.squareDetail, { opacity: squareExpand }]}>
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>今日十大热贴🔥</Text>
            </View>
            <Text style={styles.hotPost}>TOP 1  [官方公告] IntelliDeploy v2.0 重磅更新，AI 助手...</Text>
            <Text style={styles.hotPostMeta}>456 评论 · 1.2k 赞 · 8.5w 浏览</Text>
            <View style={styles.hotLine} />
            <Text style={styles.hotPost}>TOP 2  [干货分享] 超好用的 VS Code 插件...</Text>
            <Text style={styles.hotPostMeta}>128 评论 · 856 赞 · 3.2w 浏览</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.mobileCard,
            styles.profileCard,
            {
              height: profileExpand.interpolate({
                inputRange: [0, 1],
                outputRange: [68, 195],
              }),
              opacity: cardsIntro,
              transform: [
                {
                  translateY: cardsIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [48, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable style={styles.cardHitArea} onPress={() => toggleCard('profile')}>
          <View style={styles.cardArrowSmall}>
            <Text style={styles.cardArrowText}>{expandedCard === 'profile' ? '↓' : '→'}</Text>
          </View>
          <View style={styles.profileProgress}>
            <Text style={styles.profileMeta}>个人资料完善程度</Text>
            <Text style={styles.profileScore}>80/100%</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.cardTitle}>个人主页</Text>
            <Text style={styles.cardSubtitle}>查看数据，进行个性化设置</Text>
          </View>
          </Pressable>
          <Animated.View style={[styles.profileDetail, { opacity: profileExpand }]}>
            <View style={styles.profileHeroImage} />
            <Text style={styles.profileDetailTitle}>Oasis 的工作台</Text>
            <Text style={styles.profileDetailMeta}>项目 12 · 应用 8 · 自动化 4</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.bottomNav,
            {
              opacity: bottomIntro,
              transform: [
                {
                  translateY: bottomIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <NavItem icon={navHomeIcon} label="首页" active={activeTab === '首页'} onPress={setActiveTab} />
          <NavItem icon={navAppsIcon} label="应用" active={activeTab === '应用'} onPress={setActiveTab} />
          <NavItem icon={navSquareIcon} label="广场" active={activeTab === '广场'} onPress={setActiveTab} />
          <NavItem icon={navUserIcon} label="我的" active={activeTab === '我的'} onPress={setActiveTab} />
        </Animated.View>
        </View>
      </View>
    </View>
  );
}

function Metric({ icon, count }: { icon: string; count: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <View style={styles.metricDot} />
      <Text style={styles.metricCount}>{count}</Text>
    </View>
  );
}

function AppPill({ label, color, icon }: { label: string; color: string; icon: string }) {
  return (
    <View style={[styles.appPill, { backgroundColor: color }]}>
      <Text style={styles.appPillIcon}>{icon}</Text>
      <Text style={styles.appPillText}>{label}</Text>
    </View>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress: (label: string) => void;
}) {
  return (
    <Pressable style={[styles.navItem, active && styles.navItemActive]} onPress={() => onPress(label)}>
      <Image source={{ uri: icon }} style={[styles.navIcon, active && styles.navIconActive]} resizeMode="contain" />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function Home() {
  if (Platform.OS === 'web') {
    return <WebHome />;
  }
  return <MobileHome />;
}

const webStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FAFBFF',
  },
  scrollViewDark: {
    backgroundColor: '#060816',
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          background:
            'linear-gradient(211deg, rgba(239, 243, 255, 1) 6%, rgba(255, 255, 255, 1) 100%)',
        } as any)
      : {}),
  },
  pageDark: {
    ...(Platform.OS === 'web'
      ? ({
          background:
            'radial-gradient(circle at top, rgba(117, 84, 255, 0.22) 0%, rgba(15, 18, 40, 0.96) 32%, rgba(6, 8, 22, 1) 74%)',
        } as any)
      : {
          backgroundColor: '#060816',
        }),
  },
  featuresContainer: {
    width: '100%' as any,
    maxWidth: 1200,
    paddingHorizontal: 24,
    gap: 60,
    paddingVertical: 60,
    alignSelf: 'center' as any,
  },
});

const styles = StyleSheet.create({
  mobileShell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileArtboard: {
    width: 375,
    height: 812,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#EFF3FF',
    position: 'relative',
  },
  mobileBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EFF3FF',
  },
  mobileBlobPink: {
    position: 'absolute',
    width: 280,
    height: 360,
    right: -78,
    bottom: -42,
    borderRadius: 180,
    backgroundColor: 'rgba(246,184,255,0.28)',
  },
  mobileBlobPurple: {
    position: 'absolute',
    width: 250,
    height: 260,
    right: -96,
    top: 495,
    borderRadius: 130,
    backgroundColor: 'rgba(124,98,255,0.18)',
  },
  mobileTopBar: {
    position: 'absolute',
    top: 47,
    left: 14,
    right: 14,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileLogoDot: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#7C62FF',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileLogoGlyph: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: -1,
  },
  mobileLogoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4B4C67',
  },
  mobileLogoSub: {
    fontSize: 4.7,
    color: '#9A9CB8',
    marginTop: 1,
  },
  mobileSettings: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 0.8,
    borderColor: '#DADAEA',
  },
  mobileSettingsIcon: {
    color: '#595A74',
    fontSize: 15,
  },
  mobileHero: {
    position: 'absolute',
    top: 107,
    left: 36,
    width: 306,
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarHalo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F5E7FF',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B48CFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(203,231,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCat: {
    width: 62,
    height: 58,
  },
  heroCopy: {
    marginLeft: 18,
    paddingTop: 3,
  },
  heroGreeting: {
    color: '#404040',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 3,
  },
  heroQuestion: {
    color: '#7F80A1',
    fontSize: 11,
    marginBottom: 8,
  },
  heroMiboLink: {
    color: '#B05CFF',
    fontSize: 10,
    textDecorationLine: 'underline',
  },
  sectionHeader: {
    position: 'absolute',
    top: 249,
    left: 35,
    width: 307,
    height: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  galleryHeader: {
    top: 419,
  },
  sectionIcon: {
    color: '#7C62FF',
    fontSize: 10,
    marginRight: 5,
  },
  sectionTitle: {
    color: '#494A64',
    fontSize: 10,
    fontWeight: '600',
  },
  sectionMeta: {
    color: '#7F80A1',
    fontSize: 8,
    marginLeft: 4,
  },
  refreshButton: {
    marginLeft: 'auto',
  },
  refreshText: {
    color: '#7C62FF',
    fontSize: 8,
  },
  wordCloud: {
    position: 'absolute',
    top: 277,
    left: 39,
    width: 303,
    height: 111,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.42)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  wordTag: {
    position: 'absolute',
    fontWeight: '600',
  },
  tagMain: {
    left: 98,
    top: 36,
    fontSize: 24,
    color: '#8A65FF',
  },
  tagNotion: {
    left: 160,
    top: 11,
    fontSize: 14,
    color: '#6598FF',
    opacity: 0.72,
  },
  tagTranslate: {
    left: 122,
    top: 6,
    fontSize: 8,
    color: '#54AEF3',
    opacity: 0.7,
  },
  tagRetro: {
    left: 88,
    top: 21,
    fontSize: 10,
    color: '#A3B2FF',
  },
  tagVibe: {
    left: 12,
    top: 51,
    fontSize: 10,
    color: '#6598FF',
    opacity: 0.75,
  },
  tagWorkflow: {
    left: 73,
    top: 68,
    fontSize: 10,
    color: '#7B5CF6',
  },
  tagBio: {
    left: 160,
    top: 70,
    fontSize: 10,
    color: '#A997FF',
  },
  tagWeb3: {
    left: 233,
    top: 48,
    fontSize: 10,
    color: '#7C62FF',
    opacity: 0.65,
  },
  tagPrompt: {
    left: 28,
    top: 86,
    fontSize: 10,
    color: '#7C62FF',
    opacity: 0.72,
  },
  tagKnowledge: {
    left: 125,
    top: 86,
    fontSize: 10,
    color: '#A78BFA',
    opacity: 0.7,
  },
  tagOpen: {
    left: 182,
    top: 91,
    fontSize: 8,
    color: '#D582FF',
  },
  tagPomodoro: {
    left: 213,
    top: 67,
    fontSize: 10,
    color: '#7C62FF',
  },
  tagColor: {
    left: 241,
    top: 86,
    fontSize: 10,
    color: '#7C62FF',
    opacity: 0.65,
  },
  tagSmallSite: {
    left: 50,
    top: 4,
    fontSize: 10,
    color: '#6598FF',
  },
  mobileCard: {
    position: 'absolute',
    left: 28,
    width: 321,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(244,242,255,0.82)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -2, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 11,
    overflow: 'hidden',
  },
  cardHitArea: {
    height: 69,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appGalleryCard: {
    top: 447,
    paddingLeft: 31,
    paddingRight: 20,
  },
  productCard: {
    top: 517,
    paddingHorizontal: 26,
  },
  squareCard: {
    top: 587,
    backgroundColor: 'rgba(219,232,255,0.84)',
    paddingHorizontal: 31,
  },
  profileCard: {
    top: 657,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 24,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cardTitle: {
    color: '#161823',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  cardSubtitle: {
    color: '#7F80A1',
    fontSize: 8,
    marginTop: 2,
  },
  badge: {
    width: 36,
    height: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C62FF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '700',
  },
  cardArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrowSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrowText: {
    color: '#6B7280',
    fontSize: 26,
    lineHeight: 28,
  },
  productIconStrip: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 16,
  },
  productIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slackIcon: {
    backgroundColor: '#F8FBFF',
  },
  productEmoji: {
    color: '#161823',
    fontSize: 14,
    fontWeight: '700',
  },
  productText: {
    marginLeft: 'auto',
    alignItems: 'flex-start',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 22,
  },
  metricItem: {
    width: 33,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: {
    color: '#161823',
    fontSize: 16,
    lineHeight: 18,
  },
  metricDot: {
    position: 'absolute',
    top: 3,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF4D67',
  },
  metricCount: {
    color: '#7F80A1',
    fontSize: 6,
    marginTop: 1,
  },
  profileProgress: {
    marginLeft: 11,
  },
  profileMeta: {
    color: '#7F80A1',
    fontSize: 8,
    lineHeight: 16,
  },
  profileScore: {
    color: '#7C62FF',
    fontSize: 11,
    lineHeight: 17,
  },
  profileText: {
    marginLeft: 'auto',
  },
  galleryDetail: {
    position: 'absolute',
    left: 17,
    top: 73,
    width: 287,
    height: 112,
  },
  appPill: {
    position: 'relative',
    width: 112,
    height: 32,
    borderRadius: 16,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#A6A0D8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
  },
  appPillIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#7C62FF',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 11,
    fontWeight: '800',
    marginRight: 8,
  },
  appPillText: {
    color: '#494A64',
    fontSize: 10,
    fontWeight: '600',
  },
  galleryWave: {
    position: 'absolute',
    left: -18,
    right: -18,
    bottom: -6,
    height: 52,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  productDetail: {
    position: 'absolute',
    left: 50,
    top: 80,
    width: 232,
    height: 100,
  },
  productBox: {
    position: 'absolute',
    left: 16,
    top: 18,
    width: 129,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  productDetailText: {
    position: 'absolute',
    right: 0,
    top: 48,
    width: 82,
    color: '#7F80A1',
    fontSize: 8,
    lineHeight: 14,
  },
  productShard: {
    position: 'absolute',
    borderRadius: 7,
    backgroundColor: 'rgba(124,98,255,0.35)',
  },
  productShardA: {
    left: 0,
    top: 12,
    width: 56,
    height: 72,
    transform: [{ rotate: '-12deg' }],
  },
  productShardB: {
    left: 86,
    top: 0,
    width: 22,
    height: 78,
    transform: [{ rotate: '8deg' }],
  },
  productShardC: {
    left: 128,
    top: 14,
    width: 48,
    height: 70,
    transform: [{ rotate: '-8deg' }],
  },
  squareDetail: {
    position: 'absolute',
    left: 31,
    top: 78,
    width: 270,
    height: 108,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingTop: 9,
    paddingHorizontal: 18,
  },
  hotBadge: {
    alignSelf: 'center',
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7C62FF',
    paddingHorizontal: 20,
    justifyContent: 'center',
    marginBottom: 8,
  },
  hotBadgeText: {
    color: '#7C62FF',
    fontSize: 10,
    fontWeight: '700',
  },
  hotPost: {
    color: '#161823',
    fontSize: 8,
    lineHeight: 15,
  },
  hotPostMeta: {
    color: '#7F80A1',
    fontSize: 6,
    lineHeight: 12,
  },
  hotLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECEAF8',
    marginVertical: 5,
  },
  profileDetail: {
    position: 'absolute',
    left: 3,
    top: 72,
    width: 315,
    height: 118,
    borderRadius: 30,
    overflow: 'hidden',
  },
  profileHeroImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(206,225,255,0.62)',
  },
  profileDetailTitle: {
    position: 'absolute',
    right: 24,
    bottom: 38,
    color: '#161823',
    fontSize: 16,
    fontWeight: '700',
  },
  profileDetailMeta: {
    position: 'absolute',
    right: 24,
    bottom: 20,
    color: '#7F80A1',
    fontSize: 8,
  },
  bottomNav: {
    position: 'absolute',
    left: 15,
    top: 724,
    width: 335,
    height: 54,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1.3,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#BABABA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  navItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navItemActive: {
    backgroundColor: '#7C62FF',
    shadowColor: '#9382E9',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  navIcon: {
    width: 14,
    height: 14,
    tintColor: '#6B7280',
  },
  navIconActive: {
    tintColor: '#FFFFFF',
  },
  navText: {
    color: '#6B7280',
    fontSize: 7,
  },
  navTextActive: {
    color: '#FFFFFF',
  },
});
