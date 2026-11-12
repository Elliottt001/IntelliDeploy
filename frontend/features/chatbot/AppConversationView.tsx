import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { components } from '@intellideploy/api-client';
import { ChatComposer } from '../../components/mobile/ChatComposer';
import { mobileColors } from '../../theme/tokens';
import { mobileFontFamilies } from '../../theme/typography';
import type { JobVisualState } from './jobVisualState';
import { viewStyles } from './CreateWorkspaceView';

type App = components['schemas']['AppDetail'];
export type AppConversationViewProps = {
  compact?:boolean;showToggle?:boolean;showComposer?:boolean;showManagementActions?:boolean;expanded?:boolean;onToggle?:()=>void;app: App; jobState: JobVisualState; conversation: App['conversation'];
  content: string; editable: boolean; busy: boolean;
  onChangeContent: (value: string) => void; onSend: () => void; onRefresh: () => void;
  onResume: () => void; onCancel: () => void; onBilling: () => void; onRestart: () => void;
};
function Action({ label, onPress, disabled = false, testID }: { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return <Pressable accessibilityRole="button" testID={testID} onPress={onPress} disabled={disabled}
    style={[styles.action, disabled && { opacity: 0.5 }]}><Text style={styles.actionText}>{label}</Text></Pressable>;
}

export function AppConversationView({ app, jobState, conversation, content, editable, busy, onChangeContent, onSend, onRefresh, onResume, onCancel, onBilling, onRestart, compact=false, showToggle=true, showComposer=true, showManagementActions=true, expanded=!compact,onToggle }: AppConversationViewProps) {
  const job = app.active_job ?? app.latest_job;
  return <View style={styles.conversation}>
    {job && (showManagementActions||jobState.canResume) && <>
      <View style={styles.actions}>
        {showManagementActions&&jobState.canCancel && <Action label="取消任务" testID="cancel-job" disabled={busy} onPress={onCancel} />}
        {jobState.canResume && <><Action label="额度与用量" onPress={onBilling} /><Action label="恢复任务" testID="resume-job" disabled={busy} onPress={onResume} /></>}
        {showManagementActions&&<Action label="刷新状态" testID="refresh-job" onPress={onRefresh} />}
        {showManagementActions&&jobState.kind === 'cancelled' && <Action label="重新开始" testID="restart-app" onPress={onRestart} />}
      </View>
    </>}
    {compact&&showToggle&&<Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={onToggle} testID="conversation-toggle" style={viewStyles.products}><Text style={viewStyles.caption}>需求与调整</Text></Pressable>}
    {expanded&&<View style={{gap:14}}>{job&&<Text style={viewStyles.caption}>本次已使用 {job.usage_units} 额度</Text>}
    <Text accessibilityRole="header" style={styles.title}>{app.name} · 需求与调整</Text>
    {conversation.map(message => <View key={message.id} style={styles.message}>
      <Text style={styles.role}>{message.role === 'user' ? '你' : 'Mibo'}</Text>
      <Text style={styles.text}>{message.content}</Text>
    </View>)}
    {app.publication && <Text style={viewStyles.caption}>此次调整通过后将同步更新社区中的应用。</Text>}
    {!jobState.canCompose && <Text style={viewStyles.caption}>{jobState.kind === 'paused_quota' ? '额度暂停中，你可以先保存想法，恢复后再发送。' : '正在处理上一项需求，你可以先保存想法，完成后再发送。'}</Text>}
    </View>}
    {showComposer&&<ChatComposer value={content} editable={editable} busy={busy} canSubmit={jobState.canCompose}
      onChangeText={onChangeContent} onSubmit={onSend} />}
  </View>;
}
const styles = StyleSheet.create({
  conversation: { gap: 14 },
  action: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.7)', borderColor:'#D0C7FE',borderWidth:1 },
  actionText: { color: mobileColors.text, fontFamily: mobileFontFamilies.body, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  title: { color: mobileColors.text, fontFamily: mobileFontFamilies.emphasis, fontSize: 16, lineHeight: 24 },
  message: { gap: 4 },
  role: { color: mobileColors.muted, fontFamily: mobileFontFamilies.body, fontSize: 12, lineHeight: 24 },
  text: { color: mobileColors.text, fontFamily: mobileFontFamilies.body, fontSize: 14, lineHeight: 22 },
});
