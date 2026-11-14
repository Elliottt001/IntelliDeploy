import {SourceGlassSurface,sourceSurfacePaintStyle} from '../../components/mobile/glass/SourceGlassSurface';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Animated, Image, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderHandlers, type ImageSourcePropType, type ViewStyle } from 'react-native';
import Svg, { Defs, FeDropShadow, Filter, G, Path } from 'react-native-svg';
import type { FigmaPrimitiveEvidence } from '../../design/figmaComponentEvidence';
import { mobileAssets } from '../../design/generated/mobileAssetManifest';
import { mobileFontFamilies } from '../../theme/typography';
import { getSourceMotion } from '../../design/sourceMotionEvidence';
import { useSourceMotion } from '../../components/mobile/useSourceMotion';
import { communityEvidence as source } from './communityEvidence';
import type { CommunityCardCopy, DiscoveryCardModel } from './communityViewModel';
import {communityCardSlots as slots} from '../../design/communityCardSlots';
import {FigmaTree,type FigmaTreeNode} from '../../components/mobile/FigmaTree';
import {communityAvatarRenderEvidence as mascot} from '../../design/communityAvatarRenderEvidence';
const neutralArtwork=mobileAssets['845:3522:114'].source as ImageSourcePropType;
type WebPointerEvent={currentTarget?:EventTarget|null;nativeEvent?:Partial<PointerEvent&WheelEvent>;clientX?:number;clientY?:number;pointerId?:number;button?:number;isPrimary?:boolean};
const WebWheelView=View as unknown as ComponentType<{children:ReactNode;style:ViewStyle&{touchAction?:string};onWheel:(event:WebPointerEvent)=>void;onPointerDown?:(event:WebPointerEvent)=>void;onLostPointerCapture?:(event:WebPointerEvent)=>void;testID?:string;dataSet?:Record<string,string>}&Record<string,unknown>>;
const WebAnimatedView=Animated.View as unknown as ComponentType<{children:ReactNode;testID:string;dataSet:Record<string,string>;style:unknown}&Record<string,unknown>>;
const WebDataView=View as unknown as ComponentType<{children:ReactNode;testID:string;dataSet?:Record<string,string>;style:unknown;pointerEvents?:'none'}>;
const nativePanHandlers=(panHandlers:GestureResponderHandlers):Partial<GestureResponderHandlers>=>Platform.OS==='web'?{}:panHandlers;
const rgba=(color:string,opacity:number)=>{const hex=color.slice(1);return `rgba(${parseInt(hex.slice(0,2),16)},${parseInt(hex.slice(2,4),16)},${parseInt(hex.slice(4,6),16)},${opacity})`;};
export function communitySurface(definition:FigmaPrimitiveEvidence):ViewStyle {
 const fill=definition.surfaceFills?.find(p=>p.type==='SOLID');const stroke=definition.surfaceStrokes?.find(p=>p.type==='SOLID');
 const shadow=definition.surfaceEffects?.find(e=>e.type==='DROP_SHADOW');const blur=definition.surfaceEffects?.find(e=>e.type==='BACKGROUND_BLUR');
 return {backgroundColor:fill?.color?rgba(fill.color,fill.opacity):undefined,borderColor:stroke?.color?rgba(stroke.color,stroke.opacity):undefined,borderWidth:definition.borderWidths?.top,borderRadius:definition.cornerRadii?.topLeft,shadowColor:shadow?.color,shadowOpacity:shadow?.opacity,shadowRadius:shadow?.radius,shadowOffset:shadow?.offset?{width:shadow.offset.x,height:shadow.offset.y}:undefined,...(Platform.OS==='web'&&blur?{backdropFilter:`blur(${blur.radius}px)`}: {}),...sourceSurfacePaintStyle(definition.surfaceNodeId)};
}
export function CommunitySourceHeading({kind}:{kind:'title'|'subtitle'}) {
 const evidence=source[kind];const shadow=evidence.effects.find(effect=>effect.type==='DROP_SHADOW');
 return <View accessibilityLabel={evidence.characters} accessibilityRole="header">
  <Svg testID={`community-source-${kind}`} {...(Platform.OS==='web'?{'aria-hidden':true}:{accessibilityElementsHidden:true})} width={evidence.size.x} height={evidence.size.y} viewBox={`0 0 ${evidence.size.x} ${evidence.size.y}`} style={{overflow:'visible'}}>
   {shadow&&<Defs><Filter id={`community-${kind}-shadow`} x="-100%" y="-100%" width="300%" height="300%"><FeDropShadow dx={shadow.offset.x} dy={shadow.offset.y} stdDeviation={shadow.radius/2} floodColor="#7A7A7A" floodOpacity={shadow.color.a}/></Filter></Defs>}
   <G filter={shadow?`url(#community-${kind}-shadow)`:undefined}>{evidence.glyphs.map((glyph,index)=><Path key={index} d={glyph.path} fill={glyph.fill} opacity={glyph.opacity} transform={`translate(${glyph.position.x} ${glyph.position.y}) scale(${glyph.fontSize} ${-glyph.fontSize})`} />)}</G>
  </Svg>
 </View>;
}
export function PublicationPreview({card,tall=false}:{card:DiscoveryCardModel;tall?:boolean}) {
 const [failed,setFailed]=useState(false);
 return <Image key={card.previewUrl} accessibilityLabel={card.previewUrl&&!failed?`${card.title}预览`:`${card.title}暂无预览`} source={card.previewUrl&&!failed?{uri:card.previewUrl}:neutralArtwork} onError={()=>setFailed(true)} resizeMode={card.previewUrl&&!failed?'cover':'contain'} style={tall?{width:source.preview.size.x,height:source.preview.size.y,borderRadius:source.preview.cornerRadius}:styles.preview} />;
}
export function CommunitySourceCard({copy,id,kind='tall'}:{copy:CommunityCardCopy;id:string;kind?:'tall'|'standard'|'square'}) {
 const definition=source[kind],surface=communitySurface(definition),tall=kind==='tall';
 const glass=definition.surfaceEffects.some(effect=>effect.rawType==='BACKGROUND_BLUR')?'NOT_IMPLEMENTED':'NONE';
 return <WebDataView testID={`community-source-card-${id}`} dataSet={{sourceGlass:glass}} style={[surface,styles.card,{width:definition.size.width,height:definition.size.height},tall&&{padding:0,borderWidth:0}]}>
  <SourceGlassSurface sourceNodeId={definition.surfaceNodeId}/>
  {tall?<>
   <View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderWidth:sourceSurfacePaintStyle(definition.surfaceNodeId)?0:surface.borderWidth,borderColor:surface.borderColor,borderRadius:surface.borderRadius}]} />
   <View pointerEvents="none" {...(Platform.OS==='web'?{'aria-hidden':true}:{accessibilityElementsHidden:true})} style={{position:'absolute',left:slots.avatar.x,top:slots.avatar.y,width:slots.avatar.width,height:slots.avatar.height}}><FigmaTree node={mascot.tree as unknown as FigmaTreeNode} prefix={`community-source-mascot-${id}`} testID={`community-source-mascot-${id}`}/></View>
   {copy.author!==null&&<Text testID="community-card-author" numberOfLines={1} style={[communityCardStyles.creator,{position:'absolute',left:slots.copy.x,top:slots.copy.y+slots.creator.y,width:slots.header.width-slots.copy.x}]}>{copy.author}</Text>}
   {copy.time!==null&&<Text testID="community-card-time" numberOfLines={1} style={[communityCardStyles.creator,{position:'absolute',left:slots.summary.x,top:slots.copy.y+slots.creator.y,width:slots.summary.width,textAlign:'right'}]}>{copy.time}</Text>}
   {copy.body!==null&&<ScrollView testID="community-card-body" style={{position:'absolute',left:slots.summary.x,top:slots.summary.y,width:slots.summary.width,maxHeight:slots.summary.height}}><Text style={communityCardStyles.summary}>{copy.body}</Text></ScrollView>}
  </>:<>
   {copy.author!==null&&<Text testID="community-card-author" numberOfLines={1} style={styles.creator}>{copy.author}</Text>}
   {copy.time!==null&&<Text testID="community-card-time" numberOfLines={1} style={styles.creator}>{copy.time}</Text>}
   {copy.body!==null&&<ScrollView testID="community-card-body" style={styles.bodyScroll}><Text style={styles.summary}>{copy.body}</Text></ScrollView>}
  </>}
 </WebDataView>;
}
export function CommunitySourceRail({cards}:{cards:readonly {id:string;copy:CommunityCardCopy;kind?:'tall'|'standard'|'square'}[]}) {
 const motion=useMemo(()=>getSourceMotion('825:5887','DRAG','825:6452'),[]);
 const reverse=useMemo(()=>getSourceMotion('825:6488','DRAG','168:6358'),[]);
 const {animateTo,progress,settle}=useSourceMotion(motion);
 const [position,setPosition]=useState(0);
 const pointer=useRef<{claimed:boolean;x:number;y:number;pointerId:number;captureTarget:HTMLElement;captured:boolean;removeListeners:()=>void}|null>(null);
 const clearPointer=useCallback(()=>{
  const current=pointer.current;
  if(!current)return;
  pointer.current=null;
  current.removeListeners();
  if(current.captured){
   try{current.captureTarget.releasePointerCapture(current.pointerId);}catch{/* Capture can already be lost or the element detached. */}
  }
 },[]);
 useEffect(()=>clearPointer,[clearPointer]);
 useEffect(()=>{const listener=progress.addListener(({value})=>setPosition(value));return()=>progress.removeListener(listener);},[progress]);
 const delta=source.railTarget.transform.m02-source.rail.transform.m02;
 const offset=progress.interpolate({inputRange:[0,1],outputRange:[0,delta]});
 const setTarget=useCallback((target:0|1)=>animateTo(target),[animateTo]);
 const settleTarget=useCallback(()=>{clearPointer();settle();},[clearPointer,settle]);
 const handleWheel=useCallback((event:WebPointerEvent)=>{if(Platform.OS!=='web')return;const deltaX=event.nativeEvent?.deltaX??0,deltaY=event.nativeEvent?.deltaY??0;if(Math.abs(deltaX)>Math.abs(deltaY)&&deltaX!==0)setTarget(deltaX>0?1:0);},[setTarget]);
 const point=(event:WebPointerEvent)=>({x:event.nativeEvent?.clientX??event.clientX??0,y:event.nativeEvent?.clientY??event.clientY??0});
 const responder=useMemo(()=>PanResponder.create({
  onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dx)>12&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.2,
  onMoveShouldSetPanResponderCapture:(_,gesture)=>Math.abs(gesture.dx)>12&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.2,
  onPanResponderRelease:(_,gesture)=>{if(Platform.OS!=='web'&&Math.abs(gesture.dx)>30)setTarget(gesture.dx<0?1:0);},
  onPanResponderTerminate:()=>{if(Platform.OS!=='web')settleTarget();},
  onShouldBlockNativeResponder:()=>false,
 }),[setTarget,settleTarget]);
 const pointerCancel=useCallback((event:WebPointerEvent)=>{
  const current=pointer.current,id=event.nativeEvent?.pointerId??event.pointerId;
  if(current&&id===current.pointerId)settleTarget();
 },[settleTarget]);
 const pointerDown=useCallback((event:WebPointerEvent)=>{
  const raw=event.nativeEvent??event;
  if(Platform.OS!=='web'||pointer.current||raw.pointerId==null||raw.button!==0||raw.isPrimary===false)return;
  const target=event.currentTarget as HTMLElement|null;
  const documentRef=target?.ownerDocument;
  if(!target||!documentRef)return;
  const start=point(event);
  const current={claimed:false,x:start.x,y:start.y,pointerId:raw.pointerId,captureTarget:target,captured:false,removeListeners:()=>{
   documentRef.removeEventListener('pointermove',move);
   documentRef.removeEventListener('pointerup',end);
   documentRef.removeEventListener('pointercancel',cancel);
  }};
  // Document pointer events are the sole move/end authority, also covering
  // outside releases when capture is unavailable. No compatibility mouse path.
  const move=(next:PointerEvent)=>{
   if(pointer.current!==current||next.pointerId!==current.pointerId)return;
   const dx=next.clientX-current.x,dy=next.clientY-current.y;
   if(!current.claimed&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.2){
    current.claimed=true;
    // Defer capture until horizontal intent; body panning keeps native scroll.
    if(target.setPointerCapture){
     try{target.setPointerCapture(current.pointerId);current.captured=true;}catch{/* Continue with document fallback. */}
    }
   }
  };
  const end=(next:PointerEvent)=>{
   if(pointer.current!==current||next.pointerId!==current.pointerId)return;
   const dx=next.clientX-current.x;
   clearPointer();
   if(current.claimed&&Math.abs(dx)>30)setTarget(dx<0?1:0);
  };
  const cancel=(next:PointerEvent)=>pointerCancel(next);
  pointer.current=current;
  documentRef.addEventListener('pointermove',move);
  documentRef.addEventListener('pointerup',end);
  documentRef.addEventListener('pointercancel',cancel);
 },[clearPointer,pointerCancel,setTarget]);
 const panHandlers=nativePanHandlers(responder.panHandlers);
 return <WebWheelView testID="community-source-drag-responder" dataSet={{sourceResponder:'pan'}} style={{height:source.rail.size.y,overflow:'hidden',...(Platform.OS==='web'?{touchAction:'pan-y'}:{})}} onWheel={handleWheel} {...(Platform.OS==='web'?{onPointerDown:pointerDown,onLostPointerCapture:pointerCancel}:{})} {...panHandlers}>
  <WebAnimatedView testID="community-source-rail" dataSet={{sourceMotion:`${motion?.nodeId}->${motion?.targetNodeId}`,sourceReverseMotion:`${reverse?.nodeId}->${reverse?.targetNodeId}`,sourceDurationMs:String(motion?.durationMs),sourceEasing:motion?.easingType??'',sourceProgress:position>.5?'1':'0'}} style={{position:'absolute',left:0,top:0,width:source.rail.size.x,height:source.rail.size.y,transform:[{translateX:offset}]}} {...panHandlers}>
   <View style={{position:'absolute',left:0,top:0}}><CommunitySourceCard id={cards[0]?.id??'primary'} copy={cards[0]?.copy??{author:null,time:null,body:null}} kind={cards[0]?.kind}/></View>
   <View style={{position:'absolute',left:source.standardNode.transform.m02,top:0}}><CommunitySourceCard id={cards[1]?.id??'standard'} copy={cards[1]?.copy??{author:null,time:null,body:null}} kind={cards[1]?.kind??'standard'}/></View>
   <View style={{position:'absolute',left:source.squareNode.transform.m02,top:source.standard.size.height+(source.squareNode.transform.m12-source.standard.size.height)}}><CommunitySourceCard id={cards[2]?.id??'square'} copy={cards[2]?.copy??{author:null,time:null,body:null}} kind={cards[2]?.kind??'square'}/></View>
  </WebAnimatedView>
 </WebWheelView>;
}
export default function DiscoveryCard({card,kind='tall',onOpen}:{card:DiscoveryCardModel;kind?:'tall'|'standard'|'square';onOpen:()=>void}) {
 const definition=source[kind];const tall=kind==='tall';
 const surface=communitySurface(definition);
 return <Pressable accessibilityRole="button" accessibilityLabel={`查看${card.title}，${card.creator}，${card.summary}，${card.availability}`} onPress={onOpen} testID={`discovery-publication-${card.id}`} style={[surface,styles.card,{width:definition.size.width,height:definition.size.height},tall&&{padding:0,borderWidth:0}]}>
  <SourceGlassSurface sourceNodeId={definition.surfaceNodeId}/>
  {tall?<>
   <View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderWidth:sourceSurfacePaintStyle(definition.surfaceNodeId)?0:surface.borderWidth,borderColor:surface.borderColor,borderRadius:surface.borderRadius}]} />
   <View style={{position:'absolute',left:slots.header.x,top:slots.header.y,width:slots.header.width,height:slots.header.height}}>
    <View pointerEvents="none" {...(Platform.OS==='web'?{'aria-hidden':true}:{accessibilityElementsHidden:true})} style={{position:'absolute',left:slots.avatar.x,top:slots.avatar.y,width:slots.avatar.width,height:slots.avatar.height}}><FigmaTree node={mascot.tree as unknown as FigmaTreeNode} prefix={`community-brand-mascot-${card.id}`} testID={`community-brand-mascot-${card.id}`}/></View>
    <View style={{position:'absolute',left:slots.copy.x,top:slots.copy.y,width:slots.header.width-slots.copy.x,height:slots.copy.height}}>
     <Text numberOfLines={1} style={communityCardStyles.title}>{card.title}</Text>
     <Text numberOfLines={1} style={[communityCardStyles.creator,{position:'absolute',top:slots.creator.y,width:'100%'}]}>{card.creator}</Text>
    </View>
   </View>
   <Text numberOfLines={5} style={[communityCardStyles.summary,{position:'absolute',left:slots.summary.x,top:slots.summary.y,width:slots.summary.width,height:slots.summary.height}]}>{card.summary}</Text>
   <View style={{position:'absolute',left:slots.preview.x,top:slots.preview.y}}><PublicationPreview card={card} tall /></View>
   <Text style={[communityCardStyles.availability,{position:'absolute',left:slots.summary.x,bottom:17}]}>{card.availability}</Text>
  </>:<>
   <Text numberOfLines={1} style={styles.title}>{card.title}</Text>
   <Text numberOfLines={1} style={styles.creator}>{card.creator}</Text>
   <Text numberOfLines={2} style={styles.summary}>{card.summary}</Text>
   <Text style={styles.availability}>{card.availability}</Text>
  </>}
 </Pressable>;
}
export const communityCardStyles=StyleSheet.create({
 title:{fontFamily:mobileFontFamilies.pingFang,fontWeight:'500',fontSize:source.cardTitle.fontSize,lineHeight:source.cardTitle.lineHeight.value,color:source.cardTitle.textColor},
 creator:{fontFamily:mobileFontFamilies.pingFang,fontSize:source.creatorLine.fontSize,lineHeight:source.creatorLine.lineHeight.value,color:source.creatorLine.textColor},
 summary:{fontFamily:mobileFontFamilies.pingFang,fontWeight:'500',fontSize:source.summary.fontSize,lineHeight:source.summary.lineHeight.value,color:source.summary.textColor},
 availability:{fontFamily:mobileFontFamilies.pingFang,fontSize:source.creatorLine.fontSize,lineHeight:source.creatorLine.lineHeight.value,color:source.creatorLine.textColor},
 featuredTitle:{fontFamily:mobileFontFamilies.pingFang,fontWeight:'500',fontSize:source.featuredTitle.fontSize,lineHeight:source.featuredTitle.lineHeight.value,color:source.featuredTitle.textColor},
 featuredSummary:{fontFamily:mobileFontFamilies.pingFang,fontWeight:'500',fontSize:source.featuredSummary.fontSize,lineHeight:source.featuredSummary.lineHeight.value,color:source.featuredSummary.textColor},
 featuredCaption:{fontFamily:mobileFontFamilies.pingFang,fontSize:source.featuredCaption.fontSize,lineHeight:source.featuredCaption.lineHeight.value,color:source.featuredCaption.textColor},
});
const styles=StyleSheet.create({...communityCardStyles,bodyScroll:{maxHeight:98},card:{padding:17,minWidth:44,minHeight:44},title:{...communityCardStyles.title,marginBottom:3},summary:{...communityCardStyles.summary,marginTop:12},availability:{...communityCardStyles.availability,marginTop:'auto'},preview:{width:64,height:64}});
