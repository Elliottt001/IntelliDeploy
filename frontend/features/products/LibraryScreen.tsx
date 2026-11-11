import { useCallback, useRef, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ApiError, type components } from '@intellideploy/api-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { phase1Api } from '../../services/api';
import { ProductAction, ProductActions, ProductFolder, ProductMessage, ProductPage } from './ProductFolder';
import { ProductList } from './ProductList';
import type { LibraryKind } from './productViewModel';

type PublicationPage = components['schemas']['PublicationPage'];
export default function LibraryScreen({ kind }: { kind: LibraryKind }) {
  const router = useRouter(); const insets = useSafeAreaInsets();
  const [data, setData] = useState<PublicationPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const epoch = useRef(0);
  const read = kind === 'favorites' ? phase1Api.listFavorites : phase1Api.listRecentApps;
  const nextPath = `/library/${kind}`;
  const title = kind === 'favorites' ? '我的收藏' : '最近使用';
  const load = useCallback(async () => {
    const request = ++epoch.current;
    setData(null); setError(''); setLoading(true); setBusy(false); setExpanded(false);
    try {
      const value = await read();
      if (request === epoch.current) setData(value);
    } catch (cause) {
      if (request !== epoch.current) return;
      if (cause instanceof ApiError && cause.status === 401) router.replace({ pathname: '/login', params: { next: nextPath } });
      else setError('应用暂时无法加载，请重试');
    } finally { if (request === epoch.current) setLoading(false); }
  }, [read, router, nextPath]);
  useFocusEffect(useCallback(() => {
    void load(); return () => { epoch.current++; };
  }, [load]));
  async function more() {
    if (busy || loading || !data?.next_cursor) return;
    const request = epoch.current; setBusy(true); setError('');
    try {
      const value = await read(data.next_cursor);
      if (request === epoch.current) setData({ ...value, items: [...data.items, ...value.items] });
    } catch (cause) {
      if (request !== epoch.current) return;
      if (cause instanceof ApiError && cause.status === 401) router.replace({ pathname: '/login', params: { next: nextPath } });
      else setError('更多应用加载失败，可再次加载');
    } finally { if (request === epoch.current) setBusy(false); }
  }
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <ProductPage title={title} subtitle={kind === 'favorites' ? '点击查看我收藏的应用' : '按最近使用的顺序查看公开应用'} insets={insets} onBack={() => router.push('/app-gallery')} testID={`mobile-library-${kind}`}>
      {loading && <ProductMessage>正在读取应用…</ProductMessage>}
      {Boolean(error) && <ProductMessage alert>{error}</ProductMessage>}
      {!loading && Boolean(error) && !data && <ProductAction label="重试" onPress={() => void load()} />}
      {data && <ProductFolder id={kind} title={title} items={data.items} expanded={expanded} hasMore={Boolean(data.next_cursor)} onToggle={() => setExpanded(value => !value)} />}
      {data && expanded && <ProductList items={data.items.map(item => ({ id: item.id, name: item.name, summary: item.summary, creator: item.creator, status: item.available ? '应用正在运行' : '应用暂不可用' }))} onOpen={id => router.push({ pathname: '/community/[id]', params: { id } })} />}
      {Boolean(data?.next_cursor) && <ProductActions><ProductAction label={busy ? '加载中…' : '加载更多'} disabled={busy || loading} onPress={() => void more()} testID="library-load-more" /></ProductActions>}
    </ProductPage>
  </>;
}
