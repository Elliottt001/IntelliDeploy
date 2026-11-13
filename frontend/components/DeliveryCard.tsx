import { GlassCard } from './mobile/GlassCard';
import { ErrorState } from './mobile/ErrorState';
import { useState } from 'react';
import { Text } from 'react-native';
import * as Linking from 'expo-linking';
import { type components } from '@intellideploy/api-client';
import {phase1Api} from '../services/api';
import {openDelivery} from '../services/openDelivery';
import { Action, workspaceStyles as styles } from './WorkspacePage';

export default function DeliveryCard({ app }: { app: components['schemas']['AppDetail'] }) {
  const [error, setError] = useState('');
  const [report, setReport] = useState<components['schemas']['JobReport'] | null>(null);
  const delivery = app.delivery;
  if (!delivery) return null;
  async function open() {
    try { await openDelivery(delivery!,phase1Api.issueLoginCode,Linking.openURL); }
    catch { setError('暂时无法打开应用，请稍后重试。'); }
  }
  async function inspectReport(){
    if(!delivery||delivery.kind!=='EXTERNAL_LINK')return;
    try{
      const value=await phase1Api.getReport(delivery.job_id);
      if(value.job_id!==delivery.job_id)throw new Error('报告不属于当前交付');
      setReport(value);
    }catch{setError('暂时无法读取报告，请稍后重试。');}
  }
  if(delivery.kind==='EXTERNAL_LINK')return <GlassCard style={{gap:12}}><Text style={styles.title}>第三方官方服务</Text><Text style={styles.text}>{delivery.summary}</Text>{delivery.features.map(feature=><Text key={feature} style={styles.text}>· {feature}</Text>)}{delivery.differences?.map(difference=><Text key={difference} style={styles.muted}>{difference}</Text>)}<Action label="打开官方服务" testID="open-official-service" onPress={()=>void open()}/><Action label="查看来源仓库" onPress={()=>void Linking.openURL(delivery.repo_url)}/><Action label="查看验证报告" onPress={()=>void inspectReport()}/>{report&&<Text style={styles.text}>核心功能：{report.overall==='PASS'?'通过':'尚未全部验证'}</Text>}{Boolean(error)&&<ErrorState message={error} title="操作未完成"/>}</GlassCard>;
  return <GlassCard style={{ gap: 12 }}><Text style={styles.title}>你的应用</Text><Text style={styles.text}>{delivery.summary}</Text>{delivery.features.map(feature => <Text key={feature} style={styles.text}>· {feature}</Text>)}{delivery.differences?.map(difference=><Text key={difference} style={styles.muted}>{difference}</Text>)}{app.instance_status === 'RUNNING' && <Action label="打开应用" testID="open-app" onPress={() => { void open(); }} />}{app.instance_status === 'STOPPED' && <Text style={styles.muted}>应用已停止，数据仍保留。</Text>}{app.instance_status === 'FAILED' && <Text style={styles.error}>当前实例暂不可用，历史交付记录仍保留。</Text>}{Boolean(error) && <ErrorState message={error} title="操作未完成" />}</GlassCard>;
}
