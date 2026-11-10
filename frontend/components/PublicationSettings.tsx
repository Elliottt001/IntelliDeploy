import {useState} from 'react';
import {Text,TextInput,View} from 'react-native';
import {useRouter} from 'expo-router';
import {type components} from '@intellideploy/api-client';
import {phase1Api} from '../services/api';
import {Action,workspaceStyles as styles} from './WorkspacePage';
export default function PublicationSettings({app,reload}:{app:components['schemas']['AppDetail'],reload:()=>Promise<void>}){
 const router=useRouter();const[policy,setPolicy]=useState<'SPONSOR'|'VISITOR'>(app.publication?.payer_policy??'VISITOR');const[period,setPeriod]=useState<'DAY'|'MONTH'>(app.publication?.sponsor_period??'DAY');const[limit,setLimit]=useState(String(app.publication?.sponsor_limit_units??10000));const[error,setError]=useState('');const[busy,setBusy]=useState(false);
 if(!app.delivery)return null;
 async function save(){setBusy(true);try{await phase1Api.publish(app.id,{version_id:app.delivery!.version_id,payer_policy:policy,sponsor_period:period,sponsor_limit_units:Number(limit)});await reload();}catch(exc){setError(exc instanceof Error?exc.message:'发布失败');}finally{setBusy(false);}}
 async function remove(){setBusy(true);try{await phase1Api.unpublish(app.publication!.id);await reload();}catch(exc){setError(exc instanceof Error?exc.message:'取消公开失败');}finally{setBusy(false);}}
 return <View style={styles.card}><Text style={styles.title}>发布到社区</Text><Text style={styles.muted}>公开用途和使用入口。私有记录、文件和凭据不会公开；成功调整会更新公开应用，已有副本保持原版。</Text>{app.publication&&<><Action label="查看社区页面" onPress={()=>router.push({pathname:'/community/[id]',params:{id:app.publication!.id}})}/><Action label="取消公开" disabled={busy} onPress={()=>void remove()}/></>}<Text style={styles.text}>{policy==='VISITOR'?'访问者使用自己的额度':'由我赞助有限体验'}</Text><View style={styles.actions}><Action label="访问者付费" onPress={()=>setPolicy('VISITOR')}/><Action label="由我赞助" onPress={()=>setPolicy('SPONSOR')}/></View>{policy==='SPONSOR'&&<><View style={styles.actions}><Action label={period==='DAY'?'✓ 每日':'每日'} onPress={()=>setPeriod('DAY')}/><Action label={period==='MONTH'?'✓ 每月':'每月'} onPress={()=>setPeriod('MONTH')}/></View><TextInput accessibilityLabel="赞助额度上限" style={[styles.input,{minHeight:45}]} keyboardType="numeric" value={limit} onChangeText={setLimit}/></>}<Action label={app.publication?'更新公开设置':'发布应用'} testID="publish-app" disabled={busy||!!app.active_job||app.instance_status!=='RUNNING'||Number(limit)<=0} onPress={()=>void save()}/>{!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}</View>;
}
