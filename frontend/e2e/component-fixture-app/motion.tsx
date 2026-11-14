import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {SourceAnimatedControl} from '../../components/mobile/SourceAnimatedControl';
import {SourceRouteTransition,useSourceRouteTransition} from '../../components/mobile/SourceRouteTransition';
import {getSourceMotion} from '../../design/sourceMotionEvidence';
function MotionPage(){
 const navigate=useSourceRouteTransition(),[page,setPage]=useState('Actual previous DOM text');
 return <View style={{flex:1,backgroundColor:page==='Actual previous DOM text'?'#e6eeff':'#fff0f0'}} testID="motion-fixture">
  <Text nativeID="fixture-current-page">{page}</Text>
  <SourceAnimatedControl kind="settings" accessibilityLabel="Source settings hover" testID="source-settings"/>
  <SourceAnimatedControl kind="reaction" visualOnly accessibilityLabel="Isolated source reaction" testID="source-reaction"/>
  {Object.entries({top:'825:5828',bottom:'268:23006',left:'825:6984',right:'266:21193'}).map(([direction,owner])=><Pressable key={direction} testID={`route-${direction}`} onPress={()=>navigate(getSourceMotion(owner,'ON_CLICK'),()=>setPage(`Current ${direction} destination DOM`),`fixture:${direction}`)} style={{minHeight:44,minWidth:44}}><Text>{direction}</Text></Pressable>)}
 </View>;
}
export default function MotionFixture(){return <SourceRouteTransition><MotionPage/></SourceRouteTransition>;}
