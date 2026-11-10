import { useState } from 'react';
import { Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { type components } from '@intellideploy/api-client';
import { Action, workspaceStyles as styles } from './WorkspacePage';

export default function DeliveryCard({ app }: { app: components['schemas']['AppDetail'] }) {
  const [error, setError] = useState('');
  const delivery = app.delivery;
  if (!delivery) return null;
  async function open() {
    try { await Linking.openURL(delivery!.url); }
    catch { setError('暂时无法打开应用，请稍后重试。'); }
  }
  return <View style={styles.card}><Text style={styles.title}>你的应用</Text><Text style={styles.text}>{delivery.summary}</Text>{delivery.features.map(feature => <Text key={feature} style={styles.text}>· {feature}</Text>)}{app.instance_status === 'RUNNING' && <Action label="打开应用" testID="open-app" onPress={() => { void open(); }} />}{app.instance_status === 'STOPPED' && <Text style={styles.muted}>应用已停止，数据仍保留。</Text>}{app.instance_status === 'FAILED' && <Text style={styles.error}>当前实例暂不可用，历史交付记录仍保留。</Text>}{Boolean(error) && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}</View>;
}
