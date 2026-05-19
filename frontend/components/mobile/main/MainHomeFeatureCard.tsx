import { Animated, Image, Pressable, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { mainHomeAssets } from './mainHomeAssets';
import { lightLayout, lightTokens } from './mainHomeTokens';
import type { FeatureCardData, MainHomeCardId, MainHomeGalleryAppId, MainHomeRouteId } from './mainHomeTypes';

type MainHomeFeatureCardProps = {
  card: FeatureCardData;
  progress: Animated.Value;
  isExpanded: boolean;
  onPress: (id: MainHomeCardId) => void;
  onOpenGalleryApp?: (id: MainHomeGalleryAppId) => void;
  onOpenRoute?: (id: MainHomeRouteId) => void;
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

const galleryAppHotspots: Array<{
  id: MainHomeGalleryAppId;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
}> = [
  { id: 'fastgpt', label: 'FastGPT', left: 110, top: 44, width: 92, height: 36 },
  { id: 'keystats', label: 'KeyStats', left: 26, top: 88, width: 108, height: 45 },
  { id: 'pawzzle', label: 'Pawzzle 寻爪', left: 174, top: 78, width: 117, height: 48 },
  { id: 'stolen-buttons', label: 'STOLEN BUTTONS', left: 54, top: 140, width: 128, height: 44 },
  { id: 'fairyc', label: 'Fairyc', left: 180, top: 136, width: 110, height: 44 },
];

export default function MainHomeFeatureCard({
  card,
  progress,
  isExpanded,
  onPress,
  onOpenGalleryApp,
  onOpenRoute,
}: MainHomeFeatureCardProps) {
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
  const detailTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
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
          height: lightLayout.card.expandedHeight,
          zIndex: isExpanded ? 20 : card.stackOrder,
          elevation: isExpanded ? 9 : card.stackOrder + 2,
        },
      ]}
    >
      {card.id !== 'profile' ? <CardSpeckles /> : null}
      <Pressable
        style={({ pressed }) => [
          styles.hitArea,
          card.id === 'gallery' && styles.galleryHitArea,
          card.id === 'products' && styles.productsHitArea,
          card.id === 'profile' && styles.profileHitArea,
          pressed && styles.hitAreaPressed,
        ]}
        onPress={() => {
          if (isExpanded && card.id !== 'profile' && onOpenRoute) {
            onOpenRoute(card.id);
            return;
          }
          onPress(card.id);
        }}
      >
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
            <ArrowIcon />
          </Animated.View>
        ) : null}
      </Pressable>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.detail,
          card.id === 'gallery' && styles.galleryDetailLayer,
          card.id === 'profile' && styles.profileDetailLayer,
          { opacity: detailOpacity, transform: [{ translateY: detailTranslateY }] },
        ]}
      >
        {renderDetail(card.id)}
      </Animated.View>

      {card.id === 'gallery' && isExpanded && onOpenGalleryApp ? (
        <Animated.View pointerEvents="box-none" style={[styles.galleryHotspots, { opacity: detailOpacity }]}>
          {galleryAppHotspots.map((hotspot) => (
            <Pressable
              key={hotspot.id}
              accessibilityRole="button"
              accessibilityLabel={`打开 ${hotspot.label}`}
              hitSlop={4}
              style={({ pressed }) => [
                styles.galleryHotspot,
                {
                  left: hotspot.left,
                  top: hotspot.top,
                  width: hotspot.width,
                  height: hotspot.height,
                },
                pressed && styles.galleryHotspotPressed,
              ]}
              onPress={() => onOpenGalleryApp(hotspot.id)}
            />
          ))}
        </Animated.View>
      ) : null}
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

