import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AppState, Platform, View, useWindowDimensions } from 'react-native';
import type { SourceMotion } from '../../design/sourceMotionEvidence';
import { captureRoutePresentation, RouteSnapshotView, type RouteSnapshot } from './sourceRouteSnapshot';
import { sourceRouteOffsets } from './sourceRouteMotion';
import { useSourceMotion } from './useSourceMotion';
type Navigate=(motion:SourceMotion|null,callback:()=>void,canonicalTarget?:string)=>void;
const Context=createContext<Navigate>((_motion,callback)=>callback());
export const useSourceRouteTransition=()=>useContext(Context);
type Transition={motion:SourceMotion;snapshot:RouteSnapshot;generation:number;canonicalTarget?:string};
export function SourceRouteTransition({children}:PropsWithChildren){
 const viewport=useWindowDimensions(),root=useRef<View>(null),generation=useRef(0),mounted=useRef(true),active=useRef<Transition|null>(null),retired=useRef<RouteSnapshot[]>([]);
 const [transition,setTransition]=useState<Transition|null>(null),[progress,setProgress]=useState(0);
 const api=useSourceMotion(transition?.motion??null);
 const release=useCallback(()=>{api.cancel();const old=active.current;active.current=null;setTransition(null);setProgress(0);if(old)retired.current.push(old.snapshot);},[api.cancel]);
 useEffect(()=>{retired.current.splice(0).forEach(snapshot=>snapshot.dispose());},[transition]);
 const navigate=useCallback<Navigate>((motion,callback,canonicalTarget)=>{
   const expected=++generation.current;
   // SMART_ANIMATE belongs to actual corresponding source nodes in existing
   // Home/Product/Mibo components. No synthetic whole-page fade is added here.
   if(!motion?.transition?.startsWith('SLIDE_')){release();callback();return;}
   api.cancel();
   void captureRoutePresentation(root).then(snapshot=>{
     if(!mounted.current||generation.current!==expected){snapshot?.dispose();return;}
     const old=active.current;
     if(snapshot){const next={motion,snapshot,generation:expected,canonicalTarget};active.current=next;setProgress(0);setTransition(next);}
     else {active.current=null;setTransition(null);}
     if(old)retired.current.push(old.snapshot);
     callback();
   },()=>{if(mounted.current&&generation.current===expected){release();callback();}});
 },[api.cancel,release]);
 useEffect(()=>{const id=api.progress.addListener(({value})=>setProgress(value));return()=>api.progress.removeListener(id);},[api.progress]);
 useLayoutEffect(()=>{if(!transition)return;api.start(()=>{if(generation.current===transition.generation)release();});},[api.start,release,transition]);
 useEffect(()=>{mounted.current=true;const subscription=AppState.addEventListener('change',state=>{if(state!=='active'){generation.current++;release();}});return()=>{mounted.current=false;generation.current++;subscription.remove();api.cancel();active.current?.snapshot.dispose();active.current=null;retired.current.splice(0).forEach(snapshot=>snapshot.dispose());};},[api.cancel,release]);
 const offsets=transition?sourceRouteOffsets(transition.motion,progress,viewport):{incoming:{x:0,y:0},outgoing:{x:0,y:0}};
 return <Context.Provider value={navigate}><View ref={root} collapsable={false} style={{flex:1,overflow:'hidden'}} testID="source-route-presentation">
   <View style={{flex:1,transform:[{translateX:offsets.incoming.x},{translateY:offsets.incoming.y}]}} {...(Platform.OS==='web'?{dataSet:{sourceRouteProgress:String(progress),sourceRouteRawTarget:transition?.motion.targetNodeId??'',sourceRouteCanonicalTarget:transition?.canonicalTarget??''}}: {})}>{children}</View>
   {transition&&<RouteSnapshotView snapshot={transition.snapshot} x={offsets.outgoing.x} y={offsets.outgoing.y} width={viewport.width} height={viewport.height}/>}
 </View></Context.Provider>;
}

export function SourceRouteAction({motion,onPress,canonicalTarget,children}:{motion:SourceMotion;onPress:()=>void;canonicalTarget?:string;children:(onPress:()=>void)=>ReactNode}){const navigate=useSourceRouteTransition();return children(()=>navigate(motion,onPress,canonicalTarget));}
