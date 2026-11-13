import { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { mobileAssets } from '../../design/generated/mobileAssetManifest';
import { mobileColors, mobileRadii, mobileSpacing } from '../../theme/tokens';
import { mobileFontFamilies, mobileTypography } from '../../theme/typography';
import type { StoreCard } from './publicationViewModel';
import {storeCardRenderEvidence as source} from '../../design/storeCardRenderEvidence';

type PublicationCardProps = {
  favorite: boolean;
  favoriteBusy: boolean;
  item: StoreCard;
  onFavorite: (id: string, enabled: boolean) => void;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  selected: boolean;
  width: number;
};

type RearLayerEvidence =
  | typeof source.rearLayers.backFive
  | typeof source.rearLayers.backTen;

type RearPublicationCardProps = {
  item: StoreCard;
  layer: RearLayerEvidence;
  layerKey: '5' | '10';
  width: number;
};

const rotation = (matrix: { m00: number; m10: number }) =>
  `${Math.atan2(matrix.m10, matrix.m00)}rad`;
const rgba = (hex: string, alpha: number) => {
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
};

// Static design content is intentionally separate from item.previewUrl and all API facts.
const staticDesignIllustration = require('../../assets/mobile/static-design/pawzzle-phone-illustration.png') as ImageSourcePropType;

const neutralArtwork = mobileAssets['845:3522:114']
  .source as ImageSourcePropType;

function PreviewArtwork({ item }: { item: StoreCard }) {
  const [failed, setFailed] = useState(!item.previewUrl);

  useEffect(() => setFailed(!item.previewUrl), [item.previewUrl]);

  return (
    <View
      style={styles.preview}
      testID={`store-preview-frame-${item.id}`}
    >
      {!failed && item.previewUrl ? (
        <Image
          accessibilityLabel={`${item.name}预览`}
          onError={() => setFailed(true)}
          resizeMode="cover"
          source={{ uri: item.previewUrl }}
          style={styles.previewImage}
        />
      ) : (
        <View
          accessibilityLabel={`${item.name}暂无预览`}
          style={styles.placeholder}
          testID={`store-preview-placeholder-${item.id}`}
        >
          {!item.previewUrl ? <>
            <Image accessibilityLabel="示意图，不代表当前应用预览" source={staticDesignIllustration} resizeMode="contain" style={styles.previewImage} testID={`store-static-design-illustration-${item.id}`} />
            <Text style={styles.designCaption}>示意图 · 暂无应用预览</Text>
          </> : <>
            <Image source={neutralArtwork} style={styles.placeholderArt} />
            <Text style={styles.placeholderText}>预览加载失败</Text>
          </>}
        </View>
      )}
    </View>
  );
}

function RearPreview({
  item,
  layerKey,
}: {
  item: StoreCard;
  layerKey: RearPublicationCardProps['layerKey'];
}) {
  const [failed, setFailed] = useState(!item.previewUrl);
  useEffect(() => setFailed(!item.previewUrl), [item.previewUrl]);
  return !failed && item.previewUrl ? (
    <Image
      accessibilityLabel={`${item.name}相邻卡片预览`}
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: item.previewUrl }}
      style={styles.previewImage}
      testID={`store-carousel-back-${layerKey}-preview`}
    />
  ) : (
    <View style={styles.rearPreviewPlaceholder} testID={`store-carousel-back-${layerKey}-preview-missing`}>
      <Text style={styles.rearPreviewPlaceholderText}>
        {item.previewUrl ? '预览加载失败' : '暂无应用预览'}
      </Text>
    </View>
  );
}

