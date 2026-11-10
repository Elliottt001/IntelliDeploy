import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { type components } from '@intellideploy/api-client';
import { phase1Api } from '../../services/api';
import WorkspacePage, { Action, workspaceStyles as styles } from '../../components/WorkspacePage';

export default function AppGalleryScreen() {
  const router = useRouter();
  const [data, setData] = useState<components['schemas']['AppPage'] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    phase1Api.listMyApps().then(value => { if (active) { setData(value); setError(''); } }).catch(exc => { if (active) setError(exc.message ?? '无法读取应用'); });
    return () => { active = false; };
  }, []));
  async function more() {
    if (busy || !data?.next_cursor) return;
    setBusy(true);
    try { const next = await phase1Api.listMyApps(data.next_cursor); setData({ ...next, items: [...data.items, ...next.items] }); }
    catch (exc) { setError(exc instanceof Error ? exc.message : '无法读取更多应用'); }
    finally { setBusy(false); }
  }
  return <WorkspacePage title="我的应用">{Boolean(error) && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!data && !error && <Text style={styles.text}>正在读取应用…</Text>}{data?.items.length === 0 && <Text style={styles.text}>还没有应用，先描述一个想解决的问题。</Text>}{data?.items.map(app => <View key={app.id} style={styles.card}><Action label={app.name} onPress={() => router.push({ pathname: '/app-detail/[id]', params: { id: app.id } })} /><Text style={styles.muted}>{app.active_job_id ? '正在处理需求' : app.instance_status === 'RUNNING' ? '应用正在运行' : app.instance_status === 'STOPPED' ? '应用已停止，数据仍保留' : '查看状态与结果'}</Text></View>)}{data?.next_cursor && <Action label="加载更多" disabled={busy} onPress={() => { void more(); }} />}</WorkspacePage>;
}
