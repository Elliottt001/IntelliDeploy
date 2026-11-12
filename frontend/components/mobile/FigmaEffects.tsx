import {Fragment} from 'react';
import {Platform} from 'react-native';
import {Filter,FeGaussianBlur,FeOffset,FeFlood,FeComposite,FeColorMatrix,FeMerge,FeMergeNode,FeMorphology} from 'react-native-svg';
export type FigmaSourceEffect={type:string;radius:number;spread?:number;showShadowBehindNode?:boolean;offset:{x:number;y:number};color:{r:number;g:number;b:number;a:number}};
export function FigmaEffects({effects,id}:{effects:readonly FigmaSourceEffect[];id:string}){
 const supported=effects.filter(e=>['DROP_SHADOW','INNER_SHADOW','FOREGROUND_BLUR'].includes(e.type)).sort((a,b)=>['DROP_SHADOW','INNER_SHADOW','FOREGROUND_BLUR'].indexOf(a.type)-['DROP_SHADOW','INNER_SHADOW','FOREGROUND_BLUR'].indexOf(b.type));
 const previous=(index:number)=>index===0?'SourceGraphic':`effect-${index-1}`;
 return <Filter id={id} x="-100%" y="-100%" width="300%" height="300%" {...(Platform.OS==='web'?{colorInterpolationFilters:'sRGB'}:{})}>
  <FeColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
  {supported.map((e,i)=>{const result=`effect-${i}`,color=`rgb(${Math.round(e.color.r*255)},${Math.round(e.color.g*255)},${Math.round(e.color.b*255)})`;
   if(e.type==='FOREGROUND_BLUR')return <FeGaussianBlur key={i} in={previous(i)} stdDeviation={e.radius/2} result={result}/>;
   if(e.type==='DROP_SHADOW'){
    let start=i;while(start>0&&supported[start-1].type==='DROP_SHADOW')start--;
    const merge=supported[i+1]?.type!=='DROP_SHADOW';
    // The installed native SVG engine does not implement morphology; native source verification records this gap.
    const morphology=Platform.OS==='web'&&Boolean(e.spread);
    return <Fragment key={i}>{morphology&&<FeMorphology in="SourceAlpha" operator={e.spread!<0?'erode':'dilate'} radius={Math.abs(e.spread!)} result={`spread-${i}`}/>}<FeOffset in={morphology?`spread-${i}`:'hardAlpha'} dx={e.offset.x} dy={e.offset.y}/><FeGaussianBlur stdDeviation={e.radius/2} result={`blur-shadow-${i}`}/>{e.showShadowBehindNode===false&&<FeComposite in2="hardAlpha" operator="out" result={`knockout-${i}`}/>}<FeFlood floodColor={color} floodOpacity={e.color.a} result={`shadow-color-${i}`}/><FeComposite in={`shadow-color-${i}`} operator="in" in2={e.showShadowBehindNode===false?`knockout-${i}`:`blur-shadow-${i}`} result={`shadow-${i}`}/>{merge&&<FeMerge result={result}>{[...Array.from({length:i-start+1},(_,j)=><FeMergeNode key={j} in={`shadow-${start+j}`}/>).reverse(),<FeMergeNode key="graphic" in={previous(start)}/>]}</FeMerge>}</Fragment>;
   }
   return <Fragment key={i}><FeOffset in="hardAlpha" dx={e.offset.x} dy={e.offset.y}/><FeGaussianBlur stdDeviation={e.radius/2}/><FeComposite in2="hardAlpha" operator="arithmetic" k2={-1} k3={1} result={`inner-${i}`}/><FeFlood floodColor={color} floodOpacity={e.color.a}/><FeComposite in2={`inner-${i}`} operator="in"/><FeComposite in2={previous(i)} operator="over" result={result}/></Fragment>;
  })}
 </Filter>;
}
