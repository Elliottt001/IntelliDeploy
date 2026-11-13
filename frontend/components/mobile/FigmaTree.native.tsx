import {NativeFigmaScene} from './NativeFigmaScene.native';
import type {FigmaTreeNode} from './FigmaTree';
export type {FigmaTreeNode};
export function FigmaTree({node,testID}:{node:FigmaTreeNode;prefix:string;testID?:string}){return <NativeFigmaScene node={node} width={node.size.x} height={node.size.y} testID={testID}/>;}
