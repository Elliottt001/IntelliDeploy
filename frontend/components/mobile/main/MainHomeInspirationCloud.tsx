import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { mainHomeMotion } from './mainHomeMotion';
import { lightLayout, lightTokens } from './mainHomeTokens';
import type { WordCloudTag } from './mainHomeTypes';

const baseTags: WordCloudTag[] = [
  { id: 'seek', label: '寻爪', x: 20, y: 17, size: 8, color: '#D582FF', opacity: 0.6, weight: '600' },
  { id: 'small-sites', label: '小众网站', x: 50, y: 4, size: 10, color: '#6598FF', weight: '600' },
  { id: 'notion', label: 'Notion 模版', x: 160, y: 11, size: 14, color: '#6598FF', opacity: 0.7, weight: '600' },
  { id: 'translate', label: '同声传译', x: 122, y: 6, size: 8, color: '#54AEF3', opacity: 0.7, weight: '600' },
  { id: 'gpt', label: 'GPT插件', x: 154, y: 35, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'minimal', label: '极简风格', x: 213, y: 32, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'zero-cost', label: '0成本', x: 101, y: 87, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'indie', label: '独立开发', x: 75, y: 49, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'low-code-dev', label: '低代码开发', x: 51, y: 24, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'main', label: 'AI Copilot', x: 98, y: 36, size: 24, color: '#8A65FF', weight: '600' },
  { id: 'retro', label: '复古像素风', x: 88, y: 21, size: 10, color: '#A3B2FF', opacity: 0.8, weight: '600' },
  { id: 'vibe', label: 'Vibe Coding', x: 12, y: 51, size: 10, color: '#6598FF', opacity: 0.7, weight: '600' },
  { id: 'workflow', label: '自动化工作流', x: 73, y: 68, size: 10, color: '#7B5CF6', weight: '600' },
  { id: 'bio', label: '生物科技', x: 160, y: 70, size: 10, color: '#A997FF', weight: '600' },
  { id: 'web3', label: 'Web3.0', x: 233, y: 48, size: 10, color: '#7C62FF', opacity: 0.6, weight: '600' },
  { id: 'image2', label: 'image2.0', x: 12, y: 74, size: 10, color: '#D582FF', opacity: 0.48, weight: '600' },
  { id: 'prompt', label: 'Prompt技巧', x: 28, y: 86, size: 10, color: '#7C62FF', opacity: 0.7, weight: '600' },
  { id: 'knowledge', label: '知识管理', x: 125, y: 86, size: 10, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'open', label: '开源工具', x: 182, y: 91, size: 8, color: '#D582FF', opacity: 0.7, weight: '600' },
  { id: 'timer', label: '番茄钟', x: 213, y: 67, size: 10, color: '#7C62FF', weight: '600' },
  { id: 'color', label: '灵感配色', x: 241, y: 86, size: 10, color: '#7C62FF', opacity: 0.6, weight: '600' },
  { id: 'synoview', label: 'Synoview', x: 254, y: 15, size: 6, color: '#D582FF', opacity: 0.6, weight: '600' },
  { id: 'customize', label: '形象定制', x: 246, y: 34, size: 8, color: '#6598FF', opacity: 0.34, weight: '600' },
  { id: 'follow-mode', label: '星露谷mode', x: 263, y: 66, size: 6, color: '#2549FF', opacity: 0.42, weight: '600' },
  { id: 'read', label: '阅读清单', x: 31, y: 33, size: 10, color: '#A78BFA', weight: '600' },
];

const altTags: WordCloudTag[] = [
  { id: 'image2', label: 'image2.0', x: 54, y: 5, size: 10, color: '#D582FF', opacity: 0.7, weight: '600' },
  { id: 'small-sites', label: '小众网站', x: 112, y: 5, size: 10, color: '#6598FF', weight: '600' },
  { id: 'notion', label: 'Notion 模版', x: 205, y: 8, size: 14, color: '#6598FF', opacity: 0.7, weight: '600' },
  { id: 'translate', label: '同声传译', x: 160, y: 7, size: 8, color: '#54AEF3', opacity: 0.7, weight: '600' },
  { id: 'gpt', label: 'GPT插件', x: 212, y: 29, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'minimal', label: '极简风格', x: 243, y: 39, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'zero-cost', label: '0成本', x: 74, y: 61, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'indie', label: '独立开发', x: 74, y: 38, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'low-code-dev', label: '低代码开发', x: 124, y: 28, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'main', label: 'AI Copilot', x: 98, y: 36, size: 24, color: '#8A65FF', weight: '600' },
  { id: 'retro', label: '复古像素风', x: 149, y: 23, size: 10, color: '#A3B2FF', opacity: 0.8, weight: '600' },
  { id: 'vibe', label: 'Vibe Coding', x: 13, y: 22, size: 10, color: '#6598FF', opacity: 0.7, weight: '600' },
  { id: 'workflow', label: '自动化工作流', x: 37, y: 89, size: 10, color: '#7B5CF6', weight: '600' },
  { id: 'bio', label: '生物科技', x: 113, y: 93, size: 10, color: '#A997FF', weight: '600' },
  { id: 'web3', label: 'Web3.0', x: 256, y: 69, size: 10, color: '#7C62FF', opacity: 0.6, weight: '600' },
  { id: 'prompt', label: 'Prompt技巧', x: 15, y: 67, size: 10, color: '#7C62FF', opacity: 0.7, weight: '600' },
  { id: 'knowledge', label: '知识管理', x: 93, y: 69, size: 10, color: '#A78BFA', opacity: 0.6, weight: '600' },
  { id: 'open', label: '开源工具', x: 145, y: 82, size: 8, color: '#D582FF', opacity: 0.7, weight: '600' },
  { id: 'timer', label: '番茄钟', x: 177, y: 96, size: 10, color: '#7C62FF', weight: '600' },
  { id: 'color', label: '灵感配色', x: 185, y: 68, size: 10, color: '#7C62FF', opacity: 0.6, weight: '600' },
  { id: 'synoview', label: 'Synoview', x: 271, y: 43, size: 6, color: '#D582FF', opacity: 0.6, weight: '600' },
  { id: 'customize', label: '形象定制', x: 232, y: 56, size: 8, color: '#6598FF', opacity: 0.6, weight: '600' },
  { id: 'follow-mode', label: '星露谷mode', x: 227, y: 90, size: 6, color: '#2549FF', opacity: 0.42, weight: '600' },
  { id: 'read', label: '阅读清单', x: 24, y: 42, size: 10, color: '#A78BFA', weight: '600' },
];

