import {useCallback,useRef,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Stack,useFocusEffect,useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ApiError,type components} from '@intellideploy/api-client';
import {phase1Api} from '../../services/api';
import WorkspacePage,{Action,workspaceStyles} from '../../components/WorkspacePage';
import {CircleAction,EmptyState,ErrorState} from '../../components/mobile';
import CommunityBackground from '../../features/community/CommunityBackground';
import DiscoveryCard,{CommunitySourceHeading} from '../../features/community/DiscoveryCard';
import FeaturedPublication from '../../features/community/FeaturedPublication';
import {selectFeaturedPublication,toDiscoveryCard} from '../../features/community/communityViewModel';
import {communityEvidence as source} from '../../features/community/communityEvidence';
import {mobileFontFamilies} from '../../theme/typography';
export default function CommunityScreen({library}:{library?:'favorites'|'recent'}){
 const router=useRouter();const insets=useSafeAreaInsets();
 const[data,setData]=useState<components['schemas']['PublicationPage']|null>(null);const[error,setError]=useState('');const[loading,setLoading]=useState(false);const[revision,setRevision]=useState(0);
 const busy=useRef(false);const epoch=useRef(0);
 const read=library==='favorites'?phase1Api.listFavorites:library==='recent'?phase1Api.listRecentApps:phase1Api.listPublications;
 const authError=useCallback((exc:unknown)=>{if(exc instanceof ApiError&&exc.status===401){router.replace({pathname:'/login',params:{next:library?'/library/'+library:'/community'}});return true;}return false;},[router,library]);
 useFocusEffect(useCallback(()=>{let active=true;++epoch.current;busy.current=false;setLoading(false);setData(null);setError('');
  read().then(value=>{if(active)setData(value);}).catch(exc=>{if(active&&!authError(exc))setError('应用暂时无法加载，请重试。');});
  return()=>{active=false;++epoch.current;};
 },[read,authError,revision]));
 async function more(){if(busy.current||!data?.next_cursor)return;busy.current=true;setLoading(true);setError('');const requestEpoch=epoch.current;
  try{const next=await read(data.next_cursor);if(epoch.current===requestEpoch)setData(current=>({...next,items:[...(current?.items??[]),...next.items]}));}
  catch(exc){if(epoch.current===requestEpoch&&!authError(exc))setError('更多应用加载失败，请重试。');}
  finally{if(epoch.current===requestEpoch){busy.current=false;setLoading(false);}}
 }
 const retry=()=>setRevision(value=>value+1);
 const open=(id:string)=>router.push({pathname:'/community/[id]',params:{id}});
 // This optional legacy entry keeps its existing public-detail destinations; dedicated library routes own their folder layout.
 if(library)return <WorkspacePage title={library==='favorites'?'我的收藏':'最近使用'}>{!!error&&<ErrorState message={error} onRetry={retry}/>} {!data&&!error&&<Text style={workspaceStyles.text}>正在读取应用…</Text>}{data?.items.length===0&&<EmptyState title="暂时没有应用" actionLabel="重试" onAction={retry}/>} {data?.items.map(p=><View key={p.id} style={workspaceStyles.card}><Action label={p.name} onPress={()=>open(p.id)}/><Text style={workspaceStyles.text}>{p.summary}</Text><Text style={workspaceStyles.muted}>{p.creator} · {p.available?'正在运行':'暂不可用'}</Text></View>)}{data?.next_cursor&&<Action label={loading?'正在加载…':'加载更多'} disabled={loading} onPress={()=>void more()}/>}</WorkspacePage>;
 const items=data?.items??[];const featured=selectFeaturedPublication(items);
 const gap=source.standardNode.transform.m02-source.tall.size.width;
 return <CommunityBackground insets={insets}>
  <Stack.Screen options={{headerShown:false}}/>
  <View style={styles.header}><CircleAction accessibilityLabel="返回首页" icon="back" onPress={()=>router.push('/')}/><Text style={styles.headerTitle}>广场</Text><CircleAction accessibilityLabel="分享暂未开放" disabled icon="share" onPress={()=>undefined}/></View>
  <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
   <View style={styles.heading}><CommunitySourceHeading kind="title"/><CommunitySourceHeading kind="subtitle"/></View>
   {!!error&&<ErrorState message={error} onRetry={data?()=>void more():retry}/>}
   {!data&&!error&&<Text style={styles.loading}>正在读取应用…</Text>}
   {data&&items.length===0&&<EmptyState testID="community-empty" title="暂时没有公开应用" description="稍后再来看看，或重新加载。" actionLabel="重试" onAction={retry}/>}
   {items.length>0&&<>
    <ScrollView horizontal testID="community-discovery" showsHorizontalScrollIndicator={false} contentContainerStyle={{gap}} style={{height:source.tall.size.height}}>
     <DiscoveryCard card={toDiscoveryCard(items[0])} onOpen={()=>open(items[0].id)}/>
     {Array.from({length:Math.ceil((items.length-1)/2)},(_,column)=>{const top=items[1+column*2];const bottom=items[2+column*2];return <View key={top.id} style={{gap:source.squareNode.transform.m12-source.standard.size.height}}><DiscoveryCard kind="standard" card={toDiscoveryCard(top)} onOpen={()=>open(top.id)}/>{bottom&&<DiscoveryCard kind="square" card={toDiscoveryCard(bottom)} onOpen={()=>open(bottom.id)}/>}</View>;})}
    </ScrollView>
    {featured&&<FeaturedPublication card={toDiscoveryCard(featured)} onOpen={()=>open(featured.id)}/>}
   </>}
   {data?.next_cursor&&<Pressable accessibilityRole="button" disabled={loading} testID="community-load-more" onPress={()=>void more()} style={styles.more}><Text style={styles.moreText}>{loading?'正在加载…':'加载更多'}</Text></Pressable>}
  </ScrollView>
 </CommunityBackground>;
}
const styles=StyleSheet.create({header:{marginHorizontal:source.title.transform.m02-source.rail.transform.m02,flexDirection:'row',alignItems:'center',justifyContent:'space-between',height:44},headerTitle:{fontFamily:mobileFontFamilies.emphasis,fontSize:16,lineHeight:22,color:'#494A64'},content:{paddingBottom:24,gap:16},heading:{marginLeft:source.title.transform.m02-source.rail.transform.m02,marginTop:17,marginBottom:16},loading:{fontFamily:mobileFontFamilies.body,color:'#7F80A1',fontSize:14,lineHeight:20},more:{minHeight:44,minWidth:44,borderRadius:22,borderWidth:1,borderColor:'#7C62FF',justifyContent:'center',alignItems:'center',paddingHorizontal:24},moreText:{fontFamily:mobileFontFamilies.emphasis,fontSize:15,color:'#7C62FF'}});
