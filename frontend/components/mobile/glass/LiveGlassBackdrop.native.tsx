import {createContext,useContext,useEffect,useMemo,useRef,useState,type PropsWithChildren,type ReactNode} from 'react';
import {AppState,PixelRatio,StyleSheet,View,useWindowDimensions,type ViewStyle} from 'react-native';
import {makeImageFromView,type SkImage} from '@shopify/react-native-skia';
import {liveBackdropCapture} from './liveBackdropCapture';
type CaptureLayer={image:SkImage;root:View};
const Context=createContext<{image:SkImage|null;root:View|null;layers:CaptureLayer[];captureRevision:number;revision:number;status:'waiting'|'live'|'error'|'paused';error:string|null;lastFrameAt:number|null;appState:string}>({image:null,root:null,layers:[],captureRevision:0,revision:0,status:'waiting',error:null,lastFrameAt:null,appState:'unknown'});
export const useLiveGlassBackdrop=()=>useContext(Context);
// Explicit prefix slot: callers must supply only actual paint BEFORE children.
// Current optics and foreground are siblings, never descendants of capture root.
export function LiveGlassBackdrop({underlay,children,mode='absolute',interactiveUnderlay=false,captureStyle}:PropsWithChildren<{underlay:ReactNode;mode?:'absolute'|'flow';interactiveUnderlay?:boolean;captureStyle?:ViewStyle}>){
 const parent=useContext(Context);
 const [diagnostic,setDiagnostic]=useState<{status:'waiting'|'live'|'error'|'paused';error:string|null;lastFrameAt:number|null}>({status:'waiting',error:null,lastFrameAt:null});
 const retired=useRef<SkImage[]>([]),layoutReady=useRef(false),invalidateCapture=useRef<()=>void>(()=>{});
 const root=useRef<View>(null),[image,setImage]=useState<SkImage|null>(null),[captureRevision,setCaptureRevision]=useState(0),[appState,setAppState]=useState<string>(AppState.currentState);const window=useWindowDimensions();
 useEffect(()=>{
  let frame=0,last=0,foreground=AppState.currentState==='active';
  const owner=liveBackdropCapture(async()=>{if(!root.current||!layoutReady.current)return null;const next=await makeImageFromView(root);if(!next)throw Error('Native prefix capture returned null');if(next.width()<=0||next.height()<=0){next.dispose();throw Error('Native prefix capture returned empty image');}return next;},next=>{setImage(next);if(next){setCaptureRevision(n=>n+1);setDiagnostic({status:'live',error:null,lastFrameAt:Date.now()});}},old=>retired.current.push(old),error=>setDiagnostic(current=>({...current,status:'error',error:String(error)})));
  invalidateCapture.current=owner.invalidate;
  const loop=(time:number)=>{if(foreground&&time-last>=1000/30){last=time;void owner.update();}frame=requestAnimationFrame(loop);};
  frame=requestAnimationFrame(loop);
  const state=AppState.addEventListener('change',next=>{setAppState(next);foreground=next==='active';if(!foreground){setDiagnostic(current=>({...current,status:'paused'}));owner.clear();retired.current.splice(0).forEach(image=>image.dispose());}else owner.invalidate();});
  return()=>{cancelAnimationFrame(frame);state.remove();owner.stop();retired.current.splice(0).forEach(image=>image.dispose());};
 },[window.width,window.height,PixelRatio.get()]);
 useEffect(()=>{const old=retired.current.splice(0);const frame=requestAnimationFrame(()=>old.forEach(image=>image.dispose()));return()=>{cancelAnimationFrame(frame);old.forEach(image=>image.dispose());};},[image]);
 const context=useMemo(()=>({image,root:root.current,captureRevision,revision:captureRevision,...diagnostic,appState,layers:[...parent.layers,...(image&&root.current?[{image,root:root.current}]:[])]}),[image,parent.layers,captureRevision,appState,diagnostic]);
 return <>
  <View ref={root} collapsable={false} pointerEvents={mode==='flow'||interactiveUnderlay?'box-none':'none'} accessibilityElementsHidden={mode==='absolute'&&!interactiveUnderlay} style={[mode==='absolute'?StyleSheet.absoluteFill:undefined,captureStyle]} onLayout={event=>{layoutReady.current=event.nativeEvent.layout.width>0&&event.nativeEvent.layout.height>0;invalidateCapture.current();}}>{underlay}</View>
  <Context.Provider value={context}>{children}</Context.Provider>
 </>;
}
