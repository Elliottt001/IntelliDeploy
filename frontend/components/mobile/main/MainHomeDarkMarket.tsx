import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import MainHomeBottomNav from './MainHomeBottomNav';
import { mainHomeAssets } from './mainHomeAssets';
import { darkTokens } from './mainHomeTokens';
import type { DarkAppItem, DarkCategory, MainHomeNavId } from './mainHomeTypes';

const categories: DarkCategory[] = [
  {
    id: 'productivity',
    title: '效率工具',
    count: '156款',
    icon: '⚡',
    backgroundColor: '#1C1830',
    accentColor: darkTokens.colors.primarySoft,
  },
  {
    id: 'security',
    title: '安全防护',
    count: '89款',
    icon: '◇',
    backgroundColor: '#0F1F2B',
    accentColor: darkTokens.colors.cyan,
  },
  {
    id: 'media',
    title: '影音娱乐',
    count: '120款',
    icon: '▣',
    backgroundColor: '#251414',
    accentColor: '#FCA5A5',
  },
  {
    id: 'design',
    title: '设计创作',
    count: '98款',
    icon: '✎',
    backgroundColor: '#281828',
    accentColor: '#FDA4AF',
  },
];

const rankingItems: DarkAppItem[] = [
  {
    id: 'notion',
    name: 'Notion',
    category: '办公学习',
    description: '笔记、文档与知识管理工具',
    iconText: 'N',
    iconColor: '#191919',
    rating: '4.8',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: '社交通讯',
    description: '团队协作与消息沟通',
    iconText: 'S',
    iconColor: '#22C55E',
    rating: '4.8',
  },
  {
    id: 'twitter',
    name: 'X/Twitter',
    category: '社交媒体',
    description: '实时资讯与社交平台',
    iconText: 'X',
    iconColor: '#1D9BF0',
    rating: '4.7',
  },
  {
    id: 'taobao',
    name: '淘宝',
    category: '购物电商',
    description: '购物电商平台',
    iconText: '淘',
    iconColor: '#FF6A00',
    rating: '4.8',
  },
  {
    id: 'bilibili',
    name: 'B站',
    category: '影音娱乐',
    description: '视频社区',
    iconText: 'B',
    iconColor: '#FB7299',
    rating: '4.8',
  },
  {
    id: 'netflix',
    name: '网易云音乐',
    category: '影音娱乐',
    description: '音乐播放',
    iconText: 'N',
    iconColor: '#E50914',
    rating: '4.7',
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    category: '社交生活',
    description: '生活分享社区',
    iconText: '书',
    iconColor: '#FF2442',
    rating: '4.6',
  },
  {
    id: 'jd',
    name: '京东',
    category: '购物电商',
    description: '综合电商平台',
    iconText: '京',
    iconColor: '#333333',
    rating: '4.5',
  },
];

const latestItems: DarkAppItem[] = [
  {
    id: 'alfred',
    name: 'Alfred 5',
    category: '效率工具',
    description: '强大的效率搜索与启动工具',
    iconText: 'A',
    iconColor: '#4C4CEA',
  },
  {
    id: 'notion-latest',
    name: 'Notion',
    category: '办公学习',
    description: '笔记、文档与知识管理工具',
    iconText: 'N',
    iconColor: '#191919',
  },
  {
    id: 'obs',
    name: 'OBS Studio',
    category: '影音娱乐',
    description: '免费开源的直播与录屏软件',
    iconText: 'O',
    iconColor: '#302A50',
  },
  {
    id: 'figma',
    name: 'Figma',
    category: '设计创作',
    description: '界面设计与协作工具',
    iconText: 'F',
    iconColor: '#F24E1E',
  },
  {
    id: 'vscode',
    name: 'VS Code',
    category: '开发工具',
    description: '轻量级代码编辑器',
    iconText: 'V',
    iconColor: '#007ACC',
  },
];

type MainHomeDarkMarketProps = {
  activeTab: MainHomeNavId;
  onSelectTab: (id: MainHomeNavId) => void;
  onSwitchTheme: () => void;
};

