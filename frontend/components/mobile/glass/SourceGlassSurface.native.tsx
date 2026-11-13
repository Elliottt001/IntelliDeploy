import {View,StyleSheet} from 'react-native';
import {glassEvidence} from '../../../design/glassEvidence';
import {NativeFigmaScene} from '../NativeFigmaScene.native';
export function SourceGlassSurface({sourceNodeId,canvasSize,transform}:{sourceNodeId?:string;canvasSize?:{width:number;height:number};transform?:string}){
 const source=sourceNodeId?glassEvidence[sourceNodeId]:undefined;if(!source||!sourceNodeId)return null;
 return <View pointerEvents="none" accessibilityElementsHidden style={StyleSheet.absoluteFill}><NativeFigmaScene width={canvasSize?.width??source.size.x} height={canvasSize?.height??source.size.y} geometry={(source.paths??[]).map(p=>({...p,sourceNodeId:sourceNodeId as `${number}:${number}`,fill:'transparent',opacity:1,transform,sourceEffects:source.effects}))}/></View>;
}
