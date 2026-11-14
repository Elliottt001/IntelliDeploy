import {View,StyleSheet} from 'react-native';
import {glassEvidence} from '../../../design/glassEvidence';
import {NativeFigmaScene} from '../NativeFigmaScene.native';
import {sourceShellNode} from './sourceShellNode';
export function SourceGlassSurface({sourceNodeId,canvasSize,transform}:{sourceNodeId?:string;canvasSize?:{width:number;height:number};transform?:string}){
 const source=sourceNodeId?glassEvidence[sourceNodeId]:undefined;if(!source||!sourceNodeId)return null;
 // Optics sample the real prefix, then the authored paints cover them once.
 // Return only this shape's source graphic, never its entire prefix rectangle.
 return <View pointerEvents="none" accessibilityElementsHidden style={StyleSheet.absoluteFill}><NativeFigmaScene surfaceOnly width={canvasSize?.width??source.size.x} height={canvasSize?.height??source.size.y} node={sourceShellNode(source,sourceNodeId,transform)}/></View>;
}

export const sourceSurfacePaintStyle=(sourceNodeId?:string)=>sourceNodeId&&glassEvidence[sourceNodeId]?{backgroundColor:'transparent',borderWidth:0,shadowOpacity:0}:undefined;