export default function MainHomeDarkMarket({
  activeTab,
  onSelectTab,
  onSwitchTheme,
}: MainHomeDarkMarketProps) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusIcons}>▰ ▰ ▱</Text>
      </View>

      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={styles.appMark}>
            <Text style={styles.appMarkText}>APP</Text>
          </View>
          <Text style={styles.brandTitle}>AppMarket</Text>
        </View>
        <View style={styles.topActions}>
          <View style={styles.search}>
            <Text style={styles.searchIcon}>⌕</Text>
            <Text style={styles.searchText}>搜索软件、工具、资源</Text>
          </View>
          <Pressable onPress={onSwitchTheme} style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
            <Text style={styles.bellText}>☼</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.pageTitleBlock}>
        <Text style={styles.pageTitle}>应用商店</Text>
        <Text style={styles.pageSubtitle}>探索优质应用，提升效率与创造力</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>✦ 精品推荐</Text>
          <Text style={styles.heroTitle}>精选应用推荐</Text>
          <Text style={styles.heroSubtitle}>高效 · 安全 · 实用</Text>
          <Pressable style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
            <Text style={styles.heroButtonText}>探索更多</Text>
            <Text style={styles.heroButtonArrow}>›</Text>
          </Pressable>
        </View>
        <View style={styles.heroArt}>
          <View style={styles.heroTileLarge}>
            <Text style={styles.heroTileText}>✎</Text>
            <Text style={styles.heroTileText}>⌘</Text>
          </View>
          <View style={styles.heroTileRow}>
            <View style={[styles.heroTileSmall, styles.heroTilePink]}>
              <Text style={styles.heroTileText}>☆</Text>
            </View>
            <View style={[styles.heroTileSmall, styles.heroTileCyan]}>
              <Text style={styles.heroTileText}>◇</Text>
            </View>
          </View>
        </View>
        <View style={styles.heroDots}>
          <View style={styles.heroDotActive} />
          <View style={styles.heroDot} />
          <View style={styles.heroDot} />
          <View style={styles.heroDot} />
        </View>
      </View>

      <View style={styles.stats}>
        <Stat icon="♡" label="点赞的" value="128" color={darkTokens.colors.red} />
        <Stat icon="♧" label="收藏的" value="256" color={darkTokens.colors.primarySoft} />
        <Stat icon="◎" label="评论的" value="76" color={darkTokens.colors.blue} />
      </View>

      <SectionHeader icon="🔥" title="热门分类" action="查看全部" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroller}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map((category) => (
          <View key={category.id} style={[styles.categoryCard, { backgroundColor: category.backgroundColor }]}>
            <View style={[styles.categoryIcon, { backgroundColor: `${category.accentColor}18` }]}>
              <Text style={[styles.categoryIconText, { color: category.accentColor }]}>{category.icon}</Text>
            </View>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <Text style={[styles.categoryCount, { color: category.accentColor }]}>{category.count}</Text>
          </View>
        ))}
      </ScrollView>

      <SectionHeader icon="👑" title="热门排行" action="查看全部" />
      <View style={styles.rankingPanel}>
        {rankingItems.map((item, index) => (
          <RankingRow key={item.id} item={item} index={index} />
        ))}
      </View>

      <SectionHeader icon="👑" title="编辑精选" action="应用介绍" />
      <View style={styles.editorPick}>
        <View style={styles.editorHeader}>
          <View style={styles.editorIcon}>
            <Text style={styles.editorIconText}>N</Text>
          </View>
          <View>
            <Text style={styles.editorTitle}>Notion</Text>
            <Text style={styles.editorMeta}>办公学习 · 4.8 · 1.2k 评价</Text>
          </View>
        </View>
        <Text style={styles.editorDescription}>
          Notion 是一款集笔记、文档、数据库、任务管理于一体的全能知识管理工具。支持多人协作编辑，灵活的页面结构让个人与团队工作更高效有序。
        </Text>
        <View style={styles.editorPreviewRow}>
          <PreviewTile icon="📝" />
          <PreviewTile icon="📊" />
          <PreviewTile icon="🗂" />
        </View>
        <View style={styles.editorFooter}>
          <View style={styles.chips}>
            <Chip label="效率工具" color={darkTokens.colors.primarySoft} />
            <Chip label="v2.34" color={darkTokens.colors.cyan} />
            <Chip label="免费" color={darkTokens.colors.green} />
          </View>
          <Pressable style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}>
            <Text style={styles.downloadText}>下载</Text>
          </Pressable>
        </View>
      </View>

      <SectionHeader icon="★" title="最新推荐" action="查看全部" />
      <View style={styles.latestPanel}>
        {latestItems.map((item) => (
          <LatestRow key={item.id} item={item} />
        ))}
      </View>

      <MainHomeBottomNav theme="dark" activeTab={activeTab} onSelect={onSelectTab} />
    </ScrollView>
  );
}

function SectionHeader({ icon, title, action }: { icon: string; title: string; action: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleGroup}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionAction}>{action} ›</Text>
    </View>
  );
}

