import { useMemo, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { PublicationCard } from './PublicationCard';
import type { StoreCard } from './publicationViewModel';

type PublicationCarouselProps = {
  favoriteBusyId: string | null;
  favoriteIds: ReadonlySet<string>;
  items: StoreCard[];
  onFavorite: (id: string, enabled: boolean) => void;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
};

const CARD_GAP = 12;

export function PublicationCarousel({
  favoriteBusyId,
  favoriteIds,
  items,
  onFavorite,
  onOpen,
  onSelect,
  selectedId,
}: PublicationCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const viewportWidth = Math.min(336.16851806640625, windowWidth - 32);
  const cardWidth = Math.min(271, viewportWidth - 32);
  const interval = cardWidth + CARD_GAP;
  const list = useRef<FlatList<StoreCard>>(null);
  const selectedIndex = useMemo(
    () => Math.max(0, items.findIndex((item) => item.id === selectedId)),
    [items, selectedId],
  );

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
    <View style={[styles.viewport, { width: viewportWidth }]}>
      <FlatList
        contentContainerStyle={{
          paddingHorizontal: (viewportWidth - cardWidth) / 2,
        }}
        data={items}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          index,
          length: interval,
          offset: interval * index,
        })}
        horizontal
        initialScrollIndex={selectedIndex}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={selectAtOffset}
        pagingEnabled
        ref={list}
        renderItem={({ item }) => (
          <View style={{ marginRight: CARD_GAP }}>
            <PublicationCard
              favorite={favoriteIds.has(item.id)}
              favoriteBusy={favoriteBusyId === item.id}
              item={item}
              onFavorite={onFavorite}
              onOpen={onOpen}
              onSelect={(id) => {
                onSelect(id);
                const index = items.findIndex((candidate) => candidate.id === id);
                if (index >= 0) list.current?.scrollToIndex({ animated: true, index });
              }}
              selected={item.id === selectedId}
              width={cardWidth}
            />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={interval}
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
    overflow: 'visible',
  },
  list: {
    overflow: 'visible',
  },
});
