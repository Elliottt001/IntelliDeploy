import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
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
  const userScrolling=useRef(false);
  const [layoutVersion,setLayoutVersion]=useState(0);
  const selectedIndex = useMemo(
    () => Math.max(0, items.findIndex((item) => item.id === selectedId)),
    [items, selectedId],
  );
  useEffect(()=>{
    if(layoutVersion&&items.length){userScrolling.current=false;list.current?.scrollToIndex({index:selectedIndex,animated:false,viewPosition:.5});}
  },[layoutVersion,selectedIndex,items.length,viewportWidth,cardWidth]);

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
      <View
        pointerEvents="none"
        style={[
          styles.backLayer,
          {
            left: (viewportWidth - cardWidth) / 2 + 18,
            transform: [{ rotate: '10deg' }],
            width: cardWidth,
          },
        ]}
        testID="store-carousel-back-10"
      />
      <View
        pointerEvents="none"
        style={[
          styles.backLayer,
          {
            left: (viewportWidth - cardWidth) / 2 + 9,
            transform: [{ rotate: '5deg' }],
            width: cardWidth,
          },
        ]}
        testID="store-carousel-back-5"
      />
      <FlatList
        contentContainerStyle={{
          paddingHorizontal: (viewportWidth - cardWidth) / 2,
          paddingTop:21,
          gap:CARD_GAP,
        }}
        data={items}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          index,
          length: cardWidth,
          offset: (viewportWidth-cardWidth)/2+interval * index,
        })}
        horizontal
        onLayout={()=>setLayoutVersion(version=>version+1)}
        keyExtractor={(item) => item.id}
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
    backgroundColor: '#FCFCFC',
    borderRadius: 30,
    height: 399,
    position: 'absolute',
    shadowColor: '#897AB9',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
    top: 0,
  },
});
