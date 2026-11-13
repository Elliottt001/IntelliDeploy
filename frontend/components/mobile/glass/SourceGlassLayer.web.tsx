import {Fragment,useId,useMemo} from 'react';
import {ClipPath,Defs,ForeignObject,G,Path} from 'react-native-svg';
import type {FigmaSourceEffect} from '../FigmaEffects';
import {evaluateGlassField} from './sourceGlassModel';
export type SourceGlassProps={effects:readonly FigmaSourceEffect[];width:number;height:number;paths:readonly {path:string;fillRule?:'evenodd'|'nonzero'}[];transform?:string;sourceNodeId?:string};
// Rasterize geometry only, never a design image or copied page. Two distance
// passes give a source-unit signed field for arbitrary vector/ellipse/frame paths.
export function sourcePathField(width:number,height:number,paths:SourceGlassProps['paths']){
 const w=Math.max(1,Math.ceil(width)),h=Math.max(1,Math.ceil(height));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';
 for(const p of paths)ctx.fill(new Path2D(p.path),p.fillRule??'nonzero');
 const alpha=ctx.getImageData(0,0,w,h).data;
 const d=new Float32Array(w*h).fill(w+h);
 const inside=(x:number,y:number)=>x>=0&&x<w&&y>=0&&y<h&&alpha[(y*w+x)*4+3]>127;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!inside(x,y)||!inside(x-1,y)||!inside(x+1,y)||!inside(x,y-1)||!inside(x,y+1))d[y*w+x]=0;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(x)d[i]=Math.min(d[i],d[i-1]+1);if(y)d[i]=Math.min(d[i],d[i-w]+1);if(x&&y)d[i]=Math.min(d[i],d[i-w-1]+Math.SQRT2);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x+1<w)d[i]=Math.min(d[i],d[i+1]+1);if(y+1<h)d[i]=Math.min(d[i],d[i+w]+1);if(x+1<w&&y+1<h)d[i]=Math.min(d[i],d[i+w+1]+Math.SQRT2);}
 return {w,h,d,inside,canvas,ctx};
}
const pathFields=new Map<string,ReturnType<typeof sourcePathField>>();
const opticalBuffers=new Map<string,ReturnType<typeof maps>>();
function remember<T>(cache:Map<string,T>,key:string,value:T,limit:number){cache.set(key,value);if(cache.size>limit)cache.delete(cache.keys().next().value!);return value;}
function cachedMaps(e:FigmaSourceEffect,width:number,height:number,paths:SourceGlassProps['paths']){
 const key=JSON.stringify([width,height,paths,e]);return opticalBuffers.get(key)??remember(opticalBuffers,key,maps(e,width,height,paths),64);
}
function maps(e:FigmaSourceEffect,width:number,height:number,paths:SourceGlassProps['paths']){
 const key=JSON.stringify([width,height,paths]);
 const {w,h,d,inside,canvas,ctx}=pathFields.get(key)??remember(pathFields,key,sourcePathField(width,height,paths),16);
 const displacement=ctx.createImageData(w,h),surface=ctx.createImageData(w,h),reflection=ctx.createImageData(w,h);
 const reflectionScale=Math.max(1,2*Math.abs(e.reflectionDistance??0));
 const scale=Math.max(1,2*(e.refractionRadius??0)*(e.refractionIntensity??0));
 const color=typeof e.color==='object'?e.color:e.sourceColor??{r:1,g:1,b:1,a:1};
 const secondary=typeof e.secondaryColor==='object'?e.secondaryColor:e.secondarySourceColor??color;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,j=i*4;
  const gx=(d[y*w+Math.min(w-1,x+1)]-d[y*w+Math.max(0,x-1)])/2;
  const gy=(d[Math.min(h-1,y+1)*w+x]-d[Math.max(0,y-1)*w+x])/2;
  const length=Math.hypot(gx,gy)||1,normal={x:-gx/length,y:-gy/length};
  const f=evaluateGlassField(e,{x,y,width,height,distance:d[i],normal});
  reflection.data[j]=255*(.5+f.reflection.x/reflectionScale);reflection.data[j+1]=255*(.5+f.reflection.y/reflectionScale);reflection.data[j+2]=128;reflection.data[j+3]=255;
  displacement.data[j]=Math.round(255*(.5+f.displacement.x/scale));displacement.data[j+1]=Math.round(255*(.5+f.displacement.y/scale));displacement.data[j+2]=128;displacement.data[j+3]=255;
  const noiseColor=e.noiseType==='DUOTONE'?secondary:color;
  const n=e.noiseType==='MULTICOLOR'?f.noise:1;
  const shade=e.type==='GLASS'?f.light:0;
  surface.data[j]=255*(e.type==='GLASS'?1:noiseColor.r*n);surface.data[j+1]=255*(e.type==='GLASS'?1:noiseColor.g*n);surface.data[j+2]=255*(e.type==='GLASS'?1:noiseColor.b*n);
  surface.data[j+3]=255*(inside(x,y)||e.clipToShape===false?Math.min(1,(e.type==='NOISE'?f.noiseAlpha*noiseColor.a:0)+shade):0);
 }
 ctx.putImageData(reflection,0,0);const reflectionField=canvas.toDataURL();ctx.putImageData(displacement,0,0);const field=canvas.toDataURL();ctx.putImageData(surface,0,0);
 return {field,reflectionField,reflectionScale,surface:canvas.toDataURL(),scale:(e.refractionIntensity??0)===0?0:scale};
}
export function SourceGlassLayer(props:SourceGlassProps){
 if(typeof document==='undefined'||typeof Path2D==='undefined')return null;
 return <BrowserGlassLayer {...props}/>;
}
function BrowserGlassLayer({effects,width,height,paths,transform,sourceNodeId}:SourceGlassProps){
 const id=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const active=effects.filter(e=>e.visible!==false&&(e.type==='GLASS'||e.type==='NOISE'));
 const rendered=useMemo(()=>typeof document==='undefined'?[]:active.map(e=>cachedMaps(e,width,height,paths)),[JSON.stringify(active),width,height,JSON.stringify(paths)]);
 if(!rendered.length)return null;
 return <G transform={transform} data-source-glass={sourceNodeId}>
  <Defs><ClipPath id={`${id}-clip`}>{paths.map((p,i)=><Path key={i} d={p.path} fillRule={p.fillRule}/>)}</ClipPath></Defs>
  {active.map((e,i)=>{const m=rendered[i],filter=`${id}-${i}`;return <G key={i} clipPath={e.type==='GLASS'||e.clipToShape!==false?`url(#${id}-clip)`:undefined}>
   <ForeignObject x={0} y={0} width={width} height={height}>
    <div style={{position:'relative',width:'100%',height:'100%',pointerEvents:'none',mixBlendMode:e.blendMode?.toLowerCase().replaceAll('_','-') as any}}>
     <svg width="0" height="0" style={{position:'absolute'}}><defs><filter id={filter} x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation={(e.radius??0)/2} result="blur"/>
      <feImage href={m.field} x="0" y="0" width={width} height={height} preserveAspectRatio="none" result="field"/>
      {['R','G','B'].map((c,j)=><Fragment key={c}><feDisplacementMap in="blur" in2="field" scale={m.scale*(1+(j-1)*(e.chromaticAberration??0))} xChannelSelector="R" yChannelSelector="G" result={`rgb${j}`}/><feColorMatrix in={`rgb${j}`} type="matrix" values={j===0?'1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0':j===1?'0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0':'0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0'} result={`channel${j}`}/></Fragment>)}
      <feComposite in="channel0" in2="channel1" operator="arithmetic" k2="1" k3="1" result="rg"/><feComposite in="rg" in2="channel2" operator="arithmetic" k2="1" k3="1" result="rgb"/>
      {(e.reflectionDistance??0)!==0&&<><feImage href={m.reflectionField} x="0" y="0" width={width} height={height} preserveAspectRatio="none" result="reflectionField"/><feDisplacementMap in="blur" in2="reflectionField" scale={m.reflectionScale} xChannelSelector="R" yChannelSelector="G" result="reflection"/><feComposite in="reflection" in2="rgb" operator="arithmetic" k2="0.2" k3="0.8"/></>}
     </filter></defs></svg>
     {e.type==='GLASS'&&<div data-glass-backdrop="live" style={{position:'absolute',inset:0,backdropFilter:`url(#${filter})`,WebkitBackdropFilter:`url(#${filter})`}}/>}
     <img alt="" aria-hidden="true" src={m.surface} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>
    </div>
   </ForeignObject>
  </G>;})}
 </G>;
}
