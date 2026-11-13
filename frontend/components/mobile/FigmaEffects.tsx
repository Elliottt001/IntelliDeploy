import {Fragment} from 'react';
import {Platform} from 'react-native';
import {Filter,FeGaussianBlur,FeOffset,FeFlood,FeComposite,FeColorMatrix,FeMerge,FeMergeNode,FeMorphology} from 'react-native-svg';
import type {FigmaEffectEvidence} from '../../design/figmaComponentEvidence';
type LegacyColor={r:number;g:number;b:number;a:number};
export type FigmaSourceEffect=Omit<FigmaEffectEvidence,'color'|'secondaryColor'> & {color?:string|LegacyColor;secondaryColor?:string|LegacyColor};
const renderableTypes=['DROP_SHADOW','INNER_SHADOW','FOREGROUND_BLUR'];
export const hasRenderableSourceEffects=(effects:readonly FigmaSourceEffect[]|undefined)=>Boolean(effects?.some(e=>renderableTypes.includes(e.type)));
const rgbFromHex=(hex:string)=>{const value=hex.replace('#','');return value.length===6?[0,2,4].map(i=>Number.parseInt(value.slice(i,i+2),16)):null;};
const effectColor=(e:FigmaSourceEffect)=>{const c=e.sourceColor??(typeof e.color==='object'?e.color:undefined);if(c)return{color:`rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`,opacity:e.opacity??c.a};const rgb=typeof e.color==='string'?rgbFromHex(e.color):null;return{color:rgb?`rgb(${rgb.join(',')})`:typeof e.color==='string'?e.color:'rgb(0,0,0)',opacity:e.opacity??1};};
export function FigmaEffects({effects,id}:{effects:readonly FigmaSourceEffect[];id:string}){
 const supported=effects.filter(e=>renderableTypes.includes(e.type));
 const previous=(index:number)=>index===0?'SourceGraphic':`effect-${index-1}`;
 return <Filter id={id} x="-100%" y="-100%" width="300%" height="300%" {...(Platform.OS==='web'?{colorInterpolationFilters:'sRGB'}:{})}>
  <FeColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
  {supported.map((e,i)=>{const result=`effect-${i}`,{color,opacity}=effectColor(e);
   if(e.type==='FOREGROUND_BLUR')return <FeGaussianBlur key={i} in={previous(i)} stdDeviation={e.radius/2} result={result}/>;
   if(e.type==='DROP_SHADOW'){
    let start=i;while(start>0&&supported[start-1].type==='DROP_SHADOW')start--;
    const merge=supported[i+1]?.type!=='DROP_SHADOW';
    // The installed native SVG engine does not implement morphology; native source verification records this gap.
    const morphology=Platform.OS==='web'&&Boolean(e.spread);
    return <Fragment key={i}>{morphology&&<FeMorphology in="SourceAlpha" operator={e.spread!<0?'erode':'dilate'} radius={Math.abs(e.spread!)} result={`spread-${i}`}/>}<FeOffset in={morphology?`spread-${i}`:'hardAlpha'} dx={e.offset?.x??0} dy={e.offset?.y??0}/><FeGaussianBlur stdDeviation={e.radius/2} result={`blur-shadow-${i}`}/>{e.showShadowBehindNode===false&&<FeComposite in2="hardAlpha" operator="out" result={`knockout-${i}`}/>}<FeFlood floodColor={color} floodOpacity={opacity} result={`shadow-color-${i}`}/><FeComposite in={`shadow-color-${i}`} operator="in" in2={e.showShadowBehindNode===false?`knockout-${i}`:`blur-shadow-${i}`} result={`shadow-${i}`}/>{merge&&<FeMerge result={result}>{[...Array.from({length:i-start+1},(_,j)=><FeMergeNode key={j} in={`shadow-${start+j}`}/>).reverse(),<FeMergeNode key="graphic" in={previous(start)}/>]}</FeMerge>}</Fragment>;
   }
   return <Fragment key={i}><FeOffset in="hardAlpha" dx={e.offset?.x??0} dy={e.offset?.y??0}/><FeGaussianBlur stdDeviation={e.radius/2}/><FeComposite in2="hardAlpha" operator="arithmetic" k2={-1} k3={1} result={`inner-${i}`}/><FeFlood floodColor={color} floodOpacity={opacity}/><FeComposite in2={`inner-${i}`} operator="in"/><FeComposite in2={previous(i)} operator="over" result={result}/></Fragment>;
  })}
 </Filter>;
}
