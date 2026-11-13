import {sourcePathSegments} from './sourcePathSegments';
import {useEffect,useMemo} from 'react';
import {PixelRatio} from 'react-native';
import {BackdropFilter,Blur,RuntimeShader,Skia,Group,Image,ColorType,AlphaType,type SkPath,type SkRuntimeEffect} from '@shopify/react-native-skia';
import type {SourceGlassProps} from './SourceGlassLayer.web';
import {nativeGlassShader,type Segment} from './nativeGlassShader';
import {evaluateGlassField} from './sourceGlassModel';
// Flatten original Skia SVG path commands, including curves, for optical normals.
export function pathSegments(path:SkPath){return sourcePathSegments(path.toCmds());}
export type SceneMatrix=readonly [number,number,number,number,number,number];
const identity:SceneMatrix=[1,0,0,1,0,0];
export function SourceGlassLayer({effects,width,height,paths,worldMatrix=identity}:SourceGlassProps&{worldMatrix?:SceneMatrix}){
 const combined=useMemo(()=>{const result=Skia.Path.Make();for(const p of paths){const path=Skia.Path.MakeFromSVGString(p.path);if(path)result.addPath(path);}return result;},[JSON.stringify(paths)]);
 const segments=useMemo(()=>pathSegments(combined),[combined]);
 const pd=PixelRatio.get(),[a,b,c,d,tx,ty]=worldMatrix,det=a*d-b*c;
 const world=[a*pd,b*pd,0,c*pd,d*pd,0,tx*pd,ty*pd,1];
 const inverseWorld=[d/det/pd,-b/det/pd,0,-c/det/pd,a/det/pd,0,(c*ty-d*tx)/det,(b*tx-a*ty)/det,1];
 return <Group>{effects.filter(e=>e.visible!==false).map((e,i)=>{
  if(e.type==='GLASS')return <Group key={i} clip={combined}><NativeGlass source={nativeGlassShader(e,segments)} radius={e.radius} uniforms={{world,inverseWorld}}/></Group>;
  if(e.type==='NOISE')return <Group key={i} clip={e.clipToShape===false?undefined:combined}><NativeNoise effect={e} width={width} height={height}/></Group>;
  return null;
 })}</Group>;
}
const compiledShaders=new Map<string,SkRuntimeEffect>();
function compileGlass(source:string){const cached=compiledShaders.get(source);if(cached)return cached;const shader=Skia.RuntimeEffect.Make(source);if(shader){compiledShaders.set(source,shader);if(compiledShaders.size>64)compiledShaders.delete(compiledShaders.keys().next().value!);}return shader;}
function NativeGlass({source,radius,uniforms}:{source:string;radius:number;uniforms:{world:number[];inverseWorld:number[]}}){
 const shader=useMemo(()=>compileGlass(source),[source]);
 if(!shader)throw Error('Source GLASS SKSL compilation failed');
 return <BackdropFilter filter={<RuntimeShader source={shader} uniforms={uniforms}>{radius>0&&<Blur blur={radius/2}/>}</RuntimeShader>}/>;
}
function NativeNoise({effect,width,height}:{effect:SourceGlassProps['effects'][number];width:number;height:number}){
 const image=useMemo(()=>{
  const w=Math.max(1,Math.ceil(width)),h=Math.max(1,Math.ceil(height)),bytes=new Uint8Array(w*h*4);
  const color=typeof effect.color==='object'?effect.color:effect.sourceColor??{r:1,g:1,b:1,a:1};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const f=evaluateGlassField(effect,{x,y,width,height,distance:0,normal:{x:0,y:0}}),i=(y*w+x)*4;bytes[i]=color.r*255;bytes[i+1]=color.g*255;bytes[i+2]=color.b*255;bytes[i+3]=Math.round(f.noiseAlpha*color.a*255);}
  return Skia.Image.MakeImage({width:w,height:h,colorType:ColorType.RGBA_8888,alphaType:AlphaType.Unpremul},Skia.Data.fromBytes(bytes),w*4);
 },[JSON.stringify(effect),width,height]);
 useEffect(()=>()=>image?.dispose(),[image]);
 return image?<Image image={image} x={0} y={0} width={width} height={height}/>:null;
}
