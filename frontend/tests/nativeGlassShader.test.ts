import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {nativeGlassShader} from '../components/mobile/glass/nativeGlassShader';
import {glassEvidence} from '../design/glassEvidence';
const require=createRequire(import.meta.url);
it('compiles the actual production source GLASS SKSL in Skia and rejects a corrupt shader',async()=>{
 const initialize=require('canvaskit-wasm/bin/full/canvaskit.js');
 const skia=await initialize({locateFile:(file:string)=>require.resolve(`canvaskit-wasm/bin/full/${file}`)});
 const raw=glassEvidence['270:26624'].effects[0];
 const shader=nativeGlassShader(raw,[[0,0,295,0],[295,0,295,36],[295,36,0,36],[0,36,0,0]]);
 const compiled=skia.RuntimeEffect.Make(shader);
 expect(compiled).not.toBeNull();compiled?.delete();
 expect(skia.RuntimeEffect.Make(shader.replace('half4 main','invalid main'))).toBeNull();
});
it('samples actual earlier image through the production shader and all four original source curve fields',async()=>{
 const initialize=require('canvaskit-wasm/bin/full/canvaskit.js');
 const skia=await initialize({locateFile:(file:string)=>require.resolve(`canvaskit-wasm/bin/full/${file}`)});
 const {sourcePathSegments}=await import('../components/mobile/glass/sourcePathSegments');
 const split=(flat:Float32Array)=>{const cmds:number[][]=[];let i=0;const counts=[3,3,5,6,7,1];while(i<flat.length){const count=counts[flat[i]];cmds.push(Array.from(flat.slice(i,i+count)));i+=count;}return cmds;};
 for(const id of ['270:26530','119:76672','270:26347','280:26959']){
  const source=glassEvidence[id],path=skia.Path.MakeFromSVGString(source.paths![0].path),segments=sourcePathSegments(split(path.toCmds()));
  expect(segments.length).toBeGreaterThan(4);
  const e=source.effects.find(e=>e.type==='GLASS')!,effect=skia.RuntimeEffect.Make(nativeGlassShader(e,segments));expect(effect).not.toBeNull();effect.delete();path.delete();
 }
 const w=295,h=36,bytes=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;bytes[i]=x%10<5?255:0;bytes[i+2]=x%10<5?0:255;bytes[i+3]=255;}
 const info={width:w,height:h,colorType:skia.ColorType.RGBA_8888,alphaType:skia.AlphaType.Unpremul,colorSpace:skia.ColorSpace.SRGB};
 const input=skia.MakeImage(info,bytes,w*4),child=input.makeShaderOptions(skia.TileMode.Clamp,skia.TileMode.Clamp,skia.FilterMode.Nearest,skia.MipmapMode.None);
 const identity=[1,0,0,0,1,0,0,0,1];
 const raw=glassEvidence['270:26624'],path=skia.Path.MakeFromSVGString(raw.paths![0].path),segments=sourcePathSegments(split(path.toCmds()));
 const render=(refractionIntensity:number)=>{
  const e={...raw.effects[0],refractionIntensity,specularIntensity:0,chromaticAberration:0,reflectionDistance:0};
  const effect=skia.RuntimeEffect.Make(nativeGlassShader(e,segments));
  const shader=effect.makeShaderWithChildren([...identity,...identity],[child]);
  const surface=skia.MakeSurface(w,h),paint=new skia.Paint();paint.setShader(shader);surface.getCanvas().drawRect(skia.XYWHRect(0,0,w,h),paint);surface.flush();
  const snapshot=surface.makeImageSnapshot(),pixels=snapshot.readPixels(0,0,info);snapshot.delete();surface.delete();paint.delete();shader.delete();effect.delete();return pixels;
 };
 expect(Array.from(render(0))).toEqual(Array.from(bytes));
 expect(Array.from(render(.8))).not.toEqual(Array.from(bytes));
 path.delete();input.delete();child.delete();
});
