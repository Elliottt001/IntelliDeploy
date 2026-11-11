import type {PropsWithChildren} from 'react';
import {Platform,StyleSheet,View,useWindowDimensions} from 'react-native';
import Svg,{ClipPath,Defs,FeGaussianBlur,Filter,G,LinearGradient,Path,Rect,Stop} from 'react-native-svg';
import type {FigmaVectorLayer} from '../../design/figmaComponentEvidence';
import {communityEvidence as source} from './communityEvidence';
export default function CommunityBackground({insets,children}:PropsWithChildren<{insets:{left:number;right:number;top:number;bottom:number}}>) {
 const window=useWindowDimensions();const {m00:a,m10:b,m01:c,m11:d,m02:e,m12:f}=source.background.fillPaints[0].transform;const determinant=a*d-b*c;
 // Kiwi maps surface coordinates into paint space; SVG needs the inverse. Only the background fills the viewport.
 const gradientTransform=`matrix(${d/determinant} ${-b/determinant} ${-c/determinant} ${a/determinant} ${(c*f-d*e)/determinant} ${(b*e-a*f)/determinant})`;
 const blur=source.atmosphere.effects.find(effect=>effect.rawType==='FOREGROUND_BLUR')!;
 const origin=source.atmosphereNode.transform;
 return <View style={styles.page} testID="mobile-community">
  <Svg testID="community-atmosphere" pointerEvents="none" {...(Platform.OS==='web'?{'aria-hidden':true}:{accessibilityElementsHidden:true})} style={StyleSheet.absoluteFill} width="100%" height="100%">
   <Defs><ClipPath id="community-atmosphere-frame"><Rect width={source.atmosphereNode.size.x} height={source.atmosphereNode.size.y}/></ClipPath><LinearGradient id="community-background" x1="0" y1="0" x2="1" y2="0" gradientTransform={gradientTransform}><Stop offset="0" stopColor="#EFF3FF"/><Stop offset="1" stopColor="#FFFFFF"/></LinearGradient><Filter id="community-atmosphere-blur" x="-100%" y="-100%" width="300%" height="300%"><FeGaussianBlur stdDeviation={blur.radius}/></Filter></Defs>
   <Rect width="100%" height="100%" fill="url(#community-background)"/>
   <G transform={`translate(${origin.m02+(window.width-source.background.size.x)/2} ${origin.m12})`} clipPath={source.atmosphereNode.clipsContent?"url(#community-atmosphere-frame)":undefined}>
    <G filter="url(#community-atmosphere-blur)">
    {(source.atmosphere.geometry as readonly FigmaVectorLayer[]).map((layer,index)=><Path key={index} d={layer.path} fill={layer.fill} fillRule={layer.fillRule} opacity={layer.opacity} transform={layer.transform}/>)}
    </G>
   </G>
  </Svg>
  <View style={{flex:1,alignSelf:'center',width:Math.min(560,window.width-insets.left-insets.right-source.rail.transform.m02*2),paddingTop:Math.max(insets.top+3,47),paddingBottom:Math.max(insets.bottom,12)}}>{children}</View>
 </View>;
}
const styles=StyleSheet.create({page:{flex:1,overflow:'hidden',backgroundColor:'#EFF3FF'}});
