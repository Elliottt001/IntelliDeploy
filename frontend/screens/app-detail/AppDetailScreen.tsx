import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { ApiError, type components } from '@intellideploy/api-client';
import { authAPI, phase1Api } from '../../services/api';
import { subscribeJob } from '../../services/jobPolling';
import { clearDraft, readDraft, saveDraft } from '../../services/workspaceStorage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiboStage, JobProgress } from '../../components/mobile';
import { ChatbotPage, viewStyles as styles } from '../../features/chatbot/CreateWorkspaceView';
import { AppConversationView } from '../../features/chatbot/AppConversationView';
import { getJobVisualState } from '../../features/chatbot/jobVisualState';
import DeliveryCard from '../../components/DeliveryCard';
import InstanceControls from '../../components/InstanceControls';
import PublicationSettings from '../../components/PublicationSettings';

export default function AppDetailScreen({ appId }: { appId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const jobState = getJobVisualState(job ?? null);
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

  async function rereadAfterConflict(scope: symbol | null) {
    setEpoch(value => value + 1);
    try {
      const detail = await phase1Api.getApp(appId);
      if (scope === focusScope.current) setApp(detail);
    } catch (readError) {
      if (scope === focusScope.current && readError instanceof ApiError && readError.status === 401) login();
    }
  }

  async function send() {
    if (submitting.current || !jobState.canCompose || !draftKey || !content.trim()) return;
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
        if (exc instanceof ApiError && [402, 409].includes(exc.status)) await rereadAfterConflict(scope);
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
      else {
        setError(exc instanceof Error ? exc.message : '操作暂时未完成');
        if (exc instanceof ApiError && [402, 409].includes(exc.status)) await rereadAfterConflict(scope);
      }
    } finally { submitting.current = false; setBusy(false); }
  }

  return <ChatbotPage insets={insets} onBack={() => router.back()} onProducts={() => router.push('/app-gallery')} onBilling={() => router.push('/billing')}>
    {!app && !error && <Text style={styles.caption}>正在读取应用…</Text>}
    {Boolean(error) && <Text testID="workspace-error" accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {Boolean(networkError) && <Text testID="network-retry" accessibilityRole="alert" style={styles.error}>{networkError}</Text>}
    {app && <>
      <MiboStage state={jobState} question={job?.question} errorMessage={job?.error?.message} />
      <JobProgress state={jobState} testID="job-status" />
      <AppConversationView app={app} jobState={jobState} conversation={app.conversation}
        content={content} editable={Boolean(draftKey)} busy={busy}
        onChangeContent={value => { setContent(value); if (draftKey) void saveDraft(draftKey, value).catch(() => setError('草稿未能保存，请稍后重试')); }}
        onSend={() => { void send(); }} onRefresh={() => setEpoch(value => value + 1)}
        onResume={() => { void action('resume'); }} onCancel={() => { void action('cancel'); }}
        onBilling={() => router.push('/billing')} onRestart={() => router.push('/chatbot')} />
      <View testID="app-detail-secondary" style={{ gap: 14 }}>
        <DeliveryCard app={app} /><InstanceControls app={app} reload={reload} /><PublicationSettings app={app} reload={reload} />
      </View>
    </>}
  </ChatbotPage>;
}
