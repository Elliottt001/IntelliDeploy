import { GlassCard } from './mobile/GlassCard';
import { ErrorState } from './mobile/ErrorState';
import { useState } from 'react';
import { Text } from 'react-native';
import * as Linking from 'expo-linking';
import { type components } from '@intellideploy/api-client';
import {phase1Api} from '../services/api';
import { Action, workspaceStyles as styles } from './WorkspacePage';

export default function DeliveryCard({ app }: { app: components['schemas']['AppDetail'] }) {
  const [error, setError] = useState('');
  const delivery = app.delivery;
  if (!delivery) return null;
  async function open() {
    try { const callback=new URL('/api/platform/callback',delivery!.url).href;const {code}=await phase1Api.issueLoginCode(delivery!.instance_id,callback);const url=new URL(callback);url.searchParams.set('code',code);await Linking.openURL(url.href); }
    catch { setError('暂时无法打开应用，请稍后重试。'); }
  }
  return <GlassCard style={{ gap: 12 }}><Text style={styles.title}>你的应用</Text><Text style={styles.text}>{delivery.summary}</Text>{delivery.features.map(feature => <Text key={feature} style={styles.text}>· {feature}</Text>)}{app.instance_status === 'RUNNING' && <Action label="打开应用" testID="open-app" onPress={() => { void open(); }} />}{app.instance_status === 'STOPPED' && <Text style={styles.muted}>应用已停止，数据仍保留。</Text>}{app.instance_status === 'FAILED' && <Text style={styles.error}>当前实例暂不可用，历史交付记录仍保留。</Text>}{Boolean(error) && <ErrorState message={error} title="操作未完成" />}</GlassCard>;
}
