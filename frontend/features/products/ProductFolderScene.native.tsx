import {useMemo} from 'react';
import {Skia,useFont} from '@shopify/react-native-skia';
import {mobileFontAssets} from '../../theme/fonts';
import {NativeFigmaScene,sceneMatrix} from '../../components/mobile/NativeFigmaScene.native';
import type {FigmaTreeNode} from '../../components/mobile/FigmaTree';
import type {ProductFolderSceneProps} from './ProductFolderScene';
import {productFolderEvidence as source} from './productFolderEvidence';
const node=(id:string,size:{x:number;y:number},geometry:FigmaTreeNode['geometry'],transform=sceneMatrix(),effects:FigmaTreeNode['effects']=[],children:FigmaTreeNode[]=[]):FigmaTreeNode=>({sourceNodeId:id,size,geometry,transform:{m00:transform[0],m10:transform[1],m01:transform[2],m11:transform[3],m02:transform[4],m12:transform[5]},effects,children,opacity:1,visible:true,clipsContent:false,mask:false,booleanOperation:false,maskPaths:[]});
export function ProductFolderScene({height,sourceHeight,viewBoxY,items,presentation,back,front}:ProductFolderSceneProps){
 const font=useFont(mobileFontAssets.AlibabaPuHuiTiRegular,28);
 const tree=useMemo(()=>{
  const shape=(kind:'closed'|'closedFront',transform:string)=>node(source[kind].surfaceNodeId,{x:source[kind].size.width,y:source[kind].size.height},source[kind].geometry.map(g=>({...g,sourceEffects:[],paint:source[kind].surfaceFills[0]})),sceneMatrix(transform),source[kind].surfaceEffects);
  const preview=items.slice(0,source.previewSlots.length).map((item,index)=>{
   const from=source.closedPreviewSlots[index].transform,to=source.previewSlots[index].transform,slot=source.previewSlots[index],lerp=(a:number,b:number)=>a+(b-a)*presentation;
   const transform=sceneMatrix(`matrix(${lerp(from.m00,to.m00)} ${lerp(from.m10,to.m10)} ${lerp(from.m01,to.m01)} ${lerp(from.m11,to.m11)} ${lerp(from.m02,to.m02)-source.closedBackTransform.m02} ${lerp(from.m12,to.m12)-source.closedBackTransform.m12})`);
   const r=slot.cornerRadius,w=slot.size.x,h=slot.size.y;
   const geometry:FigmaTreeNode['geometry'][number][]=[{sourceNodeId:slot.sourceNodeId,path:`M${r} 0 H${w-r} A${r} ${r} 0 0 1 ${w} ${r} V${h-r} A${r} ${r} 0 0 1 ${w-r} ${h} H${r} A${r} ${r} 0 0 1 0 ${h-r} V${r} A${r} ${r} 0 0 1 ${r} 0Z`,fill:'#FFFFFF',opacity:.7,sourceEffects:[]}];
   if(font){const text=Array.from(item.name.trim())[0]??'·',metrics=font.getMetrics(),x=(w-font.measureText(text).width)/2,y=h/2-(metrics.ascent+metrics.descent)/2;const path=Skia.Path.MakeFromText(text,x,y,font);if(path){geometry.push({sourceNodeId:slot.sourceNodeId,path:path.toSVGString(),fill:'#494A64',opacity:1,sourceEffects:[]});path.dispose();}}
   const result=node(slot.sourceNodeId,slot.size,geometry,transform);result.opacity=index===0?1:Math.max(0,Math.min(1,presentation));return result;
  });
  const face=shape('closedFront',front);face.children=[node('folder-source-slogan',{x:260,y:185},source.slogan.glyphs.map(g=>({sourceNodeId:'280:26962',path:g.path,fill:g.fill,opacity:g.opacity,sourceEffects:[],transform:`matrix(${g.fontSize} 0 0 ${-g.fontSize} ${17+g.position.x} ${113+g.position.y})`})))];
  return node('folder-ordered-root',{x:260,y:sourceHeight},[],sceneMatrix(),[],[shape('closed',back),...preview,face]);
 },[font,items,presentation,back,front,sourceHeight]);
 return <NativeFigmaScene node={tree} width={260} height={height} sourceHeight={sourceHeight} viewBoxY={viewBoxY}/>;
}
