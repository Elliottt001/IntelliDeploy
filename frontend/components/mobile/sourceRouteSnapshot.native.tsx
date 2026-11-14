import type { RefObject } from 'react';
import type { View } from 'react-native';
import { Canvas, Image, makeImageFromView, type SkImage } from '@shopify/react-native-skia';
export type RouteSnapshot={image:SkImage;dispose:()=>void};
export async function captureRoutePresentation(root:RefObject<View|null>):Promise<RouteSnapshot|null>{
 if(!root.current)return null;
 const image=await makeImageFromView(root);
 let disposed=false;
 return image?{image,dispose:()=>{if(!disposed){disposed=true;image.dispose();}}}:null;
}
export function RouteSnapshotView({snapshot,x,y,width,height}:{snapshot:RouteSnapshot;x:number;y:number;width:number;height:number}){
 return <Canvas pointerEvents="none" accessibilityElementsHidden style={{position:'absolute',left:x,top:y,width,height}}><Image image={snapshot.image} x={0} y={0} width={width} height={height} fit="fill"/></Canvas>;
}
