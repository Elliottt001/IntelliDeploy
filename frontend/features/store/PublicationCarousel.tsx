import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { PublicationCard, RearPublicationCard } from './PublicationCard';
import { storeCardRenderEvidence as source } from '../../design/storeCardRenderEvidence';
import { fitSourceWidth } from '../../theme/responsive';
import type { StoreCard } from './publicationViewModel';

type PublicationCarouselProps = {
  favoriteBusyId: string | null;
  favoriteIds: ReadonlySet<string>;
  items: StoreCard[];
  onFavorite: (id: string, enabled: boolean) => void;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  availableWidth: number;
};

const rotation = (matrix: { m00: number; m10: number }) =>
  `${Math.atan2(matrix.m10, matrix.m00)}rad`;

export function PublicationCarousel({
  favoriteBusyId,
  favoriteIds,
  items,
  onFavorite,
  onOpen,
  onSelect,
  selectedId,
  availableWidth,
}: PublicationCarouselProps) {
  const viewportWidth = Math.max(0, availableWidth);
  const cardWidth = fitSourceWidth(
    source.size.x,
    source.size.x,
    viewportWidth,
    'fixed',
  );
  const horizontalScale = cardWidth / source.size.x;
  const sourceGap = source.carousel.sourceGap * horizontalScale;
  const interval = cardWidth + sourceGap;
  const list = useRef<FlatList<StoreCard>>(null);
  const userScrolling=useRef(false);
  const [laidOutWidth, setLaidOutWidth] = useState(0);
  const selectedIndex = useMemo(
    () => Math.max(0, items.findIndex((item) => item.id === selectedId)),
    [items, selectedId],
  );
  const rearFive = items[selectedIndex + 1] ?? null;
  const rearTen = items[selectedIndex + 2] ?? null;
  useEffect(() => {
    if (!items.length || Math.abs(laidOutWidth - viewportWidth) > 0.5) return;
    userScrolling.current = false;
    if (selectedIndex === 0) {
      list.current?.scrollToOffset({ animated: false, offset: 0 });
    } else {
      list.current?.scrollToIndex({
        index: selectedIndex,
        animated: false,
        viewPosition: 0.5,
      });
    }
  }, [laidOutWidth, selectedIndex, items.length, viewportWidth]);

  const selectAtOffset = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.max(
      0,
      Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / interval)),
    );
    const item = items[index];
    if (item && item.id !== selectedId) onSelect(item.id);
  };

  return (
    <View style={[styles.viewport, { width: viewportWidth }]} onTouchMove={()=>{userScrolling.current=true;}} {...(Platform.OS==='web'?{onWheel:()=>{userScrolling.current=true;}}:{})}>
      {rearTen ? (
        <View
          {...(Platform.OS === 'web'
            ? { 'aria-hidden': true }
            : { accessibilityElementsHidden: true })}
          pointerEvents="none"
          style={[
            styles.backLayer,
            {
              backgroundColor: source.carousel.layers.backTen.fill.color?.hex,
              borderRadius: source.carousel.layers.backTen.cornerRadius,
              left: source.carousel.layers.backTen.matrix.m02 * horizontalScale,
              shadowColor: source.carousel.layers.backTen.effects[0].color?.hex,
              shadowOffset: {
                width: source.carousel.layers.backTen.effects[0].offset?.x ?? 0,
                height: source.carousel.layers.backTen.effects[0].offset?.y ?? 0,
              },
              shadowOpacity: source.carousel.layers.backTen.effects[0].color?.alpha ?? 0,
              shadowRadius: source.carousel.layers.backTen.effects[0].radius ?? 0,
              top: source.carousel.layers.backTen.matrix.m12,
              transform: [{ rotate: rotation(source.carousel.layers.backTen.matrix) }],
              width: cardWidth,
            },
          ]}
          testID="store-carousel-back-10"
        >
          <RearPublicationCard
            item={rearTen}
            layer={source.rearLayers.backTen}
            layerKey="10"
            width={cardWidth}
          />
        </View>
      ) : null}
      {rearFive ? (
        <View
          {...(Platform.OS === 'web'
            ? { 'aria-hidden': true }
            : { accessibilityElementsHidden: true })}
          pointerEvents="none"
          style={[
            styles.backLayer,
            {
              backgroundColor: source.carousel.layers.backFive.fill.color?.hex,
              borderRadius: source.carousel.layers.backFive.cornerRadius,
              left: source.carousel.layers.backFive.matrix.m02 * horizontalScale,
              shadowColor: source.carousel.layers.backFive.effects[0].color?.hex,
              shadowOffset: {
                width: source.carousel.layers.backFive.effects[0].offset?.x ?? 0,
                height: source.carousel.layers.backFive.effects[0].offset?.y ?? 0,
              },
              shadowOpacity: source.carousel.layers.backFive.effects[0].color?.alpha ?? 0,
              shadowRadius: source.carousel.layers.backFive.effects[0].radius ?? 0,
              top: source.carousel.layers.backFive.matrix.m12,
              transform: [{ rotate: rotation(source.carousel.layers.backFive.matrix) }],
              width: cardWidth,
            },
          ]}
          testID="store-carousel-back-5"
        >
          <RearPublicationCard
            item={rearFive}
            layer={source.rearLayers.backFive}
            layerKey="5"
            width={cardWidth}
          />
        </View>
      ) : null}
      <FlatList
        contentContainerStyle={{
          paddingHorizontal: (viewportWidth - cardWidth) / 2,
          paddingTop:21,
          gap:sourceGap,
        }}
        data={items}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          index,
          length: interval,
          offset: (viewportWidth-cardWidth)/2+interval * index,
        })}
        horizontal
        keyExtractor={(item) => item.id}
        onLayout={(event) => setLaidOutWidth(event.nativeEvent.layout.width)}
        onMomentumScrollEnd={selectAtOffset}
        onScroll={Platform.OS === 'web' ? event=>{if(userScrolling.current)selectAtOffset(event);} : undefined}
        ref={list}
        renderItem={({ item }) => (
          <View>
            <PublicationCard
              favorite={favoriteIds.has(item.id)}
              favoriteBusy={favoriteBusyId === item.id}
              item={item}
              onFavorite={onFavorite}
              onOpen={onOpen}
              onSelect={(id) => {
                onSelect(id);
                const index = items.findIndex((candidate) => candidate.id === id);
                if (index >= 0) list.current?.scrollToIndex({ animated: true, index, viewPosition:.5 });
              }}
              selected={item.id === selectedId}
              width={cardWidth}
            />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        snapToInterval={interval}
        scrollEventThrottle={16}
        style={styles.list}
        testID="store-carousel"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    alignSelf: 'center',
    height: 440,
    marginTop:16,
    overflow: 'visible',
  },
  list: {
    overflow: 'visible',
    zIndex: 1,
  },
  backLayer: {
    height: 399,
    position: 'absolute',
    top: 0,
    transformOrigin: [0, 0, 0],
  },
});
