import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppBackground, CircleAction, MiboStage } from '../../components/mobile';
import { ChatComposer, chatComposerFigmaEvidence } from '../../components/mobile/ChatComposer';
import { mobileColors } from '../../theme/tokens';
import { mobileFontFamilies } from '../../theme/typography';
import { getJobVisualState } from './jobVisualState';

// Direct Kiwi composition: the approved 845:3479 subtree has no Instance/Symbol.
export const chatbotLayoutEvidence = {
  frameId: '845:3479', headerNodeId: '845:3502', titleNodeId: '845:3509',
  headerWidth: 334, headerHeight: 38, headerY: 47, titleSize: 16, titleLineHeight: 26, titleColor: '#000000',
  composerNodeId: '845:3530', composerY: 729, gutter: 20,
  suggestions: [
    { nodeId: '845:3524', width: 197, label: '推荐几款好用的开发工具' },
    { nodeId: '845:3526', width: 205, label: '如何使用Docker部署项目？' },
    { nodeId: '845:3528', width: 239, label: '帮我生成一个Python爬虫代码！' },
  ],
} as const;

type Navigation = { onBack: () => void; onProducts: () => void; onBilling: () => void };
export function ChatbotPage({ children, insets, onBack, onProducts, onBilling }: PropsWithChildren<Navigation & {
  insets: { top: number; bottom: number; left: number; right: number };
}>) {
  const viewport = useWindowDimensions();
  const contentWidth = Math.max(0, Math.min(560, viewport.width - insets.left - insets.right - chatbotLayoutEvidence.gutter * 2));
  return <AppBackground insets={insets} contentStyle={{ width: contentWidth }} testID="chatbot-page">
    <KeyboardAvoidingView style={viewStyles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[viewStyles.header, { marginTop: insets.top + 3 }]}>
        <CircleAction accessibilityLabel="返回" icon="back" onPress={onBack} testID="chatbot-back" />
        <Text accessibilityRole="header" style={viewStyles.headerTitle}>Mibo AI Chatbot</Text>
        <CircleAction accessibilityLabel="额度与用量" icon="settings" onPress={onBilling} testID="chatbot-settings" />
      </View>
      <Pressable accessibilityRole="button" onPress={onProducts} style={viewStyles.products} testID="chatbot-products">
        <Text style={viewStyles.caption}>我的应用</Text>
      </Pressable>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[viewStyles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </AppBackground>;
}

export type CreateWorkspaceViewProps = {
  prompt: string; quotaText: string; policyText: string; lastApp: string | null;
  busy: boolean; editable: boolean; error: string;
  onChangePrompt: (value: string) => void; onCreate: () => void; onContinue: () => void;
};
export function CreateWorkspaceView({ prompt, quotaText, policyText, lastApp, busy, editable, error, onChangePrompt, onCreate, onContinue }: CreateWorkspaceViewProps) {
  return <>
    <MiboStage state={getJobVisualState(null)} />
    <View style={viewStyles.suggestions}>{chatbotLayoutEvidence.suggestions.map(suggestion =>
      <Pressable key={suggestion.nodeId} accessibilityRole="button" disabled={!editable || busy}
        onPress={() => onChangePrompt(suggestion.label)} style={[viewStyles.suggestion, { width: suggestion.width }]}>
        <Text style={viewStyles.suggestionText}>{suggestion.label}</Text>
      </Pressable>)}</View>
    <Text style={viewStyles.caption}>{quotaText}</Text>
    {Boolean(policyText) && <Text style={viewStyles.caption}>{policyText}</Text>}
    {Boolean(error) && <Text testID="workspace-error" accessibilityRole="alert" style={viewStyles.error}>{error}</Text>}
    <ChatComposer value={prompt} editable={editable} busy={busy} onChangeText={onChangePrompt} onSubmit={onCreate} inputTestID="create-prompt" submitTestID="create-app" inputLabel="你想做什么应用" submitLabel="开始创建" />
    {lastApp && <Pressable accessibilityRole="button" testID="last-app" onPress={onContinue} style={viewStyles.products}><Text style={viewStyles.caption}>继续上次的应用</Text></Pressable>}
  </>;
}

export const viewStyles = StyleSheet.create({
  page: { flex: 1 },
  header: { alignSelf: 'center', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', maxWidth: chatbotLayoutEvidence.headerWidth, minHeight: 44, width: '100%' },
  headerTitle: { color: chatbotLayoutEvidence.titleColor, fontFamily: mobileFontFamilies.emphasis, fontSize: chatbotLayoutEvidence.titleSize, lineHeight: chatbotLayoutEvidence.titleLineHeight },
  products: { alignSelf: 'center', minWidth: 44, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  scroll: { gap: 14, paddingTop: 8 },
  caption: { color: mobileColors.muted, fontFamily: mobileFontFamilies.body, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  error: { color: mobileColors.danger, fontFamily: mobileFontFamilies.body, fontSize: 14, lineHeight: 22 },
  suggestions: { alignItems: 'center', gap: 14, marginTop: 12 },
  suggestion: { alignItems: 'center', justifyContent: 'center', minHeight: 44, maxWidth: '100%', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: chatComposerFigmaEvidence.cornerRadius, borderColor: '#FFFFFF', borderWidth: chatComposerFigmaEvidence.borderWidth, shadowColor: '#BABABA', shadowOffset: { width: 0, height: 1.786134 }, shadowOpacity: 0.25, shadowRadius: 2.679201 },
  suggestionText: { color: mobileColors.text, fontFamily: mobileFontFamilies.pingFang, fontSize: 12, lineHeight: 24 },
});
