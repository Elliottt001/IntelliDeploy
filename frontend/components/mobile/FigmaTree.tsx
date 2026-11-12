import Svg,{ClipPath,Defs,G,Path,Rect} from 'react-native-svg';
import {Platform} from 'react-native';
import {FigmaEffects} from './FigmaEffects';
import {FigmaGeometry} from './FigmaGeometry';

type Matrix={m00:number;m01:number;m02:number;m10:number;m11:number;m12:number};
export type FigmaTreeNode={
 sourceNodeId:string;size:{x:number;y:number};transform:Matrix;opacity:number;visible:boolean;clipsContent:boolean;mask:boolean;booleanOperation:boolean;
 maskPaths:readonly {path:string;fillRule:'evenodd'|'nonzero'}[];
 effects:readonly {type:string;radius:number;offset:{x:number;y:number};color:{r:number;g:number;b:number;a:number}}[];
 geometry:Parameters<typeof FigmaGeometry>[0]['geometry'];children:readonly FigmaTreeNode[];
};
const matrix=(t:Matrix)=>`matrix(${t.m00} ${t.m10} ${t.m01} ${t.m11} ${t.m02} ${t.m12})`;
function Node({node,prefix,root=false}:{node:FigmaTreeNode;prefix:string;root?:boolean}){
 if(!node.visible)return null;
 const id=`${prefix}-${node.sourceNodeId.replace(':','-')}`,effects=node.effects.filter(e=>['DROP_SHADOW','INNER_SHADOW','FOREGROUND_BLUR'].includes(e.type));
 let mask:string|undefined;
 const children=(node.booleanOperation?[]:node.children).map(child=>{
  if(child.mask){mask=`${prefix}-mask-${child.sourceNodeId.replace(':','-')}`;return null;}
  return <G key={child.sourceNodeId} clipPath={mask?`url(#${mask})`:undefined}><Node node={child} prefix={prefix}/></G>;
 });
 return <G transform={root?undefined:matrix(node.transform)} opacity={node.opacity} {...(Platform.OS==='web'?{'data-source-group':node.sourceNodeId}:{})}>
  <Defs>
   {node.clipsContent&&<ClipPath id={`${id}-frame`}><Rect width={node.size.x} height={node.size.y}/></ClipPath>}
   {node.children.filter(c=>c.mask).map(c=><ClipPath key={c.sourceNodeId} id={`${prefix}-mask-${c.sourceNodeId.replace(':','-')}`}>{c.maskPaths.map((p,i)=><Path key={i} d={p.path} fill="white" transform={matrix(c.transform)} fillRule={p.fillRule}/>)}</ClipPath>)}
   {effects.length>0&&<FigmaEffects effects={effects} id={`${id}-effects`}/>}
  </Defs>
  <G clipPath={node.clipsContent?`url(#${id}-frame)`:undefined} filter={effects.length>0?`url(#${id}-effects)`:undefined}>
   {node.geometry.length>0&&<Svg width={node.size.x} height={node.size.y} style={{overflow:'visible'}}><FigmaGeometry geometry={node.geometry} width={node.size.x} height={node.size.y} prefix={id} overflow="visible"/></Svg>}
   {children}
  </G>
 </G>;
}
export function FigmaTree({node,prefix,testID}:{node:FigmaTreeNode;prefix:string;testID?:string}){
 return <Svg testID={testID} pointerEvents="none" width={node.size.x} height={node.size.y} viewBox={`0 0 ${node.size.x} ${node.size.y}`}><Node node={node} prefix={prefix} root/></Svg>;
}
