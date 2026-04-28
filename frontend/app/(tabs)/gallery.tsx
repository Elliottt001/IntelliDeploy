import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { deployIntentStore } from '../../services/deployIntent';

const MOCK_APPS = [
  {
    id: '1',
    name: 'Next.js Blog',
    description: '基于 Next.js 的静态博客模板，支持 Markdown 文章管理',
    tags: ['Node.js', 'React', 'Next.js'],
    stars: 1240,
    category: 'Web',
  },
  {
    id: '2',
    name: 'FastAPI Starter',
    description: '生产级 FastAPI 项目模板，含 JWT 认证、PostgreSQL、Docker',
    tags: ['Python', 'FastAPI', 'PostgreSQL'],
    stars: 890,
    category: 'Backend',
  },
  {
    id: '3',
    name: 'React Native App',
    description: '跨平台移动应用模板，支持 iOS 和 Android',
    tags: ['React Native', 'Expo', 'TypeScript'],
    stars: 670,
    category: 'Mobile',
  },
  {
    id: '4',
    name: 'Vue Dashboard',
    description: '基于 Vue 3 的后台管理系统，含图表和数据可视化',
    tags: ['Vue', 'TypeScript', 'ECharts'],
    stars: 530,
    category: 'Web',
  },
  {
    id: '5',
    name: 'Go Microservice',
    description: '高性能 Go 微服务模板，含 gRPC、Redis、Prometheus 监控',
    tags: ['Go', 'gRPC', 'Redis'],
    stars: 420,
    category: 'Backend',
  },
  {
    id: '6',
    name: 'PyTorch Training',
    description: '深度学习训练框架，支持分布式训练和模型导出',
    tags: ['Python', 'PyTorch', 'CUDA'],
    stars: 310,
    category: 'AI/ML',
  },
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  'Node.js':      { bg: 'rgba(104,160,99,0.12)',  text: '#3d7a38' },
  'React':        { bg: 'rgba(97,218,251,0.12)',   text: '#0e8fa8' },
  'Next.js':      { bg: 'rgba(0,0,0,0.07)',        text: '#333' },
  'Python':       { bg: 'rgba(55,118,171,0.12)',   text: '#1e5f99' },
  'FastAPI':      { bg: 'rgba(0,150,136,0.12)',    text: '#007a6e' },
  'PostgreSQL':   { bg: 'rgba(51,103,145,0.12)',   text: '#1e5f8a' },
  'React Native': { bg: 'rgba(97,218,251,0.12)',   text: '#0e8fa8' },
  'Expo':         { bg: 'rgba(0,0,32,0.07)',       text: '#333' },
  'TypeScript':   { bg: 'rgba(49,120,198,0.12)',   text: '#1a5fa8' },
  'Vue':          { bg: 'rgba(66,184,131,0.12)',   text: '#2a8a5e' },
  'ECharts':      { bg: 'rgba(170,52,77,0.10)',    text: '#aa344d' },
  'Go':           { bg: 'rgba(0,173,216,0.12)',    text: '#007a99' },
  'gRPC':         { bg: 'rgba(36,76,90,0.10)',     text: '#244c5a' },
  'Redis':        { bg: 'rgba(220,56,45,0.10)',    text: '#b02a22' },
  'PyTorch':      { bg: 'rgba(238,76,44,0.10)',    text: '#c03a1e' },
  'CUDA':         { bg: 'rgba(118,185,0,0.10)',    text: '#4a7a00' },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Web':     { bg: 'rgba(124,98,255,0.10)', text: '#7C62FF' },
  'Backend': { bg: 'rgba(0,150,136,0.10)',  text: '#007a6e' },
  'Mobile':  { bg: 'rgba(97,218,251,0.12)', text: '#0e8fa8' },
  'AI/ML':   { bg: 'rgba(238,76,44,0.10)',  text: '#c03a1e' },
};

type App = typeof MOCK_APPS[0];

function AppCard({ app, onDeploy }: { app: App; onDeploy: (app: App) => void }) {
  const catColor = CATEGORY_COLORS[app.category] ?? { bg: 'rgba(124,98,255,0.10)', text: '#7C62FF' };
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.appName}>{app.name}</Text>
        <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
          <Text style={[styles.categoryText, { color: catColor.text }]}>{app.category}</Text>
        </View>
      </View>

      <Text style={styles.description}>{app.description}</Text>

      <View style={styles.tags}>
        {app.tags.map((tag) => {
          const c = TAG_COLORS[tag] ?? { bg: 'rgba(124,98,255,0.10)', text: '#7C62FF' };
          return (
            <View key={tag} style={[styles.tag, { backgroundColor: c.bg }]}>
              <Text style={[styles.tagText, { color: c.text }]}>{tag}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.stars}>⭐ {app.stars.toLocaleString()}</Text>
        <TouchableOpacity
          style={styles.deployButton}
          onPress={() => onDeploy(app)}
          activeOpacity={0.8}
        >
          <Text style={styles.deployButtonText}>一键部署</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function Gallery() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const filtered = MOCK_APPS.filter(
    (app) =>
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.description.includes(search) ||
      app.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDeploy = (app: App) => {
    Alert.alert('部署确认', `确定要部署 ${app.name} 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定部署',
        onPress: () => {
          deployIntentStore.set(`帮我部署 ${app.name}，技术栈：${app.tags.join('、')}`);
          router.push('/(tabs)/chat');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* 搜索栏 */}
      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索应用、技术栈..."
          placeholderTextColor="rgba(73,74,100,0.45)"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 结果数 */}
      <Text style={styles.resultCount}>{filtered.length} 个应用</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AppCard app={item} onDeploy={handleDeploy} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔭</Text>
            <Text style={styles.emptyText}>没有找到匹配的应用</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F2FF',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(124,98,255,0.18)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 12px rgba(124,98,255,0.08)' } as any)
      : {
          shadowColor: '#7C62FF',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }),
  },
  searchIcon: { fontSize: 16, marginRight: 8, opacity: 0.5 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#494A64',
    padding: 0,
  },
  clearIcon: { fontSize: 14, color: 'rgba(73,74,100,0.4)', paddingLeft: 8 },
  resultCount: {
    fontSize: 12,
    color: 'rgba(73,74,100,0.5)',
    marginHorizontal: 20,
    marginBottom: 8,
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(200,200,220,0.4)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 16px rgba(124,98,255,0.06)' } as any)
      : {
          shadowColor: '#7C62FF',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 2,
        }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    color: 'rgba(73,74,100,0.75)',
    lineHeight: 20,
    marginBottom: 12,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  tag: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stars: {
    fontSize: 13,
    color: 'rgba(73,74,100,0.5)',
  },
  deployButton: {
    backgroundColor: '#7C62FF',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 12px rgba(124,98,255,0.35)' } as any)
      : {
          shadowColor: '#7C62FF',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 4,
        }),
  },
  deployButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyEmoji: { fontSize: 40 },
  emptyText: {
    fontSize: 15,
    color: 'rgba(73,74,100,0.5)',
  },
});
