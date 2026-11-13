import {mobileFontFamilies} from '../../theme/typography';
import { VisualPendingSection } from '../../components/mobile/VisualPendingSection';
import { BrandHeader } from '../../components/mobile/BrandHeader';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, Text, View, type TextStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { ApiError, type components } from '@intellideploy/api-client';
import { authAPI, phase1Api } from '../../services/api';
import { subscribeJob } from '../../services/jobPolling';
import { clearDraft, readDraft, saveDraft } from '../../services/workspaceStorage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {ChatComposer} from '../../components/mobile/ChatComposer';
import {ActualReplyText} from '../../components/mobile/ActualReplyText';
import {latestAssistantForDisplay, needsDetailedReplyLayout, splitReplyLines} from '../../features/chatbot/replyLayout';
import { MiboStage, JobProgress } from '../../components/mobile';
import {miboRenderEvidence} from '../../design/miboRenderEvidence';
import { ChatbotPage, viewStyles as styles } from '../../features/chatbot/CreateWorkspaceView';
import { AppConversationView } from '../../features/chatbot/AppConversationView';
import { getJobVisualState } from '../../features/chatbot/jobVisualState';
import DeliveryCard from '../../components/DeliveryCard';
import InstanceControls from '../../components/InstanceControls';
import PublicationSettings from '../../components/PublicationSettings';

