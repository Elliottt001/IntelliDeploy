import { getSourceMotion } from '../../design/sourceMotionEvidence';
import {useCallback,useRef,useState} from 'react';
import {ScrollView,StyleSheet,Text,View} from 'react-native';
import {Stack,useFocusEffect,useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ApiError,type components} from '@intellideploy/api-client';
import {phase1Api} from '../../services/api';
import WorkspacePage,{Action,workspaceStyles} from '../../components/WorkspacePage';
import {CircleAction,EmptyState,ErrorState} from '../../components/mobile';
import CommunityBackground from '../../features/community/CommunityBackground';
import {CommunitySourceHeading,CommunitySourceRail} from '../../features/community/DiscoveryCard';
import {unavailablePostCopy} from '../../features/community/communityViewModel';
import {communityEvidence as source} from '../../features/community/communityEvidence';
import {mobileFontFamilies} from '../../theme/typography';
export default function CommunityScreen({library}:{library?:'favorites'|'recent'}){
 const router=useRouter();const insets=useSafeAreaInsets();
 const[data,setData]=useState<components['schemas']['PublicationPage']|null>(null);const[error,setError]=useState('');const[loading,setLoading]=useState(false);const[revision,setRevision]=useState(0);
 const busy=useRef(false);const epoch=useRef(0);
 const read=library==='favorites'?phase1Api.listFavorites:library==='recent'?phase1Api.listRecentApps:phase1Api.listPublications;
 const authError=useCallback((exc:unknown)=>{if(exc instanceof ApiError&&exc.status===401){router.replace({pathname:'/login',params:{next:library?'/library/'+library:'/community'}});return true;}return false;},[router,library]);
 useFocusEffect(useCallback(()=>{let active=true;++epoch.current;busy.current=false;setLoading(false);setData(null);setError('');
  if(!library)return()=>{active=false;++epoch.current;};
  read().then(value=>{if(active)setData(value);}).catch(exc=>{if(active&&!authError(exc))setError('应用暂时无法加载，请重试。');});
  return()=>{active=false;++epoch.current;};
 },[read,authError,revision,library]));
 async function more(){if(busy.current||!data?.next_cursor)return;busy.current=true;setLoading(true);setError('');const requestEpoch=epoch.current;
  try{const next=await read(data.next_cursor);if(epoch.current===requestEpoch)setData(current=>({...next,items:[...(current?.items??[]),...next.items]}));}
  catch(exc){if(epoch.current===requestEpoch&&!authError(exc))setError('更多应用加载失败，请重试。');}
  finally{if(epoch.current===requestEpoch){busy.current=false;setLoading(false);}}
 }
 const retry=()=>setRevision(value=>value+1);
 const open=(id:string)=>router.push({pathname:'/community/[id]',params:{id}});
 // This optional legacy entry keeps its existing public-detail destinations; dedicated library routes own their folder layout.
 if(library)return <WorkspacePage title={library==='favorites'?'我的收藏':'最近使用'}>{!!error&&<ErrorState message={error} onRetry={retry}/>} {!data&&!error&&<Text style={workspaceStyles.text}>正在读取应用…</Text>}{data?.items.length===0&&<EmptyState title="暂时没有应用" actionLabel="重试" onAction={retry}/>} {data?.items.map(p=><View key={p.id} style={workspaceStyles.card}><Action label={p.name} onPress={()=>open(p.id)}/><Text style={workspaceStyles.text}>{p.summary}</Text><Text style={workspaceStyles.muted}>{p.creator} · {p.available?'正在运行':'暂不可用'}</Text></View>)}{data?.next_cursor&&<Action label={loading?'正在加载…':'加载更多'} disabled={loading} onPress={()=>void more()}/>}</WorkspacePage>;
 return <CommunityBackground insets={insets}>
  <Stack.Screen options={{headerShown:false}}/>
  <View style={styles.header}><CircleAction accessibilityLabel="返回首页" icon="back" sourceMotion={getSourceMotion("825:6672","ON_CLICK")} canonicalTarget="/" onPress={()=>router.push('/')}/><Text style={styles.headerTitle}>广场</Text><CircleAction accessibilityLabel="分享暂未开放" disabled icon="share" onPress={()=>undefined}/></View>
  <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
   <View style={styles.heading}><CommunitySourceHeading kind="title"/><CommunitySourceHeading kind="subtitle"/></View>
   <View style={styles.railWrap}>
    <CommunitySourceRail cards={[{id:'primary',copy:unavailablePostCopy},{id:'standard',copy:unavailablePostCopy,kind:'standard'},{id:'square',copy:unavailablePostCopy,kind:'square'}]}/>
   </View>
   <View testID="community-content-unavailable" style={styles.unavailable}>
    <Text style={styles.unavailableTitle}>帖子内容暂未开放</Text>
    <Text style={styles.unavailableText}>这里会保留发现流的位置；当前只显示真实可用的页面结构。</Text>
   </View>
  </ScrollView>
 </CommunityBackground>;
}
const styles=StyleSheet.create({header:{marginHorizontal:source.title.transform.m02-source.rail.transform.m02,flexDirection:'row',alignItems:'center',justifyContent:'space-between',height:44},headerTitle:{fontFamily:mobileFontFamilies.emphasis,fontSize:16,lineHeight:22,color:'#494A64'},content:{paddingBottom:24},heading:{marginLeft:source.title.transform.m02-source.rail.transform.m02,marginTop:17,marginBottom:16},railWrap:{height:source.rail.size.y,marginLeft:source.rail.transform.m02,marginTop:16,overflow:'hidden'},unavailable:{marginHorizontal:source.title.transform.m02-source.rail.transform.m02,marginTop:16,borderRadius:16,borderWidth:1,borderColor:'rgba(124,98,255,.18)',backgroundColor:'rgba(255,255,255,.62)',padding:16},unavailableTitle:{fontFamily:mobileFontFamilies.emphasis,fontSize:15,lineHeight:22,color:'#494A64'},unavailableText:{marginTop:4,fontFamily:mobileFontFamilies.body,fontSize:13,lineHeight:20,color:'#7F80A1'}});
