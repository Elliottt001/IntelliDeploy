import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import WorkspacePage, { Action, workspaceStyles as styles } from '../../components/WorkspacePage';
import { GlassCard } from '../../components/mobile/GlassCard';
import { ErrorState } from '../../components/mobile/ErrorState';
import { VisualPendingSection } from '../../components/mobile/VisualPendingSection';
import { sanitizeNextPath } from '../../features/navigation/routePolicy';
import { authAPI } from '../../services/api';

function getRegisterErrorMessage(error: unknown): string {
  const maybeResponse = error as { response?: { data?: { error?: { message?: string }; detail?: string } } };
  return maybeResponse.response?.data?.error?.message || maybeResponse.response?.data?.detail || '注册失败，请稍后重试';
}

export default function RegisterScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string | string[] }>();
  const safeNextPath = sanitizeNextPath(next);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canSubmit = useMemo(
    () =>
      agreePrivacy &&
      username.trim().length > 0 &&
      email.trim().length > 0 &&
      password.trim().length > 0 &&
      confirmPassword.trim().length > 0 &&
      !loading,
    [agreePrivacy, confirmPassword, email, loading, password, username]
  );

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('请填写所有必填字段');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!agreePrivacy) {
      setError('请先同意隐私协议');
      return;
    }

    setLoading(true);
    try {
      await authAPI.register(username.trim(), email.trim(), password);
      const loginResponse = await authAPI.login(username.trim(), password);
      await authAPI.setToken(loginResponse.data.access_token);
      router.replace(safeNextPath as Href);
    } catch (error: unknown) {
      setError(getRegisterErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return <WorkspacePage title="创建账号，开启之旅！"><VisualPendingSection label="注册" route="/register">
    <Stack.Screen options={{ headerShown: false }} />
    <GlassCard style={{ gap: 12 }}>
      <Text style={styles.text}>在这里，实现你的奇思妙想</Text>
      <TextInput accessibilityLabel="用户名" value={username} onChangeText={setUsername} placeholder="用户名" autoCapitalize="none" autoCorrect={false} style={[styles.input, { minHeight: 44 }]} />
      <TextInput accessibilityLabel="邮箱" value={email} onChangeText={setEmail} placeholder="邮箱" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={[styles.input, { minHeight: 44 }]} />
      <TextInput accessibilityLabel="密码" value={password} onChangeText={setPassword} placeholder="密码" secureTextEntry style={[styles.input, { minHeight: 44 }]} />
      <TextInput accessibilityLabel="确认密码" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="确认密码" secureTextEntry style={[styles.input, { minHeight: 44 }]} />
      <Pressable accessibilityRole="checkbox" accessibilityLabel="同意隐私协议" accessibilityState={{ checked: agreePrivacy }} onPress={() => setAgreePrivacy(value => !value)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}><Text style={styles.text}>{agreePrivacy ? '已同意' : '点击即表示同意'}《隐私协议》</Text></Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="记住我" accessibilityState={{ checked: rememberMe }} onPress={() => setRememberMe(value => !value)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}><Text style={styles.text}>{rememberMe ? '已选择：记住我' : '记住我'}</Text></Pressable>
      {Boolean(error) && <ErrorState message={error} title="注册未完成" />}
      <Action label={loading ? '注册中...' : '立即注册'} onPress={() => { void handleRegister(); }} disabled={!canSubmit} />
      <View style={styles.actions}>{['Google', 'GitHub', 'Apple'].map(provider => <Action key={provider} label={`${provider} 注册（暂未开放）`} onPress={() => {}} disabled />)}</View>
      <Text style={styles.muted}>已有账号？</Text><Action label="立即登录" onPress={() => router.push({ pathname: '/login', params: { next: safeNextPath } })} />
    </GlassCard>
  </VisualPendingSection></WorkspacePage>;
}
