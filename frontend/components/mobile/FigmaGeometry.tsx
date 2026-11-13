import {SourceGlassLayer} from './glass/SourceGlassLayer';
import {hasSourceOptics} from './glass/sourceGlassModel';
import {glassEvidence} from '../../design/glassEvidence';
import { FigmaEffects, hasRenderableSourceEffects, type FigmaSourceEffect } from "./FigmaEffects";
import { Platform } from "react-native";
import Svg, {
  Defs,
  G,
  LinearGradient,
  RadialGradient,
  Path,
  Stop,
  ClipPath,
} from "react-native-svg";
import type { FigmaVectorLayer } from "../../design/figmaComponentEvidence";
type Layer = Omit<FigmaVectorLayer, "paint" | "sourceEffects"> & {
  paint?: Omit<NonNullable<FigmaVectorLayer["paint"]>, "type"> & {
    type: NonNullable<FigmaVectorLayer["paint"]>["type"] | "GRADIENT_ANGULAR";
  };
  sourceSize?: { x: number; y: number };
  sourceEffects?: readonly FigmaSourceEffect[];
};
export function FigmaGeometry({
  geometry,
  width,
  height,
  prefix,
  transform,
  overflow,
}: {
  geometry: readonly Layer[];
  width: number;
  height: number;
  prefix: string;
  transform?: string;
  overflow?: 'visible' | 'hidden';
}) {
  const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-');
  const effectGroups: Array<{id:string;indexes:number[];sourceNodeId:string;effects:NonNullable<Layer['sourceEffects']>}> = [];
  const grouped = new Set<number>();
  for (let index = 0; index < geometry.length; index += 1) {
    const layer = geometry[index];
    if (grouped.has(index) || !(hasRenderableSourceEffects(layer.sourceEffects)||hasSourceOptics(layer.sourceEffects??glassEvidence[layer.sourceNodeId]?.effects))) continue;
    const signature = JSON.stringify(layer.sourceEffects??glassEvidence[layer.sourceNodeId]?.effects);
    const indexes = [index];
    for (let next = index + 1; next < geometry.length; next += 1) {
      const candidate = geometry[next];
      if (candidate.sourceNodeId !== layer.sourceNodeId || JSON.stringify(candidate.sourceEffects??glassEvidence[candidate.sourceNodeId]?.effects) !== signature) break;
      indexes.push(next);
    }
    for (const groupedIndex of indexes) grouped.add(groupedIndex);
    effectGroups.push({
      effects: layer.sourceEffects??glassEvidence[layer.sourceNodeId]?.effects??[],
      id: `${prefix}-effect-${sanitize(layer.sourceNodeId)}`,
      indexes,
      sourceNodeId: layer.sourceNodeId,
    });
  }
  const groupByFirstIndex = new Map(effectGroups.map((group) => [group.indexes[0], group]));
  const renderPath = (layer: Layer, index: number) =>
    layer.paint?.type === "GRADIENT_ANGULAR" ? (
      <AngularPaint
        key={index}
        layer={layer}
        id={`${prefix}-angular-${index}`}
      />
    ) : (
      <Path
        key={index}
        {...(Platform.OS === "web"
          ? { "data-source-node": layer.sourceNodeId }
          : {})}
        d={layer.path}
        fill={
          layer.paint?.type.startsWith("GRADIENT")
            ? `url(#${prefix}-${index})`
            : (layer.fill ?? "none")
        }
        fillRule={layer.fillRule}
        opacity={layer.opacity}
        transform={layer.transform}
      />
    );
  const renderOptics=(layer:Layer,layers:readonly Layer[])=>{
    const source=glassEvidence[layer.sourceNodeId];
    const effects=layer.sourceEffects??source?.effects;
    if(!source||!effects)return null;
    return <SourceGlassLayer effects={effects} width={source.size.x} height={source.size.y} paths={layers.map(l=>({path:l.path,fillRule:l.fillRule}))} transform={layer.transform} sourceNodeId={layer.sourceNodeId}/>;
  };
  return (
    <Svg
      pointerEvents="none"
      {...(Platform.OS === "web"
        ? { "aria-hidden": true }
        : { accessibilityElementsHidden: true })}
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={overflow?{overflow}:undefined}
    >
      <Defs>
        {geometry.map((layer, index) => {
          const p = layer.paint;
          if (!p?.type.startsWith("GRADIENT") || p.type === "GRADIENT_ANGULAR")
            return null;
          const m = p.transform
              ?.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)
              ?.map(Number),
            [a, b, c, d, e, f] = m ?? [1, 0, 0, 1, 0, 0],
            det = a * d - b * c;
          const inverse = `matrix(${d / det} ${-b / det} ${-c / det} ${a / det} ${(c * f - d * e) / det} ${(b * e - a * f) / det})`;
          const stops = p.gradientStops?.map((stop, i) => (
            <Stop
              key={i}
              offset={stop.position}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ));
          return p.type === "GRADIENT_RADIAL" ? (
            <RadialGradient
              key={index}
              id={`${prefix}-${index}`}
              cx=".5"
              cy=".5"
              r=".5"
              gradientTransform={inverse}
            >
              {stops}
            </RadialGradient>
          ) : (
            <LinearGradient
              key={index}
              id={`${prefix}-${index}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
              gradientTransform={inverse}
            >
              {stops}
            </LinearGradient>
          );
        })}
      </Defs>
      <Defs>{effectGroups.map(group=><FigmaEffects key={group.id} effects={group.effects} id={group.id}/>)}</Defs>
      <G transform={transform}>
        {geometry.map((layer, index) => {
          if (grouped.has(index) && !groupByFirstIndex.has(index)) return null;
          const group = groupByFirstIndex.get(index);
          if (group) {
            return <G key={group.id} {...(Platform.OS === "web" ? { "data-source-effect-node": group.sourceNodeId } : {})}>{renderOptics(layer,group.indexes.map(i=>geometry[i]))}<G filter={hasRenderableSourceEffects(group.effects)?`url(#${group.id})`:undefined}>{group.indexes.map((layerIndex)=>renderPath(geometry[layerIndex], layerIndex))}</G></G>;
          }
          return <G key={index}>{renderOptics(layer,[layer])}{renderPath(layer, index)}</G>;
        })}
      </G>
    </Svg>
  );
}

// Figma angular paint is evaluated in its normalized paint coordinates and clipped
// by the original node path. Small sectors rasterize the native conic gradient.
function AngularPaint({ layer, id }: { layer: Layer; id: string }) {
  const p = layer.paint!,
    m = p.transform?.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number) ?? [
      1, 0, 0, 1, 0, 0,
    ],
    [a, b, c, d, e, f] = m,
    det = a * d - b * c,
    size = layer.sourceSize ?? { x: 1, y: 1 };
  const point = (x: number, y: number) =>
    `${((d * x - c * y + c * f - d * e) / det) * size.x} ${((-b * x + a * y + b * e - a * f) / det) * size.y}`;
  const stops = p.gradientStops ?? [];
  const rgba = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (
    <G transform={layer.transform} opacity={layer.opacity}>
      <Defs>
        <ClipPath id={id}>
          <Path d={layer.path} fillRule={layer.fillRule} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        {Array.from({ length: 256 }, (_, i) => {
          const t = (i + 0.5) / 256,
            hi = stops.find((s) => s.position >= t) ?? stops[stops.length - 1],
            lo = [...stops].reverse().find((s) => s.position <= t) ?? stops[0];
          if (!hi?.color || !lo?.color) return null;
          const startColor = rgba(lo.color),
            endColor = rgba(hi.color);
          const q =
              hi.position === lo.position
                ? 0
                : (t - lo.position) / (hi.position - lo.position),
            color = startColor.map((v, j) =>
              Math.round(v + (endColor[j] - v) * q),
            );
          const theta = (i * Math.PI * 2) / 256,
            next = ((i + 1) * Math.PI * 2) / 256;
          return (
            <Path
              key={i}
              d={`M${point(0.5, 0.5)} L${point(0.5 + 100 * Math.cos(theta), 0.5 + 100 * Math.sin(theta))} L${point(0.5 + 100 * Math.cos(next), 0.5 + 100 * Math.sin(next))} Z`}
              fill={`rgb(${color.join(",")})`}
              opacity={lo.opacity + (hi.opacity - lo.opacity) * q}
            />
          );
        })}
      </G>
    </G>
  );
}
