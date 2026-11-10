import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { ApiError, type components } from '@intellideploy/api-client';
import { authAPI, phase1Api } from '../../services/api';
import { subscribeJob } from '../../services/jobPolling';
import { clearDraft, readDraft, saveDraft } from '../../services/workspaceStorage';
import WorkspacePage, { Action, workspaceStyles as styles } from '../../components/WorkspacePage';
import DeliveryCard from '../../components/DeliveryCard';
import InstanceControls from '../../components/InstanceControls';
import PublicationSettings from '../../components/PublicationSettings';

const phases: Record<string, string> = { clarifying: '正在理解需求', retrieving: '正在准备应用', implementing: '正在实现应用', building: '正在准备应用', validating: '正在验证功能', deploying: '正在发布应用', verifying_live: '正在验证使用入口', completed: '应用已交付' };
const states: Record<string, string> = { WAITING_USER: '需要你补充一点信息', PAUSED_QUOTA: '额度不足，任务已暂停', FAILED: '本次调整未完成', CANCELLED: '任务已取消', SUCCEEDED: '应用已交付' };

export default function AppDetailScreen({ appId }: { appId: string }) {
  const router = useRouter();
  const [app, setApp] = useState<components['schemas']['AppDetail'] | null>(null);
  const [content, setContent] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [focused, setFocused] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const focusScope = useRef<symbol | null>(null);
  const job = app?.active_job ?? app?.latest_job;
  const running = Boolean(app?.active_job && ['QUEUED', 'RUNNING'].includes(app.active_job.status));
  const login = useCallback(() => router.replace({ pathname: '/login', params: { next: `/app-detail/${appId}` } }), [appId, router]);
  const reload=useCallback(async()=>{const detail=await phase1Api.getApp(appId);if(mounted.current)setApp(detail);},[appId]);

  useFocusEffect(useCallback(() => {
    const scope = Symbol();
    focusScope.current = scope;
    mounted.current = true; setFocused(true);
    setApp(null); setDraftKey(''); setError(''); setNetworkError(''); setBusy(submitting.current);
    const controller = new AbortController();
    async function restore() {
      try {
        const user = (await authAPI.getMe()).data;
        const key = `intellideploy:${user.id}:message:${appId}`;
        const [detail, draft] = await Promise.all([phase1Api.getApp(appId, controller.signal), readDraft(key)]);
        if (!mounted.current || controller.signal.aborted) return;
        setApp(detail); setContent(draft?.content ?? ''); setDraftKey(key); setError('');
        await AsyncStorage.setItem(`intellideploy:${user.id}:last-app`, appId);
      } catch (exc) {
        if (!mounted.current || controller.signal.aborted) return;
        if (exc instanceof ApiError && exc.status === 401) login();
        else setError(exc instanceof Error ? exc.message : '无法读取应用');
      }
    }
    void restore();
    return () => { mounted.current = false; focusScope.current = null; setFocused(false); controller.abort(); };
  }, [appId, login]));

  useEffect(() => {
    if (!focused || !job) return;
    return subscribeJob(job.id, async (_snapshot, signal) => {
      const detail = await phase1Api.getApp(appId, signal);
      if (mounted.current && !signal.aborted) { setApp(detail); setNetworkError(''); }
    }, { readJob: phase1Api.getJob, appState: AppState, onUnauthorized: login, onError: () => setNetworkError('网络连接暂时中断，正在重试。任务进度仍保存在平台。') });
  }, [focused, job?.id, appId, login, epoch]);

  async function send() {
    if (submitting.current || running || !draftKey || !content.trim()) return;
    const scope = focusScope.current;
    submitting.current = true; setBusy(true); setError('');
    try {
      const draft = await saveDraft(draftKey, content);
      await phase1Api.sendMessage(appId, draft.content, draft.operationId);
      await clearDraft(draftKey, draft.operationId);
      if (scope === focusScope.current) {
        setContent(''); setEpoch(value => value + 1);
        const detail = await phase1Api.getApp(appId);
        if (scope === focusScope.current) setApp(detail);
      }
    } catch (exc) {
      if (scope !== focusScope.current) return;
      if (exc instanceof ApiError && exc.status === 401) login();
      else {
        setError(exc instanceof Error ? exc.message : '暂时无法发送，请稍后重试');
        if (exc instanceof ApiError && exc.status === 409) setEpoch(value => value + 1);
      }
    } finally { submitting.current = false; setBusy(false); }
  }
  async function action(kind: 'resume' | 'cancel') {
    if (!job || submitting.current) return;
    const scope = focusScope.current;
    submitting.current = true; setBusy(true); setError('');
    try {
      const key = `intellideploy:action:${appId}:${job.id}:${kind}`;
      const draft = await readDraft(key) ?? await saveDraft(key, randomUUID());
      if (kind === 'resume') await phase1Api.resumeJob(job.id, draft.operationId);
      else await phase1Api.cancelJob(job.id, draft.operationId);
      await clearDraft(key, draft.operationId);
      if (scope === focusScope.current) {
        setEpoch(value => value + 1);
        const detail = await phase1Api.getApp(appId);
        if (scope === focusScope.current) setApp(detail);
      }
    } catch (exc) {
      if (scope !== focusScope.current) return;
      if (exc instanceof ApiError && exc.status === 401) login();
      else setError(exc instanceof Error ? exc.message : '操作暂时未完成');
    } finally { submitting.current = false; setBusy(false); }
  }

  return <WorkspacePage title={app?.name ?? '应用与对话'}>{!app && !error && <Text style={styles.text}>正在读取应用…</Text>}{Boolean(error) && <Text testID="workspace-error" accessibilityRole="alert" style={styles.error}>{error}</Text>}{Boolean(networkError) && <Text accessibilityRole="alert" style={styles.error}>{networkError}</Text>}{app && <>{job && <View style={styles.card}><Text testID="job-status" style={styles.text}>{states[job.status] ?? phases[job.phase] ?? '正在处理需求'}</Text>{job.question && <Text style={styles.text}>{job.question}</Text>}{job.error && <Text style={styles.error}>{job.error.message}</Text>}<Text style={styles.muted}>本次已使用 {job.usage_units} 额度</Text><View style={styles.actions}>{running && <Action label="取消任务" testID="cancel-job" disabled={busy} onPress={() => { void action('cancel'); }} />}{job.status === 'PAUSED_QUOTA' && <><Action label="额度与用量" onPress={() => router.push('/billing')} /><Action label="恢复任务" testID="resume-job" disabled={busy} onPress={() => { void action('resume'); }} /></>}<Action label="刷新状态" testID="refresh-job" onPress={() => setEpoch(value => value + 1)} /></View></View>}<DeliveryCard app={app} /><InstanceControls app={app} reload={reload}/><PublicationSettings app={app} reload={reload}/><View style={styles.card}><Text style={styles.title}>需求与调整</Text>{app.conversation.map(message => <View key={message.id}><Text style={styles.muted}>{message.role === 'user' ? '你' : 'Mibo'}</Text><Text style={styles.text}>{message.content}</Text></View>)}{app.publication&&<Text style={styles.muted}>此次调整通过后将同步更新社区中的应用。</Text>}<TextInput accessibilityLabel="继续对话" testID="message-input" multiline maxLength={20000} value={content} editable={!busy && Boolean(draftKey)} style={styles.input} placeholder="补充需求或继续调整" onChangeText={value => { setContent(value); if (draftKey) void saveDraft(draftKey, value).catch(() => setError('草稿未能保存，请稍后重试')); }} />{running && <Text style={styles.muted}>正在处理上一项需求，你可以先保存想法，完成后再发送。</Text>}<Action label={busy ? '正在提交' : '发送'} testID="send-message" disabled={busy || running || !draftKey || !content.trim()} onPress={() => { void send(); }} /></View></>}</WorkspacePage>;
}
