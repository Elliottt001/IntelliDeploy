import {NativeFigmaScene,type SceneLayer} from './NativeFigmaScene.native';
export function FigmaGeometry({geometry,width,height,transform}:{geometry:readonly SceneLayer[];width:number;height:number;prefix:string;transform?:string;overflow?:'visible'|'hidden'}){return <NativeFigmaScene geometry={geometry} width={width} height={height} transform={transform}/>;}