function Stat({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIcon, { borderColor: `${color}38`, backgroundColor: `${color}18` }]}>
        <Text style={[styles.statIconText, { color }]}>{icon}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function RankingRow({ item, index }: { item: DarkAppItem; index: number }) {
  return (
    <View style={styles.rankingRow}>
      <Text style={styles.rankNumber}>{index + 1}</Text>
      <View style={[styles.appIcon, { backgroundColor: item.iconColor }]}>
        <Text style={styles.appIconText}>{item.iconText}</Text>
      </View>
      <View style={styles.rankingCopy}>
        <Text style={styles.appName}>{item.name}</Text>
        <Text style={styles.appDescription}>{item.description}</Text>
      </View>
      <View style={styles.ratingPill}>
        <Text style={styles.ratingText}>★ {item.rating}</Text>
      </View>
    </View>
  );
}

function LatestRow({ item }: { item: DarkAppItem }) {
  return (
    <View style={styles.latestRow}>
      <View style={[styles.latestIcon, { backgroundColor: item.iconColor }]}>
        <Text style={styles.latestIconText}>{item.iconText}</Text>
      </View>
      <View style={styles.latestCopy}>
        <View style={styles.latestTitleRow}>
          <Text style={styles.latestName}>{item.name}</Text>
          <View style={styles.latestTag}>
            <Text style={styles.latestTagText}>{item.category}</Text>
          </View>
        </View>
        <Text style={styles.latestDescription}>{item.description}</Text>
      </View>
      <Pressable style={({ pressed }) => [styles.latestDownload, pressed && styles.pressed]}>
        <Text style={styles.latestDownloadText}>下载 ⇩</Text>
      </Pressable>
    </View>
  );
}

