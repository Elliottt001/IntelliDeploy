import { Animated, Image, Pressable, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { mainHomeAssets } from './mainHomeAssets';
import { lightLayout, lightTokens } from './mainHomeTokens';
import type { FeatureCardData, MainHomeCardId } from './mainHomeTypes';

type MainHomeFeatureCardProps = {
  card: FeatureCardData;
  progress: Animated.Value;
  isExpanded: boolean;
  onPress: (id: MainHomeCardId) => void;
  onOpenGallery: () => void;
};

const cardSpeckles = [
  { left: 44, top: 12, size: 1.4, opacity: 0.35 },
  { left: 74, top: 42, size: 1, opacity: 0.28 },
  { left: 103, top: 21, size: 1.3, opacity: 0.3 },
  { left: 132, top: 52, size: 1, opacity: 0.24 },
  { left: 168, top: 15, size: 1.2, opacity: 0.32 },
  { left: 204, top: 37, size: 1, opacity: 0.26 },
  { left: 245, top: 18, size: 1.5, opacity: 0.31 },
  { left: 278, top: 48, size: 1.1, opacity: 0.25 },
];

export default function MainHomeFeatureCard({
  card,
  progress,
  isExpanded,
  onPress,
  onOpenGallery,
}: MainHomeFeatureCardProps) {
  const height = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [lightLayout.card.collapsedHeight, lightLayout.card.expandedHeight],
  });
  const top = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [card.collapsedTop, card.expandedTop],
  });
  const detailOpacity = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0, 1],
  });
  const arrowScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        card.id === 'products' && styles.productsCard,
        card.id === 'square' && styles.squareCard,
        card.id === 'profile' && styles.profileCard,
        {
          top,
          height,
          zIndex: isExpanded ? 10 : 1,
          elevation: isExpanded ? 8 : 3,
        },
      ]}
    >
      {card.id !== 'profile' ? <CardSpeckles /> : null}
      <Pressable style={[styles.hitArea, card.id === 'products' && styles.productsHitArea]} onPress={() => onPress(card.id)}>
        {card.id === 'products' ? <ProductsTopRow /> : renderLead(card.id)}

        {card.id !== 'products' ? (
          <View style={[styles.copy, card.id === 'profile' && styles.copyRight]}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{card.title}</Text>
              {card.id === 'gallery' ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>上新！</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.subtitle}>{card.subtitle}</Text>
          </View>
        ) : null}

        {card.id === 'square' ? <SquareMetrics /> : null}

        {card.id !== 'products' && card.id !== 'profile' ? (
          <Animated.View style={[styles.arrow, { transform: [{ scale: arrowScale }] }]}>
            <ArrowIcon direction={isExpanded ? 'down' : 'right'} />
          </Animated.View>
        ) : null}
      </Pressable>

      <Animated.View pointerEvents={isExpanded ? 'auto' : 'none'} style={[styles.detail, { opacity: detailOpacity }]}>
        {renderDetail(card.id, onOpenGallery)}
      </Animated.View>
    </Animated.View>
  );
}

function ProductsTopRow() {
  return (
    <View pointerEvents="none" style={styles.productsTopRow}>
      <View style={[styles.arrow, styles.productsLeadArrow]}>
        <ArrowIcon />
      </View>
      <ProductSpriteIcon containerStyle={styles.productSlackMask} imageStyle={styles.productSlackImage} />
      <ProductSpriteIcon containerStyle={styles.productCalendarMask} imageStyle={styles.productCalendarImage} />
      <ProductSpriteIcon containerStyle={styles.productVercelMask} imageStyle={styles.productVercelImage} />
      <Text style={styles.productsTitle}>我的产品</Text>
      <Text style={styles.productsSubtitle}>管理我的应用与工具</Text>
    </View>
  );
}

function ProductSpriteIcon({
  containerStyle,
  imageStyle,
}: {
  containerStyle: StyleProp<ViewStyle>;
  imageStyle: StyleProp<ImageStyle>;
}) {
  return (
    <View style={[styles.productSpriteMask, containerStyle]}>
      <Image source={mainHomeAssets.productsIcons} resizeMode="stretch" style={[styles.productSpriteImage, imageStyle]} />
    </View>
  );
}

