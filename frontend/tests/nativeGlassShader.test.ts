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
