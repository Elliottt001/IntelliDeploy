import {useEffect,useState} from 'react';
import {AppState,Text,TextInput,View,Switch} from 'react-native';
import {useRouter} from 'expo-router';
import {ApiError,type components} from '@intellideploy/api-client';
import {phase1Api,authAPI} from '../services/api';
import {readDraft,saveDraft,clearDraft} from '../services/workspaceStorage';
import {subscribeJob} from '../services/jobPolling';
import {Action,workspaceStyles as styles} from './WorkspacePage';

export default function InstanceControls({app,reload}:{app:components['schemas']['AppDetail'],reload:()=>Promise<void>}){
 const router=useRouter();const instance=app.instance;const[operation,setOperation]=useState(instance?.active_operation_id??null);const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[confirmation,setConfirmation]=useState('');const[deleteData,setDeleteData]=useState(false);
 useEffect(()=>{if(instance?.active_operation_id)setOperation(instance.active_operation_id);},[instance?.active_operation_id]);
 useEffect(()=>{if(!operation)return;return subscribeJob(operation,async(result,signal)=>{if(signal.aborted)return;if(['SUCCEEDED','FAILED'].includes(result.status)){setOperation(null);if(result.error)setError(result.error.message);await reload();}},{readJob:phase1Api.getInstanceOperation,appState:AppState,onError:()=>setError('网络暂时中断，正在回读实例操作。'),onUnauthorized:()=>router.replace({pathname:'/login',params:{next:'/app-detail/'+app.id}})});},[operation,reload,router,app.id]);
 async function act(kind:'start'|'stop'|'delete'){if(!instance||busy||operation)return;setBusy(true);setError('');
  try{const user=(await authAPI.getMe()).data;const key=`intellideploy:${user.id}:instance:${instance.id}:${kind}`;const draft=await saveDraft(key,JSON.stringify({deleteData:kind==='delete'?deleteData:false}));const result=kind==='start'?await phase1Api.startInstance(instance.id,draft.operationId):kind==='stop'?await phase1Api.stopInstance(instance.id,draft.operationId):await phase1Api.deleteInstance(instance.id,deleteData,draft.operationId);await clearDraft(key,draft.operationId);setOperation(result.id);setConfirmation('');}
  catch(exc){if(exc instanceof ApiError&&exc.status===401)router.replace({pathname:'/login',params:{next:'/app-detail/'+app.id}});else setError(exc instanceof Error?exc.message:'操作失败');}finally{setBusy(false);}}
 if(!instance)return null;
 return <View style={styles.card}><Text style={styles.title}>运行管理</Text>{operation&&<Text style={styles.text}>正在处理实例操作</Text>}{instance.stop_reason==='QUOTA'&&<View><Text style={styles.text}>额度不足，补充额度后可以恢复运行。</Text><Action label='补充额度' onPress={()=>router.push({pathname:'/billing',params:{appId:app.id}})}/></View>}{instance.status==='STOPPED'||instance.status==='FAILED'?<Action label="恢复运行" testID="start-instance" disabled={busy||!!operation||!!app.active_job} onPress={()=>void act('start')}/>:instance.status==='RUNNING'?<Action label="停止运行" testID="stop-instance" disabled={busy||!!operation||!!app.active_job} onPress={()=>void act('stop')}/>:null}{instance.status!=='DELETED'&&<><Text style={styles.muted}>删除将撤销此实例的使用入口。可选择是否同时删除持久数据和文件；停止运行会保留数据。</Text><TextInput testID="delete-confirmation" accessibilityLabel="输入 DELETE 确认" style={[styles.input,{minHeight:45}]} value={confirmation} onChangeText={setConfirmation} placeholder="输入 DELETE 确认"/><View style={styles.actions}><Switch value={deleteData} onValueChange={setDeleteData} accessibilityLabel="同时删除持久数据"/><Text style={styles.text}>同时删除持久数据和文件</Text></View><Action label="确认删除实例" testID="delete-instance" disabled={busy||!!operation||!!app.active_job||confirmation!=='DELETE'} onPress={()=>void act('delete')}/></>}{!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}</View>;
}