function PreviewTile({ icon }: { icon: string }) {
  return (
    <View style={styles.previewTile}>
      <Text style={styles.previewIcon}>{icon}</Text>
    </View>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: darkTokens.colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingBottom: 0,
    backgroundColor: darkTokens.colors.background,
  },
  statusBar: {
    height: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTime: {
    color: '#050505',
    fontSize: darkTokens.typography.status,
    fontWeight: '700',
  },
  statusIcons: {
    color: '#111111',
    fontSize: 10,
  },
  topBar: {
    height: 40,
    marginHorizontal: 16,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appMark: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkTokens.colors.primary,
  },
  appMarkText: {
    color: darkTokens.colors.text,
    fontSize: 9,
    fontWeight: '900',
  },
  brandTitle: {
    color: darkTokens.colors.text,
    fontSize: darkTokens.typography.brand,
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  search: {
    width: 152,
    height: 29,
    borderRadius: 999,
    backgroundColor: darkTokens.colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchIcon: {
    color: darkTokens.colors.dim,
    fontSize: 13,
  },
  searchText: {
    color: darkTokens.colors.dim,
    fontSize: 10,
  },
  bell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: darkTokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellText: {
    color: darkTokens.colors.primarySoft,
    fontSize: 14,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  pageTitleBlock: {
    height: 67,
    marginHorizontal: 16,
    paddingTop: 12,
  },
  pageTitle: {
    color: darkTokens.colors.text,
    fontSize: darkTokens.typography.pageTitle,
    fontWeight: '700',
    lineHeight: 33,
  },
  pageSubtitle: {
    color: darkTokens.colors.dim,
    fontSize: darkTokens.typography.body,
    lineHeight: 16,
  },
  hero: {
    height: 155.5,
    marginHorizontal: 16,
    borderRadius: darkTokens.radii.hero,
    overflow: 'hidden',
    backgroundColor: '#1D1050',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heroCopy: {
    flex: 1,
  },
  heroEyebrow: {
    color: darkTokens.colors.primarySoft,
    fontSize: darkTokens.typography.heroEyebrow,
    letterSpacing: 1,
    lineHeight: 15,
  },
  heroTitle: {
    color: darkTokens.colors.text,
    fontSize: darkTokens.typography.heroTitle,
    fontWeight: '700',
    lineHeight: 28,
    marginTop: 4,
  },
  heroSubtitle: {
    color: darkTokens.colors.primarySoft,
    fontSize: darkTokens.typography.body,
    lineHeight: 16,
    marginTop: 3,
  },
  heroButton: {
    marginTop: 16,
    height: 28,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: darkTokens.colors.primary,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroButtonText: {
    color: darkTokens.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  heroButtonArrow: {
    color: darkTokens.colors.text,
    fontSize: 16,
    marginTop: -1,
  },
  heroArt: {
    width: 86,
    alignItems: 'flex-end',
    gap: 8,
  },
  heroTileLarge: {
    width: 68,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#6D28D9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroTileRow: {
    flexDirection: 'row',
    gap: 6,
  },
  heroTileSmall: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTilePink: {
    backgroundColor: darkTokens.colors.pink,
  },
  heroTileCyan: {
    backgroundColor: '#0EA5E9',
  },
  heroTileText: {
    color: darkTokens.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  heroDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    height: 5,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  heroDotActive: {
    width: 16,
    height: 5,
    borderRadius: 999,
    backgroundColor: darkTokens.colors.primary,
  },
  heroDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3D355A',
  },
  stats: {
    height: 134,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: darkTokens.radii.surface,
    borderWidth: 1,
    borderColor: darkTokens.colors.border,
    backgroundColor: darkTokens.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  statItem: {
    width: 70,
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconText: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: darkTokens.colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  statValue: {
    color: darkTokens.colors.text,
    fontSize: darkTokens.typography.stat,
    fontWeight: '700',
    lineHeight: 20,
  },
  sectionHeader: {
    height: 20,
    marginHorizontal: 16,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionIcon: {
    color: darkTokens.colors.primarySoft,
    fontSize: 14,
  },
  sectionTitle: {
    color: darkTokens.colors.text,
    fontSize: darkTokens.typography.sectionTitle,
    fontWeight: '600',
  },
  sectionAction: {
    color: darkTokens.colors.muted,
    fontSize: 12,
  },
  categoryScroller: {
    marginTop: 12,
  },
  categoryContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryCard: {
    width: 82,
    height: 113,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: {
    fontSize: 18,
  },
  categoryTitle: {
    color: darkTokens.colors.text,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 15,
  },
  categoryCount: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  rankingPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: darkTokens.colors.border,
    backgroundColor: darkTokens.colors.surface,
    overflow: 'hidden',
  },
  rankingRow: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#242842',
  },
  rankNumber: {
    width: 22,
    color: darkTokens.colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  appIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  appIconText: {
    color: darkTokens.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  rankingCopy: {
    flex: 1,
    marginLeft: 10,
  },
  appName: {
    color: darkTokens.colors.text,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  appDescription: {
    color: darkTokens.colors.dim,
    fontSize: 10,
    lineHeight: 14,
  },
  ratingPill: {
    height: 22,
    minWidth: 54,
    borderRadius: 999,
    backgroundColor: '#1E2140',
    borderWidth: 1,
    borderColor: '#3D4170',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  ratingText: {
    color: darkTokens.colors.primarySoft,
    fontSize: 10,
  },
  editorPick: {
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 318,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: darkTokens.colors.border,
    backgroundColor: darkTokens.colors.surface,
    padding: 16,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editorIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#191919',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  editorIconText: {
    color: darkTokens.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  editorTitle: {
    color: darkTokens.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  editorMeta: {
    color: darkTokens.colors.dim,
    fontSize: 10,
    marginTop: 4,
  },
  editorDescription: {
    color: darkTokens.colors.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 14,
  },
  editorPreviewRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  previewTile: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkTokens.colors.borderSoft,
    backgroundColor: '#1E1B3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIcon: {
    fontSize: 24,
  },
  editorFooter: {
    minHeight: 32,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 1,
  },
  chip: {
    height: 23,
    borderRadius: 999,
    backgroundColor: '#1E1B3A',
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 10,
  },
  downloadButton: {
    height: 32,
    borderRadius: 999,
    backgroundColor: darkTokens.colors.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  downloadText: {
    color: darkTokens.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  latestPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: darkTokens.colors.border,
    backgroundColor: darkTokens.colors.surface,
    overflow: 'hidden',
  },
  latestRow: {
    height: 81,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#242842',
  },
  latestIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  latestIconText: {
    color: darkTokens.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  latestCopy: {
    flex: 1,
    marginLeft: 12,
  },
  latestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  latestName: {
    color: darkTokens.colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  latestTag: {
    height: 19,
    borderRadius: 999,
    backgroundColor: '#1E1B3A',
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  latestTagText: {
    color: darkTokens.colors.primarySoft,
    fontSize: 10,
  },
  latestDescription: {
    color: darkTokens.colors.dim,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  latestDownload: {
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3D4170',
    backgroundColor: '#1E2140',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  latestDownloadText: {
    color: darkTokens.colors.primarySoft,
    fontSize: 12,
  },
});
