import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

import { mobileApprovedFrameIds } from '../design/mobileEvidence';
import {
  getSourceMotion,
  sourceMotionFrameIds,
} from '../design/sourceMotionEvidence';
import {
  extractSourceMotion,
  mergeInteractions,
} from '../scripts/extract-source-motion.mjs';
import { sourceBox, sourceNode } from './figmaSource';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

const interactionId = (sessionID: number, localID: number) => ({
  sessionID,
  localID,
});

test('folder motion preserves the original action and parameters', () => {
  const raw = sourceNode('280:26962').prototypeInteractions[0].actions[0];
  const motion = getSourceMotion('280:26962', 'ON_CLICK')!;

  expect(motion.interactionId).toBe('386:137');
  expect(motion.targetNodeId).toBe('380:147');
  expect(motion.navigation).toBe(raw.navigationType);
  expect(motion.transition).toBe(raw.transitionType);
  expect(motion.durationMs).toBeCloseTo(raw.transitionDuration * 1000, 6);
  expect(motion.easingType).toBe(raw.easingType);
  expect(motion.easingFunction).toEqual(raw.easingFunction);
});

test('Mibo prototype timeout keeps the source delay and transition units', () => {
  const raw = sourceNode('846:3544').prototypeInteractions[0];
  const motion = getSourceMotion('846:3544', 'AFTER_TIMEOUT', '849:3608')!;

  expect(motion.interactionId).toBe('852:4337');
  expect(motion.prototypeDelayMs).toBeCloseTo(
    raw.event.transitionTimeout * 1000,
    6,
  );
  expect(motion.durationMs).toBeCloseTo(
    raw.actions[0].transitionDuration * 1000,
    6,
  );
  expect(motion.easingFunction).toEqual(raw.actions[0].easingFunction);
});

test('formal mobile frames come from the single approved mobile evidence manifest', () => {
  expect(sourceMotionFrameIds).toEqual(mobileApprovedFrameIds);
  expect(sourceMotionFrameIds).toHaveLength(26);
});

test('SCROLL_TO actions preserve unknown and sentinel targets as null', () => {
  expect(getSourceMotion('280:26959', 'ON_CLICK')?.targetNodeId).toBeNull();
  expect(getSourceMotion('380:190', 'ON_CLICK')?.targetNodeId).toBeNull();
  expect(getSourceMotion('380:190', 'ON_CLICK')?.navigation).toBe('SCROLL_TO');
});

test('sourceBox composes the source parent matrix into an AABB', () => {
  const leaf = sourceNode('280:26962');
  const box = sourceBox('168:6299', '280:26962');

  expect(box).toEqual({
    x: leaf.transform.m02,
    y: leaf.transform.m12,
    width: leaf.size.x,
    height: leaf.size.y,
  });
});

test('mergeInteractions replaces and deletes by complete interaction ID', () => {
  const inherited = [
    {
      id: interactionId(1, 1),
      event: { interactionType: 'ON_CLICK' },
      actions: [{ transitionNodeID: interactionId(9, 1) }],
      isDeleted: false,
    },
  ];
  const own = [
    {
      id: interactionId(2, 2),
      event: { interactionType: 'ON_HOVER' },
      actions: [{ transitionNodeID: interactionId(9, 2) }],
      isDeleted: false,
    },
  ];
  const overrides = [
    {
      id: interactionId(1, 1),
      event: { interactionType: 'ON_CLICK' },
      actions: [{ transitionNodeID: interactionId(9, 3) }],
      isDeleted: false,
    },
    {
      id: interactionId(2, 2),
      event: { interactionType: 'ON_HOVER' },
      actions: [{ transitionNodeID: interactionId(9, 4) }],
      isDeleted: true,
    },
  ];

  expect(mergeInteractions(inherited, own, overrides)).toEqual([
    overrides[0],
  ]);
});

test('extractSourceMotion applies override replacement and deletion without source-path leakage', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'source-motion-'));
  temporaryDirectories.push(temporaryRoot);
  const designSource = path.join(temporaryRoot, 'design-source');
  await mkdir(path.join(designSource, 'design-data'), { recursive: true });

  await writeFile(
    path.join(designSource, 'design-data/document.kiwi.json'),
    JSON.stringify({
      nodeChanges: [
        {
          guid: interactionId(1, 100),
          name: 'Approved frame',
          parentIndex: { guid: interactionId(0, 0) },
          size: { x: 375, y: 812 },
          transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          type: 'FRAME',
        },
        {
          guid: interactionId(2, 200),
          name: 'Symbol root',
          parentIndex: { guid: interactionId(0, 0) },
          size: { x: 10, y: 10 },
          transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          type: 'SYMBOL',
          prototypeInteractions: [
            {
              id: interactionId(3, 1),
              event: { interactionType: 'ON_CLICK' },
              actions: [
                {
                  transitionNodeID: interactionId(8, 1),
                  navigationType: 'NAVIGATE',
                  transitionType: 'SMART_ANIMATE',
                  transitionDuration: 0.1,
                  easingType: 'INOUT_CUBIC',
                  easingFunction: [0, 0, 1, 1],
                },
              ],
              isDeleted: false,
            },
          ],
        },
        {
          guid: interactionId(1, 101),
          name: 'Instance root',
          parentIndex: { guid: interactionId(1, 100) },
          size: { x: 10, y: 10 },
          symbolData: {
            symbolID: interactionId(2, 200),
            symbolOverrides: [
              {
                guidPath: { guids: [interactionId(2, 200)] },
                prototypeInteractions: [
                  {
                    id: interactionId(3, 1),
                    event: { interactionType: 'ON_CLICK' },
                    actions: [
                      {
                        transitionNodeID: interactionId(8, 2),
                        navigationType: 'NAVIGATE',
                        transitionType: 'SLIDE_FROM_LEFT',
                        transitionDuration: 0.2,
                        easingType: 'GENTLE_SPRING',
                        easingFunction: [1, 64, 12, 0],
                      },
                    ],
                    isDeleted: false,
                  },
                  {
                    id: interactionId(4, 1),
                    event: { interactionType: 'ON_HOVER' },
                    actions: [{ navigationType: 'SWAP_STATE' }],
                    isDeleted: true,
                  },
                ],
              },
            ],
          },
          transform: { m00: 1, m01: 0, m02: 10, m10: 0, m11: 1, m12: 20 },
          type: 'INSTANCE',
        },
      ],
    }),
  );

  const outputPath = path.join(temporaryRoot, 'motion.ts');
  const result = await extractSourceMotion({
    designSource,
    frameIds: ['1:100'],
    outputPath,
  });

  expect(result.motionCount).toBe(1);
  const output = await readFile(outputPath, 'utf8');
  expect(output).toContain('"interactionId": "3:1"');
  expect(output).toContain('"targetNodeId": "8:2"');
  expect(output).toContain('"durationMs": 200');
  expect(output).not.toContain(designSource);
  expect(output).not.toContain('"4:1"');
});
