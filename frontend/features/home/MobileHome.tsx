import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppBackground, BottomNav, BrandHeader, CircleAction, GlassCard, MobileIcon } from '../../components/mobile';
import { mobileAssets } from '../../design/generated/mobileAssetManifest';
import { authAPI } from '../../services/api';
import { mobileFontFamilies } from '../../theme/typography';
import { mobileColors, mobileSpacing } from '../../theme/tokens';
import {
  homeCards,
  homeFigmaEvidence,
  homeSuggestions,
  type HomeCardKey,
} from './homeContent';

const miboImage = mobileAssets['845:3522:114'].source;
const cardIcons = {
  community: 'compass',
  products: 'user',
  profile: 'user',
  store: 'layout-grid',
} as const satisfies Record<HomeCardKey, 'compass' | 'layout-grid' | 'user'>;
const cardEvidenceByKey = Object.fromEntries(
  homeFigmaEvidence.cards.map((card) => [card.key, card]),
) as Record<HomeCardKey, (typeof homeFigmaEvidence.cards)[number]>;
const suggestionPositions = ['suggestion0', 'suggestion1', 'suggestion2'] as const;

export function MobileHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedCard, setExpandedCard] = useState<HomeCardKey | null>(null);
  const [username, setUsername] = useState('你好');

  useEffect(() => {
    let alive = true;
    authAPI
      .getMe()
      .then((response) => {
        if (alive && response.data.username.trim()) {
          setUsername(response.data.username.trim());
        }
      })
      .catch(() => {
        if (alive) {
          setUsername('你好');
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const navigate = (href: string) => {
    router.push(href as never);
  };

  return (
    <AppBackground
      contentStyle={styles.content}
      insets={{ left: insets.left, right: insets.right }}
      testID="mobile-home"
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100, paddingTop: insets.top + 18 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader
          action={
            <CircleAction
              accessibilityLabel="额度与设置"
              icon="settings"
              onPress={() => navigate('/billing')}
              style={styles.headerAction}
              testID="home-settings"
            />
          }
          subtitle="Powered by Sealos | GitHub"
          title="IntelliDeploy"
        />

        <View style={styles.hero}>
          <View style={styles.miboHalo}>
            <Image accessibilityIgnoresInvertColors source={miboImage} style={styles.mibo} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>Hi！{username}</Text>
            <Text style={styles.question}>今天又有什么新想法？</Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => navigate('/chatbot')}
              style={styles.miboLink}
              testID="home-mibo-open"
            >
              <Text style={styles.miboLinkText}>与 Mibo AI 对话</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <MobileIcon color={mobileColors.primary} name="arrow-right" size={13} />
          <Text style={styles.sectionTitle}>灵感池</Text>
          <Text style={styles.sectionMeta}>当日有什么新鲜好玩的</Text>
        </View>
        <GlassCard
          style={[
            styles.wordCloud,
            {
              height: homeFigmaEvidence.wordCloud.frame.height,
              maxWidth: homeFigmaEvidence.wordCloud.frame.width,
              minHeight: homeFigmaEvidence.wordCloud.frame.height,
            },
          ]}
          testID="home-suggestions"
        >
          {homeFigmaEvidence.wordCloud.items.map((item) => (
            <Text
              key={item.id}
              style={[
                styles.wordCloudText,
                {
                  color: item.color,
                  fontSize: item.fontSize,
                  left: item.x,
                  lineHeight: item.height,
                  opacity: item.opacity ?? 1,
                  top: item.y,
                  width: item.width,
                },
              ]}
            >
              {item.text}
            </Text>
          ))}
          {homeSuggestions.map((suggestion, index) => (
            <Pressable
              accessibilityRole="button"
              key={suggestion.id}
              onPress={() =>
                navigate(`/chatbot?prompt=${encodeURIComponent(suggestion.prompt)}`)
              }
              style={[styles.suggestion, styles[suggestionPositions[index]]]}
              testID={`home-suggestion-${suggestion.id}`}
            >
              <Text style={styles.suggestionText}>{suggestion.label.replace('做一个', '')}</Text>
            </Pressable>
          ))}
        </GlassCard>

        <View style={styles.sectionHeader}>
          <MobileIcon color={mobileColors.primary} name="arrow-right" size={13} />
          <Text style={styles.sectionTitle}>功能广场</Text>
          <Text style={styles.sectionMeta}>立即探索你的新世界</Text>
        </View>

        <View style={styles.cards}>
          {homeCards.map((card) => {
            const expanded = expandedCard === card.key;
            const evidence = cardEvidenceByKey[card.key];
            return (
              <GlassCard
                key={card.key}
                style={[
                  styles.homeCard,
                  {
                    maxWidth: evidence.closed.width,
                    minHeight: expanded
                      ? evidence.expandedSurface.height
                      : evidence.closed.height,
                  },
                ]}
                testID={`home-card-${card.key}-shell`}
              >
                <Pressable
                  {...({ 'aria-expanded': expanded ? 'true' : 'false' } as object)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() =>
                    setExpandedCard((current) => (current === card.key ? null : card.key))
                  }
                  style={styles.cardToggle}
                  testID={`home-card-${card.key}`}
                >
                  <View style={styles.cardIcon}>
                    <MobileIcon
                      color="#FFFFFF"
                      name={cardIcons[card.key]}
                      size={18}
                    />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{card.title}</Text>
                    <Text style={styles.cardDescription}>{card.description}</Text>
                  </View>
                  <View style={styles.cardChevron}>
                    <MobileIcon
                      color={mobileColors.text}
                      name="arrow-right"
                      size={expanded ? 15 : 13}
                    />
                  </View>
                </Pressable>

                {expanded ? (
                  <View style={styles.cardDetail}>
                    <View style={styles.detailRail}>
                      <View style={[styles.detailDot, styles.detailDotPrimary]} />
                      <View style={[styles.detailDot, styles.detailDotBlue]} />
                      <View style={[styles.detailDot, styles.detailDotPink]} />
                    </View>
                    <Text style={styles.detailText}>
                      {card.key === 'community'
                        ? '匿名可读广场内容，互动操作按现有登录规则进入。'
                        : card.description}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => navigate(card.href)}
                      style={styles.openButton}
                      testID={`home-card-${card.key}-open`}
                    >
                      <Text style={styles.openButtonText}>进入</Text>
                      <MobileIcon color="#FFFFFF" name="arrow-right" size={14} />
                    </Pressable>
                  </View>
                ) : null}
              </GlassCard>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={[styles.bottomNavWrap, { bottom: Math.max(insets.bottom, 10) }]}
        testID="home-bottom-nav-wrap"
      >
        <BottomNav active="home" onNavigate={navigate} testID="home-bottom-nav" />
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    position: 'relative',
  },
  scrollContent: {
    gap: 18,
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    minHeight: 126,
    paddingTop: 14,
  },
  headerAction: {
    transform: [{ translateX: -6 }],
  },
  miboHalo: {
    alignItems: 'center',
    backgroundColor: '#F5E7FF',
    borderColor: '#FFFFFF',
    borderRadius: 47,
    borderWidth: 5,
    height: 94,
    justifyContent: 'center',
    shadowColor: '#B48CFF',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    width: 94,
  },
  mibo: {
    height: 70,
    resizeMode: 'contain',
    width: 70,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  greeting: {
    color: '#404040',
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  question: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 12,
    lineHeight: 18,
  },
  miboLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: mobileSpacing.controlMin,
    justifyContent: 'center',
  },
  miboLinkText: {
    color: '#B05CFF',
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 24,
  },
  sectionTitle: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionMeta: {
    color: mobileColors.muted,
    flexShrink: 1,
    fontFamily: mobileFontFamilies.body,
    fontSize: 10,
    lineHeight: 14,
  },
  wordCloud: {
    alignSelf: 'center',
    height: 111,
    minHeight: 111,
    overflow: 'hidden',
    padding: 0,
    position: 'relative',
    width: '100%',
  },
  wordCloudText: {
    fontFamily: mobileFontFamilies.emphasis,
    fontWeight: '600',
    lineHeight: 34,
    position: 'absolute',
  },
  suggestion: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderColor: 'rgba(124,98,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: mobileSpacing.controlMin,
    minWidth: mobileSpacing.controlMin,
    paddingHorizontal: 10,
    position: 'absolute',
  },
  suggestion0: {
    left: 14,
    top: 8,
  },
  suggestion1: {
    right: 12,
    top: 8,
  },
  suggestion2: {
    bottom: 8,
    right: 12,
  },
  suggestionText: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.body,
    fontSize: 10,
    lineHeight: 16,
  },
  cards: {
    gap: 0,
  },
  homeCard: {
    alignSelf: 'center',
    borderRadius: 30,
    minHeight: 70,
    overflow: 'hidden',
    paddingBottom: 7,
    paddingHorizontal: 24,
    paddingTop: 8,
    width: '100%',
  },
  cardToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: mobileColors.primary,
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  cardCopy: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  cardTitle: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 16,
    lineHeight: 22,
  },
  cardDescription: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  cardChevron: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderColor: '#FFFFFF',
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    marginLeft: 10,
    transform: [{ rotate: '0deg' }],
    width: 38,
  },
  cardDetail: {
    marginTop: 14,
    minHeight: 76,
  },
  detailRail: {
    flexDirection: 'row',
    gap: 8,
    height: 28,
    position: 'relative',
  },
  detailDot: {
    borderColor: 'rgba(255,255,255,0.90)',
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    width: 28,
  },
  detailDotPrimary: {
    backgroundColor: mobileColors.primary,
  },
  detailDotBlue: {
    backgroundColor: mobileColors.blue,
  },
  detailDotPink: {
    backgroundColor: mobileColors.pink,
  },
  detailText: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  openButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: mobileColors.primary,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: mobileSpacing.controlMin,
    minWidth: 92,
    paddingHorizontal: 16,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 13,
    lineHeight: 18,
  },
  bottomNavWrap: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
});
