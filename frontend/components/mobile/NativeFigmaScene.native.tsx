import {useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {PixelRatio,View,StyleSheet} from 'react-native';
import {Canvas,Image,Skia,type CanvasRef,type SkImage} from '@shopify/react-native-skia';
import type {FigmaVectorLayer} from '../../design/figmaComponentEvidence';
import type {FigmaSourceEffect} from './FigmaEffects';
import {glassEvidence} from '../../design/glassEvidence';
import {useLiveGlassBackdrop} from './glass/LiveGlassBackdrop.native';
import {renderNativeGroupScene,lastNativeFrameResources,disposeNativeGroupCaches} from './glass/nativeGroupScene';
import type {FigmaTreeNode} from './FigmaTree';
let mountedSourceScenes=0;
export type SceneMatrix=readonly [number,number,number,number,number,number];
export const identity:SceneMatrix=[1,0,0,1,0,0];
export function sceneMatrix(text?:string):SceneMatrix{return (text?.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number)??identity) as unknown as SceneMatrix;}
const multiply=(l:SceneMatrix,r:SceneMatrix):SceneMatrix=>[l[0]*r[0]+l[2]*r[1],l[1]*r[0]+l[3]*r[1],l[0]*r[2]+l[2]*r[3],l[1]*r[2]+l[3]*r[3],l[0]*r[4]+l[2]*r[5]+l[4],l[1]*r[4]+l[3]*r[5]+l[5]];
export type SceneLayer=Omit<FigmaVectorLayer,'paint'|'sourceEffects'> & {sourceEffects?:readonly FigmaSourceEffect[];sourceSize?:{x:number;y:number};paint?:{type:string;transform?:string;gradientStops?:readonly {color?:string;opacity:number;position:number}[]}};
export function NativeFigmaScene({geometry,width,height,transform,node,testID,sourceHeight,viewBoxY=0,canvasRef,onImage,onMetrics,surfaceOnly=false}:{geometry?:readonly SceneLayer[];width:number;height:number;transform?:string;node?:FigmaTreeNode;testID?:string;sourceHeight?:number;viewBoxY?:number;surfaceOnly?:boolean;canvasRef?:RefObject<CanvasRef|null>;onImage?:(image:SkImage)=>void;onMetrics?:(metrics:{compositionMs:number;resources:{created:number;released:number;live:number}})=>void}){
 useEffect(()=>{mountedSourceScenes++;return()=>{if(--mountedSourceScenes===0)disposeNativeGroupCaches();};},[]);
 const ref=useRef<View>(null),[layoutWidth,setLayoutWidth]=useState(width),[origins,setOrigins]=useState<ReadonlyMap<View,{x:number;y:number}>>(new Map());const {layers}=useLiveGlassBackdrop();const generation=useRef(0);
 useEffect(()=>{const token=++generation.current;let pending=layers.length;const input=new Map<View,{x:number;y:number}>();
  if(!pending)return;ref.current?.measureInWindow((x,y)=>layers.forEach(l=>l.root.measureInWindow((rx,ry)=>{if(token!==generation.current)return;input.set(l.root,{x:rx-x,y:ry-y});if(--pending===0)setOrigins(input);})));return()=>{generation.current++;};
 },[layers,layoutWidth,height]);
 const scale:SceneMatrix=[layoutWidth/width,0,0,sourceHeight?height/sourceHeight:1,0,-viewBoxY*(sourceHeight?height/sourceHeight:1)];
 const world=node?scale:multiply(scale,sceneMatrix(transform));
 const tree=useMemo(()=>node??geometryTree(geometry??[],width,height),[node,JSON.stringify(geometry),width,height]);
 // Store coordinates, never retired image objects. Every render samples the
 // currently published prefix; late measurement callbacks cannot revive images.
 const render=useMemo(()=>{const started=performance.now();const image=renderNativeGroupScene(Skia,tree,{width:layoutWidth,height,dpr:PixelRatio.get(),world,includeBackdrop:!surfaceOnly,backdrops:layers.filter(l=>origins.has(l.root)).map(l=>({image:l.image,...origins.get(l.root)!,width:l.image.width()/PixelRatio.get(),height:l.image.height()/PixelRatio.get()}))});return {image,compositionMs:performance.now()-started,resources:lastNativeFrameResources};},[tree,layoutWidth,height,JSON.stringify(world),layers,origins,surfaceOnly]);
 const image=render.image;
 useEffect(()=>{onMetrics?.({compositionMs:render.compositionMs,resources:render.resources});},[render,onMetrics]);
 useEffect(()=>{onImage?.(image);},[image,onImage]);
 useEffect(()=>()=>image.dispose(),[image]);
 return <View ref={ref} collapsable={false} testID={testID} pointerEvents="none" accessibilityElementsHidden style={{width:'100%',height}} onLayout={e=>setLayoutWidth(e.nativeEvent.layout.width)}><Canvas ref={canvasRef} style={StyleSheet.absoluteFill}><Image image={image} x={0} y={0} width={layoutWidth} height={height}/></Canvas></View>;
}
function geometryTree(geometry:readonly SceneLayer[],width:number,height:number):FigmaTreeNode{
 const base={size:{x:width,y:height},transform:{m00:1,m01:0,m02:0,m10:0,m11:1,m12:0},opacity:1,visible:true,clipsContent:false,mask:false,booleanOperation:false,maskPaths:[],effects:[],geometry:[],children:[]} satisfies Omit<FigmaTreeNode,'sourceNodeId'>;
 const groups:SceneLayer[][]=[];for(const l of geometry){const previous=groups.at(-1);if(previous&&previous[0].sourceNodeId===l.sourceNodeId&&previous[0].transform===l.transform&&JSON.stringify(previous[0].sourceEffects)===JSON.stringify(l.sourceEffects))previous.push(l);else groups.push([l]);}
 return {...base,sourceNodeId:'native-source-root',children:groups.map(layers=>{const l=layers[0],source=glassEvidence[l.sourceNodeId],m=sceneMatrix(l.transform);return {...base,sourceNodeId:l.sourceNodeId,size:source?.size??l.sourceSize??base.size,transform:{m00:m[0],m10:m[1],m01:m[2],m11:m[3],m02:m[4],m12:m[5]},effects:l.sourceEffects??source?.effects??[],geometry:layers.map(l=>({...l,transform:undefined,sourceEffects:[]})) as unknown as FigmaTreeNode['geometry']};})};
}