export function RearPublicationCard({
  item,
  layer,
  layerKey,
  width,
}: RearPublicationCardProps) {
  const scale = width / layer.surface.size.x;
  const slot = (matrix: { m02: number; m12: number }) => ({
    left: matrix.m02 * scale,
    top: matrix.m12,
  });
  const content = layer.content;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.rearInitial,
          slot(content.icon.matrix),
          {
            height: content.icon.size.y,
            transform: [{ rotate: rotation(content.icon.matrix) }],
            width: content.icon.size.x,
          },
        ]}
        testID={`store-carousel-back-${layerKey}-icon`}
      >
        <View
          style={[
            styles.rearIconSurface,
            {
              backgroundColor: rgba(
                content.icon.surface.fill.color!.hex,
                content.icon.surface.fill.opacity * content.icon.surface.fill.color!.alpha,
              ),
              borderRadius: content.icon.surface.cornerRadius,
              height: content.icon.surface.size.y,
              left: content.icon.surface.matrix.m02,
              top: content.icon.surface.matrix.m12,
              width: content.icon.surface.size.x,
              ...(Platform.OS === 'web'
                ? {
                    boxShadow: content.icon.surface.effects
                      .filter((effect) => effect.rawType === 'DROP_SHADOW')
                      .map((effect) => `${effect.offset?.x ?? 0}px ${effect.offset?.y ?? 0}px ${effect.radius ?? 0}px ${effect.spread ?? 0}px ${rgba(effect.color!.hex, effect.color!.alpha)}`)
                      .join(', '),
                  }
                : {}),
            },
          ]}
        >
          <Text style={styles.rearInitialText}>{Array.from(item.name.trim())[0] ?? '·'}</Text>
        </View>
      </View>
      <View
        style={[
          styles.rearHeading,
          slot(content.title.matrix),
          {
            transform: [{ rotate: rotation(content.title.matrix) }],
            width: Math.max(72, width - content.title.matrix.m02 * scale - 14),
          },
        ]}
      >
        <Text
          style={[
            styles.rearName,
            {
              color: content.title.text.textColor,
              fontSize: content.title.text.fontSize,
              lineHeight: content.title.text.lineHeight,
            },
          ]}
          testID={`store-carousel-back-${layerKey}-name`}
        >
          {item.name}
        </Text>
        <Text
          style={[
            styles.rearMetadata,
            {
              color: content.metadata.textColor,
              fontSize: content.metadata.fontSize,
              lineHeight: content.metadata.lineHeight,
            },
          ]}
        >
          {item.creator} · {item.availability}
        </Text>
      </View>
      <View
        style={[
          styles.rearDivider,
          slot(content.divider.matrix),
          {
            backgroundColor: content.divider.strokes[0].color?.hex,
            opacity: (content.divider.strokes[0].opacity ?? 1) *
              (content.divider.strokes[0].color?.alpha ?? 1),
            transform: [{ rotate: rotation(content.divider.matrix) }],
            width: content.divider.size.x * scale,
          },
        ]}
      />
      <Text
        style={[
          styles.rearSummary,
          slot(content.summary.matrix),
          {
            color: content.summary.text.textColor,
            fontSize: content.summary.text.fontSize,
            lineHeight: content.summary.text.lineHeight,
            transform: [{ rotate: rotation(content.summary.matrix) }],
            width: content.summary.size.x * scale,
          },
        ]}
        testID={`store-carousel-back-${layerKey}-summary`}
      >
        {item.summary}
      </Text>
      <View
        style={[
          styles.rearPager,
          slot(content.pager.matrix),
          {
            transform: [{ rotate: rotation(content.pager.matrix) }],
            width: content.pager.size.x * scale,
          },
        ]}
      >
        {content.pager.dots.map((dot) => (
          <View
            key={dot.sourceNodeId}
            style={{
              backgroundColor: dot.fill.color?.hex ?? 'transparent',
              borderRadius: dot.size.x / 2,
              height: dot.size.y,
              left: dot.transform.m02 * scale,
              opacity: (dot.fill.opacity ?? 1) * (dot.fill.color?.alpha ?? 1),
              position: 'absolute',
              top: dot.transform.m12,
              width: dot.size.x,
            }}
            testID={`store-carousel-back-${layerKey}-pager-dot`}
          />
        ))}
      </View>
      <View
        style={[
          styles.rearPreview,
          slot(content.preview.matrix),
          {
            height: content.preview.size.y,
            transform: [{ rotate: rotation(content.preview.matrix) }],
            width: content.preview.size.x * scale,
          },
        ]}
      >
        <RearPreview item={item} layerKey={layerKey} />
      </View>
    </View>
  );
}

