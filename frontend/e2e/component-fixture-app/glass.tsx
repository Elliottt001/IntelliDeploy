import {FigmaGeometry} from '../../components/mobile/FigmaGeometry';
import {SourceGlassLayer} from '../../components/mobile/glass/SourceGlassLayer.web';
import {glassEvidence} from '../../design/glassEvidence';
import {useState} from 'react';
import {View,Pressable,Text} from 'react-native';
import Svg,{G,Rect,Text as SvgText,Path} from 'react-native-svg';
export default function GlassFixture(){
 const [enabled,setEnabled]=useState(false),[changed,setChanged]=useState(false);
 return <View testID="glass-fixture" style={{paddingTop:100,backgroundColor:'#ffffff',flex:1}}>
  <Pressable testID="glass-enable" onPress={()=>setEnabled(!enabled)}><Text>toggle glass</Text></Pressable>
  <Pressable testID="glass-underlay" onPress={()=>setChanged(!changed)}><Text>toggle live underlay</Text></Pressable>
  <View testID="glass-region" style={{width:295,height:100}}>
  <Svg width={295} height={100}>
   {Array.from({length:60},(_,i)=><Rect key={i} x={i*5} width={5} height={100} fill={i%2?(changed?'#00ff00':'#ff0000'):'#0000ff'}/>)}
   <SvgText x={20} y={55} fontSize={25} fill="white">{changed?'CURRENT TEXT':'EARLIER TEXT'}</SvgText>
   <G transform="translate(0 30)"><SourceGlassLayer effects={glassEvidence['270:26624'].effects.filter(e=>e.type==='GLASS').map(e=>({...e,refractionIntensity:enabled?e.refractionIntensity:0,radius:0,chromaticAberration:0,specularIntensity:0,opacity:0}))} width={295} height={36} paths={[{path:"M18 0 H277 A18 18 0 0 1 277 36 H18 A18 18 0 0 1 18 0Z"}]} sourceNodeId="270:26624"/><Path d="M18 0 H277 A18 18 0 0 1 277 36 H18 A18 18 0 0 1 18 0Z" fill="white" fillOpacity={.05}/></G>
  </Svg>
  </View>
  <View style={{opacity:.9,overflow:'hidden',borderRadius:20,width:295,height:100}} testID="glass-nested-region">
   <FigmaGeometry width={295} height={100} prefix="glass-nested" geometry={[
    ...Array.from({length:60},(_,i)=>({sourceNodeId:`0:${i}` as `${number}:${number}`,path:`M${i*5} 0 h5 v100 h-5 Z`,fill:i%2?(changed?'#00ff00':'#ff0000'):'#0000ff',opacity:1})),
    {sourceNodeId:'270:26624',path:"M18 0 H277 A18 18 0 0 1 277 36 H18 A18 18 0 0 1 18 0Z",fill:'white',opacity:.05,transform:'translate(0 30)',sourceEffects:glassEvidence['270:26624'].effects.map(e=>e.type==='GLASS'?({...e,refractionIntensity:enabled?e.refractionIntensity:0,radius:0,chromaticAberration:0,specularIntensity:0,opacity:0}):e)},
   ]}/>
  </View>
 </View>;
}
