import { useCallback, useRef, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ApiError, type components } from '@intellideploy/api-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { phase1Api } from '../../services/api';
import { ProductAction, ProductActions, ProductFolder, ProductMessage, ProductPage } from '../../features/products/ProductFolder';
import { ProductList } from '../../features/products/ProductList';
import { getAppStatusLabel, partitionApps } from '../../features/products/productViewModel';

type AppPage = components['schemas']['AppPage'];
export default function AppGalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<'created' | 'copies'>('created');
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<AppPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const load = useCallback(async () => {
    const request = ++epoch.current;
    setLoading(true); setError(''); setBusy(false);
    try {
      const value = await phase1Api.listMyApps();
      if (request === epoch.current) setData(value);
    } catch (cause) {
      if (request !== epoch.current) return;
      if (cause instanceof ApiError && cause.status === 401) router.replace({ pathname: '/login', params: { next: '/app-gallery' } });
      else setError('应用暂时无法加载，请重试');
    } finally { if (request === epoch.current) setLoading(false); }
  }, [router]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { epoch.current++; };
  }, [load]));
  async function more() {
    if (busy || loading || !data?.next_cursor) return;
    const request = epoch.current;
    setBusy(true); setError('');
    try {
      const next = await phase1Api.listMyApps(data.next_cursor);
      if (request === epoch.current) setData({ ...next, items: [...data.items, ...next.items] });
    } catch (cause) {
      if (request !== epoch.current) return;
      if (cause instanceof ApiError && cause.status === 401) router.replace({ pathname: '/login', params: { next: '/app-gallery' } });
      else setError('更多应用加载失败，可再次加载');
    } finally { if (request === epoch.current) setBusy(false); }
  }
  const items = partitionApps(data?.items ?? [])[category];
  function select(next: 'created' | 'copies') { setCategory(next); setExpanded(false); }
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <ProductPage title="我的产品" subtitle={category === 'created' ? '点击查看我创建的应用' : '点击查看我的应用副本'} insets={insets} onBack={() => router.push('/')} testID="mobile-products">
      {loading && <ProductMessage>正在读取应用…</ProductMessage>}
      {Boolean(error) && <ProductMessage alert>{error}</ProductMessage>}
      {!loading && Boolean(error) && !data && <ProductAction label="重试" onPress={() => void load()} />}
      {data && <ProductFolder id={category} title={category === 'created' ? '我创建的' : '我的副本'} items={items} expanded={expanded} hasMore={Boolean(data.next_cursor)} onToggle={() => setExpanded(value => !value)} />}
      <ProductActions>
        <ProductAction label="我创建的" selected={category === 'created'} onPress={() => select('created')} />
        <ProductAction label="我的副本" selected={category === 'copies'} onPress={() => select('copies')} />
        <ProductAction label="我的收藏" onPress={() => router.push({ pathname: '/library/[kind]', params: { kind: 'favorites' } })} />
        <ProductAction label="最近使用" onPress={() => router.push({ pathname: '/library/[kind]', params: { kind: 'recent' } })} />
      </ProductActions>
      {data && expanded && <ProductList items={items.map(app => ({ id: app.id, name: app.name, status: getAppStatusLabel(app) }))} onOpen={id => router.push({ pathname: '/app-detail/[id]', params: { id } })} />}
      {Boolean(data?.next_cursor) && <ProductActions><ProductAction label={busy ? '加载中…' : '加载更多'} disabled={busy || loading} onPress={() => void more()} testID="products-load-more" /></ProductActions>}
      <ProductActions><ProductAction label="新建应用" onPress={() => router.push('/chatbot')} /></ProductActions>
    </ProductPage>
  </>;
}
