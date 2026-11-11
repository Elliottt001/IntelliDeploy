import { type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppBackground } from './mobile/AppBackground';
import { BrandHeader } from './mobile/BrandHeader';
import { mobileColors } from '../theme/tokens';

export function Action({ label, onPress, disabled = false, testID }: { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return <Pressable accessibilityRole="button" testID={testID} onPress={onPress} disabled={disabled} accessibilityState={{ disabled }} style={[workspaceStyles.button, disabled && { opacity: 0.5 }, { minHeight: 44, minWidth: 44 }]}><Text style={workspaceStyles.buttonText}>{label}</Text></Pressable>;
}

export default function WorkspacePage({ title, children }: PropsWithChildren<{ title: string }>) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return <AppBackground testID="workspace-background" insets={insets}>
    <KeyboardAvoidingView style={workspaceStyles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }}>
        <View style={workspaceStyles.content}>
          <BrandHeader testID="workspace-brand-header" />
          <View style={workspaceStyles.actions}><Action label="新建应用" onPress={() => router.push('/chatbot')} /><Action label="我的应用" onPress={() => router.push('/app-gallery')} /><Action label="应用社区" onPress={() => router.push('/community')} /><Action label="额度与用量" onPress={() => router.push('/billing')} /></View>
          <Text accessibilityRole="header" style={workspaceStyles.title}>{title}</Text>{children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </AppBackground>;
}

export const workspaceStyles = StyleSheet.create({
  page: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 16 },
  brand: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  title: { fontSize: 22, color: '#494A64', fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, gap: 12 },
  text: { color: '#494A64', fontSize: 16, lineHeight: 24 },
  muted: { color: mobileColors.muted, fontSize: 14, lineHeight: 22 },
  error: { color: '#B42318', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#A3B2FF', borderRadius: 12, padding: 12, minHeight: 110, color: '#494A64', backgroundColor: '#FFFFFF', fontSize: 16, textAlignVertical: 'top' },
  button: { backgroundColor: '#7C62FF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignSelf: 'flex-start', justifyContent: 'center', alignItems: 'center', maxWidth: '100%' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
