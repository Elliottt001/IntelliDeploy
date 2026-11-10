import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { phase1Api } from '../../services/api';
import WorkspacePage, { Action, workspaceStyles as styles } from '../../components/WorkspacePage';

export default function BillingScreen() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAccount>> | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    loadAccount().then(value => { if (active) { setData(value); setError(''); } }).catch(exc => { if (active) setError(exc.message ?? '无法读取额度'); });
    return () => { active = false; };
  }, [revision]));
  return <WorkspacePage title="额度与用量">{Boolean(error) && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!data && !error && <Text style={styles.text}>正在读取额度…</Text>}{data && <><View style={styles.card}><Text style={styles.title}>可用额度：{data.balance.available_units}</Text><Text style={styles.text}>执行预留：{data.balance.reserved_units}</Text><Text style={styles.muted}>{data.policy.failed_usage_rule}</Text>{data.subscription && <Text style={styles.text}>当前套餐状态：{data.subscription.status}，到期时间：{data.subscription.period_end}</Text>}</View><View style={styles.card}><Text style={styles.title}>用量记录</Text>{data.usage.items.length === 0 && <Text style={styles.muted}>暂无已结算用量。</Text>}{data.usage.items.map(item => <Text key={item.id} style={styles.text}>{item.kind} · {item.cost_units} 额度 · {item.created_at}</Text>)}</View></>}<Action label="刷新额度" onPress={() => setRevision(value => value + 1)} /></WorkspacePage>;
}

async function loadAccount() {
  const [balance, policy, usage, subscription] = await Promise.all([phase1Api.getBalance(), phase1Api.getPolicy(), phase1Api.listUsage(), phase1Api.getSubscription()]);
  return { balance, policy, usage, subscription };
}
