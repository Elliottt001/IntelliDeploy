import { useCallback, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { ApiError } from '@intellideploy/api-client';
import { authAPI, phase1Api } from '../../services/api';
import { clearDraft, readDraft, saveDraft } from '../../services/workspaceStorage';
import WorkspacePage, { Action, workspaceStyles as styles } from '../../components/WorkspacePage';

export default function ChatbotScreen() {
  const router = useRouter();
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
        setOwnerId(user.id); setDraftKey(key); setPrompt(draft?.content ?? ''); setLastApp(last); setRule(policy.failed_usage_rule); setBalance(quota.available_units); setError('');
      } catch (exc) { if (active) setError(exc instanceof Error ? exc.message : '无法恢复需求，请稍后重试'); }
    }
    void restore();
    return () => { active = false; };
  }, []));
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
  return <WorkspacePage title="把你的想法变成应用"><View style={styles.card}><Text style={styles.text}>告诉 Mibo 你想解决什么问题，完成后会在这里提供使用入口。</Text><Text style={styles.muted}>{balance === null ? '正在读取账户额度…' : `可用额度：${balance}`}</Text>{Boolean(rule) && <Text style={styles.muted}>{rule}</Text>}<TextInput accessibilityLabel="你想做什么应用" testID="create-prompt" multiline maxLength={20000} value={prompt} editable={!busy && Boolean(draftKey)} style={styles.input} placeholder="例如：记录梦境，用 AI 分析并保存历史" onChangeText={value => { setPrompt(value); if (draftKey) void saveDraft(draftKey, value).catch(() => setError('草稿未能保存，请稍后重试')); }} />{Boolean(error) && <Text testID="workspace-error" accessibilityRole="alert" style={styles.error}>{error}</Text>}<Action label={busy ? '正在提交' : '开始创建'} testID="create-app" onPress={() => { void create(); }} disabled={busy || !draftKey || !prompt.trim()} />{lastApp && <Action label="继续上次的应用" testID="last-app" onPress={() => router.push({ pathname: '/app-detail/[id]', params: { id: lastApp } })} />}</View></WorkspacePage>;
}
