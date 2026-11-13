import { expect, test } from 'vitest';

import type { SourceMotion } from '../design/sourceMotionEvidence';
import { getSourceMotion } from '../design/sourceMotionEvidence';
import { sampleSourceEasing } from '../features/navigation/sourceMotionPolicy';
import { sourceNode } from './figmaSource';

test('cubic source easing starts and ends at finite endpoints', () => {
  const source = getSourceMotion('852:4061', 'AFTER_TIMEOUT', '852:4150')!;

  expect(sampleSourceEasing(source, 0)).toBe(0);
  expect(sampleSourceEasing(source, 1)).toBe(1);
  expect(sampleSourceEasing(source, 0.25)).toBeCloseTo(0.12916191173107416, 6);
  expect(sampleSourceEasing(source, 0.5)).toBeCloseTo(0.5000000447034836, 6);
  expect(sampleSourceEasing(source, 0.75)).toBeCloseTo(0.8708380882689258, 6);
});

test('source springs keep raw tuple semantics and allow overshoot', () => {
  const raw = sourceNode('266:21480').prototypeInteractions[0].actions[0];
  const source = getSourceMotion('266:21480', 'ON_HOVER', '248:20537')!;

  expect(source.easingType).toBe('CUSTOM_SPRING');
  expect(source.easingFunction).toEqual(raw.easingFunction);
  expect(sampleSourceEasing(source, 0)).toBe(0);
  expect(sampleSourceEasing(source, 1)).toBe(1);
  expect(sampleSourceEasing(source, 0.25)).toBeCloseTo(
    1.1776099371172466,
    6,
  );
  expect(sampleSourceEasing(source, 0.25)).toBeGreaterThan(1);
});

test('spring preset three preserves the Mibo source duration and tuple', () => {
  const raw = sourceNode('846:3544').prototypeInteractions[0].actions[0];
  const source = getSourceMotion('846:3544', 'AFTER_TIMEOUT', '849:3608')!;

  expect(source.easingType).toBe('SPRING_PRESET_THREE');
  expect(source.durationMs).toBeCloseTo(raw.transitionDuration * 1000, 6);
  expect(source.easingFunction).toEqual([1, 80, 20, 0]);
  expect(sampleSourceEasing(source, 0.25)).toBeCloseTo(
    0.7203384291657774,
    6,
  );
});

test('unknown and invalid source easing is rejected', () => {
  const base = getSourceMotion('852:4061', 'AFTER_TIMEOUT', '852:4150')!;
  const withSource = (motion: Partial<SourceMotion>) => ({
    ...base,
    ...motion,
  });

  expect(() =>
    sampleSourceEasing(
      withSource({ easingType: 'BOUNCE', easingFunction: [0, 0, 1, 1] }),
      0.5,
    ),
  ).toThrow('Unsupported source easing');
  expect(() =>
    sampleSourceEasing(
      withSource({ easingType: 'INOUT_CUBIC', easingFunction: [-0.1, 0, 1, 1] }),
      0.5,
    ),
  ).toThrow('Invalid source bezier');
  expect(() =>
    sampleSourceEasing(
      withSource({ easingType: 'CUSTOM_SPRING', easingFunction: [0, 80, 20, 0] }),
      0.5,
    ),
  ).toThrow('Unsupported source spring');
});
