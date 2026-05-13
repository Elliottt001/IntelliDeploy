import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

const assets = {
  logo: require('../assets/app-gallery/brand-logo.png'),
  settings: require('../assets/app-gallery/settings-button.png'),
  searchBar: require('../assets/app-gallery/search-bar.png'),
  hotPill: require('../assets/app-gallery/hot-ranking-pill.png'),
  categoryPill: require('../assets/app-gallery/category-pill.png'),
  filterPill: require('../assets/app-gallery/filter-pill.png'),
  cardLeft: require('../assets/app-gallery/card-layer-left.png'),
  cardRight: require('../assets/app-gallery/card-layer-right.png'),
  frontCard: require('../assets/app-gallery/card-layer-front.png'),
  pawzzleIcon: require('../assets/app-gallery/pawzzle-icon.png'),
  titleRating: require('../assets/app-gallery/pawzzle-title-rating.png'),
  goldenBadge: require('../assets/app-gallery/golden-meow-badge.png'),
  editorChoice: require('../assets/app-gallery/editor-choice-label.png'),
  description: require('../assets/app-gallery/pawzzle-description.png'),
  detailsLink: require('../assets/app-gallery/details-link.png'),
  screenshots: require('../assets/app-gallery/pawzzle-screenshots.png'),
  dots: require('../assets/app-gallery/carousel-dots.png'),
  actionBar: require('../assets/app-gallery/action-bar.png'),
};

export default function AppGallery() {
  const router = useRouter();
  const [pressedAction, setPressedAction] = useState<string | null>(null);
  const intro = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [float, intro]);

  const floatY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const actionScale = (name: string) => ({
    transform: [{ scale: pressedAction === name ? 0.95 : 1 }],
  });

  return (
    <ScrollView
      style={styles.viewport}
      contentContainerStyle={styles.stage}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stageTitle}>App Gallery</Text>

      <View style={styles.phone}>
        <View style={styles.background} />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [22, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Image source={assets.logo} style={styles.logo} resizeMode="contain" />
            </Pressable>
            <Pressable style={styles.settingsButton} hitSlop={8}>
              <Image source={assets.settings} style={styles.settingsImage} resizeMode="contain" />
            </Pressable>
          </View>

          <Pressable style={styles.searchWrap}>
            <Image source={assets.searchBar} style={styles.searchBar} resizeMode="stretch" />
          </Pressable>

          <View style={styles.pills}>
            <Pressable>
              <Image source={assets.hotPill} style={styles.hotPill} resizeMode="stretch" />
            </Pressable>
            <Pressable>
              <Image source={assets.categoryPill} style={styles.categoryPill} resizeMode="stretch" />
            </Pressable>
            <Pressable>
              <Image source={assets.filterPill} style={styles.filterPill} resizeMode="stretch" />
            </Pressable>
          </View>

          <Animated.View style={[styles.deck, { transform: [{ translateY: floatY }] }]}>
            <Image source={assets.cardLeft} style={styles.cardLeft} resizeMode="stretch" />
            <Image source={assets.cardRight} style={styles.cardRight} resizeMode="stretch" />
            <Image source={assets.frontCard} style={styles.frontCard} resizeMode="stretch" />

            <View style={styles.cardContent}>
              <Image source={assets.pawzzleIcon} style={styles.appIcon} resizeMode="contain" />
              <Image source={assets.titleRating} style={styles.titleRating} resizeMode="contain" />
              <Image source={assets.goldenBadge} style={styles.goldenBadge} resizeMode="contain" />
              <Image source={assets.editorChoice} style={styles.editorChoice} resizeMode="contain" />
              <Image source={assets.description} style={styles.description} resizeMode="contain" />
              <Image source={assets.detailsLink} style={styles.detailsLink} resizeMode="contain" />
              <Image source={assets.screenshots} style={styles.screenshots} resizeMode="contain" />
              <Image source={assets.dots} style={styles.dots} resizeMode="contain" />
            </View>
          </Animated.View>

          <View style={styles.actionDock}>
            <Image source={assets.actionBar} style={styles.actionBar} resizeMode="stretch" />
            <Pressable
              style={[styles.actionButton, styles.likeButton, actionScale('like')]}
              onPressIn={() => setPressedAction('like')}
              onPressOut={() => setPressedAction(null)}
            />
            <Pressable
              style={[styles.actionButton, styles.favoriteButton, actionScale('favorite')]}
              onPressIn={() => setPressedAction('favorite')}
              onPressOut={() => setPressedAction(null)}
            />
            <Pressable
              style={[styles.actionButton, styles.commentButton, actionScale('comment')]}
              onPressIn={() => setPressedAction('comment')}
              onPressOut={() => setPressedAction(null)}
            />
          </View>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: '#575756',
  },
  stage: {
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#575756',
    paddingVertical: 32,
  },
  stageTitle: {
    width: 402,
    marginBottom: 10,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    fontWeight: '700',
  },
  phone: {
    width: 402,
    height: 874,
    borderRadius: 45,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#F4F7FF',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 18px 50px rgba(0,0,0,0.18)' } as any) : {}),
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F6F8FF',
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  header: {
    position: 'absolute',
    top: 58,
    left: 25,
    right: 18,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 171,
    height: 38,
  },
  settingsButton: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsImage: {
    width: 40,
    height: 41,
  },
  searchWrap: {
    position: 'absolute',
    top: 133,
    left: 40,
    width: 322,
    height: 46,
  },
  searchBar: {
    width: '100%',
    height: '100%',
  },
  pills: {
    position: 'absolute',
    top: 213,
    left: 48,
    right: 48,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hotPill: {
    width: 102,
    height: 23,
  },
  categoryPill: {
    width: 111,
    height: 24,
  },
  filterPill: {
    width: 68,
    height: 24,
  },
  deck: {
    position: 'absolute',
    top: 270,
    left: 28,
    width: 347,
    height: 451,
  },
  cardLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 347,
    height: 451,
  },
  cardRight: {
    position: 'absolute',
    left: 13.5,
    top: 7,
    width: 320,
    height: 437,
  },
  frontCard: {
    position: 'absolute',
    left: 28,
    top: 16,
    width: 291,
    height: 419,
  },
  cardContent: {
    position: 'absolute',
    left: 28,
    top: 16,
    width: 291,
    height: 419,
  },
  appIcon: {
    position: 'absolute',
    left: 28,
    top: 38,
    width: 73,
    height: 73,
  },
  titleRating: {
    position: 'absolute',
    left: 116,
    top: 49,
    width: 130,
    height: 35,
  },
  goldenBadge: {
    position: 'absolute',
    left: 217,
    top: 48,
    width: 38,
    height: 13,
  },
  editorChoice: {
    position: 'absolute',
    left: 118,
    top: 96,
    width: 68,
    height: 10,
  },
  description: {
    position: 'absolute',
    left: 29,
    top: 122,
    width: 230,
    height: 59,
  },
  detailsLink: {
    position: 'absolute',
    left: 238,
    top: 173,
    width: 26,
    height: 7,
  },
  screenshots: {
    position: 'absolute',
    left: 51,
    top: 204,
    width: 188,
    height: 162,
  },
  dots: {
    position: 'absolute',
    left: 124,
    top: 386,
    width: 40,
    height: 5,
  },
  actionDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 78,
    height: 68,
    alignItems: 'center',
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 5,
    width: 370,
    height: 65,
  },
  actionButton: {
    position: 'absolute',
    top: 1,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeButton: {
    left: 102,
  },
  favoriteButton: {
    left: 195,
  },
  commentButton: {
    left: 287,
  },
});
