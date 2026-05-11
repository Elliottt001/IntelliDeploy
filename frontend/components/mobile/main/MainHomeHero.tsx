import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { mainHomeAssets } from './mainHomeAssets';
import { lightLayout, lightTokens } from './mainHomeTokens';

type MainHomeHeroProps = {
  intro: Animated.Value;
  floatY: Animated.AnimatedInterpolation<number | string>;
  miboPulse: Animated.Value;
  onOpenMibo: () => void;
  onPressAvatar: () => void;
};

export default function MainHomeHero({
  intro,
  floatY,
  miboPulse,
  onOpenMibo,
  onPressAvatar,
}: MainHomeHeroProps) {
  return (
    <Animated.View
      style={[
        styles.hero,
        {
          opacity: intro,
          transform: [
            {
              translateY: Animated.add(
                floatY,
                intro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                })
              ),
            },
            {
              scale: intro.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable onPress={onPressAvatar} style={({ pressed }) => [styles.avatarWrap, pressed && styles.avatarPressed]}>
        <View style={styles.avatarHalo}>
          <Image source={mainHomeAssets.cat} resizeMode="contain" style={styles.cat} />
        </View>
      </Pressable>

      <View style={styles.copy}>
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Hi!</Text>
          <Text style={styles.greeting}>Oasis✨</Text>
        </View>
        <Text style={styles.question}>今天又有什么新想法？</Text>
        <Pressable accessibilityRole="button" onPress={onOpenMibo}>
          <Animated.Text
            style={[
              styles.miboLink,
              {
                transform: [
                  {
                    scale: miboPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.06],
                    }),
                  },
                ],
              },
            ]}
          >
            {'<<< 点击此处与Mibo^^ AI对话'}
          </Animated.Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'absolute',
    left: lightLayout.hero.left,
    top: lightLayout.hero.top,
    width: lightLayout.hero.width,
    height: lightLayout.hero.height,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 84,
    height: 84,
  },
  avatarPressed: {
    transform: [{ scale: 0.96 }],
  },
  avatarHalo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: lightTokens.colors.white,
    backgroundColor: '#F5E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    ...lightTokens.shadow.avatar,
  },
  cat: {
    width: 76,
    height: 70,
    transform: [{ rotate: '-6deg' }],
  },
  copy: {
    marginLeft: 0,
    paddingTop: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greeting: {
    color: lightTokens.colors.heroText,
    fontSize: lightTokens.typography.heroTitle,
    fontWeight: '600',
    lineHeight: 25,
  },
  question: {
    color: lightTokens.colors.textMuted,
    fontSize: lightTokens.typography.heroMeta,
    height: 15,
    lineHeight: 14,
    marginTop: 1,
  },
  miboLink: {
    color: lightTokens.colors.primaryGradient,
    fontSize: lightTokens.typography.mibo,
    textDecorationLine: 'underline',
    marginLeft: 74,
    marginTop: 13,
  },
});
