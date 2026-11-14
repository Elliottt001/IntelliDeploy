import type { SourceMotion } from '../../design/sourceMotionEvidence';
export function sourceRouteOffsets(motion: SourceMotion, progress: number, viewport: {width:number;height:number}) {
  const direction: Record<string,[number,number]>={SLIDE_FROM_TOP:[0,-viewport.height],SLIDE_FROM_BOTTOM:[0,viewport.height],SLIDE_FROM_LEFT:[-viewport.width,0],SLIDE_FROM_RIGHT:[viewport.width,0]};
  const [x,y]=direction[motion.transition??'']??[0,0];
  return {incoming:{x:x*(1-progress),y:y*(1-progress)},outgoing:{x:-x*progress,y:-y*progress}};
}
