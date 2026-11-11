import { VisualPendingSection } from '../../components/mobile/VisualPendingSection';
import { GlassCard } from '../../components/mobile/GlassCard';
import { ErrorState } from '../../components/mobile/ErrorState';
import {useCallback,useState} from 'react';
import {Text} from 'react-native';
import * as Linking from 'expo-linking';
import axios from 'axios';
import {useFocusEffect,useRouter} from 'expo-router';
import {ApiError,type components} from '@intellideploy/api-client';
import {authAPI,phase1Api} from '../../services/api';
import {saveDraft,clearDraft} from '../../services/workspaceStorage';
import WorkspacePage,{Action,workspaceStyles as styles} from '../../components/WorkspacePage';
export default function PublicationScreen({id}:{id:string}){
 const router=useRouter();const[p,setP]=useState<components['schemas']['PublicationResponse']|null>(null);const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[favorite,setFavorite]=useState(false);
 const login=()=>router.push({pathname:'/login',params:{next:'/community/'+id}});
 function failure(exc:unknown){if((exc instanceof ApiError&&exc.status===401)||(axios.isAxiosError(exc)&&exc.response?.status===401))login();else setError(exc instanceof Error?exc.message:'操作失败');}
 useFocusEffect(useCallback(()=>{let active=true;phase1Api.getPublication(id).then(value=>{if(active)setP(value);}).catch(exc=>{if(active)setError(exc.message);});phase1Api.listFavorites().then(value=>{if(active)setFavorite(value.items.some(item=>item.id===id));}).catch(()=>{});return()=>{active=false;};},[id]));
 async function copy(){if(busy)return;setBusy(true);try{const user=(await authAPI.getMe()).data;const key=`intellideploy:${user.id}:copy:${id}`;const draft=await saveDraft(key,id);const result=await phase1Api.createCopy(id,undefined,draft.operationId);await clearDraft(key,draft.operationId);router.push({pathname:'/app-detail/[id]',params:{id:result.app_id}});}catch(exc){failure(exc);}finally{setBusy(false);}}
 async function open(){if(!p?.url||busy)return;setBusy(true);try{let url=p.url;try{const callback=new URL('/api/platform/callback',url).href;const{code}=await phase1Api.issueLoginCode(p.instance_id,callback);const target=new URL(callback);target.searchParams.set('code',code);url=target.href;}catch(exc){if(!(exc instanceof ApiError&&exc.status===401&&p.payer_policy==='SPONSOR'))throw exc;}try{await phase1Api.recordUse(id);}catch(exc){if(!(exc instanceof ApiError&&exc.status===401))throw exc;}await Linking.openURL(url);}catch(exc){failure(exc);}finally{setBusy(false);}}
 async function save(){try{await phase1Api.setFavorite(id,!favorite);setFavorite(!favorite);}catch(exc){failure(exc);}}
 return <WorkspacePage title={p?.name??'社区应用'}><VisualPendingSection label="公开应用详情" route="/community/[id]">{!!error&&<ErrorState message={error} title="操作未完成" />}{p&&<GlassCard style={{ gap: 12 }}><Text style={styles.text}>{p.summary}</Text><Text style={styles.muted}>由 {p.creator} 发布</Text>{p.features.map(f=><Text key={f} style={styles.text}>· {f}</Text>)}<Text style={styles.text}>{p.payer_policy==='VISITOR'?'访问者使用自己的额度，使用前登录。':`发布者赞助有限体验，${p.sponsor_period==='DAY'?'每日':'每月'}上限 ${p.sponsor_limit_units} 额度。`}</Text><Text style={styles.muted}>副本具有独立数据和费用，不复制作者的私有记录、文件和凭据。</Text>{p.available?<Action label="直接使用" disabled={busy} onPress={()=>void open()}/>:<Text style={styles.text}>暂不可用</Text>}<Action label="创建我的副本" testID="copy-publication" disabled={busy} onPress={()=>void copy()}/><Action label={favorite?'取消收藏':'收藏应用'} onPress={()=>void save()}/></GlassCard>}</VisualPendingSection></WorkspacePage>;
}
