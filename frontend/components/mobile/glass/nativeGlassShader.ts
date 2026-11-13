import type {FigmaSourceEffect} from '../FigmaEffects';
export type Segment=readonly [number,number,number,number];
// Shader samples the previous paint in this Canvas. Coordinates are device
// pixels; inverseWorld maps them back to original Figma logical units.
export function nativeGlassShader(e:FigmaSourceEffect,segments:readonly Segment[]){
 const num=(v:number)=>Number.isFinite(v)?`${v.toFixed(7)}`:'0.0';
 const nearest=segments.map(s=>`edge(p,float2(${num(s[0])},${num(s[1])}),float2(${num(s[2])},${num(s[3])}),distance,normal);`).join('\n');
 return `uniform shader image;
uniform float3x3 inverseWorld;
uniform float3x3 world;
void edge(float2 p,float2 a,float2 b,inout float distance,inout float2 normal){
 float2 v=b-a;float t=clamp(dot(p-a,v)/max(dot(v,v),0.000001),0.0,1.0);
 float2 delta=a+t*v-p;float d=length(delta);
 if(d<distance){distance=d;normal=delta/max(d,0.00001);}
}
half4 main(float2 xy){
 float2 p=(inverseWorld*float3(xy,1)).xy;
 float distance=100000.0;float2 normal=float2(0);${nearest}
 float radius=${num(e.refractionRadius??0)};
 float edgeAmount=radius>0.0?clamp(1.0-distance/max(radius,0.00001),0.0,1.0):0.0;
 float2 bend=normal*${num(e.refractionIntensity??0)}*radius*edgeAmount*edgeAmount;
 float dispersion=${num(e.chromaticAberration??0)};
 float2 dr=(world*float3(p+bend*(1.0-dispersion),1)).xy;
 float2 dg=(world*float3(p+bend,1)).xy;
 float2 db=(world*float3(p+bend*(1.0+dispersion),1)).xy;
 half4 color=half4(image.eval(dr).r,image.eval(dg).g,image.eval(db).b,image.eval(dg).a);
 float bevel=${num(e.bevelSize??0)}>0.0?exp(-distance/max(${num((e.bevelSize??0)*4)},0.00001)):0.0;
 float angle=${num((e.specularAngle??0)*Math.PI/180)};
 float light=${num(e.specularIntensity??0)}*max(0.0,dot(normal,float2(cos(angle),sin(angle))))*bevel;
 float reflection=${num(e.reflectionDistance??0)};
 if(reflection!=0.0){float2 r=(world*float3(p+normal*reflection,1)).xy;color=mix(color,image.eval(r),0.2);}
 return half4(mix(color.rgb,half3(1),half(light)),color.a);
}`;
}
