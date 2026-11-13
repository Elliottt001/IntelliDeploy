import {createContext,useContext,useEffect,useRef,useState,type PropsWithChildren,type ReactNode} from 'react';
import {AppState,PixelRatio,StyleSheet,View,useWindowDimensions} from 'react-native';
import {makeImageFromView,type SkImage} from '@shopify/react-native-skia';
import {liveBackdropCapture} from './liveBackdropCapture';
const Context=createContext<{image:SkImage|null;root:View|null}>({image:null,root:null});
export const useLiveGlassBackdrop=()=>useContext(Context);
// Explicit prefix slot: callers must supply only actual paint BEFORE children.
// Current optics and foreground are siblings, never descendants of capture root.
export function LiveGlassBackdrop({underlay,children}:PropsWithChildren<{underlay:ReactNode}>){
 const root=useRef<View>(null),[image,setImage]=useState<SkImage|null>(null);const window=useWindowDimensions();
 useEffect(()=>{
  let frame=0,last=0,foreground=AppState.currentState==='active';
  const owner=liveBackdropCapture(()=>root.current?makeImageFromView(root):Promise.resolve(null),setImage);
  const loop=(time:number)=>{if(foreground&&time-last>=1000/30){last=time;void owner.update().catch(()=>{});}frame=requestAnimationFrame(loop);};
  frame=requestAnimationFrame(loop);
  const state=AppState.addEventListener('change',next=>{foreground=next==='active';owner.invalidate();});
  return()=>{cancelAnimationFrame(frame);state.remove();owner.stop();};
 },[window.width,window.height,PixelRatio.get()]);
 return <Context.Provider value={{image,root:root.current}}>
  <View ref={root} collapsable={false} pointerEvents="none" accessibilityElementsHidden style={StyleSheet.absoluteFill} onLayout={()=>{}}>{underlay}</View>
  {children}
 </Context.Provider>;
}
