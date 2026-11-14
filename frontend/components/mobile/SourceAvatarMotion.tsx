import {SourceRouteNode} from './sourceRouteShared';
import {useSourceRouteTransition} from './SourceRouteTransition';
import {useState} from 'react';
import {Platform,Pressable,View} from 'react-native';
import {sourceControlStates} from '../../design/sourceControlMotionEvidence';
import {getSourceMotion} from '../../design/sourceMotionEvidence';
import {FigmaTree} from './FigmaTree';
import {useSourceTreeMotion} from './useSourceTreeMotion';
export function SourceAvatarMotion({sourceNodeId='270:26291',active,interactive=false,onNavigateHome,presentationRef,testID='source-avatar-motion'}:{sourceNodeId?:string;active?:boolean;interactive?:boolean;onNavigateHome?:()=>void;presentationRef?:{current:{sourceNodeId:string}|null};testID?:string}){
 const navigate=useSourceRouteTransition();
 const activate=()=>{setHovered(true);if(onNavigateHome)navigate(getSourceMotion(sourceNodeId,'ON_HOVER'),onNavigateHome,'/');};
 const [hovered,setHovered]=useState(false);
 const normal=sourceControlStates[sourceNodeId]??sourceControlStates['270:26291'];
 const motion=getSourceMotion(sourceNodeId,'ON_HOVER')??getSourceMotion('266:21194','ON_HOVER');
 const state=useSourceTreeMotion((active??hovered)?sourceControlStates['188:16338']:normal,motion);
 if(presentationRef)presentationRef.current=state;
 const dx=state.transform.m02-normal.transform.m02,dy=state.transform.m12-normal.transform.m12;
 const art=<SourceRouteNode sourceNodeId={sourceNodeId} style={{width:state.size.x,height:state.size.y,transform:[{translateX:dx},{translateY:dy}]}}><FigmaTree node={state} prefix={testID}/></SourceRouteNode>;
 if(!interactive)return art;
 return <Pressable accessibilityRole="button" accessibilityLabel="查看品牌头像状态" onHoverIn={activate} onHoverOut={()=>setHovered(false)} onPressIn={()=>{if(Platform.OS!=='web')activate();}} onPressOut={()=>{if(Platform.OS!=='web')setHovered(false);}} style={{minWidth:44,minHeight:44}} testID={testID}>{art}</Pressable>;
}
