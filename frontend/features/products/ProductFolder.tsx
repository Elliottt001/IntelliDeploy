import { useEffect, useMemo, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Image as NativeImage, useWindowDimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { ClipPath, Defs, FeDropShadow, FeGaussianBlur, Filter, G, Image, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import {formalMobileControls} from '../../design/formalMobileControls';
import {getMobileLayout} from '../../theme/responsive';
import {MobileBackdrop} from '../../components/mobile/MobileBackdrop';
import { AppBackground, CircleAction } from '../../components/mobile';
import type { FigmaPaintEvidence, FigmaVectorLayer } from '../../design/figmaComponentEvidence';
import { mobileAssets } from '../../design/generated/mobileAssetManifest';
import { mobileColors } from '../../theme/tokens';
import { mobileFontFamilies } from '../../theme/typography';
import { getSourceMotion } from '../../design/sourceMotionEvidence';
import { useSourceMotion } from '../../components/mobile/useSourceMotion';
import { fitSourceWidth } from '../../theme/responsive';
import { productFolderEvidence as source } from './productFolderEvidence';

const neutralArtwork = mobileAssets['845:3522:114'].source as ImageSourcePropType;
type Item = { id: string; name: string };
type TextEvidence = typeof source.collection | typeof source.slogan;

export function ProductArtwork({ name }: { name: string }) {
  return <NativeImage accessibilityLabel={`${name}暂无应用图标`} source={neutralArtwork} style={styles.rowArt} />;
}

function SourceText({ evidence, color }: { evidence: TextEvidence; color: string }) {
  return <G fill={color}>{evidence.glyphs.map((glyph, index) => <Path key={index} d={glyph.path} fill={glyph.fill} opacity={glyph.opacity} transform={`translate(${glyph.position.x} ${glyph.position.y}) scale(${glyph.fontSize} ${-glyph.fontSize})`} />)}</G>;
}

function FolderShape({ kind, gradientId }: { kind: 'closed' | 'closedFront' | 'openBack' | 'openFront'; gradientId: string }) {
  const definition = source[kind];
  const paint = definition.surfaceFills[0] as FigmaPaintEvidence;
  // Kiwi's paint matrix maps shape coordinates to gradient coordinates. SVG requires its inverse.
  const matrix = paint.transform?.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number);
  let gradientTransform: string | undefined;
  if (matrix) {
    const [a, b, c, d, e, f] = matrix;
    const determinant = a * d - b * c;
    gradientTransform = `matrix(${d / determinant} ${-b / determinant} ${-c / determinant} ${a / determinant} ${(c * f - d * e) / determinant} ${(b * e - a * f) / determinant})`;
  }

  return <>
    {paint.type === 'GRADIENT_LINEAR' && <Defs><LinearGradient id={gradientId} x1={matrix ? 0 : paint.start?.x} y1={matrix ? 0 : paint.start?.y} x2={matrix ? 1 : paint.end?.x} y2={matrix ? 0 : paint.end?.y} gradientTransform={gradientTransform}>
      {paint.gradientStops?.map((stop, index) => <Stop key={index} offset={stop.position} stopColor={stop.color} stopOpacity={stop.opacity} />)}
    </LinearGradient></Defs>}
    {definition.geometry.map((raw, index) => {
      const layer = raw as FigmaVectorLayer;
      return <Path key={index} d={layer.path} fill={paint.type === 'GRADIENT_LINEAR' ? `url(#${gradientId})` : layer.fill} fillRule={layer.fillRule} opacity={layer.opacity} transform={layer.transform} />;
    })}
  </>;
}

type SourceMatrix = { m00: number; m01: number; m02: number; m10: number; m11: number; m12: number };
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
function localMatrix(from: SourceMatrix, to: SourceMatrix, progress: number) {
  const origin = source.closedBackTransform;
  return `matrix(${lerp(from.m00,to.m00,progress)} ${lerp(from.m10,to.m10,progress)} ${lerp(from.m01,to.m01,progress)} ${lerp(from.m11,to.m11,progress)} ${lerp(from.m02-origin.m02,to.m02-origin.m02,progress)} ${lerp(from.m12-origin.m12,to.m12-origin.m12,progress)})`;
}

export function ProductFolder({ id, title, items, expanded, hasMore, onToggle }: {
  id: string; title: string; items: readonly Item[]; expanded: boolean; hasMore: boolean; onToggle: () => void;
}) {
  const viewport=useWindowDimensions();
  // Open and close author the same spring tuple. Keeping one motion object lets
  // useSourceMotion reverse from the current presentation value without reset.
  const motion=useMemo(()=>getSourceMotion('280:26962','ON_CLICK','380:147'),[]);
  const {animateTo,progress}=useSourceMotion(motion);
  const [presentation,setPresentation]=useState(expanded?1:0);
  useEffect(()=>{const listener=progress.addListener(({value})=>setPresentation(value));return()=>progress.removeListener(listener);},[progress]);
  useEffect(()=>animateTo(expanded?1:0),[animateTo,expanded]);
  const folderWidth=fitSourceWidth(source.closed.size.width,source.sourceFrameWidth,viewport.width,'relative');
  const scale=folderWidth/source.closed.size.width;
  const safeScale=scale||1;
  const localHeight=240+105*presentation;
  const back=localMatrix(source.closedBackTransform,source.openBackTransform,presentation);
  const front=localMatrix(source.closedFrontTransform,source.openFrontTransform,presentation);
  const glass = source.closedFront.surfaceEffects.find(effect => effect.rawType === 'GLASS');
  const backdropX=-(viewport.width-folderWidth)/(2*safeScale);
  const backdropY=-255/safeScale;
  const preview = (item: Item, index: number, accessible: boolean) => {
    const closedSlot=source.closedPreviewSlots[index],openSlot=source.previewSlots[index];
    const opacity=index===0?1:Math.max(0,Math.min(1,presentation));
    return <G key={item.id} opacity={opacity} transform={localMatrix(closedSlot.transform,openSlot.transform,presentation)} testID={accessible ? `folder-slot-${openSlot.sourceNodeId.replace(':','-')}` : undefined}>
      <G testID={accessible ? `folder-item-${item.id}` : undefined}>
      <Defs><ClipPath id={`folder-art-${id}-${index}-${accessible}`}><Rect width={openSlot.size.x} height={openSlot.size.y} rx={openSlot.cornerRadius} /></ClipPath></Defs>
      <Rect width={openSlot.size.x} height={openSlot.size.y} rx={openSlot.cornerRadius} fill="#FFFFFF" fillOpacity={0.7}/>
      <SvgText x={openSlot.size.x/2} y={openSlot.size.y/2} fill="#494A64" fontFamily={mobileFontFamilies.body} fontSize={Math.min(28,openSlot.size.y/2)} textAnchor="middle" alignmentBaseline="central">{Array.from(item.name.trim())[0]??'·'}</SvgText>
      </G>
    </G>;
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}文件夹`} accessibilityState={{ expanded }} aria-expanded={expanded}
    onPress={onToggle} style={[styles.folder,{width:folderWidth,marginTop:69-30*scale*presentation}]} testID={`product-folder-${id}`}>
    <Svg {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessibilityElementsHidden: true })} width={folderWidth} height={localHeight*scale} viewBox={`0 ${-30*presentation} 260 ${localHeight}`} style={styles.folderArt}>
      <G transform={back}>
        <FolderShape kind="closed" gradientId={`folder-gradient-${id}`} />

      </G>
      {items.slice(0,source.previewSlots.length).map((item,index)=>preview(item,index,true))}
      {glass && <>
        <Defs>
          <Filter id={`folder-blur-${id}`} x="-100%" y="-100%" width="300%" height="300%"><FeGaussianBlur stdDeviation={glass.radius/2} /></Filter>
          <ClipPath id={`folder-front-clip-${id}`}><Path d={source.closedFront.geometry[0].path} transform={front} /></ClipPath>
        </Defs>
        {/* Local blur is only the current fallback; raw GLASS remains NOT_IMPLEMENTED. */}
        <G clipPath={`url(#folder-front-clip-${id})`}><G filter={`url(#folder-blur-${id})`}>
          <G transform={`translate(${backdropX} ${backdropY})`}><MobileBackdrop width={viewport.width/safeScale} height={viewport.height/safeScale} prefix={`folder-${id}`}/></G>
          <G transform={back}><FolderShape kind="closed" gradientId={`folder-background-${id}`} /></G>
          {items.slice(0,source.previewSlots.length).map((item,index)=>preview(item,index,false))}
        </G></G>
      </>}
      <G transform={front}>
        <FolderShape kind="closedFront" gradientId={`folder-front-${id}`} />
        <G transform="translate(17 113)"><SourceText evidence={source.slogan} color="#FFFFFF" /></G>
      </G>
    </Svg>
    <Text style={styles.folderCount}>{hasMore ? '已加载 ' : ''}{items.length} 个应用 · {expanded ? '点击收起' : '点击展开'}</Text>
  </Pressable>;
}

export function ProductPage({ title, subtitle, insets, onBack, testID, children, actions, actionsOpen=false, onToggleActions }: PropsWithChildren<{
  actions?:ReactNode;actionsOpen?:boolean;onToggleActions?:()=>void;title: string; subtitle: string; insets: { top: number; bottom: number; left: number; right: number }; onBack: () => void; testID: string;
}>) {
  const viewport=useWindowDimensions(),pageLayout=getMobileLayout(viewport.width,insets),headerSource=formalMobileControls.productHeader;
  const headerLeft=headerSource.transform.m02-3+Math.max(0,(viewport.width-375)/2),headerWidth=Math.min(headerSource.size.x+6,viewport.width-insets.left-insets.right-35);
  const textShadow = source.collection.effects.find(effect => effect.type === 'DROP_SHADOW');
  return <AppBackground insets={insets} testID={testID} contentStyle={{ paddingTop: Math.max(insets.top,44), paddingBottom: Math.max(insets.bottom, 12) }}>
    <View style={[styles.header,{alignSelf:'flex-start',width:headerWidth,maxWidth:headerWidth,marginLeft:headerLeft-pageLayout.gutter-insets.left}]} testID="products-header">
      <CircleAction accessibilityLabel={title === '我的产品' ? '返回首页' : '返回我的产品'} icon="back" onPress={onBack} surfaceOffset={headerSource.back.surfaceOffset} iconOffset={headerSource.back.iconOffset} />
      <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
      <CircleAction accessibilityLabel={actions?"产品分类与操作":"分享暂未开放"} disabled={!actions} icon="share" surfaceOffset={headerSource.share.surfaceOffset} iconOffset={headerSource.share.iconOffset} onPress={()=>onToggleActions?.()} testID={actions?"products-actions-open":undefined}/>
    </View>
    {actions&&actionsOpen&&<View style={styles.actionsMenu}>{actions}<ProductAction label="关闭分类菜单" onPress={()=>onToggleActions?.()}/></View>}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View accessibilityLabel="COLLECTION" style={[styles.collection,{marginLeft:Math.max(0,headerSource.collection.transform.m02-pageLayout.gutter)}]}>
        <Svg width={source.collection.size.x} height={source.collection.size.y} viewBox={`0 0 ${source.collection.size.x} ${source.collection.size.y}`} style={{ overflow: 'visible' }}>
          {textShadow && <Defs><Filter id="collection-shadow" x="-100%" y="-100%" width="300%" height="300%"><FeDropShadow dx={textShadow.offset.x} dy={textShadow.offset.y} stdDeviation={textShadow.radius/2} floodColor="#7A7A7A" floodOpacity={textShadow.color.a} /></Filter></Defs>}
          <G filter={textShadow ? 'url(#collection-shadow)' : undefined}><SourceText evidence={source.collection} color={mobileColors.text} /></G>
        </Svg>
      </View>
      <Text style={[styles.subtitle,{marginLeft:Math.max(0,headerSource.collection.transform.m02-pageLayout.gutter)}]}>{subtitle}</Text>
      {children}
      <Text style={styles.footer}>世界在你掌心…</Text>
    </ScrollView>
  </AppBackground>;
}

export function ProductAction({ label, onPress, disabled = false, testID, selected = false }: {
  label: string; onPress: () => void; disabled?: boolean; testID?: string; selected?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} testID={testID} style={[styles.action, selected && styles.selected, disabled && styles.disabled]}>
    <Text style={[styles.actionLabel, selected && styles.selectedLabel]}>{label}</Text>
  </Pressable>;
}

export function ProductActions({ children }: { children: ReactNode }) { return <View style={styles.actions}>{children}</View>; }
export function ProductMessage({ children, alert = false }: { children: ReactNode; alert?: boolean }) { return <Text accessibilityRole={alert ? 'alert' : undefined} style={[styles.message, alert && styles.error]}>{children}</Text>; }

const styles = StyleSheet.create({
  actionsMenu: {position:'absolute',right:0,top:91,zIndex:10,width:280,maxWidth:'100%',backgroundColor:'#FFFFFF',borderColor:'#D0C7FE',borderWidth:1,borderRadius:20,padding:12},
  header: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, width: '100%', maxWidth: source.header.size.x },
  headerTitle: { fontFamily: mobileFontFamilies.pingFang, fontSize: 16, lineHeight: 22, fontWeight: '500', color: mobileColors.text },
  scroll: { flexGrow: 1, paddingTop:40, paddingBottom: 24 },
  collection: { alignSelf: 'flex-start', height: source.collection.size.y, width: source.collection.size.x },
  subtitle: { marginTop: 7, fontFamily: mobileFontFamilies.pingFang, fontSize: 12, lineHeight: 17, color: mobileColors.muted },
  folder: { alignItems: 'center', alignSelf: 'center', minHeight: 44, minWidth: 44, maxWidth: '100%' },
  folderArt: { overflow: 'visible' },
  folderCount: { marginTop: 20, fontFamily: mobileFontFamilies.body, fontSize: 12, lineHeight: 18, color: mobileColors.muted },
  rowArt: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 12, width: 44, height: 44 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20, marginBottom: 12 },
  action: { alignItems: 'center', justifyContent: 'center', minWidth: 88, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: '#D0C7FE', paddingHorizontal: 12 },
  selected: { backgroundColor: mobileColors.primary, borderColor: mobileColors.primary },
  actionLabel: { fontFamily: mobileFontFamilies.body, fontSize: 13, lineHeight: 20, color: mobileColors.text },
  selectedLabel: { color: '#FFFFFF' }, disabled: { opacity: 0.5 },
  message: { marginVertical: 12, fontFamily: mobileFontFamilies.body, fontSize: 14, lineHeight: 22, color: mobileColors.muted },
  error: { color: mobileColors.danger },
  footer: { alignSelf: 'center', marginTop: 'auto', paddingTop: 40, fontFamily: mobileFontFamilies.pingFang, fontSize: 12, lineHeight: 17, color: mobileColors.muted },
});
