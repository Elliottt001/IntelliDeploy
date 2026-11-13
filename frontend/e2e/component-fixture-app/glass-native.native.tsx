import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AppState,Platform,PixelRatio,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Canvas,Rect,Image,Skia,ColorType,AlphaType,useCanvasRef,type SkImage,type CanvasRef} from '@shopify/react-native-skia';
import {LiveGlassBackdrop,useLiveGlassBackdrop} from '../../components/mobile/glass/LiveGlassBackdrop.native';
import {NativeFigmaScene} from '../../components/mobile/NativeFigmaScene.native';
import type {FigmaTreeNode} from '../../components/mobile/FigmaTree';
import {renderNativeGroupScene} from '../../components/mobile/glass/nativeGroupScene';
import {glassEvidence} from '../../design/glassEvidence';
const W=295,H=100;
function node(id:string,geometry:FigmaTreeNode['geometry'],children:FigmaTreeNode[]=[],effects:FigmaTreeNode['effects']=[]):FigmaTreeNode{return {sourceNodeId:id,size:{x:W,y:H},transform:{m00:1,m01:0,m02:0,m10:0,m11:1,m12:0},opacity:1,visible:true,clipsContent:false,mask:false,booleanOperation:false,maskPaths:[],effects,geometry,children};}
export default function NativeGlassFixture(){
 const canvas=useCanvasRef(),control=useCanvasRef();
 const controls=useMemo(()=>{const s=Skia.Surface.Make(20,20)!;s.getCanvas().clear(Skia.Color('#00ff00'));s.flush();const texture=s.makeImageSnapshot(),raster=s.makeImageSnapshot();s.dispose();return {texture,raster};},[]);
 useEffect(()=>()=>{controls.texture.dispose();controls.raster.dispose();},[controls]);
 const metrics=useRef<{count:number;total:number;maximum:number}>({count:0,total:0,maximum:0});
 const onMetrics=useCallback(({compositionMs}:{compositionMs:number})=>{metrics.current.count++;metrics.current.total+=compositionMs;metrics.current.maximum=Math.max(metrics.current.maximum,compositionMs);},[]);
 const onImage=useCallback((image:SkImage)=>{const w=image.width(),h=image.height(),bytes=image.readPixels(0,0,{width:w,height:h,colorType:ColorType.RGBA_8888,alphaType:AlphaType.Unpremul});const pd=w/W;const at=(x:number,y:number)=>bytes?Array.from(bytes.slice((Math.floor(y*pd)*w+Math.floor(x*pd))*4,(Math.floor(y*pd)*w+Math.floor(x*pd))*4+4)):null;console.log('NATIVE_GLASS_ACTUAL_SOURCE',JSON.stringify({surfaceBackend:'CPU_RASTER',textureBacked:(image as SkImage&{isTextureBacked?:()=>boolean}).isTextureBacked?.()??null,appState:AppState.currentState,size:[w,h],rgba:{prior:at(50,20),lens:at(50,40),outside:at(285,5)}}));},[]);
 const rawGlass=glassEvidence['270:26624'].effects.find(e=>e.type==='GLASS')!;
 const [revision,setRevision]=useState(0),[frozen,setFrozen]=useState(false),[probes,setProbes]=useState(true),[refraction,setRefraction]=useState(rawGlass.refractionIntensity!),[dispersion,setDispersion]=useState(0),[report,setReport]=useState('native-probe-starting');
 const tree=useMemo(()=>{
  const earlier=node('0:1',[{sourceNodeId:'0:1',path:'M20 10 H100 V70 H20Z',fill:revision%2?'#00ff00':'#ff0000',opacity:1,sourceEffects:[]}]);
  const lens=node('270:26624',glassEvidence['270:26624'].paths!.map(p=>({...p,sourceNodeId:'270:26624',fill:'transparent',opacity:1,sourceEffects:[]})),[],glassEvidence['270:26624'].effects.filter(e=>e.type==='GLASS').map(e=>({...e,radius:0,specularIntensity:0,refractionIntensity:refraction,chromaticAberration:dispersion})));
  lens.transform.m12=30;
  return node('0:0',[],[node('0:3',[],[earlier,lens],[{type:'FOREGROUND_BLUR',radius:4},{type:'DROP_SHADOW',radius:4,offset:{x:2,y:2},color:'#000000',opacity:.25}])]);
 },[revision,refraction,dispersion]);
 useEffect(()=>{if(frozen)return;const timer=setInterval(()=>setRevision(n=>n+1),1200);return()=>clearInterval(timer);},[frozen]);
 useEffect(()=>{
  if(!probes)return;
  try{
   const dpr=PixelRatio.get(),w=Math.ceil(W*dpr),h=Math.ceil(H*dpr),surface=Skia.Surface.Make(w,h);if(!surface)throw Error('CPU Raster Make returned null');
   const p=Skia.Paint();for(let x=0;x<w;x++){p.setColor(Skia.Color(Math.floor(x/dpr)%10<5?'#0000ff':'#ffffff'));surface.getCanvas().drawRect(Skia.XYWHRect(x,0,1,h),p);}surface.flush();const input=surface.makeImageSnapshot();
   const image=renderNativeGroupScene(Skia,tree,{width:W,height:H,dpr,backdrops:[{image:input,x:0,y:0,width:W,height:H}]});
   const pixels=image.readPixels(0,0,{width:w,height:h,colorType:ColorType.RGBA_8888,alphaType:AlphaType.Unpremul});if(!pixels)throw Error('readPixels returned null');
   const at=(x:number,y:number)=>Array.from(pixels.slice((Math.floor(y*dpr)*w+Math.floor(x*dpr))*4,(Math.floor(y*dpr)*w+Math.floor(x*dpr))*4+4));
   const result={status:'RENDERED',platform:Platform.OS,revision,dpr,inputSize:[w,h],rgba:{prior:at(50,20),lens:at(50,40),outside:at(285,5)},model:'source-parameter optical field; proprietary Figma parity unverified'};
   setReport(JSON.stringify(result));console.log('NATIVE_GLASS_PROBE',JSON.stringify(result));image.dispose();input.dispose();surface.dispose();p.dispose();
  }catch(error){const result={status:'ERROR',revision,message:String(error)};setReport(JSON.stringify(result));console.log('NATIVE_GLASS_PROBE',JSON.stringify(result));}
 },[tree,revision,probes]);
 return <View style={{flex:1,paddingTop:80,backgroundColor:'white'}} testID="glass-native-fixture">
  <ScrollView style={{maxHeight:125}}><Text selectable testID="glass-native-report">{report}</Text></ScrollView>
  <Pressable testID="native-glass-probes" onPress={()=>{metrics.current={count:0,total:0,maximum:0};setProbes(v=>!v);}} style={{minHeight:44,justifyContent:'center'}}><Text>{probes?'Profile without readbacks':'Enable pixel probes'}</Text></Pressable>
  <Pressable testID="native-glass-freeze" onPress={()=>setFrozen(v=>!v)} style={{minHeight:44,justifyContent:'center'}}><Text>{frozen?'Resume underlay':'Freeze underlay'}</Text></Pressable>
  <Pressable testID="native-glass-refraction" onPress={()=>setRefraction(v=>v===0?rawGlass.refractionIntensity!:0)} style={{minHeight:44,justifyContent:'center'}}><Text>{refraction===0?'Original refraction':'Zero refraction'}</Text></Pressable>
  <Pressable testID="native-glass-dispersion" onPress={()=>setDispersion(v=>v===0?rawGlass.chromaticAberration!:0)} style={{minHeight:44,justifyContent:'center'}}><Text>{dispersion===0?'Original dispersion':'Zero dispersion'}</Text></Pressable>
  <Canvas ref={control} style={{width:W,height:20,marginTop:20}}><Rect x={0} y={0} width={20} height={20} color="#ff00ff"/><Image image={controls.texture} x={20} y={0} width={20} height={20}/><Image image={controls.raster} x={40} y={0} width={20} height={20}/></Canvas>
  <View style={{width:W,height:H,marginTop:20}}>
   <LiveGlassBackdrop underlay={<View style={StyleSheet.absoluteFill}>{Array.from({length:59},(_,i)=><View key={i} style={{position:'absolute',left:i*5,width:5,height:H,backgroundColor:i%2?(revision%2?'#00ff00':'#ff0000'):'#0000ff'}}/>)}<Text style={{position:'absolute',top:15,left:15,color:'white'}}>LIVE RN TEXT {revision}</Text></View>}>
    <NativeFigmaScene node={tree} width={W} height={H} canvasRef={canvas} onImage={probes?onImage:undefined} onMetrics={onMetrics}/><CanvasProbe scene={canvas} control={control} timerRevision={revision} refraction={refraction} dispersion={dispersion} frozen={frozen} probes={probes} metrics={metrics} report={setReport}/>
   </LiveGlassBackdrop>
  </View>
 </View>;
}

