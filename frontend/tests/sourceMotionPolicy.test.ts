import { expect, test } from 'vitest';

import { getSourceMotion } from '../design/sourceMotionEvidence';
import { shouldStartSourceTransition } from '../features/navigation/sourceMotionPolicy';

test('prototype timeout cannot advance a live job', () => {
  const source = getSourceMotion('846:3544', 'AFTER_TIMEOUT', '849:3608')!;

  expect(
    shouldStartSourceTransition(
      source,
      'prototype-timer',
      'QUEUED',
      'RUNNING',
    ),
  ).toBe(false);
  expect(
    shouldStartSourceTransition(source, 'snapshot', 'QUEUED', 'RUNNING'),
  ).toBe(true);
  expect(
    shouldStartSourceTransition(source, 'snapshot', 'RUNNING', 'RUNNING'),
  ).toBe(false);
});

test('interactions do not replay prototype timeout transitions', () => {
  const timeout = getSourceMotion('846:3544', 'AFTER_TIMEOUT', '849:3608')!;
  const press = getSourceMotion('266:21221', 'ON_PRESS', '188:16759')!;

  expect(
    shouldStartSourceTransition(timeout, 'interaction', 'IDLE', 'RUNNING'),
  ).toBe(false);
  expect(
    shouldStartSourceTransition(press, 'interaction', 'IDLE', 'RUNNING'),
  ).toBe(true);
});
