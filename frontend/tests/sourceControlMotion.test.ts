import { expect, test } from 'vitest';
import { getSourceMotion } from '../design/sourceMotionEvidence';
import { shouldStartSourceTransition } from '../features/navigation/sourceMotionPolicy';
import { sourceNode } from './figmaSource';

test('visual reaction closure includes both click and one millisecond timeout actions', () => {
  for (const [owner, event, target] of [
    ['228:19794', 'ON_CLICK', '228:19793'],
    ['228:19793', 'AFTER_TIMEOUT', '228:19791'],
    ['228:19791', 'ON_CLICK', '228:19792'],
    ['228:19792', 'AFTER_TIMEOUT', '228:19794'],
  ] as const) {
    const motion = getSourceMotion(owner, event);
    expect(motion, owner).not.toBeNull();
    const raw = sourceNode(owner).prototypeInteractions[0];
    expect(motion!.targetNodeId).toBe(target);
    expect(motion!.durationMs).toBe(raw.actions[0].transitionDuration * 1000);
    expect(motion!.easingFunction).toEqual(raw.actions[0].easingFunction);
    expect(motion!.prototypeDelayMs).toBe((raw.event.transitionTimeout ?? 0) * 1000);
  }
});

test('settings hover source is available separately from instance navigation override', () => {
  expect(getSourceMotion('248:20538', 'ON_HOVER')?.targetNodeId).toBe('248:20537');
  expect(getSourceMotion('266:21480/248:20524', 'ON_CLICK')?.targetNodeId).toBe('168:6258');
});

test('prototype timers never advance authoritative Mibo job state', () => {
  expect(shouldStartSourceTransition(getSourceMotion('846:3544', 'AFTER_TIMEOUT')!, 'prototype-timer', 'queued', 'success')).toBe(false);
});

test('control state geometry carries original local matrices, node opacity and raw paint exactly once',async()=>{
 const {sourceControlStates}=await import('../design/sourceControlMotionEvidence');
 const check=(state:typeof sourceControlStates[string])=>{
  const raw=sourceNode(state.sourceNodeId);
  expect(state.size).toEqual(raw.size);expect(state.transform).toEqual(raw.transform);expect(state.opacity).toBe(raw.opacity??1);
  for(const layer of state.geometry){const paint=layer.rawPaint as Record<string,any>;
   expect([...(raw.fillPaints??[]),...(raw.strokePaints??[])]).toContainEqual(paint);
   expect(layer.opacity).toBe((paint.opacity??1)*(paint.color?.a??1));
  }
  state.children.forEach(check);
 };
 Object.values(sourceControlStates).forEach(check);
});

test('all twenty source trees retain canonical Kiwi mask and geometry visibility/clip flags',async()=>{
 const {sourceControlStates}=await import('../design/sourceControlMotionEvidence');let masks=0;
 const visit=(state:typeof sourceControlStates[string])=>{
  const raw=sourceNode(state.sourceNodeId),canonicalMask=raw.mask===undefined?Boolean(raw.isMask):raw.mask;
  expect(state.mask,state.sourceNodeId).toBe(canonicalMask);if(canonicalMask)masks++;
  expect(state.visible,state.sourceNodeId).toBe(raw.visible!==false);
  expect(state.booleanOperation,state.sourceNodeId).toBe(raw.type==='BOOLEAN_OPERATION');
  expect(state.clipsContent,state.sourceNodeId).toBe(raw.frameMaskDisabled===false);
  for(const layer of state.geometry)expect(['nonzero','evenodd']).toContain(layer.fillRule);
  for(const path of state.maskPaths)expect(['nonzero','evenodd']).toContain(path.fillRule);
  if([...(raw.fillGeometry??[]),...(raw.strokeGeometry??[])].some((g:{windingRule?:string})=>g.windingRule==='ODD'))expect(state.geometry.some(g=>g.fillRule==='evenodd')).toBe(true);
  state.children.forEach(visit);
 };
 expect(Object.keys(sourceControlStates)).toHaveLength(20);Object.values(sourceControlStates).forEach(visit);expect(masks).toBeGreaterThan(0);
});
