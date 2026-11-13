import {View,StyleSheet} from 'react-native';
import Svg from 'react-native-svg';
import {glassEvidence} from '../../../design/glassEvidence';
import {SourceGlassLayer} from './SourceGlassLayer.web';
export function SourceGlassSurface({sourceNodeId,canvasSize,transform}:{sourceNodeId?:string;canvasSize?:{width:number;height:number};transform?:string}){
 const source=sourceNodeId?glassEvidence[sourceNodeId]:undefined;if(!source)return null;
 const size=canvasSize??{width:source.size.x,height:source.size.y};
 const paths=source.paths?.length?source.paths:[{path:`M0 0 H${source.size.x} V${source.size.y} H0 Z`}];
 return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden><SourceGlassLayer effects={source.effects} width={source.size.x} height={source.size.y} paths={paths} sourceNodeId={sourceNodeId} transform={transform}/></Svg></View>;
}
