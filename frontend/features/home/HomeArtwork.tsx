import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native";
import Svg, { ClipPath, Defs, G, Image, Path, Rect } from "react-native-svg";
import { FigmaTree } from "../../components/mobile/FigmaTree";
import { FigmaGeometry } from "../../components/mobile/FigmaGeometry";
import type { FigmaVectorLayer } from "../../design/figmaComponentEvidence";
import { homeRenderEvidence as source } from "../../design/homeRenderEvidence";
import { mobileAssets } from "../../design/generated/mobileAssetManifest";
export const matrix = (m: {
  m00: number;
  m10: number;
  m01: number;
  m11: number;
  m02: number;
  m12: number;
}) => `matrix(${m.m00} ${m.m10} ${m.m01} ${m.m11} ${m.m02} ${m.m12})`;
export function HomeAvatar({pressed=false}:{pressed?:boolean}) {
 const definition=pressed?source.avatarPressed:source.avatar;
 return <View testID={pressed?'home-avatar-pressed':'home-avatar-default'} style={{position:'absolute',left:pressed?source.avatarPressedTransform.m02-36:0,top:pressed?source.avatarPressedTransform.m12-107:0,width:definition.size.width,height:definition.size.height}}><FigmaTree node={pressed?source.avatarTrees.pressed:source.avatarTrees.normal} prefix={pressed?'home-avatar-pressed':'home-avatar'}/></View>;
}
export function HomeCardArtwork({
  cardWidth,
  kind,
  progress,
}: {
  cardWidth: number;
  kind: keyof typeof source.cards;
  progress: Animated.Value;
}) {
  const definition = source.cards[kind];
  const closedImageRoot =
    kind === "products" ? "270:26431" : kind === "profile" ? "270:26504" : null;
  const expandedImageRoot =
    source.homeStates.find((state) => state.card === kind)?.expandedNodeId ??
    null;
  const closedImages = source.images.filter((n) => n.rootId === closedImageRoot);
  const expandedImages = source.images.filter(
    (n) => n.rootId === expandedImageRoot,
  );
  const sourceX = (value: number) => (value / 321) * cardWidth;
  const expandedOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const closedOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const imageLayer = (
    images: ReadonlyArray<(typeof source.images)[number]>,
    opacity: Animated.AnimatedInterpolation<number>,
    testID: string,
  ) =>
    images.length > 0 && (
      <Animated.View
        pointerEvents="none"
        testID={testID}
        style={[StyleSheet.absoluteFill, { opacity }]}
      >
        <Svg
          {...(Platform.OS === "web"
            ? { "aria-hidden": true }
            : { accessibilityElementsHidden: true })}
          style={StyleSheet.absoluteFill}
          width="100%"
          height={195}
          viewBox="0 0 321 195"
          preserveAspectRatio="none"
        >
          {images.map((n, i) => {
            const uv = n.paintTransform,
              { m00: a, m10: b, m01: c, m11: d, m02: e, m12: f } = uv,
              det = a * d - b * c;
            const inverse = `matrix(${d / det} ${((-b / det) * n.size.y) / n.size.x} ${((-c / det) * n.size.x) / n.size.y} ${a / det} ${((c * f - d * e) / det) * n.size.x} ${((b * e - a * f) / det) * n.size.y})`;
            const asset = Object.values(mobileAssets).find(
              (a) => a.nodeId === n.assetNodeId,
            )!.source as ImageSourcePropType;
            const clip = `home-${kind}-image-${testID}-${i}`;
            return (
              <G
                key={n.sourceNodeId}
                transform={matrix(n.transform)}
                opacity={n.opacity}
              >
                <Defs>
                  <ClipPath id={clip}>
                    {n.clipPaths.length ? (
                      n.clipPaths.map((p, j) => (
                        <Path key={j} d={p.path} fillRule={p.fillRule} />
                      ))
                    ) : (
                      <Rect
                        width={n.size.x}
                        height={n.size.y}
                        rx={n.cornerRadius}
                      />
                    )}
                  </ClipPath>
                </Defs>
                <G clipPath={`url(#${clip})`}>
                  <Image
                    href={asset}
                    width={n.size.x}
                    height={n.size.y}
                    preserveAspectRatio="none"
                    transform={inverse}
                  />
                </G>
              </G>
            );
          })}
        </Svg>
      </Animated.View>
    );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <FigmaGeometry
        geometry={definition.geometry as readonly FigmaVectorLayer[]}
        width={321}
        height={195}
        prefix={`home-${kind}`}
        transform={matrix(definition.nodeTransform)}
      />
      {kind === 'store' && <Animated.View testID="home-store-fold-layer" style={[StyleSheet.absoluteFill,{opacity:expandedOpacity}]}>
        <FigmaGeometry geometry={source.storeFold.geometry as readonly FigmaVectorLayer[]}
          width={321} height={195} prefix="home-store-fold" transform={matrix(source.storeFold.nodeTransform)} />
      </Animated.View>}
      {kind==='community'&&source.decorations.community.map((decoration,index)=><Animated.View key={decoration.surfaceNodeId} testID={`home-community-decoration-${index}`} style={{position:'absolute',left:sourceX(decoration.nodeTransform.m02),top:decoration.nodeTransform.m12,width:decoration.size.width,height:decoration.size.height,opacity:expandedOpacity}}><FigmaGeometry geometry={decoration.geometry as readonly FigmaVectorLayer[]} width={decoration.size.width} height={decoration.size.height} prefix={`home-community-decoration-${index}`}/></Animated.View>)}
      {imageLayer(closedImages, closedOpacity, `home-${kind}-closed-image-layer`)}
      {imageLayer(expandedImages, expandedOpacity, `home-${kind}-expanded-image-layer`)}
    </View>
  );
}