function renderDetail(id: MainHomeCardId) {
  if (id === 'gallery') {
    return (
      <View style={styles.galleryDetail}>
        <Image source={mainHomeAssets.featureAppstore} resizeMode="stretch" style={styles.galleryImage} />
      </View>
    );
  }

  if (id === 'products') {
    return (
      <View style={styles.productsDetail}>
        <View style={[styles.productRay, styles.productRayBlueA]} />
        <View style={[styles.productRay, styles.productRayBlueB]} />
        <View style={[styles.productRay, styles.productRayPinkA]} />
        <View style={[styles.productRay, styles.productRayPinkB]} />
        <View style={[styles.productRay, styles.productRayYellow]} />
        <View style={[styles.productRay, styles.productRayPurple]} />
        <View style={styles.productBoxShadow} />
        <View style={styles.productHalo} />
        <View style={[styles.productFlap, styles.productFlapLeft]} />
        <View style={[styles.productFlap, styles.productFlapRight]} />
        <View style={[styles.productFlap, styles.productFlapBack]} />
        <View style={styles.productBox}>
          <View style={styles.productBoxLeft} />
          <View style={styles.productBoxRight} />
          <View style={styles.productBoxRibbon} />
        </View>
        <ProductSpriteIcon containerStyle={[styles.productFloatingIcon, styles.productBadgeDrive]} imageStyle={styles.productDriveImage} />
        <ProductSpriteIcon containerStyle={[styles.productFloatingIcon, styles.productBadgeDesign]} imageStyle={styles.productDesignImage} />
        <ProductSpriteIcon containerStyle={[styles.productFloatingIcon, styles.productBadgeNotion]} imageStyle={styles.productNotionImage} />
        <ProductSpriteIcon containerStyle={[styles.productFloatingIcon, styles.productBadgeTeams]} imageStyle={styles.productTeamsImage} />
        <ProductSpriteIcon containerStyle={[styles.productFloatingIcon, styles.productBadgeJira]} imageStyle={styles.productJiraImage} />
        <View style={styles.productSparkle}>
          <Text style={styles.productSparkleText}>+</Text>
        </View>
        <Text style={styles.productText}>收藏进度：21/50</Text>
        <Text style={styles.productLink}>免费扩容</Text>
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
      <View style={styles.profileImageClip}>
        <Image source={mainHomeAssets.featureCommunity} resizeMode="stretch" style={styles.profileImage} />
        <View style={styles.profileImageLeftWash} />
        <View style={styles.profileImageWash} />
      </View>
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
    backgroundColor: lightTokens.colors.cardLavender,
    overflow: 'hidden',
    ...lightTokens.shadow.soft,
  },
  productsCard: {
    backgroundColor: lightTokens.colors.cardProducts,
  },
  squareCard: {
    backgroundColor: lightTokens.colors.cardBlue,
  },
  profileCard: {
    backgroundColor: lightTokens.colors.white,
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
  hitAreaPressed: {
    transform: [{ scale: 0.985 }],
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
  galleryHitArea: {
    zIndex: 2,
    elevation: 2,
  },
  profileHitArea: {
    zIndex: 2,
    elevation: 2,
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
    zIndex: 1,
  },
  galleryDetailLayer: {
    top: 0,
  },
  profileDetailLayer: {
    top: 0,
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
    top: 0,
    width: lightLayout.card.width,
    height: lightLayout.card.expandedHeight,
    borderRadius: lightTokens.radii.card,
    overflow: 'hidden',
  },
  galleryImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: lightLayout.card.width,
    height: 302,
  },
  galleryHotspots: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: lightLayout.card.width,
    height: lightLayout.card.expandedHeight,
    zIndex: 4,
    elevation: 10,
  },
  galleryHotspot: {
    position: 'absolute',
    borderRadius: lightTokens.radii.chip,
  },
  galleryHotspotPressed: {
    backgroundColor: 'rgba(124,98,255,0.08)',
  },
  productsDetail: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 321,
    height: 125,
  },
  productRay: {
    position: 'absolute',
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  productRayBlueA: {
    left: 127,
    top: 42,
    height: 22,
    backgroundColor: '#5B7CFF',
    transform: [{ rotate: '-34deg' }],
  },
  productRayBlueB: {
    left: 205,
    top: 43,
    height: 20,
    backgroundColor: '#6B8BFF',
    transform: [{ rotate: '34deg' }],
  },
  productRayPinkA: {
    left: 119,
    top: 60,
    height: 10,
    backgroundColor: '#FF5CAB',
    transform: [{ rotate: '68deg' }],
  },
  productRayPinkB: {
    left: 218,
    top: 63,
    height: 10,
    backgroundColor: '#FF6BB3',
    transform: [{ rotate: '-68deg' }],
  },
  productRayYellow: {
    left: 111,
    top: 72,
    height: 12,
    backgroundColor: '#F8C24E',
    transform: [{ rotate: '-24deg' }],
  },
  productRayPurple: {
    left: 221,
    top: 81,
    height: 13,
    backgroundColor: '#7C62FF',
    transform: [{ rotate: '50deg' }],
  },
  productBoxShadow: {
    position: 'absolute',
    left: 117,
    top: 104,
    width: 96,
    height: 18,
    borderRadius: 54,
    backgroundColor: 'rgba(108,77,198,0.18)',
  },
  productHalo: {
    position: 'absolute',
    left: 110,
    top: 53,
    width: 108,
    height: 55,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  productFlap: {
    position: 'absolute',
    width: 66,
    height: 35,
    borderRadius: 10,
    backgroundColor: '#F7F1FF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  productFlapLeft: {
    left: 101,
    top: 63,
    transform: [{ rotate: '21deg' }],
  },
  productFlapRight: {
    left: 164,
    top: 63,
    transform: [{ rotate: '-21deg' }],
  },
  productFlapBack: {
    left: 132,
    top: 53,
    width: 66,
    height: 31,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '1deg' }],
  },
  productBox: {
    position: 'absolute',
    left: 125,
    top: 82,
    width: 78,
    height: 43,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: '#8F65FF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  productBoxLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 39,
    backgroundColor: '#A985FF',
  },
  productBoxRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 39,
    backgroundColor: '#7C62FF',
  },
  productBoxRibbon: {
    position: 'absolute',
    left: 34,
    top: -2,
    bottom: -2,
    width: 10,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  productFloatingIcon: {
    width: 23,
    height: 23,
    borderRadius: 7,
    backgroundColor: lightTokens.colors.white,
    ...lightTokens.shadow.soft,
  },
  productBadgeDrive: {
    left: 119,
    top: 44,
    transform: [{ rotate: '-17deg' }],
  },
  productBadgeDesign: {
    left: 187,
    top: 46,
    transform: [{ rotate: '13deg' }],
  },
  productBadgeNotion: {
    left: 157,
    top: 67,
    width: 19,
    height: 19,
    borderRadius: 6,
    transform: [{ rotate: '-12deg' }],
  },
  productBadgeTeams: {
    left: 209,
    top: 63,
    transform: [{ rotate: '8deg' }],
  },
  productBadgeJira: {
    left: 178,
    top: 78,
    width: 18,
    height: 18,
    borderRadius: 6,
    transform: [{ rotate: '15deg' }],
  },
  productDriveImage: {
    left: -8,
    top: -119,
    width: 230,
    height: 153,
  },
  productDesignImage: {
    left: -170,
    top: -119,
    width: 230,
    height: 153,
  },
  productNotionImage: {
    left: -6,
    top: -6,
    width: 230,
    height: 153,
  },
  productTeamsImage: {
    left: -203,
    top: -83,
    width: 230,
    height: 153,
  },
  productJiraImage: {
    left: -72,
    top: -45,
    width: 230,
    height: 153,
  },
  productSparkle: {
    position: 'absolute',
    left: 151,
    top: 105,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B592FF',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  productSparkleText: {
    color: lightTokens.colors.white,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '600',
  },
  productText: {
    position: 'absolute',
    right: 29,
    top: 56,
    width: 74,
    color: lightTokens.colors.textMuted,
    fontSize: 7,
    lineHeight: 12,
    textAlign: 'right',
  },
  productLink: {
    position: 'absolute',
    right: 29,
    top: 75,
    width: 74,
    color: lightTokens.colors.primaryGradient,
    fontSize: 7,
    lineHeight: 12,
    textAlign: 'right',
    textDecorationLine: 'underline',
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
    left: 0,
    top: 0,
    width: lightLayout.card.width,
    height: lightLayout.card.expandedHeight,
    borderRadius: 30,
    overflow: 'hidden',
  },
  profileImageClip: {
    position: 'absolute',
    left: 3,
    top: 70,
    width: 315,
    height: 123,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  profileImage: {
    position: 'absolute',
    left: -185,
    top: -202,
    width: 591,
    height: 659,
  },
  profileImageWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  profileImageLeftWash: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 95,
    backgroundColor: lightTokens.colors.white,
  },
});
