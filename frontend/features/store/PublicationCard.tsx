import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { mobileAssets } from '../../design/generated/mobileAssetManifest';
import { mobileColors, mobileRadii, mobileSpacing } from '../../theme/tokens';
import { mobileFontFamilies, mobileTypography } from '../../theme/typography';
import type { StoreCard } from './publicationViewModel';

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
          <Image source={neutralArtwork} style={styles.placeholderArt} />
          <Text style={styles.placeholderText}>暂无预览</Text>
        </View>
      )}
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
      <View testID={selected ? 'store-detail' : undefined}>
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text numberOfLines={1} style={styles.name}>
              {item.name}
            </Text>
            <Text numberOfLines={1} style={styles.creator}>
              {item.creator}
            </Text>
          </View>
          <Text style={styles.availability}>{item.availability}</Text>
        </View>
        <Text numberOfLines={3} style={styles.summary}>
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
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(167, 139, 250, 0.35)',
    borderRadius: 30,
    borderWidth: 1,
    height: 399,
    overflow: 'hidden',
    padding: 18,
    shadowColor: '#ADA6C4',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  selectedCard: {
    opacity: 1,
    transform: [{ scale: 1 }],
    zIndex: 2,
  },
  adjacentCard: {
    opacity: 0.74,
    transform: [{ scale: 0.94 }],
    zIndex: 1,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  headingCopy: {
    flex: 1,
  },
  name: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 17,
    lineHeight: 23,
  },
  creator: {
    ...mobileTypography.caption,
    color: mobileColors.muted,
  },
  availability: {
    backgroundColor: '#EFEBFB',
    borderRadius: mobileRadii.pill,
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 12,
    lineHeight: 18,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  summary: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.body,
    fontSize: 13,
    height: 57,
    lineHeight: 19,
    marginTop: 10,
  },
  preview: {
    backgroundColor: '#F5F8FF',
    borderRadius: 16,
    height: 184,
    marginTop: 10,
    overflow: 'hidden',
    width: '100%',
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
  placeholderText: {
    ...mobileTypography.caption,
    color: mobileColors.muted,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
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
