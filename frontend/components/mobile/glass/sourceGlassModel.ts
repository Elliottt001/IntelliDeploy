import type {FigmaSourceEffect} from '../FigmaEffects';
export type RawShellPaint={ [key:string]:unknown; type:string;visible?:boolean;opacity?:number;color?:{r:number;g:number;b:number;a:number};transform?:{m00:number;m01:number;m02:number;m10:number;m11:number;m12:number};stops?:readonly {color:{r:number;g:number;b:number;a:number};position:number;[key:string]:unknown}[]};
export type GlassSourceNode={type:string;size:{x:number;y:number};cornerRadius:number;fillPaints?:readonly RawShellPaint[];strokePaints?:readonly RawShellPaint[];strokePaths?:readonly {path:string;fillRule?:'evenodd'|'nonzero'}[];paths?:readonly {path:string;fillRule?:'evenodd'|'nonzero'}[];effects:readonly FigmaSourceEffect[]};
export type FieldPoint={x:number;y:number;width:number;height:number;distance:number;normal:{x:number;y:number}};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
// Source points are Figma logical units. Normal/distance come from the actual
// source path's signed distance field; layout scaling is applied only at paint.
// Official Plugin API maps frost radius / light intensity and angle / refraction,
// depth and dispersion to Kiwi radius/specular*/refraction*/chromaticAberration.
// Only a NOISE effect activates grain; common inherited GLASS noise fields stay raw.
// Model: circular bevel profile, edge refraction, separated RGB sampling,
// directional Lambert rim and seeded cell noise. Figma's proprietary BRDF/RNG
// are unpublished; this is parameter fidelity, not a claim of shader identity.
export function evaluateGlassField(e:FigmaSourceEffect,p:FieldPoint){
 const glass=e.type==='GLASS'&&e.visible!==false;
 const radius=glass?(e.refractionRadius??0):0;
 const edge=radius>0?clamp(1-Math.max(0,p.distance)/radius):0;
 const bend=(e.refractionIntensity??0)*radius*edge*edge;
 const displacement={x:bend===0?0:p.normal.x*bend,y:bend===0?0:p.normal.y*bend};
 const angle=(e.specularAngle??0)*Math.PI/180;
 const bevel=glass&&(e.bevelSize??0)>0?Math.exp(-Math.max(0,p.distance)/(e.bevelSize!*4)):0;
 const light=(e.specularIntensity??0)*Math.max(0,p.normal.x*Math.cos(angle)+p.normal.y*Math.sin(angle))*bevel;
 const nx=Math.floor(p.x/Math.max(e.noiseSize?.x??1,0.0001));
 const ny=Math.floor(p.y/Math.max(e.noiseSize?.y??1,0.0001));
 let seed=(e.seed??0)^Math.imul(nx,374761393)^Math.imul(ny,668265263);
 seed=Math.imul(seed^(seed>>>13),1274126177);seed^=seed>>>16;
 const noise=(seed>>>0)/4294967296;
 const active=noise<clamp(e.density??1);
 const reflectionDistance=glass?(e.reflectionDistance??0):0;
 return {displacement,dispersion:(e.chromaticAberration??0)*edge,light,bevel,
  reflection:{x:reflectionDistance===0?0:reflectionDistance*p.normal.x,y:reflectionDistance===0?0:reflectionDistance*p.normal.y},
  noise,noiseAlpha:e.type==='NOISE'&&e.visible!==false&&active?(e.opacity??0):0};
}
export const hasSourceOptics=(effects:readonly FigmaSourceEffect[]|undefined)=>Boolean(effects?.some(e=>e.visible!==false&&(e.type==='GLASS'||e.type==='NOISE')));
