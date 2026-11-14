import {sourceRouteNodes} from '../../design/sourceControlMotionEvidence';
import {SharedRouteContext,SourceRouteNode,type SharedNode,type SharedPresentation} from './sourceRouteShared';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AppState, Platform, View, useWindowDimensions } from 'react-native';
import type { SourceMotion } from '../../design/sourceMotionEvidence';
import { captureRoutePresentation, RouteSnapshotView, measureRouteNode, type RouteSnapshot } from './sourceRouteSnapshot';
import { sourceRouteOffsets } from './sourceRouteMotion';
import { useSourceMotion } from './useSourceMotion';
type Navigate=(motion:SourceMotion|null,callback:()=>void,canonicalTarget?:string)=>void;
const Context=createContext<Navigate>((_motion,callback)=>callback());
export const useSourceRouteTransition=()=>useContext(Context);
type Transition={motion:SourceMotion;snapshot?:RouteSnapshot;shared?:SharedPresentation[];generation:number;canonicalTarget?:string};
const routeFamily=(path?:string)=>path?.startsWith('/chatbot')?'845:3479':path==='/'?'270:26263':undefined;
export function SourceRouteTransition({children,currentPath}:PropsWithChildren<{currentPath?:string}>){
 const viewport=useWindowDimensions(),root=useRef<View>(null),generation=useRef(0),mounted=useRef(true),active=useRef<Transition|null>(null),retired=useRef<RouteSnapshot[]>([]),nodes=useRef(new Map<string,SharedNode>()),rootOrigin=useRef({x:0,y:0});
 const [,refreshNodes]=useState(0);
 const register=useCallback((node:SharedNode)=>{const prior=nodes.current.get(node.key);const family=routeFamily(active.current?.canonicalTarget??currentPath);const priorMeta=prior?sourceRouteNodes[prior.sourceNodeId as keyof typeof sourceRouteNodes]:undefined;const metadata=sourceRouteNodes[node.sourceNodeId as keyof typeof sourceRouteNodes];if(node.live&&family&&metadata?.pageRoot!==family)return()=>{};if(prior?.live&&!node.live&&(!family||priorMeta?.pageRoot===family))return()=>{};nodes.current.set(node.key,node);refreshNodes(n=>n+1);return()=>{if(nodes.current.get(node.key)===node){nodes.current.delete(node.key);refreshNodes(n=>n+1);}};},[currentPath]);
 const retire=useCallback((old:Transition|null)=>{if(old?.snapshot)retired.current.push(old.snapshot);if(old?.shared)retired.current.push(...old.shared.map(node=>node.snapshot));},[]);
 const [transition,setTransition]=useState<Transition|null>(null),[progress,setProgress]=useState(0);
 const api=useSourceMotion(transition?.motion??null);
 const release=useCallback(()=>{api.cancel();const old=active.current;active.current=null;setTransition(null);setProgress(0);retire(old);},[api.cancel,retire]);
 useEffect(()=>{retired.current.splice(0).forEach(snapshot=>snapshot.dispose());},[transition]);
 const navigate=useCallback<Navigate>((motion,callback,canonicalTarget)=>{
   const expected=++generation.current;
   if(!motion || (!motion.transition?.startsWith('SLIDE_')&&motion.transition!=='SMART_ANIMATE')){release();callback();return;}
   api.cancel();
   const capture=async()=>{
     if(motion.transition==='SMART_ANIMATE'){
       const origin=await measureRouteNode(root);if(origin)rootOrigin.current={x:origin.x,y:origin.y};
       const shared:SharedPresentation[]=[];
       try{for(const node of nodes.current.values()){
         const family=routeFamily(active.current?.canonicalTarget??currentPath);const metadata=sourceRouteNodes[node.sourceNodeId as keyof typeof sourceRouteNodes];if(node.live&&family&&metadata?.pageRoot!==family)continue;
         const bounds=await measureRouteNode(node.ref);if(!bounds||bounds.width<=0||bounds.height<=0)continue;
         const snapshot=await captureRoutePresentation(node.ref);if(generation.current!==expected||!mounted.current){snapshot?.dispose();shared.splice(0).forEach(node=>node.snapshot.dispose());return {shared};}if(snapshot)shared.push({...node,snapshot,bounds});
       }}catch(error){shared.forEach(node=>node.snapshot.dispose());throw error;}
       return {shared};
     }
     return {snapshot:await captureRoutePresentation(root)??undefined};
   };
   void capture().then(captured=>{
     if(!mounted.current||generation.current!==expected){captured.snapshot?.dispose();captured.shared?.forEach(node=>node.snapshot.dispose());return;}
     const old=active.current;
     const next={motion:{...motion},...captured,generation:expected,canonicalTarget};active.current=next;setProgress(0);setTransition(next);
     retire(old);callback();
   },()=>{if(mounted.current&&generation.current===expected){release();callback();}});
 },[api.cancel,release,retire,currentPath]);
 useEffect(()=>{const id=api.progress.addListener(({value})=>setProgress(value));return()=>api.progress.removeListener(id);},[api.progress]);
 useLayoutEffect(()=>{if(!transition)return;api.start(()=>{if(generation.current===transition.generation)release();});},[api.start,release,transition]);
 useEffect(()=>{mounted.current=true;const subscription=AppState.addEventListener('change',state=>{if(state!=='active'){generation.current++;release();}});return()=>{mounted.current=false;generation.current++;subscription.remove();api.cancel();active.current?.snapshot?.dispose();active.current?.shared?.forEach(node=>node.snapshot.dispose());active.current=null;retired.current.splice(0).forEach(snapshot=>snapshot.dispose());};},[api.cancel,release]);
 const priorPath=useRef(currentPath);
 useEffect(()=>{if(currentPath!==priorPath.current){const canonical=active.current?.canonicalTarget?.split('?')[0];if(canonical?.startsWith('/')&&currentPath!==canonical){generation.current++;release();}priorPath.current=currentPath;}},[currentPath,release]);
 const offsets=transition?sourceRouteOffsets(transition.motion,progress,viewport):{incoming:{x:0,y:0},outgoing:{x:0,y:0}};
 const smart=transition?.motion.transition==='SMART_ANIMATE';
 return <Context.Provider value={navigate}><SharedRouteContext.Provider value={{register,previous:transition?.shared??[],progress,smart}}><View ref={root} collapsable={false} style={{flex:1,overflow:'hidden'}} testID="source-route-presentation">
   <View style={{flex:1,transform:[{translateX:offsets.incoming.x},{translateY:offsets.incoming.y}]}} {...(Platform.OS==='web'?{dataSet:{sourceRouteProgress:String(progress),sourceRouteRawTarget:transition?.motion.targetNodeId??'',sourceRouteCanonicalTarget:transition?.canonicalTarget??''}}: {})}>{children}</View>
   {transition?.snapshot&&<RouteSnapshotView snapshot={transition.snapshot} x={offsets.outgoing.x} y={offsets.outgoing.y} width={viewport.width} height={viewport.height}/>}
   {smart&&transition?.shared?.filter(node=>{const live=nodes.current.get(node.key);const family=routeFamily(transition.canonicalTarget??currentPath);const metadata=live?sourceRouteNodes[live.sourceNodeId as keyof typeof sourceRouteNodes]:undefined;return !live?.live||(family&&metadata?.pageRoot!==family);}).map(node=><SourceRouteNode key={node.key} sourceNodeId={node.sourceNodeId} ghost presentation={node} style={{position:'absolute',left:node.bounds.x-rootOrigin.current.x,top:node.bounds.y-rootOrigin.current.y,width:node.bounds.width,height:node.bounds.height}}/>)}
 </View></SharedRouteContext.Provider></Context.Provider>;
}

export function SourceRouteAction({motion,onPress,canonicalTarget,children}:{motion:SourceMotion;onPress:()=>void;canonicalTarget?:string;children:(onPress:()=>void)=>ReactNode}){const navigate=useSourceRouteTransition();return children(()=>navigate(motion,onPress,canonicalTarget));}
