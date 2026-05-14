import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import MainHomeBackground from './MainHomeBackground';
import MainHomeBottomNav from './MainHomeBottomNav';
import MainHomeDarkMarket from './MainHomeDarkMarket';
import MainHomeFeatureCards from './MainHomeFeatureCards';
import MainHomeHeader from './MainHomeHeader';
import MainHomeHero from './MainHomeHero';
import MainHomeInspirationCloud from './MainHomeInspirationCloud';
import { mainHomeMotion, runPressPulse } from './mainHomeMotion';
import { MAIN_HOME_FRAME, lightTokens } from './mainHomeTokens';
import type { MainHomeCardId, MainHomeGalleryAppId, MainHomeNavId, MainHomeTheme } from './mainHomeTypes';
import { homeAPI, type HomeFeedResponse } from '../../../services/api';

const fallbackHomeFeed: HomeFeedResponse = {
  greeting: {
    userId: 'local',
    nickname: 'Oasis',
    bubbleText: '今天又有什么新想法？',
  },
  inspirationPool: {
    title: '灵感池',
    keywords: [],
  },
  navCards: [],
};

export default function MainHomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [theme, setTheme] = useState<MainHomeTheme>('light');
  const [expandedCard, setExpandedCard] = useState<MainHomeCardId | null>(null);
  const [activeTab, setActiveTab] = useState<MainHomeNavId>('home');
  const [cloudVariant, setCloudVariant] = useState(0);
  const [homeFeed, setHomeFeed] = useState<HomeFeedResponse | null>(null);

  const navIntro = useRef(new Animated.Value(0)).current;
  const heroIntro = useRef(new Animated.Value(0)).current;
  const cloudIntro = useRef(new Animated.Value(0)).current;
  const cardsIntro = useRef(new Animated.Value(0)).current;
  const floatLoop = useRef(new Animated.Value(0)).current;
  const miboPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    homeAPI
      .getFeed()
      .then((response) => {
        if (isMounted) {
          setHomeFeed(response.data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setHomeFeed(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(navIntro, {
        toValue: 1,
        duration: mainHomeMotion.introFast,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroIntro, {
        toValue: 1,
        duration: mainHomeMotion.introSlow,
        easing: Easing.out(Easing.back(1.12)),
        useNativeDriver: true,
      }),
      Animated.timing(cloudIntro, {
        toValue: 1,
        duration: mainHomeMotion.introMedium,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardsIntro, {
        toValue: 1,
        duration: mainHomeMotion.introSlow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const floatAnimation = Animated.loop(
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
    );
    floatAnimation.start();

    return () => floatAnimation.stop();
  }, [cardsIntro, cloudIntro, floatLoop, heroIntro, navIntro]);

  const artboardMetrics = useMemo(() => {
    const scale = Math.min(width / MAIN_HOME_FRAME.width, height / MAIN_HOME_FRAME.height);
    const visualWidth = MAIN_HOME_FRAME.width * scale;
    const visualHeight = MAIN_HOME_FRAME.height * scale;

    return {
      scale,
      visualWidth,
      visualHeight,
      left: (visualWidth - MAIN_HOME_FRAME.width) / 2,
      top: (visualHeight - MAIN_HOME_FRAME.height) / 2,
    };
  }, [height, width]);

  const floatY = floatLoop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });
  const inverseFloatY = floatLoop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 5],
  });
  const displayFeed = homeFeed ?? fallbackHomeFeed;
  const keywordLabels = useMemo(
    () => displayFeed.inspirationPool.keywords.map((keyword) => keyword.keyword),
    [displayFeed.inspirationPool.keywords]
  );

  const handleToggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
    setExpandedCard(null);
  }, []);

  const handleOpenMibo = useCallback(() => {
    runPressPulse(miboPulse);
    router.push('/chatbot');
  }, [miboPulse, router]);

  const handleToggleCard = useCallback((id: MainHomeCardId) => {
    setExpandedCard((current) => (current === id ? null : id));
  }, []);

  const handleOpenGalleryApp = useCallback(
    (appId: MainHomeGalleryAppId) => {
      router.push({ pathname: '/app-gallery', params: { app: appId } });
    },
    [router]
  );

  const handlePressAvatar = useCallback(() => {
    runPressPulse(miboPulse);
  }, [miboPulse]);

  const handlePressCloud = useCallback(() => {
    setCloudVariant((current) => current + 1);
  }, []);

  if (theme === 'dark') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" hidden translucent backgroundColor="transparent" />
        <MainHomeDarkMarket activeTab={activeTab} onSelectTab={setActiveTab} onSwitchTheme={handleToggleTheme} />
      </>
    );
  }

  return (
    <View style={styles.host}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" hidden translucent backgroundColor="transparent" />
      <View style={[styles.scaledSlot, { width: artboardMetrics.visualWidth, height: artboardMetrics.visualHeight }]}>
        <View
          style={[
            styles.artboard,
            {
              left: artboardMetrics.left,
              top: artboardMetrics.top,
              transform: [{ scale: artboardMetrics.scale }],
            },
          ]}
        >
          <MainHomeBackground floatY={floatY} inverseFloatY={inverseFloatY} />
          <MainHomeHeader theme={theme} intro={navIntro} onToggleTheme={handleToggleTheme} />
          <MainHomeHero
            intro={heroIntro}
            floatY={floatY}
            miboPulse={miboPulse}
            nickname={displayFeed.greeting.nickname}
            bubbleText={displayFeed.greeting.bubbleText}
            onOpenMibo={handleOpenMibo}
            onPressAvatar={handlePressAvatar}
          />
          <MainHomeInspirationCloud
            intro={cloudIntro}
            cloudVariant={cloudVariant}
            keywords={keywordLabels}
            onShuffle={handlePressCloud}
            onPressCloud={handlePressCloud}
          />
          <MainHomeFeatureCards
            intro={cardsIntro}
            navCards={displayFeed.navCards}
            expandedCard={expandedCard}
            onToggleCard={handleToggleCard}
            onOpenGalleryApp={handleOpenGalleryApp}
          />
          <MainHomeBottomNav theme="light" activeTab={activeTab} onSelect={setActiveTab} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightTokens.colors.white,
  },
  scaledSlot: {
    position: 'relative',
  },
  artboard: {
    position: 'absolute',
    width: MAIN_HOME_FRAME.width,
    height: MAIN_HOME_FRAME.height,
    borderRadius: MAIN_HOME_FRAME.radius,
    borderWidth: MAIN_HOME_FRAME.borderWidth,
    borderColor: lightTokens.colors.white,
    backgroundColor: lightTokens.colors.frameStart,
    overflow: 'hidden',
  },
});