function ArrowIcon({ direction = 'right' }: { direction?: 'right' | 'down' }) {
  return (
    <View style={[styles.arrowGlyph, direction === 'down' && styles.arrowGlyphDown]}>
      <View style={styles.arrowShaft} />
      <View style={[styles.arrowHead, styles.arrowHeadUpper]} />
      <View style={[styles.arrowHead, styles.arrowHeadLower]} />
    </View>
  );
}

function renderLead(id: MainHomeCardId) {
  if (id === 'profile') {
    return (
      <View style={styles.profileLead}>
        <View style={[styles.arrow, styles.profileLeadArrow]}>
          <ArrowIcon />
        </View>
        <View style={styles.profileProgress}>
          <Text style={styles.profileMeta}>个人资料完善程度</Text>
          <Text style={styles.profileScore}>80/100%</Text>
        </View>
      </View>
    );
  }

  return null;
}

function renderDetail(id: MainHomeCardId, onOpenGallery: () => void) {
  if (id === 'gallery') {
    return (
      <View style={styles.galleryDetail}>
        <GalleryPill icon="✣" label="Slack" />
        <GalleryPill icon="31" label="Calendar" />
        <GalleryPill icon="△" label="Deploy" />
        <GalleryPill icon="F" label="FairyGUI" />
        <Pressable style={styles.detailCta} onPress={onOpenGallery}>
          <Text style={styles.detailCtaText}>进入 App Gallery</Text>
        </Pressable>
      </View>
    );
  }

  if (id === 'products') {
    return (
      <View style={styles.productsDetail}>
        <View style={styles.productBox} />
        <View style={[styles.productShard, styles.productShardA]} />
        <View style={[styles.productShard, styles.productShardB]} />
        <View style={[styles.productShard, styles.productShardC]} />
        <Text style={styles.productText}>收藏进度：21/50 免费扩容</Text>
      </View>
    );
  }

  if (id === 'square') {
    return (
      <View style={styles.squareDetail}>
        <View style={styles.hotBadge}>
          <Text style={styles.hotBadgeText}>今日十大热贴🔥</Text>
        </View>
        <Text style={styles.hotPost}>TOP 1  [官方公告] IntelliDeploy v2.0 重磅更新，AI 助手...</Text>
        <Text style={styles.hotMeta}>456 评论 · 1.2k 赞 · 8.5w 浏览</Text>
        <View style={styles.hotLine} />
        <Text style={styles.hotPost}>TOP 2  [干货分享] 超好用的 VS Code 插件...</Text>
        <Text style={styles.hotMeta}>128 评论 · 856 赞 · 3.2w 浏览</Text>
      </View>
    );
  }

  return (
    <View style={styles.profileDetail}>
      <Image source={mainHomeAssets.featureCommunity} resizeMode="cover" style={styles.profileImage} />
      <View style={styles.profileFade} />
      <Text style={styles.profileDetailTitle}>Oasis 的工作台</Text>
      <Text style={styles.profileDetailMeta}>项目 12 · 应用 8 · 自动化 4</Text>
    </View>
  );
}

function GalleryPill({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.galleryPill}>
      <Text style={styles.galleryIcon}>{icon}</Text>
      <Text style={styles.galleryText}>{label}</Text>
    </View>
  );
}

function SquareMetrics() {
  return (
    <View style={styles.metrics}>
      <Metric icon="♡" />
      <Metric icon="☆" />
      <Metric icon="chat" />
    </View>
  );
}

function Metric({ icon }: { icon: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricDot} />
      {icon === 'chat' ? <ChatMetricIcon /> : <Text style={styles.metricIcon}>{icon}</Text>}
      <Text style={styles.metricText}>99+</Text>
    </View>
  );
}

function ChatMetricIcon() {
  return (
    <View style={styles.chatMetricIcon}>
      <View style={styles.chatMetricDot} />
      <View style={styles.chatMetricDot} />
      <View style={styles.chatMetricDot} />
    </View>
  );
}