type MainHomeInspirationCloudProps = {
  intro: Animated.Value;
  cloudVariant: number;
  keywords: string[];
  onShuffle: () => void;
  onPressCloud: () => void;
};

export default function MainHomeInspirationCloud({
  intro,
  cloudVariant,
  keywords,
  onShuffle,
  onPressCloud,
}: MainHomeInspirationCloudProps) {
  const tags = useMemo(() => {
    const template = cloudVariant % 2 === 0 ? baseTags : altTags;
    if (keywords.length === 0) {
      return template;
    }

    return template.map((tag, index) => ({
      ...tag,
      id: `${tag.id}-${keywords[index] ?? index}`,
      label: keywords[index] ?? tag.label,
    }));
  }, [cloudVariant, keywords]);
  const cloudTransition = useRef(new Animated.Value(1)).current;
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    cloudTransition.stopAnimation();
    cloudTransition.setValue(0);
    Animated.timing(cloudTransition, {
      toValue: 1,
      duration: mainHomeMotion.gentleState,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cloudTransition, cloudVariant]);

  return (
    <>
      <Animated.View
        style={[
          styles.header,
          {
            opacity: intro,
            transform: [
              {
                translateY: intro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.headerLabel}>
          <Text style={styles.spark}>✦</Text>
          <Text style={styles.title}>灵感池</Text>
          <Text style={styles.meta}>· 当日有什么新鲜好玩的</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onShuffle} hitSlop={8}>
          <Text style={styles.shuffle}>换一批↻</Text>
        </Pressable>
      </Animated.View>

      <Pressable accessibilityRole="button" onPress={onPressCloud}>
        <Animated.View
          style={[
            styles.cloud,
            {
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
                {
                  scale: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.cloudGlow} />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: cloudTransition,
                transform: [
                  {
                    translateY: cloudTransition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [9, 0],
                    }),
                  },
                  {
                    scale: cloudTransition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.985, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {tags.map((tag) => (
              <Text
                key={tag.id}
                style={[
                  styles.tag,
                  {
                    left: tag.x,
                    top: tag.y,
                    fontSize: tag.size,
                    color: tag.color,
                    opacity: tag.opacity ?? 1,
                    fontWeight: tag.weight ?? '600',
                  },
                ]}
              >
                {tag.label}
              </Text>
            ))}
          </Animated.View>
        </Animated.View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    left: lightLayout.inspirationHeader.left,
    top: lightLayout.inspirationHeader.top,
    width: lightLayout.inspirationHeader.width,
    height: lightLayout.inspirationHeader.height,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spark: {
    color: lightTokens.colors.primary,
    fontSize: 10,
    marginRight: 5,
  },
  title: {
    color: lightTokens.colors.textSoft,
    fontSize: lightTokens.typography.sectionTitle,
    fontWeight: '600',
  },
  meta: {
    color: lightTokens.colors.textMuted,
    fontSize: lightTokens.typography.sectionMeta,
    marginLeft: 4,
  },
  shuffle: {
    color: lightTokens.colors.primary,
    fontSize: lightTokens.typography.sectionMeta,
    fontWeight: '600',
  },
  cloud: {
    position: 'absolute',
    left: lightLayout.cloud.left,
    top: lightLayout.cloud.top,
    width: lightLayout.cloud.width,
    height: lightLayout.cloud.height,
    borderRadius: lightTokens.radii.cloud,
    borderWidth: 1,
    borderColor: lightTokens.colors.white,
    backgroundColor: lightTokens.colors.cloudSurface,
    overflow: 'hidden',
  },
  cloudGlow: {
    position: 'absolute',
    left: 68,
    top: 28,
    width: 165,
    height: 62,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.44)',
  },
  tag: {
    position: 'absolute',
    letterSpacing: 0,
  },
});