function CanvasProbe({scene,control,timerRevision,refraction,dispersion,frozen,probes,metrics,report}:{scene:React.RefObject<CanvasRef|null>;control:React.RefObject<CanvasRef|null>;timerRevision:number;refraction:number;dispersion:number;frozen:boolean;probes:boolean;metrics:React.RefObject<{count:number;total:number;maximum:number}>;report:(text:string)=>void}){
 const {captureRevision,appState,status,error,lastFrameAt,captureMs,image:input}=useLiveGlassBackdrop();const latest=useRef({captureRevision,appState,status,error,lastFrameAt,captureMs,input});latest.current={captureRevision,appState,status,error,lastFrameAt,captureMs,input};
 useEffect(()=>{if(!probes)return;let active=true;const timer=setTimeout(()=>{void Promise.all([scene.current?.makeImageSnapshotAsync(),control.current?.makeImageSnapshotAsync()]).then(([image,test])=>{try{
  if(!active||!image||!test)return;const w=image.width(),h=image.height(),bytes=image.readPixels(0,0,{width:w,height:h,colorType:ColorType.RGBA_8888,alphaType:AlphaType.Unpremul});const cb=test.readPixels(0,0,{width:test.width(),height:test.height(),colorType:ColorType.RGBA_8888,alphaType:AlphaType.Unpremul});
  if(!bytes||!cb)throw Error('Canvas readPixels returned null');const pd=w/W;const at=(x:number,y:number)=>Array.from(bytes.slice((Math.floor(y*pd)*w+Math.floor(x*pd))*4,(Math.floor(y*pd)*w+Math.floor(x*pd))*4+4));
  const live=latest.current;const captured=live.input?.readPixels(0,0,{width:live.input.width(),height:live.input.height(),colorType:ColorType.RGBA_8888,alphaType:AlphaType.Unpremul});const inputAt=(x:number,y:number)=>live.input&&captured?Array.from(captured.slice((Math.floor(y*live.input.width()/W)*live.input.width()+Math.floor(x*live.input.width()/W))*4,(Math.floor(y*live.input.width()/W)*live.input.width()+Math.floor(x*live.input.width()/W))*4+4)):null;const colorAt=(x:number)=>Array.from(cb.slice(Math.floor(x*test.width()/W)*4,Math.floor(x*test.width()/W)*4+4));
  const result={status:'CANVAS_SAMPLED',refraction,dispersion,frozen,edgeLeft:[2,4,6,8,10].map(x=>({x,y:48,rgba:at(x,48)})),edgeRight:[W-2,W-4,W-6,W-8,W-10].map(x=>({x,y:48,rgba:at(x,48)})),platform:Platform.OS,appState:live.appState,captureStatus:live.status,captureError:live.error,captureMs:live.captureMs,lastFrameAt:live.lastFrameAt,captureRevision:live.captureRevision,inputRgba:{a:inputAt(3,70),b:inputAt(8,70),c:inputAt(285,5)},timerRevision,inputSize:live.input?[live.input.width(),live.input.height()]:null,dpr:pd,controls:{fill:colorAt(10),texture:colorAt(30),raster:colorAt(50)},rgba:{prior:at(50,20),lens:at(50,40),outside:at(285,5)}};report(JSON.stringify(result));console.log('NATIVE_GLASS_CANVAS',JSON.stringify(result));
 }finally{image?.dispose();test?.dispose();}}).catch(error=>console.log('NATIVE_GLASS_CANVAS_ERROR',String(error)));},350);return()=>{active=false;clearTimeout(timer);};},[scene,control,timerRevision,refraction,dispersion,frozen,appState,probes]);
 useEffect(()=>{if(probes)return;const first=latest.current.captureRevision,start=performance.now();const timer=setTimeout(()=>{const elapsed=performance.now()-start,live=latest.current,m=metrics.current;const result={status:'PROFILE_NO_READBACK',appState:live.appState,captureStatus:live.status,captureError:live.error,captureRevision:live.captureRevision,frames:live.captureRevision-first,elapsedMs:elapsed,captureHz:(live.captureRevision-first)*1000/elapsed,lastCaptureMs:live.captureMs,compositionSamples:m.count,meanCompositionMs:m.count?m.total/m.count:null,maxCompositionMs:m.maximum};report(JSON.stringify(result));console.log('NATIVE_GLASS_PROFILE',JSON.stringify(result));},10000);return()=>clearTimeout(timer);},[probes]);
 return null;
}
