import {useMemo} from 'react';
import {PixelRatio} from 'react-native';
import {BackdropFilter,Blur,RuntimeShader,Skia,Group,Image,ColorType,AlphaType,type SkPath} from '@shopify/react-native-skia';
import type {SourceGlassProps} from './SourceGlassLayer.web';
import {nativeGlassShader,type Segment} from './nativeGlassShader';
import {evaluateGlassField} from './sourceGlassModel';
// Flatten original Skia SVG path commands, including curves, for optical normals.
export function pathSegments(path:SkPath):Segment[]{
 const segments:Segment[]=[];let x=0,y=0,sx=0,sy=0;
 const line=(nx:number,ny:number)=>{segments.push([x,y,nx,ny]);x=nx;y=ny;};
 for(const c of path.toCmds()){
  if(c[0]===0){x=sx=c[1];y=sy=c[2];}
  else if(c[0]===1)line(c[1],c[2]);
  else if(c[0]===5)line(sx,sy);
  else{const px=x,py=y;for(let i=1;i<=24;i++){const t=i/24,u=1-t;
   if(c[0]===2)line(u*u*px+2*u*t*c[1]+t*t*c[3],u*u*py+2*u*t*c[2]+t*t*c[4]);
   else if(c[0]===4)line(u*u*u*px+3*u*u*t*c[1]+3*u*t*t*c[3]+t*t*t*c[5],u*u*u*py+3*u*u*t*c[2]+3*u*t*t*c[4]+t*t*t*c[6]);
   else if(c[0]===3){const w=c[5],den=u*u+2*w*u*t+t*t;line((u*u*px+2*w*u*t*c[1]+t*t*c[3])/den,(u*u*py+2*w*u*t*c[2]+t*t*c[4])/den);}
  }}
 }
 return segments;
}
export type SceneMatrix=readonly [number,number,number,number,number,number];
const identity:SceneMatrix=[1,0,0,1,0,0];
export function SourceGlassLayer({effects,width,height,paths,worldMatrix=identity}:SourceGlassProps&{worldMatrix?:SceneMatrix}){
 const combined=useMemo(()=>{const result=Skia.Path.Make();for(const p of paths){const path=Skia.Path.MakeFromSVGString(p.path);if(path)result.addPath(path);}return result;},[JSON.stringify(paths)]);
 const segments=useMemo(()=>pathSegments(combined),[combined]);
 const pd=PixelRatio.get(),[a,b,c,d,tx,ty]=worldMatrix,det=a*d-b*c;
 const world=[a*pd,c*pd,tx*pd,b*pd,d*pd,ty*pd,0,0,1];
 const inverseWorld=[d/det/pd,-c/det/pd,(c*ty-d*tx)/det,-b/det/pd,a/det/pd,(b*tx-a*ty)/det,0,0,1];
 return <Group clip={combined}>{effects.filter(e=>e.visible!==false).map((e,i)=>{
  if(e.type==='GLASS')return <NativeGlass key={i} source={nativeGlassShader(e,segments)} radius={e.radius} uniforms={{world,inverseWorld}}/>;
  if(e.type==='NOISE')return <NativeNoise key={i} effect={e} width={width} height={height}/>;
  return null;
 })}</Group>;
}
function NativeGlass({source,radius,uniforms}:{source:string;radius:number;uniforms:{world:number[];inverseWorld:number[]}}){
 const shader=useMemo(()=>Skia.RuntimeEffect.Make(source),[source]);
 if(!shader)throw Error('Source GLASS SKSL compilation failed');
 return <BackdropFilter filter={<RuntimeShader source={shader} uniforms={uniforms}>{radius>0&&<Blur blur={radius/2}/>}</RuntimeShader>}/>;
}
function NativeNoise({effect,width,height}:{effect:SourceGlassProps['effects'][number];width:number;height:number}){
 const image=useMemo(()=>{
  const w=Math.max(1,Math.ceil(width)),h=Math.max(1,Math.ceil(height)),bytes=new Uint8Array(w*h*4);
  const color=typeof effect.color==='object'?effect.color:effect.sourceColor??{r:1,g:1,b:1,a:1};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const f=evaluateGlassField(effect,{x,y,width,height,distance:0,normal:{x:0,y:0}}),i=(y*w+x)*4;bytes[i]=color.r*255;bytes[i+1]=color.g*255;bytes[i+2]=color.b*255;bytes[i+3]=f.noiseAlpha*color.a*255;}
  return Skia.Image.MakeImage({width:w,height:h,colorType:ColorType.RGBA_8888,alphaType:AlphaType.Unpremul},Skia.Data.fromBytes(bytes),w*4);
 },[JSON.stringify(effect),width,height]);
 return image?<Image image={image} x={0} y={0} width={width} height={height}/>:null;
}