export function PublicationCard({
  favorite,
  favoriteBusy,
  item,
  onFavorite,
  onOpen,
  onSelect,
  selected,
  width,
}: PublicationCardProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      aria-selected={selected}
      onPress={() => onSelect(item.id)}
      style={[
        styles.card,
        { width },
        selected ? styles.selectedCard : styles.adjacentCard,
      ]}
      testID={`store-carousel-card-${item.id}`}
    >
      <View testID={selected ? 'store-detail' : undefined} style={{height:source.size.y,position:'relative'}}>
        <View pointerEvents="none" accessibilityLabel={`${item.name}暂无应用图标`} style={styles.initial}><Text style={styles.initialText}>{Array.from(item.name.trim())[0]??'·'}</Text></View>
        <View
          style={[
            styles.heading,
            { width: Math.max(80, width - source.title.position.m02 - 18) },
          ]}
        >
          <View style={styles.headingCopy}>
            <ScrollView
              accessibilityLabel={`${item.name}完整应用名称`}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.nameViewport}
              testID={`store-card-name-scroll-${item.id}`}
            >
              <Text style={styles.name} testID={`store-card-name-${item.id}`}>
                {item.name}
              </Text>
            </ScrollView>
            <Text numberOfLines={1} style={styles.creator}>
              {item.creator}
            </Text>
          </View>
          <Text style={styles.availability}>{item.availability}</Text>
        </View>
        <Text numberOfLines={4} style={styles.summary}>
          {item.summary}
        </Text>
        <PreviewArtwork item={item} />
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={favoriteBusy}
            onPress={() => onFavorite(item.id, !favorite)}
            style={[styles.secondaryAction, favoriteBusy && styles.disabled]}
            testID={`store-favorite-${item.id}`}
          >
            <Text style={styles.secondaryLabel}>
              {favorite ? '已收藏' : '收藏'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpen(item.id)}
            style={styles.primaryAction}
            testID={`store-open-${item.id}`}
          >
            <Text style={styles.primaryLabel}>查看详情</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FCFCFC',
    borderRadius: 30,
    borderWidth: 0,
    height: 399,
    padding: 0,
    shadowColor: '#897AB9',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  selectedCard: {
    opacity: 1,
    transform: [{ scale: 1 }],
    zIndex: 2,
  },
  adjacentCard: {
    opacity: 1,
    zIndex: 1,
  },
  heading: {
    position:'absolute',
    left:source.title.position.m02,
    top:source.title.position.m12,
    alignItems:'flex-start',
  },
  headingCopy: {
    width:'100%',
  },
  name: {
    color: source.title.textColor,
    fontFamily: mobileFontFamilies.pingFang,
    fontWeight:'500',
    fontSize: source.title.fontSize,
    lineHeight: source.title.lineHeight,
  },
  nameViewport: {
    maxWidth: '100%',
  },
  creator: {
    fontFamily:mobileFontFamilies.pingFang,
    fontSize:source.secondaryText.fontSize,
    lineHeight:source.secondaryText.lineHeight,
    color:source.secondaryText.textColor,
    marginTop:2,
  },
  availability: {
    backgroundColor: '#EFEBFB',
    borderRadius: mobileRadii.pill,
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 8,
    lineHeight: 16,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 0,
    marginTop:3,
  },
  summary: {
    position:'absolute',
    left:source.summary.position.m02,
    top:source.summary.position.m12,
    width:source.summary.size.x,
    color:source.summary.textColor,
    fontFamily:mobileFontFamilies.pingFang,
    fontWeight:'300',
    fontSize:source.summary.fontSize,
    height:source.summary.size.y,
    lineHeight:source.summary.lineHeight,
  },
  preview: {
    position:'absolute',
    left:source.preview.position.m02,
    top:source.preview.position.m12,
    backgroundColor:source.backgroundColor,
    borderRadius:0,
    height:source.preview.size.y,
    overflow: 'hidden',
    width:source.preview.size.x,
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  placeholder: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  placeholderArt: {
    height: 76,
    opacity: 0.72,
    resizeMode: 'contain',
    width: 76,
  },
  designCaption: {
    position:'absolute', bottom:0, left:0, right:0, textAlign:'center',
    backgroundColor:'rgba(255,255,255,0.94)', color:mobileColors.muted,
    fontFamily:mobileFontFamilies.body, fontSize:10, lineHeight:18,
  },
  placeholderText: {
    ...mobileTypography.caption,
    color: mobileColors.muted,
    marginTop: 4,
  },
  rearDivider: {
    backgroundColor: '#E4E4E7',
    height: 1,
    position: 'absolute',
  },
  rearHeading: {
    position: 'absolute',
  },
  rearInitial: {
    position: 'absolute',
  },
  rearIconSurface: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  rearInitialText: {
    color: '#6B7280',
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 20,
  },
  rearMetadata: {
    fontFamily: mobileFontFamilies.pingFang,
  },
  rearName: {
    fontFamily: mobileFontFamilies.pingFang,
    fontWeight: '500',
  },
  rearPager: {
    height: 5,
    position: 'absolute',
  },
  rearPreview: {
    backgroundColor: '#FCFCFC',
    overflow: 'hidden',
    position: 'absolute',
  },
  rearPreviewPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#F4F2FA',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  rearPreviewPlaceholderText: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 10,
  },
  rearSummary: {
    fontFamily: mobileFontFamilies.pingFang,
    fontWeight: '300',
    height: 60,
    position: 'absolute',
  },
  actions: {
    position:'absolute',left:18,right:18,top:355,
    flexDirection: 'row',
    gap: 10,
  },
  initial:{position:'absolute',left:source.initial.x,top:source.initial.y,width:source.initial.size.x,height:source.initial.size.y,borderRadius:source.initial.cornerRadius,backgroundColor:source.initial.backgroundColor,justifyContent:'center',alignItems:'center'},
  initialText:{fontFamily:mobileFontFamilies.pingFang,fontSize:24,color:'#6B7280'},
  secondaryAction: {
    alignItems: 'center',
    borderColor: mobileColors.primary,
    borderRadius: mobileRadii.action,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: mobileSpacing.controlMin,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: mobileColors.primary,
    borderRadius: mobileRadii.action,
    flex: 1.4,
    justifyContent: 'center',
    minHeight: mobileSpacing.controlMin,
  },
  secondaryLabel: {
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 14,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});
