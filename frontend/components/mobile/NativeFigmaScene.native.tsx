import {useEffect,useRef,useState} from 'react';
import {PixelRatio,View,StyleSheet} from 'react-native';
import {Canvas,Group,Path,Image,LinearGradient,RadialGradient,SweepGradient,vec,Skia,Shadow,Blur,type SkMatrix} from '@shopify/react-native-skia';
import type {FigmaSourceEffect} from './FigmaEffects';
import type {FigmaVectorLayer} from '../../design/figmaComponentEvidence';
import {glassEvidence} from '../../design/glassEvidence';
import {SourceGlassLayer,type SceneMatrix} from './glass/SourceGlassLayer.native';
import {useLiveGlassBackdrop} from './glass/LiveGlassBackdrop.native';
import type {FigmaTreeNode} from './FigmaTree';
export const identity:SceneMatrix=[1,0,0,1,0,0];
export function sceneMatrix(text?:string):SceneMatrix{return (text?.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number)??identity) as unknown as SceneMatrix;}
export function multiply(l:SceneMatrix,r:SceneMatrix):SceneMatrix{return [l[0]*r[0]+l[2]*r[1],l[1]*r[0]+l[3]*r[1],l[0]*r[2]+l[2]*r[3],l[1]*r[2]+l[3]*r[3],l[0]*r[4]+l[2]*r[5]+l[4],l[1]*r[4]+l[3]*r[5]+l[5]];}
const skMatrix=([a,b,c,d,x,y]:SceneMatrix)=>Skia.Matrix([a,c,x,b,d,y,0,0,1]);
export type SceneLayer=Omit<FigmaVectorLayer,'paint'|'sourceEffects'> & {sourceEffects?:readonly FigmaSourceEffect[];sourceSize?:{x:number;y:number};paint?:{type:string;transform?:string;gradientStops?:readonly {color?:string;opacity:number;position:number}[]}};
export function NativeFigmaScene({geometry,width,height,transform,node,testID}: {geometry?:readonly SceneLayer[];width:number;height:number;transform?:string;node?:FigmaTreeNode;testID?:string}){
 const ref=useRef<View>(null),[layoutWidth,setLayoutWidth]=useState(width),[origin,setOrigin]=useState({x:0,y:0});const {image,root}=useLiveGlassBackdrop();
 useEffect(()=>{if(!image)return;ref.current?.measureInWindow((x,y)=>{root?.measureInWindow((rx,ry)=>setOrigin({x:x-rx,y:y-ry}));});},[image,root]);
 const scale:SceneMatrix=[layoutWidth/width,0,0,1,0,0];
 return <View ref={ref} collapsable={false} testID={testID} pointerEvents="none" accessibilityElementsHidden style={{width:'100%',height}} onLayout={e=>setLayoutWidth(e.nativeEvent.layout.width)}>
  <Canvas style={StyleSheet.absoluteFill}>
   {image&&<Image image={image} x={-origin.x} y={-origin.y} width={image.width()/PixelRatio.get()} height={image.height()/PixelRatio.get()}/>}
   <Group matrix={skMatrix(scale)}>{node?<TreePaint node={node} world={scale} root/>:<GeometryPaint geometry={geometry??[]} world={multiply(scale,sceneMatrix(transform))} transform={sceneMatrix(transform)}/>}</Group>
  </Canvas>
 </View>;
}
export function GeometryPaint({geometry,world,transform=identity}:{geometry:readonly SceneLayer[];world:SceneMatrix;transform?:SceneMatrix}){
 const groups:Array<{layers:SceneLayer[];index:number}>=[];
 geometry.forEach((l,i)=>{const previous=groups[groups.length-1];if(previous&&previous.layers[0].sourceNodeId===l.sourceNodeId&&previous.layers[0].transform===l.transform)previous.layers.push(l);else groups.push({layers:[l],index:i});});
 return <Group matrix={skMatrix(transform)}>{groups.map(({layers,index})=>{
  const l=layers[0],source=glassEvidence[l.sourceNodeId],m=sceneMatrix(l.transform),effects=l.sourceEffects??source?.effects??[];
  return <Group key={index} matrix={skMatrix(m)}>
   {source&&<SourceGlassLayer effects={effects} width={source.size.x} height={source.size.y} paths={layers.map(l=>({path:l.path,fillRule:l.fillRule}))} worldMatrix={multiply(world,m)}/>}
   {layers.map((layer,i)=><ScenePath key={i} layer={{...layer,transform:undefined}} size={source?.size}/>) }
  </Group>;
 })}</Group>;
}
function ScenePath({layer,size}:{layer:SceneLayer;size?:{x:number;y:number}}){
 const path=Skia.Path.MakeFromSVGString(layer.path);if(!path)return null;if(layer.fillRule==='evenodd')path.setFillType(1);
 const p=layer.paint,stops=p?.gradientStops??[],m=sceneMatrix(p?.transform),[a,b,c,d,x,y]=m,det=a*d-b*c,s=size??layer.sourceSize??{x:1,y:1};
 const gradientMatrix=skMatrix([d/det*s.x,-b/det*s.y,-c/det*s.x,a/det*s.y,(c*y-d*x)/det*s.x,(b*x-a*y)/det*s.y]);
 const colors=stops.map(stop=>{const c=Skia.Color(stop.color??'#ffffff');c[3]=stop.opacity;return c;}),positions=stops.map(s=>s.position);
 const effects=layer.sourceEffects??[];
 return <Group opacity={layer.opacity} matrix={skMatrix(sceneMatrix(layer.transform))}>
  <Path path={path} color={layer.fill??'transparent'}>
   {p?.type==='GRADIENT_LINEAR'&&<LinearGradient start={vec(0,0)} end={vec(1,0)} colors={colors} positions={positions} matrix={gradientMatrix}/>}
   {p?.type==='GRADIENT_RADIAL'&&<RadialGradient c={vec(.5,.5)} r={.5} colors={colors} positions={positions} matrix={gradientMatrix}/>}
   {p?.type==='GRADIENT_ANGULAR'&&<SweepGradient c={vec(.5,.5)} colors={colors} positions={positions} matrix={gradientMatrix}/>}
   {effects.filter(e=>e.visible!==false).map((e,i)=>e.type==='DROP_SHADOW'||e.type==='INNER_SHADOW'?<Shadow key={i} dx={e.offset?.x??0} dy={e.offset?.y??0} blur={e.radius/2} color={typeof e.color==='string'?e.color:'#ffffff'} inner={e.type==='INNER_SHADOW'}/>:e.type==='FOREGROUND_BLUR'?<Blur key={i} blur={e.radius/2}/>:null)}
  </Path>
  {layer.stroke&&<Path path={path} color={layer.stroke} style="stroke" strokeWidth={layer.strokeWidth??1}/>}
 </Group>;
}
function TreePaint({node,world,root=false}:{node:FigmaTreeNode;world:SceneMatrix;root?:boolean}){
 if(!node.visible)return null;const m=root?identity:[node.transform.m00,node.transform.m10,node.transform.m01,node.transform.m11,node.transform.m02,node.transform.m12] as SceneMatrix;
 const next=multiply(world,m);let mask:string|undefined;
 const clip=node.clipsContent?Skia.Path.Make().addRRect(Skia.RRectXY(Skia.XYWHRect(0,0,node.size.x,node.size.y),node.cornerRadius??0,node.cornerRadius??0)):undefined;
 return <Group matrix={skMatrix(m)} opacity={node.opacity} clip={clip}>
  <SourceGlassLayer effects={node.effects} width={node.size.x} height={node.size.y} paths={node.geometry.map(l=>({path:l.path,fillRule:l.fillRule}))} worldMatrix={next}/>
  <GeometryPaint geometry={node.geometry} world={next}/>
  {!node.booleanOperation&&node.children.map(child=>{
   if(child.mask){mask=child.sourceNodeId;return null;}
   const maskNode=node.children.find(c=>c.sourceNodeId===mask);let maskPath;
   if(maskNode){maskPath=Skia.Path.Make();for(const p of maskNode.maskPaths){const path=Skia.Path.MakeFromSVGString(p.path);if(path){path.transform(skMatrix([maskNode.transform.m00,maskNode.transform.m10,maskNode.transform.m01,maskNode.transform.m11,maskNode.transform.m02,maskNode.transform.m12]));maskPath.addPath(path);}}}
   return <Group key={child.sourceNodeId} clip={maskPath}><TreePaint node={child} world={next}/></Group>;
  })}
 </Group>;
}