function CardSpeckles() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {cardSpeckles.map((dot) => (
        <View
          key={`${dot.left}-${dot.top}`}
          style={[
            styles.cardSpeckle,
            {
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              borderRadius: dot.size / 2,
              opacity: dot.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: lightLayout.card.left,
    width: lightLayout.card.width,
    borderRadius: lightTokens.radii.card,
    borderWidth: 1,
    borderColor: lightTokens.colors.white,
    backgroundColor: lightTokens.colors.lavenderCard,
    overflow: 'hidden',
    ...lightTokens.shadow.soft,
  },
  productsCard: {
    backgroundColor: 'rgba(236,227,252,0.82)',
  },
  squareCard: {
    backgroundColor: lightTokens.colors.blueCard,
  },
  profileCard: {
    backgroundColor: lightTokens.colors.profileCard,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  hitArea: {
    position: 'relative',
    height: lightLayout.card.collapsedHeight,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 31,
    paddingRight: 20,
  },
  copy: {
    minWidth: 92,
  },
  copyRight: {
    marginLeft: 'auto',
    marginRight: 10,
  },
  productsHitArea: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  productsTopRow: {
    ...StyleSheet.absoluteFillObject,
  },
  productsLeadArrow: {
    position: 'absolute',
    left: 25,
    top: 20,
    marginLeft: 0,
  },
  productSpriteMask: {
    position: 'absolute',
    overflow: 'hidden',
  },
  productSpriteImage: {
    position: 'absolute',
  },
  productSlackMask: {
    left: 66,
    top: 13.55,
    width: 64.16,
    height: 50.65,
  },
  productSlackImage: {
    left: 0,
    top: -75.47,
    width: 413.3,
    height: 275.5,
  },
  productCalendarMask: {
    left: 123.88,
    top: 10,
    width: 45.76,
    height: 51.65,
  },
  productCalendarImage: {
    left: -120.29,
    top: -197.45,
    width: 400,
    height: 266.68,
  },
  productVercelMask: {
    left: 169.53,
    top: 10.85,
    width: 43.47,
    height: 44.72,
  },
  productVercelImage: {
    left: -174,
    top: -197.45,
    width: 400,
    height: 266.68,
  },
  productsTitle: {
    position: 'absolute',
    left: 229,
    top: 12,
    width: 64,
    color: lightTokens.colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 32,
    textAlign: 'center',
  },
  productsSubtitle: {
    position: 'absolute',
    left: 221,
    top: 34,
    width: 72,
    color: lightTokens.colors.textMuted,
    fontSize: 8,
    lineHeight: 32,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    color: lightTokens.colors.text,
    fontSize: lightTokens.typography.cardTitle,
    fontWeight: '600',
    lineHeight: 24,
  },
  subtitle: {
    color: lightTokens.colors.textMuted,
    fontSize: lightTokens.typography.cardMeta,
    marginTop: 1,
  },
  badge: {
    width: 36,
    height: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightTokens.colors.primary,
  },
  badgeText: {
    color: lightTokens.colors.white,
    fontSize: 7,
    fontWeight: '700',
  },
  arrow: {
    marginLeft: 'auto',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: lightTokens.colors.white,
    backgroundColor: 'rgba(255,255,255,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: {
    width: 18,
    height: 18,
  },
  arrowGlyphDown: {
    transform: [{ rotate: '90deg' }],
  },
  arrowShaft: {
    position: 'absolute',
    left: 2,
    top: 8,
    width: 13,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#6B7280',
  },
  arrowHead: {
    position: 'absolute',
    right: 1,
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#6B7280',
  },
  arrowHeadUpper: {
    top: 5.5,
    transform: [{ rotate: '45deg' }],
  },
  arrowHeadLower: {
    top: 10.5,
    transform: [{ rotate: '-45deg' }],
  },
  detail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 70,
    bottom: 0,
  },
  profileProgress: {
    width: 112,
  },
  profileLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileLeadArrow: {
    marginLeft: 0,
  },
  profileMeta: {
    color: lightTokens.colors.textMuted,
    fontSize: 8,
    lineHeight: 16,
  },
  profileScore: {
    color: lightTokens.colors.primary,
    fontSize: 11,
    lineHeight: 17,
  },
  metrics: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 2,
  },
  metric: {
    width: 33,
    height: 40,
    borderRadius: 10,
    backgroundColor: lightTokens.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDot: {
    position: 'absolute',
    top: 3,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: lightTokens.colors.redDot,
  },
  metricIcon: {
    color: lightTokens.colors.text,
    fontSize: 16,
    lineHeight: 18,
  },
  chatMetricIcon: {
    width: 17,
    height: 14,
    borderRadius: 5,
    borderWidth: 1.6,
    borderColor: lightTokens.colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 2,
  },
  chatMetricDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: lightTokens.colors.text,
  },
  metricText: {
    color: lightTokens.colors.textMuted,
    fontSize: 6,
  },
  cardSpeckle: {
    position: 'absolute',
    backgroundColor: lightTokens.colors.white,
  },
  galleryDetail: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    paddingLeft: 18,
    paddingTop: 3,
  },
  galleryPill: {
    width: 122,
    height: 30,
    borderRadius: 16,
    backgroundColor: lightTokens.colors.white,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  galleryIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F5F2FF',
    color: lightTokens.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
    marginRight: 8,
  },
  galleryText: {
    color: lightTokens.colors.textSoft,
    fontSize: 10,
    fontWeight: '600',
  },
  detailCta: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: lightTokens.colors.primary,
    zIndex: 2,
    elevation: 9,
  },
  detailCtaText: {
    color: lightTokens.colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  productsDetail: {
    position: 'absolute',
    left: 45,
    top: 4,
    width: 235,
    height: 112,
  },
  productBox: {
    position: 'absolute',
    left: 18,
    top: 26,
    width: 129,
    height: 72,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: lightTokens.colors.white,
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  productShard: {
    position: 'absolute',
    borderRadius: 7,
    backgroundColor: 'rgba(124,98,255,0.35)',
  },
  productShardA: {
    left: 0,
    top: 17,
    width: 58,
    height: 76,
    transform: [{ rotate: '-12deg' }],
  },
  productShardB: {
    left: 85,
    top: 6,
    width: 22,
    height: 78,
    transform: [{ rotate: '8deg' }],
  },
  productShardC: {
    left: 127,
    top: 20,
    width: 49,
    height: 70,
    transform: [{ rotate: '-8deg' }],
  },
  productText: {
    position: 'absolute',
    right: 0,
    top: 58,
    width: 82,
    color: lightTokens.colors.textMuted,
    fontSize: 8,
    lineHeight: 14,
  },
  squareDetail: {
    position: 'absolute',
    left: 31,
    top: 8,
    width: 270,
    height: 108,
    borderRadius: 10,
    backgroundColor: lightTokens.colors.white,
    paddingTop: 9,
    paddingHorizontal: 18,
  },
  hotBadge: {
    alignSelf: 'center',
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: lightTokens.colors.primary,
    paddingHorizontal: 20,
    justifyContent: 'center',
    marginBottom: 8,
  },
  hotBadgeText: {
    color: lightTokens.colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  hotPost: {
    color: lightTokens.colors.text,
    fontSize: 8,
    lineHeight: 15,
  },
  hotMeta: {
    color: lightTokens.colors.textMuted,
    fontSize: 6,
    lineHeight: 12,
  },
  hotLine: {
    height: 1,
    backgroundColor: '#ECEAF8',
    marginVertical: 5,
  },
  profileDetail: {
    position: 'absolute',
    left: 3,
    top: 2,
    width: 315,
    height: 118,
    borderRadius: 30,
    overflow: 'hidden',
  },
  profileImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  profileFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  profileDetailTitle: {
    position: 'absolute',
    right: 24,
    bottom: 38,
    color: lightTokens.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  profileDetailMeta: {
    position: 'absolute',
    right: 24,
    bottom: 20,
    color: lightTokens.colors.textMuted,
    fontSize: 8,
  },
});