export default function AppDetailScreen({ appId }: { appId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversationExpanded,setConversationExpanded]=useState(false);
  const [phasesExpanded,setPhasesExpanded]=useState(false);
  const [managementOpen,setManagementOpen]=useState(false);
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
  const latestAssistant=app?latestAssistantForDisplay(app.conversation,job?.question):null;
  const hasDetailedReply=Boolean(latestAssistant && needsDetailedReplyLayout(latestAssistant.content));
  const lateShortReply=jobState.kind==='validating'||jobState.kind==='deploying';
  const shortReplyLayout=lateShortReply?miboRenderEvidence.lateShortReplyLayout:miboRenderEvidence.shortReplyLayout;
  const replyPanel=jobState.kind==='succeeded'?miboRenderEvidence.successReplyPanel:miboRenderEvidence.replyPanel;
  const replyStyle=hasDetailedReply?miboRenderEvidence.replyStyles.detailed:miboRenderEvidence.replyStyles.short;
  const login = useCallback(() => router.replace({ pathname: '/login', params: { next: `/app-detail/${appId}` } }), [appId, router]);
  const reload=useCallback(async()=>{const detail=await phase1Api.getApp(appId);if(mounted.current)setApp(detail);},[appId]);
  const retryLoad=useCallback(async()=>{setError('');try{const detail=await phase1Api.getApp(appId);if(mounted.current)setApp(detail);}catch(exc){if(!mounted.current)return;if(exc instanceof ApiError&&exc.status===401)login();else setError(exc instanceof Error?exc.message:'无法读取应用');}},[appId,login]);

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

  const changeContent=(value:string)=>{setContent(value);if(draftKey)void saveDraft(draftKey,value).catch(()=>setError('草稿未能保存，请稍后重试'));};
  const openBilling=()=>app&&router.push({pathname:'/billing',params:{appId:app.id}});
  return <ChatbotPage detailActions={app?[{id:'conversation-toggle',label:'需求与调整',expanded:conversationExpanded,onPress:()=>setConversationExpanded(value=>!value)},{id:'job-phases-toggle',label:'查看任务阶段',expanded:phasesExpanded,onPress:()=>setPhasesExpanded(value=>!value)},{id:'delivery-management-toggle',label:'交付与管理',expanded:managementOpen,onPress:()=>setManagementOpen(value=>!value)}]:undefined} insets={insets} onBack={() => router.back()} onProducts={() => router.push('/app-gallery')} onBilling={openBilling} footer={app?<ChatComposer value={content} editable={Boolean(draftKey)} busy={busy} canSubmit={jobState.canCompose} onChangeText={changeContent} onSubmit={()=>{void send();}}/>:undefined}>
    {!app && !error && <Text style={styles.caption}>正在读取应用…</Text>}
    {Boolean(error) && <><Text testID="workspace-error" accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>{void retryLoad();}} style={styles.products} testID="retry-app-detail"><Text style={styles.caption}>重试读取</Text></Pressable></>}
    {Boolean(networkError) && <Text testID="network-retry" accessibilityRole="alert" style={styles.error}>{networkError}</Text>}
    {app && <>
      <MiboStage hasDetails={hasDetailedReply} snapshotKey={job?`${job.status}:${job.phase}`:'none'} titleTestID="job-status" state={jobState} question={job?.question} errorMessage={job?.error?.message} />
      {latestAssistant&&<View accessibilityLabel="Mibo 最新回复" style={[{alignSelf:'center',width:283,maxWidth:'100%'},hasDetailedReply?{borderRadius:replyPanel.cornerRadius,backgroundColor:replyPanel.backgroundColor,paddingLeft:replyPanel.textPosition.m02,paddingRight:replyPanel.size.x-replyPanel.textPosition.m02-replyPanel.textSize.x,paddingVertical:replyPanel.textPosition.m12,minHeight:replyPanel.size.y,marginTop:replyPanel.offsetY,shadowColor:'#897AB9',shadowOffset:{width:replyPanel.shadow.offset.x,height:replyPanel.shadow.offset.y},shadowOpacity:replyPanel.shadow.color.a,shadowRadius:replyPanel.shadow.radius}:{marginTop:lateShortReply?miboRenderEvidence.lateShortReplyLayout.offsetY:0}]}>
        <Text style={{fontFamily:mobileFontFamilies.pingFang,fontSize:10,lineHeight:14,color:'#7F80A1',marginBottom:hasDetailedReply?0:7,textAlign:hasDetailedReply?'left':'center',...(hasDetailedReply?{position:'absolute',left:replyPanel.textPosition.m02,top:-20}:{} )}}>Mibo 最新回复</Text>
        {hasDetailedReply?<ActualReplyText testID="latest-assistant-reply" content={latestAssistant.content} style={{width:replyPanel.textSize.x,transform:Platform.OS==='web'?[{translateY:replyStyle.lineBaselines[0]-14}]:undefined,fontFamily:mobileFontFamilies.pingFang,fontSize:replyStyle.fontSize,lineHeight:replyStyle.lineHeight,color:replyStyle.textColor}}/>:<View testID="latest-assistant-reply" accessibilityLabel={latestAssistant.content} style={{marginLeft:shortReplyLayout.textOriginX-(375-283)/2}}>{splitReplyLines(latestAssistant.content).map((line,index)=><Text key={index} testID={`assistant-reply-line-${index}`} style={{fontFamily:mobileFontFamilies.pingFang,fontSize:replyStyle.fontSize,lineHeight:replyStyle.lineHeight,color:replyStyle.textColor,minHeight:replyStyle.lineHeight,marginTop:index?shortReplyLayout.lineOffsets[index]-shortReplyLayout.lineOffsets[index-1]-replyStyle.lineHeight:0}}>{line.content}<Text style={Platform.OS==='web'?({whiteSpace:'normal'} as unknown as TextStyle):undefined}>{line.separator}</Text></Text>)}</View>}
      </View>}
      {phasesExpanded&&<JobProgress state={jobState} compact showToggle={false} expanded onToggle={()=>setPhasesExpanded(value=>!value)}/>}
      <AppConversationView compact showToggle={false} showManagementActions={managementOpen} expanded={conversationExpanded} onToggle={()=>setConversationExpanded(value=>!value)} showComposer={false} app={app} jobState={jobState} conversation={app.conversation}
        content={content} editable={Boolean(draftKey)} busy={busy}
        onChangeContent={changeContent}
        onSend={() => { void send(); }} onRefresh={() => setEpoch(value => value + 1)}
        onResume={() => { void action('resume'); }} onCancel={() => { void action('cancel'); }}
        onBilling={openBilling} onRestart={() => router.push('/chatbot')} />
      <DeliveryCard app={app}/>

      {managementOpen&&<VisualPendingSection label="应用交付与管理" route="/app-detail/[id]:secondary"><View testID="app-detail-secondary" style={{ gap: 14 }}><BrandHeader testID="secondary-brand-header" />
        <InstanceControls app={app} reload={reload} /><PublicationSettings app={app} reload={reload} />
      </View></VisualPendingSection>}
    </>}
  </ChatbotPage>;
}
