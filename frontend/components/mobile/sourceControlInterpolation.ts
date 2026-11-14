import type { FigmaTreeNode } from './FigmaTree';
import type { FigmaVectorLayer } from '../../design/figmaComponentEvidence';
export type SourceControlState = Omit<FigmaTreeNode, 'children' | 'geometry'> & {
  geometry: readonly (FigmaVectorLayer & { rawPaint?: unknown })[];
  matchKey: string; name: string; type: string;
  children: readonly SourceControlState[];
};
const mix = (a: number, b: number, t: number) => a + (b-a)*t;
function color(a: string | undefined, b: string | undefined, t: number) {
  if (!a || !b || !/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return t < 1 ? a : b;
  return `#${[1,3,5].map(i=>Math.round(Math.max(0,Math.min(255,mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)))).toString(16).padStart(2,'0')).join('')}`;
}
export function interpolateSourcePath(a: string, b: string, t: number): string | null {
  const number = /-?\d*\.?\d+(?:e[+-]?\d+)?/gi;
  if (a.replace(number,'#') !== b.replace(number,'#')) return null;
  const values = b.match(number)?.map(Number) ?? [];
  let index = 0;
  return a.replace(number, value => String(mix(Number(value),values[index++],t)));
}
function geometry(a: readonly FigmaVectorLayer[], b: readonly FigmaVectorLayer[], t: number) {
  return b.flatMap((target,index) => {
    const from = a[index];
    if (!from) return [{...target,opacity:target.opacity*Math.max(0,Math.min(1,t))}];
    const path = interpolateSourcePath(from.path,target.path,t);
    if (path === null) return [{...from,opacity:from.opacity*(1-Math.max(0,Math.min(1,t)))},{...target,opacity:target.opacity*Math.max(0,Math.min(1,t))}];
    const paint = target.paint && from.paint && target.paint.type === from.paint.type ? {
      ...target.paint, color:color(from.paint.color,target.paint.color,t),
      opacity:mix(from.paint.opacity,target.paint.opacity,t),
      start:target.paint.start && from.paint.start ? {x:mix(from.paint.start.x,target.paint.start.x,t),y:mix(from.paint.start.y,target.paint.start.y,t)}:target.paint.start,
      end:target.paint.end && from.paint.end ? {x:mix(from.paint.end.x,target.paint.end.x,t),y:mix(from.paint.end.y,target.paint.end.y,t)}:target.paint.end,
      gradientStops:target.paint.gradientStops?.map((stop,i)=>{const old=from.paint?.gradientStops?.[i];return old?{...stop,color:color(old.color,stop.color,t),opacity:mix(old.opacity,stop.opacity,t),position:mix(old.position,stop.position,t)}:stop;}),
    }:target.paint;
    return [{...target,path,fill:color(from.fill,target.fill,t),opacity:mix(from.opacity,target.opacity,t),paint}];
  }).concat(a.slice(b.length).map(layer=>({...layer,opacity:layer.opacity*(1-Math.max(0,Math.min(1,t)))})));
}
/** Correspondence is original name/type/sibling occurrence, not arbitrary node IDs. */
export function interpolateSourceControl(a: SourceControlState, b: SourceControlState, t: number): SourceControlState {
  if (t === 0) return a;
  if (t === 1) return b;
  const transform = {...b.transform};
  for (const key of Object.keys(transform) as (keyof typeof transform)[]) transform[key]=mix(a.transform[key],b.transform[key],t);
  const children = b.children.map(child => {
    const from=a.children.find(candidate=>candidate.matchKey===child.matchKey);
    return from?interpolateSourceControl(from,child,t):{...child,opacity:child.opacity*Math.max(0,Math.min(1,t))};
  });
  for(const child of a.children) if(!b.children.some(candidate=>candidate.matchKey===child.matchKey)) children.push({...child,opacity:child.opacity*(1-Math.max(0,Math.min(1,t)))});
  return {...b,size:{x:mix(a.size.x,b.size.x,t),y:mix(a.size.y,b.size.y,t)},transform,opacity:mix(a.opacity,b.opacity,t),geometry:geometry(a.geometry,b.geometry,t),children};
}
