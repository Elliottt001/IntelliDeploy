import {useCallback,useState} from 'react';
import {Text,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {ApiError,type components} from '@intellideploy/api-client';
import {phase1Api} from '../../services/api';
import WorkspacePage,{Action,workspaceStyles as styles} from '../../components/WorkspacePage';
export default function CommunityScreen({library}:{library?:'favorites'|'recent'}){
 const router=useRouter();const[data,setData]=useState<components['schemas']['PublicationPage']|null>(null);const[error,setError]=useState('');
 const read=library==='favorites'?phase1Api.listFavorites:library==='recent'?phase1Api.listRecentApps:phase1Api.listPublications;
 useFocusEffect(useCallback(()=>{let active=true;setData(null);read().then(value=>{if(active)setData(value);}).catch(exc=>{if(active){if(exc instanceof ApiError&&exc.status===401)router.replace({pathname:'/login',params:{next:library?'/library/'+library:'/community'}});else setError(exc.message);}});return()=>{active=false;};},[read,router,library]));
 async function more(){try{const next=await read(data?.next_cursor??undefined);setData({...next,items:[...(data?.items??[]),...next.items]});}catch(exc){setError(exc instanceof Error?exc.message:'读取失败');}}
 return <WorkspacePage title={library==='favorites'?'我的收藏':library==='recent'?'最近使用':'应用社区'}>{!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!data&&!error&&<Text style={styles.text}>正在读取应用…</Text>}{data?.items.length===0&&<Text style={styles.text}>暂时没有应用。</Text>}{data?.items.map(p=><View key={p.id} style={styles.card}><Action label={p.name} onPress={()=>router.push({pathname:'/community/[id]',params:{id:p.id}})}/><Text style={styles.text}>{p.summary}</Text><Text style={styles.muted}>{p.creator} · {p.available?'正在运行':'暂不可用'}</Text></View>)}{data?.next_cursor&&<Action label="加载更多" onPress={()=>void more()}/>}</WorkspacePage>;
}
