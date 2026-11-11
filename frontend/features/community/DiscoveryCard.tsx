import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type ViewStyle } from 'react-native';
import Svg, { Defs, FeDropShadow, Filter, G, Path } from 'react-native-svg';
import type { FigmaPrimitiveEvidence } from '../../design/figmaComponentEvidence';
import { mobileAssets } from '../../design/generated/mobileAssetManifest';
import { mobileFontFamilies } from '../../theme/typography';
import { communityEvidence as source } from './communityEvidence';
import type { DiscoveryCardModel } from './communityViewModel';
const neutralArtwork=mobileAssets['845:3522:114'].source as ImageSourcePropType;
const rgba=(color:string,opacity:number)=>{const hex=color.slice(1);return `rgba(${parseInt(hex.slice(0,2),16)},${parseInt(hex.slice(2,4),16)},${parseInt(hex.slice(4,6),16)},${opacity})`;};
export function communitySurface(definition:FigmaPrimitiveEvidence):ViewStyle {
 const fill=definition.surfaceFills?.find(p=>p.type==='SOLID');const stroke=definition.surfaceStrokes?.find(p=>p.type==='SOLID');
 const shadow=definition.surfaceEffects?.find(e=>e.type==='DROP_SHADOW');const blur=definition.surfaceEffects?.find(e=>e.type==='BACKGROUND_BLUR');
 return {backgroundColor:fill?.color?rgba(fill.color,fill.opacity):undefined,borderColor:stroke?.color?rgba(stroke.color,stroke.opacity):undefined,borderWidth:definition.borderWidths?.top,borderRadius:definition.cornerRadii?.topLeft,shadowColor:shadow?.color,shadowOpacity:shadow?.opacity,shadowRadius:shadow?.radius,shadowOffset:shadow?.offset?{width:shadow.offset.x,height:shadow.offset.y}:undefined,...(Platform.OS==='web'&&blur?{backdropFilter:`blur(${blur.radius}px)`}: {})};
}
export function CommunitySourceHeading({kind}:{kind:'title'|'subtitle'}) {
 const evidence=source[kind];const shadow=evidence.effects.find(effect=>effect.type==='DROP_SHADOW');
 return <View accessibilityLabel={evidence.characters} accessibilityRole="header">
  <Svg testID={`community-source-${kind}`} {...(Platform.OS==='web'?{'aria-hidden':true}:{accessibilityElementsHidden:true})} width={evidence.size.x} height={evidence.size.y} viewBox={`0 0 ${evidence.size.x} ${evidence.size.y}`} style={{overflow:'visible'}}>
   {shadow&&<Defs><Filter id={`community-${kind}-shadow`} x="-100%" y="-100%" width="300%" height="300%"><FeDropShadow dx={shadow.offset.x} dy={shadow.offset.y} stdDeviation={shadow.radius} floodColor="#7A7A7A" floodOpacity={shadow.color.a}/></Filter></Defs>}
   <G filter={shadow?`url(#community-${kind}-shadow)`:undefined}>{evidence.glyphs.map((glyph,index)=><Path key={index} d={glyph.path} fill={glyph.fill} opacity={glyph.opacity} transform={`translate(${glyph.position.x} ${glyph.position.y}) scale(${glyph.fontSize} ${-glyph.fontSize})`} />)}</G>
  </Svg>
 </View>;
}
export function PublicationPreview({card,tall=false}:{card:DiscoveryCardModel;tall?:boolean}) {
 const [failed,setFailed]=useState(false);
 return <Image key={card.previewUrl} accessibilityLabel={card.previewUrl&&!failed?`${card.title}预览`:`${card.title}暂无预览`} source={card.previewUrl&&!failed?{uri:card.previewUrl}:neutralArtwork} onError={()=>setFailed(true)} resizeMode={card.previewUrl&&!failed?'cover':'contain'} style={tall?{width:source.preview.size.x,height:source.preview.size.y,borderRadius:source.preview.cornerRadius}:styles.preview} />;
}
export default function DiscoveryCard({card,kind='tall',onOpen}:{card:DiscoveryCardModel;kind?:'tall'|'standard'|'square';onOpen:()=>void}) {
 const definition=source[kind];const tall=kind==='tall';
 return <Pressable accessibilityRole="button" accessibilityLabel={`查看${card.title}`} onPress={onOpen} testID={`discovery-publication-${card.id}`} style={[communitySurface(definition),styles.card,{width:definition.size.width,height:definition.size.height}]}>
  <Text numberOfLines={tall?2:1} style={styles.title}>{card.title}</Text>
  <Text numberOfLines={1} style={styles.creator}>{card.creator}</Text>
  <Text numberOfLines={tall?5:2} style={styles.summary}>{card.summary}</Text>
  {tall&&<View style={{marginTop:12}}><PublicationPreview card={card} tall /></View>}
  <Text style={styles.availability}>{card.availability}</Text>
 </Pressable>;
}
export const communityCardStyles=StyleSheet.create({
 title:{fontFamily:mobileFontFamilies.pingFang,fontWeight:'500',fontSize:source.cardTitle.fontSize,lineHeight:source.cardTitle.lineHeight.value,color:source.cardTitle.textColor},
 creator:{fontFamily:mobileFontFamilies.pingFang,fontSize:source.creatorLine.fontSize,lineHeight:source.creatorLine.lineHeight.value,color:source.creatorLine.textColor},
 summary:{fontFamily:mobileFontFamilies.pingFang,fontWeight:'500',fontSize:source.summary.fontSize,lineHeight:source.summary.lineHeight.value,color:source.summary.textColor},
 availability:{fontFamily:mobileFontFamilies.pingFang,fontSize:source.creatorLine.fontSize,lineHeight:source.creatorLine.lineHeight.value,color:source.creatorLine.textColor},
 featuredTitle:{fontFamily:mobileFontFamilies.pingFang,fontWeight:'500',fontSize:source.featuredTitle.fontSize,lineHeight:source.featuredTitle.lineHeight.value,color:source.featuredTitle.textColor},
 featuredSummary:{fontFamily:mobileFontFamilies.pingFang,fontWeight:'500',fontSize:source.featuredSummary.fontSize,lineHeight:source.featuredSummary.lineHeight.value,color:source.featuredSummary.textColor},
 featuredCaption:{fontFamily:mobileFontFamilies.pingFang,fontSize:source.featuredCaption.fontSize,lineHeight:source.featuredCaption.lineHeight.value,color:source.creatorLine.textColor},
});
const styles=StyleSheet.create({...communityCardStyles,card:{padding:17,minWidth:44,minHeight:44},title:{...communityCardStyles.title,marginBottom:3},summary:{...communityCardStyles.summary,marginTop:12},availability:{...communityCardStyles.availability,marginTop:'auto'},preview:{width:64,height:64}});
