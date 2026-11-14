import {createContext,useContext,useLayoutEffect,useRef,type PropsWithChildren} from 'react';
import {View,Animated,Platform,StyleSheet,type StyleProp,type ViewStyle} from 'react-native';
import {sourceRouteNodes} from '../../design/sourceControlMotionEvidence';
import {RouteSnapshotView,type RouteSnapshot,measureRouteNode} from './sourceRouteSnapshot';
export type SharedBounds={x:number;y:number;width:number;height:number};
export type SharedNode={key:string;sourceNodeId:string;ref:React.RefObject<View|null>;live:boolean};
export type SharedPresentation={key:string;sourceNodeId:string;snapshot:RouteSnapshot;bounds:SharedBounds};
export const SharedRouteContext=createContext<{
 register:(node:SharedNode)=>()=>void;previous:readonly SharedPresentation[];progress:number;smart:boolean;
}>({register:()=>()=>{},previous:[],progress:1,smart:false});
export function SourceRouteNode({sourceNodeId,style,children,testID,ghost=false,presentation,captureHeight,contentHeight}:{sourceNodeId:string;captureHeight?:number;contentHeight?:ViewStyle['height'];style?:StyleProp<ViewStyle>;testID?:string;ghost?:boolean;presentation?:SharedPresentation}&PropsWithChildren){
 const metadata=sourceRouteNodes[sourceNodeId as keyof typeof sourceRouteNodes];
 const context=useContext(SharedRouteContext),ref=useRef<View>(null),bounds=useRef<SharedBounds|null>(null);
 const key=metadata?.key??sourceNodeId;
 useLayoutEffect(()=>metadata?context.register({key,sourceNodeId,ref,live:!ghost}):undefined,[context.register,key,sourceNodeId,ghost]);
 const previous=presentation??context.previous.find(node=>node.key===key),t=context.progress;
 const initial=bounds.current;
 // Root matrices are actual measured source presentations; no design-size
 // viewport translation or cross-page scale assumption is substituted.
 const layout=StyleSheet.flatten(style)??{};
 const old=previous?.bounds;
 const transform=context.smart&&old&&initial&&!ghost?[{translateX:(old.x-initial.x)*(1-t)},{translateY:(old.y-initial.y)*(1-t)},{scaleX:1+(old.width/Math.max(initial.width,1)-1)*(1-t)},{scaleY:1+(old.height/Math.max(initial.height,1)-1)*(1-t)}]:undefined;
 return <Animated.View ref={ref} collapsable={false} testID={testID} pointerEvents={ghost?'none':'box-none'} accessibilityElementsHidden={ghost} style={[style,captureHeight?{height:captureHeight}:undefined,transform?{transform:[...(Array.isArray(layout.transform)?layout.transform:[]),...transform],transformOrigin:'left top'}:undefined]} onLayout={()=>{void measureRouteNode(ref).then(value=>{if(value)bounds.current=value;});}} {...(Platform.OS==='web'?{dataSet:{sourceSmartNode:key,sourceSmartId:sourceNodeId},...(ghost?{'aria-hidden':true}:{})}: {})}>
  <Animated.View pointerEvents={ghost?'none':'box-none'} style={{height:contentHeight,flexGrow:contentHeight===undefined?1:0,flexShrink:contentHeight===undefined?1:0,alignSelf:'stretch',flexDirection:layout.flexDirection,alignItems:layout.alignItems,justifyContent:layout.justifyContent,gap:layout.gap,rowGap:layout.rowGap,columnGap:layout.columnGap,opacity:context.smart?(ghost?0:Math.max(0,Math.min(1,t))):1}}>{children}</Animated.View>
  {context.smart&&previous&&<View pointerEvents="none" accessibilityElementsHidden style={{position:'absolute',inset:0,opacity:Math.max(0,Math.min(1,1-t))}}><RouteSnapshotView snapshot={previous.snapshot} x={0} y={0} width={initial?.width??old!.width} height={initial?.height??old!.height}/></View>}
 </Animated.View>;
}
