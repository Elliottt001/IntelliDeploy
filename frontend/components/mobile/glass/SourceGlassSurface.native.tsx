import {View,StyleSheet} from 'react-native';
import {glassEvidence} from '../../../design/glassEvidence';
import {NativeFigmaScene} from '../NativeFigmaScene.native';
export function SourceGlassSurface({sourceNodeId}:{sourceNodeId?:string}){
 const source=sourceNodeId?glassEvidence[sourceNodeId]:undefined;if(!source||!sourceNodeId)return null;
 return <View pointerEvents="none" accessibilityElementsHidden style={StyleSheet.absoluteFill}><NativeFigmaScene width={source.size.x} height={source.size.y} geometry={(source.paths??[]).map(p=>({...p,sourceNodeId:sourceNodeId as `${number}:${number}`,fill:'transparent',opacity:1,sourceEffects:source.effects}))}/></View>;
}
