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
