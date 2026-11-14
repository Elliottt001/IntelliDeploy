import {nativeFrameResources} from './nativeFrameResources';
import type {Skia,SkImage,SkSurface,SkImageFilter,SkColor,SkRuntimeEffect,SkPicture} from '@shopify/react-native-skia';
import {BlendMode,TileMode,ClipOp,FilterMode,MipmapMode,ColorType,AlphaType,PaintStyle} from '@shopify/react-native-skia/src/skia/types';
import type {FigmaTreeNode} from '../FigmaTree';
import type {FigmaSourceEffect} from '../FigmaEffects';
import {glassEvidence} from '../../../design/glassEvidence';
import {nativeGlassShader} from './nativeGlassShader';
import {sourcePathSegments} from './sourcePathSegments';
import {evaluateGlassField} from './sourceGlassModel';
type Matrix=readonly [number,number,number,number,number,number];
const identity:Matrix=[1,0,0,1,0,0];
const multiply=(l:Matrix,r:Matrix):Matrix=>[l[0]*r[0]+l[2]*r[1],l[1]*r[0]+l[3]*r[1],l[0]*r[2]+l[2]*r[3],l[1]*r[2]+l[3]*r[3],l[0]*r[4]+l[2]*r[5]+l[4],l[1]*r[4]+l[3]*r[5]+l[5]];
const parse=(t?:string):Matrix=>(t?.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number)??identity) as unknown as Matrix;
const columns=([a,b,c,d,x,y]:Matrix)=>[a,b,0,c,d,0,x,y,1];
const inverse=([a,b,c,d,x,y]:Matrix):Matrix=>{const det=a*d-b*c;return [d/det,-b/det,-c/det,a/det,(c*y-d*x)/det,(b*x-a*y)/det];};
const matrix=(sk:typeof Skia,[a,b,c,d,x,y]:Matrix)=>sk.Matrix([a,c,x,b,d,y,0,0,1]);
export type NativeGroupSceneOptions={width:number;height:number;dpr:number;world?:Matrix;includeBackdrop?:boolean;backdrops:readonly {image:SkImage;x:number;y:number;width:number;height:number}[]};
const shaders=new Map<string,SkRuntimeEffect>();
const staticGroups=new Map<string,SkPicture>();
const visible=(e:FigmaSourceEffect)=>e.visible!==false;
const containsGlass=(n:FigmaTreeNode):boolean=>n.effects.some(e=>visible(e)&&e.type==='GLASS')||n.geometry.some(g=>g.sourceEffects?.some(e=>visible(e)&&e.type==='GLASS'))||n.children.some(containsGlass);
function color(sk:typeof Skia,e:FigmaSourceEffect):SkColor{const c=e.sourceColor??(typeof e.color==='object'?e.color:undefined);const out=c?Float32Array.of(c.r,c.g,c.b,c.a):sk.Color(typeof e.color==='string'?e.color:'#000000');out[3]=e.opacity??c?.a??out[3];return out;}
// Mirrors the installed Skia inner-shadow DAG. Only group SourceGraphic enters it.
function effectFilter(sk:typeof Skia,effects:readonly FigmaSourceEffect[],world:Matrix){
 let input:SkImageFilter|null=null;
 const supported=effects.filter(visible);
 for(let index=0;index<supported.length;index++){const e=supported[index];
  const dx=world[0]*(e.offset?.x??0)+world[2]*(e.offset?.y??0),dy=world[1]*(e.offset?.x??0)+world[3]*(e.offset?.y??0);
  const sx=e.radius/2*Math.hypot(world[0],world[1]),sy=e.radius/2*Math.hypot(world[2],world[3]);
  if(e.type==='FOREGROUND_BLUR')input=sk.ImageFilter.MakeBlur(sx,sy,TileMode.Decal,input);
  else if(e.type==='DROP_SHADOW'){
   const batch:FigmaSourceEffect[]=[e];while(supported[index+1]?.type==='DROP_SHADOW')batch.push(supported[++index]);
   const graphic=input??sk.ImageFilter.MakeColorFilter(sk.ColorFilter.MakeBlend(Float32Array.of(0,0,0,1),BlendMode.Dst),null);
   const hardAlpha=sk.ImageFilter.MakeColorFilter(sk.ColorFilter.MakeMatrix([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,127,0]),null);
   let shadows:SkImageFilter|null=null;
   for(const s of [...batch].reverse()){
    const x=world[0]*(s.offset?.x??0)+world[2]*(s.offset?.y??0),y=world[1]*(s.offset?.x??0)+world[3]*(s.offset?.y??0);
    let shadow=sk.ImageFilter.MakeDropShadowOnly(x,y,s.radius/2*Math.hypot(world[0],world[1]),s.radius/2*Math.hypot(world[2],world[3]),color(sk,s),input);
    if(s.showShadowBehindNode===false)shadow=sk.ImageFilter.MakeBlend(BlendMode.DstOut,shadow,hardAlpha);
    shadows=shadows?sk.ImageFilter.MakeBlend(BlendMode.SrcOver,shadows,shadow):shadow;
   }
   input=sk.ImageFilter.MakeBlend(BlendMode.SrcOver,shadows!,graphic);
  }
  else if(e.type==='INNER_SHADOW'){
   const black=Float32Array.of(0,0,0,1);
   const graphic=sk.ImageFilter.MakeColorFilter(sk.ColorFilter.MakeBlend(black,BlendMode.Dst),null);
   const alpha=sk.ImageFilter.MakeColorFilter(sk.ColorFilter.MakeBlend(black,BlendMode.SrcIn),null);
   const outside=sk.ImageFilter.MakeColorFilter(sk.ColorFilter.MakeBlend(color(sk,e),BlendMode.SrcOut),null);
   const blur=sk.ImageFilter.MakeBlur(sx,sy,TileMode.Decal,sk.ImageFilter.MakeOffset(dx,dy,outside));
   const inner=sk.ImageFilter.MakeBlend(BlendMode.SrcIn,alpha,blur);
   const combined=sk.ImageFilter.MakeBlend(BlendMode.SrcOver,graphic,inner);
   input=input?sk.ImageFilter.MakeCompose(combined,input):combined;
  }
 }
 return input;
}
// Each group has a transparent SourceGraphic surface. Glass explicitly samples
// the parent prefix + this group's already-painted source. Filtering the finished
// group never filters external backdrop or includes current optics in its input.
export function renderNativeGroupScene(nativeApi:typeof Skia,node:FigmaTreeNode,o:NativeGroupSceneOptions):SkImage{
 const frame=nativeFrameResources(nativeApi),sk=frame.api,release=frame.release;
 const canvases=new WeakMap<SkSurface,ReturnType<SkSurface['getCanvas']>>();
 const canvasOf=(surface:SkSurface)=>{const prior=canvases.get(surface);if(prior)return prior;const canvas=surface.getCanvas();canvases.set(surface,canvas);return canvas;};
 try{
 const opticalPadding=(n:FigmaTreeNode,m:Matrix,root=false):number=>{const t=n.transform,local=root?m:multiply(m,[t.m00,t.m10,t.m01,t.m11,t.m02,t.m12]),scale=Math.max(Math.hypot(local[0],local[1]),Math.hypot(local[2],local[3]));return Math.max(0,...n.effects.filter(visible).map(e=>e.type==='GLASS'?(e.radius*1.5+Math.abs((e.refractionRadius??0)*(e.refractionIntensity??0))*(1+Math.abs(e.chromaticAberration??0))+Math.abs(e.reflectionDistance??0))*scale:0),...n.children.map(c=>opticalPadding(c,local)));};
 const pad=Math.ceil(opticalPadding(node,o.world??identity,true));
 const W=Math.max(1,Math.ceil((o.width+2*pad)*o.dpr)),H=Math.max(1,Math.ceil((o.height+2*pad)*o.dpr));
 // Make is SkSurfaces::Raster in the official native factory; MakeOffscreen
 // shares Metal/Ganesh with UI and must never run on this JS composition path.
 const surface=()=>{const s=sk.Surface.Make(W,H);if(!s)throw Error('Source group offscreen allocation failed');canvasOf(s).clear(sk.Color('transparent'));return s;};
 const snapshot=(s:SkSurface)=>{s.flush();return s.makeImageSnapshot();};
 const merge=(before:SkImage,current:SkSurface)=>{const s=surface();canvasOf(s).drawImage(before,0,0);const image=snapshot(current);canvasOf(s).drawImage(image,0,0);release(image);const result=snapshot(s);release(s);return result;};
 const drawImage=(target:SkSurface,image:SkImage,opacity=1,filter:SkImageFilter|null=null,blend?:string)=>{const p=sk.Paint();p.setAlphaf(opacity);if(blend&&blend!=='NORMAL'){const key=Object.keys(BlendMode).find(k=>k.toLowerCase()===blend.toLowerCase().replaceAll('_',''));if(key)p.setBlendMode(BlendMode[key as keyof typeof BlendMode] as BlendMode);}if(filter)p.setImageFilter(filter);canvasOf(target).drawImage(image,0,0,p);release(p);};
 const path=(raw:string,world:Matrix)=>{const p=sk.Path.MakeFromSVGString(raw);if(p)p.transform(matrix(sk,world));return p;};
 const paintGeometry=(target:SkSurface,n:FigmaTreeNode,world:Matrix)=>{
  for(const l of n.geometry){const local=multiply(world,parse(l.transform)),p=path(l.path,local);if(!p)continue;if(l.fillRule==='evenodd')p.setFillType(1);
   const paint=sk.Paint();paint.setAntiAlias(true);const solid=sk.Color(l.fill??'transparent');solid[3]*=l.opacity;paint.setColor(solid);
   const fill=l.paint,stops=fill?.gradientStops??[];
   if(fill?.type.startsWith('GRADIENT')&&stops.length){const size=glassEvidence[l.sourceNodeId]?.size??n.size;const fm=inverse(parse(fill.transform));const gradientWorld=multiply(local,multiply([size.x,0,0,size.y,0,0],fm));
    const colors=stops.map(s=>{const c=sk.Color(s.color??'#ffffff');c[3]=s.opacity;return c;}),positions=stops.map(s=>s.position);const m=matrix(sk,gradientWorld);
    const shader=fill.type==='GRADIENT_RADIAL'?sk.Shader.MakeRadialGradient(sk.Point(.5,.5),.5,colors,positions,TileMode.Clamp,m):fill.type==='GRADIENT_ANGULAR'?sk.Shader.MakeSweepGradient(.5,.5,colors,positions,TileMode.Clamp,m):sk.Shader.MakeLinearGradient(sk.Point(0,0),sk.Point(1,0),colors,positions,TileMode.Clamp,m);
    paint.setShader(shader);paint.setAlphaf(l.opacity);release(shader);
   }
   const filter=effectFilter(sk,l.sourceEffects??[],local);if(filter)paint.setImageFilter(filter);canvasOf(target).drawPath(p,paint);
   if(l.stroke){const stroke=sk.Paint();stroke.setAntiAlias(true);stroke.setStyle(PaintStyle.Stroke);stroke.setStrokeWidth((l.strokeWidth??1)*Math.hypot(local[0],local[1]));stroke.setColor(sk.Color(l.stroke));stroke.setAlphaf(l.opacity);canvasOf(target).drawPath(p,stroke);release(stroke);}
   release(p);release(paint);
  }
 };
 const drawOptics=(target:SkSurface,n:FigmaTreeNode,world:Matrix,before:SkImage,type:'GLASS'|'NOISE')=>{
  if(!n.effects.some(e=>visible(e)&&e.type===type))return;
  const paths=n.geometry.length?n.geometry:glassEvidence[n.sourceNodeId]?.paths??[];
  const localPath=sk.Path.Make();for(const raw of paths){const p=sk.Path.MakeFromSVGString(raw.path);if(p){if(raw.fillRule==='evenodd')p.setFillType(1);localPath.addPath(p);release(p);}}
  const devicePath=localPath.copy();devicePath.transform(matrix(sk,world));
  for(const e of n.effects.filter(e=>visible(e)&&e.type===type)){
   if(type==='GLASS'){
    let input=merge(before,target);
    if(e.radius>0){const frost=surface();drawImage(frost,input,1,sk.ImageFilter.MakeBlur(e.radius/2*Math.hypot(world[0],world[1]),e.radius/2*Math.hypot(world[2],world[3]),TileMode.Clamp));release(input);input=snapshot(frost);release(frost);}
    const text=nativeGlassShader(e,sourcePathSegments(localPath.toCmds()));let effect=shaders.get(text);if(!effect){effect=sk.RuntimeEffect.Make(text)??undefined;if(!effect)throw Error('Source GLASS group shader compile failed');frame.retain(effect);shaders.set(text,effect);if(shaders.size>64){const key=shaders.keys().next().value!;release(shaders.get(key));shaders.delete(key);}}
    const child=input.makeShaderOptions(TileMode.Clamp,TileMode.Clamp,FilterMode.Linear,MipmapMode.None);
    const shader=effect.makeShaderWithChildren([...columns(inverse(world)),...columns(world)],[child]);const p=sk.Paint();p.setAntiAlias(true);p.setShader(shader);
    canvasOf(target).drawPath(devicePath,p);release(p);release(shader);release(child);release(input);
   }else{
    const w=Math.max(1,Math.ceil(n.size.x)),h=Math.max(1,Math.ceil(n.size.y)),bytes=new Uint8Array(w*h*4),c=color(sk,e);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const f=evaluateGlassField(e,{x,y,width:w,height:h,distance:0,normal:{x:0,y:0}}),i=(y*w+x)*4;bytes[i]=c[0]*255;bytes[i+1]=c[1]*255;bytes[i+2]=c[2]*255;bytes[i+3]=Math.round(f.noiseAlpha*(e.sourceColor?.a??(typeof e.color==='object'?e.color.a:1))*255);}
    const image=sk.Image.MakeImage({width:w,height:h,colorType:ColorType.RGBA_8888,alphaType:AlphaType.Unpremul},sk.Data.fromBytes(bytes),w*4);
    if(image){const canvas=canvasOf(target);canvas.save();if(e.clipToShape!==false)canvas.clipPath(devicePath,ClipOp.Intersect,true);canvas.concat(matrix(sk,world));canvas.drawImageRect(image,sk.XYWHRect(0,0,w,h),sk.XYWHRect(0,0,n.size.x,n.size.y),sk.Paint());canvas.restore();release(image);}
   }
  }
  release(localPath);release(devicePath);
 };
 const paintNode=(n:FigmaTreeNode,before:SkImage,world:Matrix,root=false):SkImage=>{
  const t=n.transform,local=root?world:multiply(world,[t.m00,t.m10,t.m01,t.m11,t.m02,t.m12]);
  const key=!containsGlass(n)?JSON.stringify([W,H,n,local]):null;
  if(key&&staticGroups.has(key)){const s=surface();canvasOf(s).drawPicture(staticGroups.get(key)!);const image=snapshot(s);release(s);return image;}
  const source=surface(),canvas=canvasOf(source);let clipFrame;
  if(n.clipsContent){clipFrame=sk.Path.Make();clipFrame.addRRect(sk.RRectXY(sk.XYWHRect(0,0,n.size.x,n.size.y),n.cornerRadius??0,n.cornerRadius??0));clipFrame.transform(matrix(sk,local));canvas.clipPath(clipFrame,ClipOp.Intersect,true);}
  if(n.visible){drawOptics(source,n,local,before,'GLASS');paintGeometry(source,n,local);drawOptics(source,n,local,before,'NOISE');
   if(!n.booleanOperation){let mask:FigmaTreeNode|undefined;
    for(const child of n.children){if(child.mask){mask=child;continue;}if(!child.visible)continue;canvas.save();
     if(mask){const mt=mask.transform,m=multiply(local,[mt.m00,mt.m10,mt.m01,mt.m11,mt.m02,mt.m12]),clip=sk.Path.Make();for(const p of mask.maskPaths){const pth=path(p.path,m);if(pth){if(p.fillRule==='evenodd'){pth.setFillType(1);clip.setFillType(1);}clip.addPath(pth);release(pth);}}canvas.clipPath(clip,ClipOp.Intersect,true);release(clip);}
     const needsPrefix=containsGlass(child),prefix=needsPrefix?merge(before,source):before,image=paintNode(child,prefix,local);const ct=child.transform,cw=multiply(local,[ct.m00,ct.m10,ct.m01,ct.m11,ct.m02,ct.m12]);drawImage(source,image,child.opacity,effectFilter(sk,child.effects,cw),child.blendMode);if(needsPrefix)release(prefix);release(image);canvas.restore();
    }
   }
  }
  const result=snapshot(source);release(source);if(clipFrame)release(clipFrame);
  if(key){const recorder=sk.PictureRecorder(),recordCanvas=recorder.beginRecording(sk.XYWHRect(0,0,W,H));
   const record=(value:FigmaTreeNode,m:Matrix,isRoot=false)=>{
    if(!value.visible)return;const t=value.transform,next=isRoot?m:multiply(m,[t.m00,t.m10,t.m01,t.m11,t.m02,t.m12]);recordCanvas.save();
    if(value.clipsContent){const clip=sk.Path.Make().addRRect(sk.RRectXY(sk.XYWHRect(0,0,value.size.x,value.size.y),value.cornerRadius??0,value.cornerRadius??0));clip.transform(matrix(sk,next));recordCanvas.clipPath(clip,ClipOp.Intersect,true);release(clip);}
    const p=sk.Paint();if(!isRoot){p.setAlphaf(value.opacity);const filter=effectFilter(sk,value.effects,next);if(filter)p.setImageFilter(filter);recordCanvas.saveLayer(p);}
    const recording={getCanvas:()=>recordCanvas} as SkSurface;paintGeometry(recording,value,next);drawOptics(recording,value,next,before,'NOISE');
    if(!value.booleanOperation){let mask:FigmaTreeNode|undefined;for(const child of value.children){if(child.mask){mask=child;continue;}recordCanvas.save();if(mask){const mt=mask.transform,mw=multiply(next,[mt.m00,mt.m10,mt.m01,mt.m11,mt.m02,mt.m12]),clip=sk.Path.Make();for(const raw of mask.maskPaths){const p=path(raw.path,mw);if(p){if(raw.fillRule==='evenodd')clip.setFillType(1);clip.addPath(p);release(p);}}recordCanvas.clipPath(clip,ClipOp.Intersect,true);release(clip);}record(child,next);recordCanvas.restore();}}
    if(!isRoot)recordCanvas.restore();release(p);recordCanvas.restore();
   };
   record(n,local,true);const picture=recorder.finishRecordingAsPicture();release(recorder);staticGroups.set(key,picture);if(staticGroups.size>24){const first=staticGroups.keys().next().value!;release(staticGroups.get(first));staticGroups.delete(first);}}
  return result;
 };
 const parent=surface();for(const b of o.backdrops){const p=sk.Paint();canvasOf(parent).drawImageRect(b.image,sk.XYWHRect(0,0,b.image.width(),b.image.height()),sk.XYWHRect((b.x+pad)*o.dpr,(b.y+pad)*o.dpr,b.width*o.dpr,b.height*o.dpr),p);release(p);}
 const prefix=snapshot(parent),world=multiply([o.dpr,0,0,o.dpr,pad*o.dpr,pad*o.dpr],o.world??identity),image=paintNode(node,prefix,world,true);
 if(o.includeBackdrop===false)canvasOf(parent).clear(sk.Color('transparent'));
 drawImage(parent,image,node.opacity,effectFilter(sk,node.effects,world),node.blendMode);release(prefix);release(image);parent.flush();const result=parent.makeImageSnapshot(sk.XYWHRect(pad*o.dpr,pad*o.dpr,Math.ceil(o.width*o.dpr),Math.ceil(o.height*o.dpr)));release(parent);return result;
 }finally{lastNativeFrameResources=frame.finish();}
}
export let lastNativeFrameResources={created:0,released:0,live:0};

export function disposeNativeGroupCaches(){for(const value of shaders.values())value.dispose();for(const value of staticGroups.values())value.dispose();shaders.clear();staticGroups.clear();}
