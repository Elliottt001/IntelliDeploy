import { useCallback, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError } from '@intellideploy/api-client';
import { authAPI, phase1Api } from '../../services/api';
import { clearDraft, readDraft, saveDraft } from '../../services/workspaceStorage';
import { ChatbotPage, CreateWorkspaceView } from '../../features/chatbot/CreateWorkspaceView';

export default function ChatbotScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string | string[] }>();
  const selectedPrompt = typeof params.prompt === 'string' && params.prompt.length <= 4000 ? params.prompt : '';
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [lastApp, setLastApp] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [rule, setRule] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    async function restore() {
      try {
        const user = (await authAPI.getMe()).data;
        const key = `intellideploy:${user.id}:create`;
        const [draft, last, policy, quota] = await Promise.all([readDraft(key), AsyncStorage.getItem(`intellideploy:${user.id}:last-app`), phase1Api.getPolicy(), phase1Api.getBalance()]);
        if (!active) return;
        setOwnerId(user.id); setDraftKey(key); setPrompt(draft?.content || selectedPrompt); setLastApp(last); setRule(policy.failed_usage_rule); setBalance(quota.available_units); setError('');
      } catch (exc) { if (active) setError(exc instanceof Error ? exc.message : '无法恢复需求，请稍后重试'); }
    }
    void restore();
    return () => { active = false; };
  }, [selectedPrompt]));
  async function create() {
    if (submitting.current || !draftKey || !prompt.trim()) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const draft = await saveDraft(draftKey, prompt);
      const result = await phase1Api.createApp(draft.content, undefined, draft.operationId);
      await AsyncStorage.setItem(`intellideploy:${ownerId}:last-app`, result.app_id);
      await clearDraft(draftKey, draft.operationId);
      router.push({ pathname: '/app-detail/[id]', params: { id: result.app_id } });
    } catch (exc) {
      if (exc instanceof ApiError && exc.status === 401) router.replace({ pathname: '/login', params: { next: '/chatbot' } });
      else setError(exc instanceof Error ? exc.message : '暂时无法提交，重试会保留原请求');
    } finally { submitting.current = false; setBusy(false); }
  }
  return <ChatbotPage insets={insets} onBack={() => router.back()} onProducts={() => router.push('/app-gallery')} onBilling={() => router.push('/billing')}>
    <CreateWorkspaceView prompt={prompt} quotaText={balance === null ? '正在读取账户额度…' : `可用额度：${balance}`}
      policyText={rule} lastApp={lastApp} busy={busy} editable={Boolean(draftKey)} error={error}
      onChangePrompt={value => { setPrompt(value); if (draftKey) void saveDraft(draftKey, value).catch(() => setError('草稿未能保存，请稍后重试')); }}
      onCreate={() => { void create(); }} onContinue={() => { if (lastApp) router.push({ pathname: '/app-detail/[id]', params: { id: lastApp } }); }} />
  </ChatbotPage>;
}
