import {SourceGlassSurface} from '../../components/mobile/glass/SourceGlassSurface';
import { Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Svg,{ClipPath,Defs,FeGaussianBlur,Filter,G,Image,Rect} from 'react-native-svg';
import { mobileAssets } from '../../design/generated/mobileAssetManifest';
import { communityEvidence as source } from './communityEvidence';
import { communitySurface, communityCardStyles } from './DiscoveryCard';
import type { DiscoveryCardModel } from './communityViewModel';
const decoration=mobileAssets['825:6573:175'].source as ImageSourcePropType;
export default function FeaturedPublication({card,onOpen}:{card:DiscoveryCardModel;onOpen:()=>void}) {
 const {featuredContent,decoration:art,decorationContainer:container,glow}=source;
 const matrix=art.transform;const fill=art.fillPaints[0].transform;
 const determinant=fill.m00*fill.m11-fill.m01*fill.m10;
 // Kiwi maps normalized node coordinates into image UV space. Invert, then convert UV coordinates to native points.
 const assetMatrix=`matrix(${fill.m11/determinant} ${-fill.m10/determinant*art.size.y/art.size.x} ${-fill.m01/determinant*art.size.x/art.size.y} ${fill.m00/determinant} ${(fill.m01*fill.m12-fill.m11*fill.m02)/determinant*art.size.x} ${(fill.m10*fill.m02-fill.m00*fill.m12)/determinant*art.size.y})`;
 const decorationMatrix=`matrix(${matrix.m00} ${matrix.m10} ${matrix.m01} ${matrix.m11} ${matrix.m02} ${matrix.m12})`;
 return <Pressable accessibilityRole="button" accessibilityLabel={`查看${card.title}，${card.creator}，${card.summary}，${card.availability}`} onPress={onOpen} testID={`featured-publication-${card.id}`} style={[communitySurface(source.featured),styles.card,{height:source.featured.size.height,overflow:source.featuredNode.clipsContent?'hidden':'visible'}]}>
  <SourceGlassSurface sourceNodeId={source.featured.surfaceNodeId}/>
  <Svg pointerEvents="none" {...(Platform.OS==='web'?{'aria-hidden':true}:{accessibilityElementsHidden:true})} style={StyleSheet.absoluteFill} width="100%" height={source.featured.size.height} viewBox={`0 0 ${source.featured.size.width} ${source.featured.size.height}`} preserveAspectRatio="xMinYMin slice">
   <Defs><ClipPath id={`community-decoration-clip-${card.id}`}><Rect width={art.size.x} height={art.size.y}/></ClipPath><Filter id={`community-glow-${card.id}`} x="-100%" y="-100%" width="300%" height="300%"><FeGaussianBlur stdDeviation={glow.effects[0].radius/2}/></Filter></Defs>
   <Rect x={glow.transform.m02} y={glow.transform.m12} width={glow.size.x} height={glow.size.y} rx={glow.cornerRadius} fill="#BC13FE" opacity={glow.fillPaints[0].opacity} filter={`url(#community-glow-${card.id})`}/>
   <G transform={`translate(${container.transform.m02} ${container.transform.m12})`} opacity={container.opacity}>
    <G testID="community-decoration" transform={decorationMatrix}><G clipPath={`url(#community-decoration-clip-${card.id})`}><Image href={decoration} width={art.size.x} height={art.size.y} preserveAspectRatio="none" transform={assetMatrix}/></G></G>
   </G>
  </Svg>
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
   <Text numberOfLines={1} style={[communityCardStyles.featuredCaption,{position:'absolute',left:featuredContent.transform.m02,top:featuredContent.transform.m12,right:featuredContent.transform.m02}]}>{card.creator}</Text>
   <Text numberOfLines={1} style={[communityCardStyles.featuredTitle,{position:'absolute',left:featuredContent.transform.m02,top:featuredContent.transform.m12+source.featuredTitleSlot.transform.m12,right:featuredContent.transform.m02}]}>{card.title}</Text>
   <Text numberOfLines={2} style={[communityCardStyles.featuredSummary,{position:'absolute',left:featuredContent.transform.m02,top:featuredContent.transform.m12+source.featuredSummarySlot.transform.m12,right:featuredContent.transform.m02}]}>{card.summary}</Text>
   <Text style={[communityCardStyles.featuredCaption,{position:'absolute',left:featuredContent.transform.m02,top:featuredContent.transform.m12+source.availabilitySlot.transform.m12}]}>{card.availability}</Text>
  </View>
 </Pressable>;
}
const styles=StyleSheet.create({card:{width:'100%',minHeight:44,minWidth:44,maxWidth:source.featured.size.width}});
