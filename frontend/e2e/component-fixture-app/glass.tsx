import {FigmaGeometry} from '../../components/mobile/FigmaGeometry';
import {SourceGlassLayer} from '../../components/mobile/glass/SourceGlassLayer.web';
import {glassEvidence} from '../../design/glassEvidence';
import {useState} from 'react';
import {View,Pressable,Text,TextInput} from 'react-native';
import Svg,{G,Rect,Text as SvgText,Path} from 'react-native-svg';
export default function GlassFixture(){
 const [enabled,setEnabled]=useState(false),[changed,setChanged]=useState(false);
 const [shape,setShape]=useState('270:26624');const opticalShape=glassEvidence[shape]??glassEvidence['270:26624'];
 const [params,setParams]=useState<Record<string,number>>({}),[noise,setNoise]=useState<Record<string,number>>({density:0});
 return <View testID="glass-fixture" style={{paddingTop:100,backgroundColor:'#ffffff',flex:1}}>
  <Pressable testID="glass-enable" onPress={()=>setEnabled(!enabled)}><Text>toggle glass</Text></Pressable>
  <Pressable testID="glass-underlay" onPress={()=>setChanged(!changed)}><Text>toggle live underlay</Text></Pressable>
  <View testID="glass-region" style={{width:295,height:100}}>
  <Svg width={295} height={100}>
   {Array.from({length:60},(_,i)=><Rect key={i} x={i*5} width={5} height={100} fill={i%2?(changed?'#00ff00':'#ff0000'):'#0000ff'}/>)}
   <SvgText x={20} y={55} fontSize={25} fill="white">{changed?'CURRENT TEXT':'EARLIER TEXT'}</SvgText>
   <G transform="translate(0 30)"><G transform={`scale(${Math.min(295/opticalShape.size.x,60/opticalShape.size.y)})`}><SourceGlassLayer effects={opticalShape.effects.filter(e=>e.type==='GLASS').map(e=>({...e,refractionIntensity:enabled?e.refractionIntensity:0,radius:0,chromaticAberration:0,specularIntensity:0,opacity:0,...params}))} width={opticalShape.size.x} height={opticalShape.size.y} paths={opticalShape.paths!} sourceNodeId={shape}/></G><SourceGlassLayer effects={[{...glassEvidence['270:26319'].effects.find(e=>e.type==='NOISE')!,...noise}]} width={295} height={36} paths={[{path:"M18 0 H277 A18 18 0 0 1 277 36 H18 A18 18 0 0 1 18 0Z"}]}/><Path d="M18 0 H277 A18 18 0 0 1 277 36 H18 A18 18 0 0 1 18 0Z" fill="white" fillOpacity={.05}/></G>
  </Svg>
  </View>
  <View style={{opacity:.9,overflow:'hidden',borderRadius:20,width:295,height:100}} testID="glass-nested-region">
   <FigmaGeometry width={295} height={100} prefix="glass-nested" geometry={[
    ...Array.from({length:60},(_,i)=>({sourceNodeId:`0:${i}` as `${number}:${number}`,path:`M${i*5} 0 h5 v100 h-5 Z`,fill:i%2?(changed?'#00ff00':'#ff0000'):'#0000ff',opacity:1})),
    {sourceNodeId:'270:26624',path:"M18 0 H277 A18 18 0 0 1 277 36 H18 A18 18 0 0 1 18 0Z",fill:'white',opacity:.05,transform:'translate(0 30)',sourceEffects:glassEvidence['270:26624'].effects.map(e=>e.type==='GLASS'?({...e,refractionIntensity:enabled?e.refractionIntensity:0,radius:0,chromaticAberration:0,specularIntensity:0,opacity:0}):e)},
   ]}/>
  </View>
  <TextInput testID="glass-shape" value={shape} onChangeText={setShape}/>
  <TextInput testID="glass-params" value={JSON.stringify(params)} onChangeText={text=>{try{setParams(JSON.parse(text));}catch{}}}/>
  <TextInput testID="glass-noise" value={JSON.stringify(noise)} onChangeText={text=>{try{setNoise(JSON.parse(text));}catch{}}}/>
 </View>;
}
