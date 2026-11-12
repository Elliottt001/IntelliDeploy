import type { PropsWithChildren, ReactNode } from 'react';
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

function localMatrix(matrix: { m00: number; m01: number; m02: number; m10: number; m11: number; m12: number }, x: number, y: number) {
  return `matrix(${matrix.m00} ${matrix.m10} ${matrix.m01} ${matrix.m11} ${x} ${y})`;
}

export function ProductFolder({ id, title, items, expanded, hasMore, onToggle }: {
  id: string; title: string; items: readonly Item[]; expanded: boolean; hasMore: boolean; onToggle: () => void;
}) {
  const viewport=useWindowDimensions();
  const back = source.openBackTransform;
  const front = expanded ? source.openFrontTransform : source.closedFrontTransform;
  const frontKey = expanded ? 'openFront' : 'closedFront';
  const glass = source[frontKey].surfaceEffects.find(effect => effect.type === 'BACKGROUND_BLUR');
  const preview = (item: Item, index: number, accessible: boolean) => {
    const slot = expanded ? source.previewSlots[index] : source.closedPreviewSlot;
    return <G key={item.id} transform={localMatrix(slot.transform, slot.transform.m02 - back.m02 + 10, slot.transform.m12 - back.m12)} testID={accessible ? `folder-item-${item.id}` : undefined}>
      <Defs><ClipPath id={`folder-art-${id}-${index}-${accessible}`}><Rect width={slot.size.x} height={slot.size.y} rx={slot.cornerRadius} /></ClipPath></Defs>
      <Rect width={slot.size.x} height={slot.size.y} rx={slot.cornerRadius} fill="#FFFFFF" fillOpacity={0.7}/>
      <SvgText x={slot.size.x/2} y={slot.size.y/2} fill="#494A64" fontFamily={mobileFontFamilies.body} fontSize={Math.min(28,slot.size.y/2)} textAnchor="middle" alignmentBaseline="central">{Array.from(item.name.trim())[0]??'·'}</SvgText>
    </G>;
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}文件夹`} accessibilityState={{ expanded }} aria-expanded={expanded}
    onPress={onToggle} style={[styles.folder, expanded && styles.expandedFolder]} testID={`product-folder-${id}`}>
    <Svg {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessibilityElementsHidden: true })} width="100%" height={expanded ? 345 : 240} viewBox={expanded ? '0 -30 280 345' : '0 0 280 240'}>
      <G transform={expanded ? localMatrix(back, 10, 0) : 'translate(10 0)'}>
        <FolderShape kind={expanded ? 'openBack' : 'closed'} gradientId={`folder-gradient-${id}`} />

      </G>
      {items.slice(0, expanded ? source.previewSlots.length : 1).map((item, index) => preview(item, index, true))}
      {glass && <>
        <Defs>
          <Filter id={`folder-blur-${id}`} x="-100%" y="-100%" width="300%" height="300%"><FeGaussianBlur stdDeviation={glass.radius/2} /></Filter>
          <ClipPath id={`folder-front-clip-${id}`}><Path d={source[frontKey].geometry[0].path} transform={localMatrix(front, 10, front.m12 - back.m12)} /></ClipPath>
        </Defs>
        {/* The shared extractor maps Figma GLASS to background blur. Physical refraction needs native visual acceptance. */}
        <G clipPath={`url(#folder-front-clip-${id})`}><G filter={`url(#folder-blur-${id})`}>
          <G transform={`translate(${-(viewport.width-280)/2} -255)`}><MobileBackdrop width={viewport.width} height={viewport.height} prefix={`folder-${id}`}/></G>
          <G transform={expanded ? localMatrix(back, 10, 0) : 'translate(10 0)'}><FolderShape kind={expanded ? 'openBack' : 'closed'} gradientId={`folder-background-${id}`} /></G>
          {items.slice(0, expanded ? source.previewSlots.length : 1).map((item, index) => preview(item, index, false))}
        </G></G>
      </>}
      <G transform={localMatrix(front, 10, front.m12 - back.m12)}>
        <FolderShape kind={frontKey} gradientId={`folder-front-${id}`} />
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
  folder: { alignItems: 'center', alignSelf: 'center', marginTop: 69, minHeight: 44, minWidth: 44, width: 280, maxWidth: '100%' },
  // The expanded viewBox starts at -30: move its layout box up 30pt to keep the source rear anchored.
  expandedFolder: { marginTop: 39 },
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
