import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';

import MainHomeFeatureCard from './MainHomeFeatureCard';
import { lightLayout, lightTokens } from './mainHomeTokens';
import { mainHomeMotion } from './mainHomeMotion';
import type { FeatureCardData, MainHomeCardId, MainHomeGalleryAppId, MainHomeRouteId } from './mainHomeTypes';
import type { HomeFeedResponse } from '../../../services/api';

const featureCards: FeatureCardData[] = [
  {
    id: 'gallery',
    title: 'App Gallery',
    subtitle: '发现优秀应用，提升效率',
    collapsedTop: 447,
    expandedTop: 328,
    accent: '#7C62FF',
    stackOrder: 1,
  },
  {
    id: 'products',
    title: '我的产品',
    subtitle: '管理我的应用与工具',
    collapsedTop: 517,
    expandedTop: 401,
    accent: '#A78BFA',
    stackOrder: 2,
  },
  {
    id: 'square',
    title: '广场',
    subtitle: '探索分享，交流成长',
    collapsedTop: 587,
    expandedTop: 465,
    accent: '#60A5FA',
    stackOrder: 3,
  },
  {
    id: 'profile',
    title: '个人主页',
    subtitle: '查看数据，进行个性化设置',
    collapsedTop: 657,
    expandedTop: 544,
    accent: '#C05CF6',
    stackOrder: 4,
  },
];

type MainHomeFeatureCardsProps = {
  intro: Animated.Value;
  navCards: HomeFeedResponse['navCards'];
  expandedCard: MainHomeCardId | null;
  onToggleCard: (id: MainHomeCardId) => void;
  onOpenGalleryApp: (id: MainHomeGalleryAppId) => void;
  onOpenRoute: (id: MainHomeRouteId) => void;
};

export default function MainHomeFeatureCards({
  intro,
  navCards,
  expandedCard,
  onToggleCard,
  onOpenGalleryApp,
  onOpenRoute,
}: MainHomeFeatureCardsProps) {
  const progresses = {
    gallery: useRef(new Animated.Value(0)).current,
    products: useRef(new Animated.Value(0)).current,
    square: useRef(new Animated.Value(0)).current,
    profile: useRef(new Animated.Value(0)).current,
  };
  const cards = useMemo(() => mergeNavCards(navCards), [navCards]);
  const orderedCards = useMemo(() => {
    if (!expandedCard) {
      return cards;
    }

    return [
      ...cards.filter((card) => card.id !== expandedCard),
      cards.find((card) => card.id === expandedCard)!,
    ];
  }, [cards, expandedCard]);

  useEffect(() => {
    Animated.parallel(
      cards.map((card) =>
        Animated.timing(progresses[card.id], {
          toValue: expandedCard === card.id ? 1 : 0,
          duration: mainHomeMotion.cardExpand,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      )
    ).start();
  }, [cards, expandedCard, progresses.gallery, progresses.products, progresses.profile, progresses.square]);

  return (
    <>
      <Animated.View
        style={[
          styles.header,
          {
            opacity: intro,
            transform: [
              {
                translateY: intro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.headerLabel}>
          <Text style={styles.spark}>✦</Text>
          <Text style={styles.title}>功能广场</Text>
          <Text style={styles.meta}>· 立即探索你的新世界</Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: intro,
            transform: [
              {
                translateY: intro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          },
        ]}
      >
        {orderedCards.map((card) => (
          <MainHomeFeatureCard
            key={card.id}
            card={card}
            progress={progresses[card.id]}
            isExpanded={expandedCard === card.id}
            onPress={onToggleCard}
            onOpenGalleryApp={onOpenGalleryApp}
            onOpenRoute={onOpenRoute}
          />
        ))}
      </Animated.View>
    </>
  );
}

function mergeNavCards(navCards: HomeFeedResponse['navCards']): FeatureCardData[] {
  const byId = new Map<MainHomeCardId, HomeFeedResponse['navCards'][number]>();

  navCards.forEach((card) => {
    const id = normalizeNavCardKey(card.key);
    if (id) {
      byId.set(id, card);
    }
  });

  return featureCards.map((card) => {
    const apiCard = byId.get(card.id);
    if (!apiCard) {
      return card;
    }

    return {
      ...card,
      title: apiCard.title,
      iconUrl: apiCard.iconUrl,
      route: apiCard.route,
    };
  });
}

function normalizeNavCardKey(key: string): MainHomeCardId | null {
  if (key === 'gallery') {
    return 'gallery';
  }
  if (key === 'myProducts' || key === 'products') {
    return 'products';
  }
  if (key === 'plaza' || key === 'square') {
    return 'square';
  }
  if (key === 'profile' || key === 'me') {
    return 'profile';
  }
  return null;
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    left: lightLayout.featureHeader.left,
    top: lightLayout.featureHeader.top,
    width: lightLayout.featureHeader.width,
    height: lightLayout.featureHeader.height,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spark: {
    color: lightTokens.colors.primary,
    fontSize: 10,
    marginRight: 5,
  },
  title: {
    color: lightTokens.colors.textSoft,
    fontSize: lightTokens.typography.sectionTitle,
    fontWeight: '600',
  },
  meta: {
    color: lightTokens.colors.textMuted,
    fontSize: lightTokens.typography.sectionMeta,
    marginLeft: 4,
  },
});
