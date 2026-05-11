import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { lightLayout, lightTokens } from './mainHomeTokens';
import type { WordCloudTag } from './mainHomeTypes';

const baseTags: WordCloudTag[] = [
  { id: 'seek', label: '寻风', x: 11, y: 20, size: 8, color: '#D582FF', opacity: 0.32, weight: '600' },
  { id: 'small-sites', label: '小众网站', x: 50, y: 4, size: 10, color: '#6598FF', weight: '600' },
  { id: 'notion', label: 'Notion 模版', x: 160, y: 11, size: 14, color: '#6598FF', opacity: 0.7, weight: '600' },
  { id: 'translate', label: '同声传译', x: 122, y: 6, size: 8, color: '#54AEF3', opacity: 0.7, weight: '600' },
  { id: 'gpt', label: 'GPT插件', x: 154, y: 32, size: 3.5, color: '#A78BFA', opacity: 0.6, weight: '600' },
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
  { id: 'follow-mode', label: '跟着音mode', x: 236, y: 63, size: 5, color: '#8A65FF', opacity: 0.36, weight: '600' },
  { id: 'read', label: '阅读清单', x: 31, y: 33, size: 10, color: '#A78BFA', weight: '600' },
];

const altTags: WordCloudTag[] = [
  { id: 'deploy', label: '一键部署', x: 48, y: 5, size: 10, color: '#6598FF', weight: '600' },
  { id: 'cloud', label: '云原生', x: 166, y: 12, size: 14, color: '#6598FF', opacity: 0.7, weight: '600' },
  { id: 'agent', label: 'AI Agent', x: 113, y: 7, size: 8, color: '#54AEF3', opacity: 0.7, weight: '600' },
  { id: 'main-vibe', label: 'Vibe Coding', x: 88, y: 36, size: 24, color: '#8A65FF', weight: '600' },
  { id: 'github', label: 'GitHub', x: 224, y: 50, size: 10, color: '#7C62FF', opacity: 0.62, weight: '600' },
  { id: 'sealos', label: 'Sealos', x: 29, y: 52, size: 10, color: '#6598FF', opacity: 0.72, weight: '600' },
  { id: 'monitor', label: '容器监控', x: 80, y: 70, size: 10, color: '#7B5CF6', weight: '600' },
  { id: 'template', label: '部署模板', x: 165, y: 72, size: 10, color: '#A997FF', weight: '600' },
  { id: 'open-source', label: '开源项目', x: 29, y: 87, size: 10, color: '#7C62FF', opacity: 0.7, weight: '600' },
  { id: 'low-code', label: '低代码', x: 128, y: 88, size: 10, color: '#A78BFA', opacity: 0.62, weight: '600' },
  { id: 'pipeline', label: '自动化流水线', x: 198, y: 86, size: 10, color: '#7C62FF', opacity: 0.65, weight: '600' },
];

type MainHomeInspirationCloudProps = {
  intro: Animated.Value;
  cloudVariant: number;
  onShuffle: () => void;
  onPressCloud: () => void;
};

export default function MainHomeInspirationCloud({
  intro,
  cloudVariant,
  onShuffle,
  onPressCloud,
}: MainHomeInspirationCloudProps) {
  const tags = cloudVariant % 2 === 0 ? baseTags : altTags;

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
    backgroundColor: 'rgba(255,255,255,0.34)',
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
