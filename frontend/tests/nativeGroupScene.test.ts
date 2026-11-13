import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {renderNativeGroupScene} from '../components/mobile/glass/nativeGroupScene';
import type {FigmaTreeNode} from '../components/mobile/FigmaTree';
const require=createRequire(import.meta.url);
it('filters only group SourceGraphic while nested glass samples the real prior prefix and internal earlier paint',async()=>{
 const init=require('canvaskit-wasm/bin/full/canvaskit.js'),ck=await init({locateFile:(f:string)=>require.resolve(`canvaskit-wasm/bin/full/${f}`)});
 const {JsiSkApi}=require('@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia');const sk=JsiSkApi(ck);
 const w=100,h=60,base=sk.Surface.Make(w,h),paint=sk.Paint();
 for(let x=0;x<w;x++){paint.setColor(sk.Color(x%10<5?'#ff0000':'#0000ff'));base.getCanvas().drawRect(sk.XYWHRect(x,0,1,h),paint);}base.flush();const input=base.makeImageSnapshot();
 const make=sk.Surface.Make.bind(sk.Surface);let cpuSurfaces=0;sk.Surface.Make=(w:number,h:number)=>{cpuSurfaces++;return make(w,h);};
 sk.Surface.MakeOffscreen=()=>{throw Error('JS compositor must not allocate shared GPU surface');};
 const node=(id:string,geometry:any[],children:FigmaTreeNode[]=[],effects:any[]=[]):FigmaTreeNode=>({sourceNodeId:id,size:{x:w,y:h},transform:{m00:1,m01:0,m02:0,m10:0,m11:1,m12:0},opacity:1,visible:true,clipsContent:false,mask:false,booleanOperation:false,maskPaths:[],geometry,children,effects});
 const earlier=node('0:1',[{sourceNodeId:'0:1',path:'M10 10 H50 V40 H10Z',fill:'#00ff00',opacity:1,sourceEffects:[]}]);
 const lens=node('0:2',[{sourceNodeId:'0:2',path:'M20 15 H70 V45 H20Z',fill:'transparent',opacity:1,sourceEffects:[]}],[],[{type:'GLASS',radius:0,refractionRadius:15,refractionIntensity:1,specularIntensity:0,chromaticAberration:0,bevelSize:0}]);
 const group=node('0:3',[],[earlier,lens],[{type:'FOREGROUND_BLUR',radius:4,visible:true}]);const root=node('0:0',[],[group]);
 const info={width:w,height:h,colorType:4,alphaType:3};
 const before=input.readPixels(0,0,info)!;
 const image=renderNativeGroupScene(sk,root,{width:w,height:h,dpr:1,backdrops:[{image:input,x:0,y:0,width:w,height:h}]});
 const after=image.readPixels(0,0,info)!;
 expect(cpuSurfaces).toBeGreaterThan(1);
 expect(Array.from(after)).not.toEqual(Array.from(before));
 // Outside group bounds remains the unblurred actual backdrop, pixel for pixel.
 for(let x=85;x<100;x++)expect(Array.from(after.slice((5*w+x)*4,(5*w+x)*4+4))).toEqual(Array.from(before.slice((5*w+x)*4,(5*w+x)*4+4)));
 const at=(x:number,y:number)=>Array.from(after.slice((y*w+x)*4,(y*w+x)*4+4));
 expect(at(25,25)[1]).toBeGreaterThan(200); // earlier real green graphic remains in lens input
 image.dispose();input.dispose();base.dispose();paint.dispose();
});
it('repeated CPU frames reclaim all temporary native factory resources with bounded caches',async()=>{
 const init=require('canvaskit-wasm/bin/full/canvaskit.js'),ck=await init({locateFile:(f:string)=>require.resolve(`canvaskit-wasm/bin/full/${f}`)});
 const {JsiSkApi}=require('@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia'),sk=JsiSkApi(ck);
 const {lastNativeFrameResources}=await import('../components/mobile/glass/nativeGroupScene');
 const makeNode=(color:string):FigmaTreeNode=>({sourceNodeId:'990:1',size:{x:24,y:16},transform:{m00:1,m01:0,m02:0,m10:0,m11:1,m12:0},opacity:1,visible:true,clipsContent:false,mask:false,booleanOperation:false,maskPaths:[],children:[],effects:[{type:'GLASS',radius:0,refractionRadius:3,refractionIntensity:.5,specularIntensity:0}],geometry:[{sourceNodeId:'990:1',path:'M0 0 H24 V16 H0 Z',fill:color,opacity:.2,sourceEffects:[]}]});
 const api=await import('../components/mobile/glass/nativeGroupScene');
 for(let i=0;i<40;i++){const image=renderNativeGroupScene(sk,makeNode(i%2?'#ff0000':'#00ff00'),{width:24,height:16,dpr:1,backdrops:[]});image.dispose();expect(api.lastNativeFrameResources.live).toBe(0);expect(api.lastNativeFrameResources.released).toBeLessThanOrEqual(api.lastNativeFrameResources.created);}
});
