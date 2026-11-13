import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';

import {
  filterLoadedPublications,
  type Publication,
  sortByRecentUpdate,
  storeFigmaEvidence,
  toStoreCard,
} from '../features/store/publicationViewModel';
import { rankingRenderEvidence } from '../design/rankingRenderEvidence';
import { storeCardRenderEvidence } from '../design/storeCardRenderEvidence';
import { storeCardSourceAudit } from '../design/storeCardSourceAudit';
import { rankingSourceAudit } from '../design/rankingSourceAudit';

const publication: Publication = {
  id: 'p',
  app_id: 'a',
  instance_id: 'i',
  version_id: 'v',
  name: '共享笔记',
  summary: '记录自己的笔记',
  features: [],
  creator: '作者',
  preview_url: null,
  url: null,
  available: false,
  payer_policy: 'VISITOR',
  sponsor_period: 'DAY',
  sponsor_limit_units: 100,
  copy_url: '/copy',
  updated_at: '2026-11-10T00:00:00Z',
};

test('missing images and metrics become a stable neutral card', () => {
  expect(toStoreCard(publication)).toEqual({
    id: 'p',
    name: '共享笔记',
    summary: '记录自己的笔记',
    creator: '作者',
    previewUrl: null,
    availability: '暂不可用',
    updatedAt: publication.updated_at,
  });
  expect(Object.keys(toStoreCard(publication))).not.toContain('rating');
  expect(Object.keys(toStoreCard(publication))).not.toContain('downloads');
});

test('search only filters loaded items and ranking means recent update', () => {
  expect(filterLoadedPublications([publication], '笔记')).toHaveLength(1);
  expect(filterLoadedPublications([publication], '音乐')).toHaveLength(0);
  expect(
    sortByRecentUpdate([
      { ...publication, id: 'old', updated_at: '2026-01-01T00:00:00Z' },
      publication,
    ]).map((item) => item.id),
  ).toEqual(['p', 'old']);
});

test('recent update sorting puts invalid dates last and breaks every tie by id', () => {
  expect(
    sortByRecentUpdate([
      { ...publication, id: 'invalid-z', updated_at: 'not-a-date' },
      { ...publication, id: 'tie-z', updated_at: '2026-11-10T00:00:00Z' },
      { ...publication, id: 'invalid-a', updated_at: '' },
      { ...publication, id: 'newest', updated_at: '2026-11-11T00:00:00Z' },
      { ...publication, id: 'tie-a', updated_at: '2026-11-10T00:00:00Z' },
    ]).map((item) => item.id),
  ).toEqual(['newest', 'tie-a', 'tie-z', 'invalid-a', 'invalid-z']);
});

test.each([
  ['extract-store-card-render-evidence.mjs', '270:26597'],
  ['extract-ranking-render-evidence.mjs', '825:6804'],
])('the %s generator rejects a non-375 formal frame', (script, frameId) => {
  const root = mkdtempSync(path.join(tmpdir(), 'task7-invalid-source-'));
  mkdirSync(path.join(root, 'design-data'));
  const [sessionID, localID] = frameId.split(':').map(Number);
  writeFileSync(
    path.join(root, 'design-data/document.kiwi.json'),
    JSON.stringify({
      nodeChanges: [{
        guid: { sessionID, localID },
        type: 'FRAME',
        size: { x: 374, y: 812 },
      }],
    }),
  );
  const result = spawnSync(process.execPath, [path.join('scripts', script)], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    env: {
      ...process.env,
      INTELLIDEPLOY_EVIDENCE_OUTPUT: path.join(root, 'output.ts'),
      INTELLIDEPLOY_FIGMA_SOURCE: root,
    },
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('must remain a 375x812 FRAME');
});

test('store evidence generation rejects a requested ID that is no longer absent', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'task7-present-requested-id-'));
  mkdirSync(path.join(root, 'design-data'));
  writeFileSync(
    path.join(root, 'design-data/document.kiwi.json'),
    JSON.stringify({
      nodeChanges: [{
        guid: { sessionID: 270, localID: 26244 },
        type: 'FRAME',
        size: { x: 375, y: 812 },
      }],
    }),
  );
  const result = spawnSync(
    process.execPath,
    [path.join('scripts', 'extract-store-card-render-evidence.mjs')],
    {
      cwd: path.resolve('.'),
      encoding: 'utf8',
      env: { ...process.env, INTELLIDEPLOY_FIGMA_SOURCE: root },
    },
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Previously absent source node now exists: 270:26244');
});

test.skipIf(!process.env.INTELLIDEPLOY_FIGMA_SOURCE)('store source audit (NOT_RUN unless INTELLIDEPLOY_FIGMA_SOURCE is set)', () => {
  const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE!;
  const document = JSON.parse(
    readFileSync(path.join(source, 'design-data/document.kiwi.json'), 'utf8'),
  ) as {
    nodeChanges: Array<{
      guid: { localID: number; sessionID: number };
      parentIndex?: { guid: { localID: number; sessionID: number } };
      prototypeInteractions?: Array<{
        actions: Array<{
          easingFunction: number[];
          easingType: string;
          navigationType: string;
          transitionDuration: number;
          transitionNodeID: { localID: number; sessionID: number };
          transitionType: string;
        }>;
      }>;
      effects?: Array<{
        color?: { a: number; b: number; g: number; r: number };
        offset?: { x: number; y: number };
        radius?: number;
        type: string;
        visible: boolean;
      }>;
      fillPaints?: Array<{
        color: { a: number; b: number; g: number; r: number };
        opacity: number;
        type: string;
        visible: boolean;
      }>;
      size?: { x: number; y: number };
      strokePaints?: Array<{
        color: { a: number; b: number; g: number; r: number };
        opacity: number;
        type: string;
        visible: boolean;
      }>;
      symbolData?: { symbolID?: { localID: number; sessionID: number } };
      transform?: {
        m00: number;
        m01: number;
        m02: number;
        m10: number;
        m11: number;
        m12: number;
      };
      type: string;
    }>;
  };
  const id = (node: (typeof document.nodeChanges)[number]) =>
    `${node.guid.sessionID}:${node.guid.localID}`;
  const nodes = new Map(document.nodeChanges.map((node) => [id(node), node]));
  const descendants = (rootId: string) => {
    const ids = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of document.nodeChanges) {
        const parent = node.parentIndex
          ? `${node.parentIndex.guid.sessionID}:${node.parentIndex.guid.localID}`
          : '';
        if (ids.has(parent) && !ids.has(id(node))) {
          ids.add(id(node));
          changed = true;
        }
      }
    }
    return [...ids].map((nodeId) => nodes.get(nodeId)!);
  };
  const sourceBox = (nodeId: string) => {
    const node = nodes.get(nodeId)!;
    return {
      height: node.size?.y,
      id: nodeId,
      width: node.size?.x,
      x: node.transform?.m02,
      y: node.transform?.m12,
    };
  };
  const parentId = (nodeId: string) => {
    const parent = nodes.get(nodeId)?.parentIndex?.guid;
    return parent ? `${parent.sessionID}:${parent.localID}` : null;
  };
  const rotation = (nodeId: string) => {
    const transform = nodes.get(nodeId)?.transform;
    return transform
      ? (Math.atan2(transform.m10, transform.m00) * 180) / Math.PI
      : null;
  };

  expect(storeFigmaEvidence.sourcePriority).toEqual([
    'kiwi-document',
    'original-fig-zip',
    'mobile-nodes',
  ]);
  expect(nodes.has('270:26244')).toBe(false);
  expect(nodes.has('376:4769')).toBe(false);
  expect(storeFigmaEvidence.detail.frame.id).toBe('270:26597');
  expect(storeFigmaEvidence.ranking.frame.id).toBe('825:6804');
  expect(rankingRenderEvidence.sourceFrameId).toBe('825:6804');
  expect(rankingRenderEvidence.layout).toMatchObject({
    header: sourceBox('825:6983'),
    hero: sourceBox('845:3359'),
    list: sourceBox('845:3357'),
    listSurface: sourceBox('825:7026'),
  });
  expect('sourceAudit' in storeCardRenderEvidence).toBe(false);
  expect('sourceAudit' in rankingRenderEvidence).toBe(false);
  expect('subtree' in storeCardRenderEvidence.rearLayers.backTen).toBe(false);
  expect('subtree' in storeCardRenderEvidence.rearLayers.backFive).toBe(false);
  expect(storeCardSourceAudit.requestedIdsAbsent).toEqual(
    ['270:26244', '376:4769'].filter((nodeId) => !nodes.has(nodeId)),
  );
  expect(storeCardSourceAudit.descendants).toHaveLength(179);
  expect(rankingSourceAudit.descendants).toHaveLength(295);
  const storeRaw = (nodeId: string) =>
    storeCardSourceAudit.descendants.find((entry) => entry.nodeId === nodeId)!.raw as unknown as Record<string, any>;
  const rankingRaw = (nodeId: string) =>
    rankingSourceAudit.descendants.find((entry) => entry.nodeId === nodeId)!.raw as unknown as Record<string, any>;
  expect(storeRaw('270:26755')).toEqual(nodes.get('270:26755'));
  expect(storeRaw('270:26739')).toEqual(nodes.get('270:26739'));
  expect(rankingRaw('825:7130')).toEqual(nodes.get('825:7130'));
  expect(storeRaw('270:26760').prototypeInteractions).toEqual(
    nodes.get('270:26760')!.prototypeInteractions,
  );
  expect(rankingRaw('825:6984').prototypeInteractions).toEqual(
    nodes.get('825:6984')!.prototypeInteractions,
  );
  for (const audit of [storeCardSourceAudit, rankingSourceAudit]) {
    const instance = audit.instances[0];
    expect(instance.semanticScope).toBe('shared-bottom-navigation-state-control');
    expect(instance.runtimeSupport).toBe('NOT_IMPLEMENTED');
    expect(instance.runtimeReason).toContain('BottomNav');
    expect(instance.runtimeReason).not.toContain('PublicationResponse');
    expect(instance.ancestors.map((ancestor) => ancestor.name)).toEqual(
      expect.arrayContaining(['CONTAINER', '设置', 'Frame 2147238705', '底部文字框']),
    );
  }
  const titleShadow = nodes.get('825:7006')!.effects![0];
  expect(rankingRenderEvidence.introTitle.effects).toEqual([
    expect.objectContaining({
      rawType: titleShadow.type,
      color: expect.objectContaining({ alpha: titleShadow.color!.a }),
      offset: titleShadow.offset,
      radius: titleShadow.radius,
    }),
  ]);
  const navigation = nodes.get('825:6984')!.prototypeInteractions![0];
  expect(rankingSourceAudit.prototypeInteractions.find(
    (entry) => entry.nodeId === '825:6984',
  )!.raw).toEqual(
    nodes.get('825:6984')!.prototypeInteractions,
  );
  expect(sourceBox(storeFigmaEvidence.detail.frame.id)).toEqual(
    storeFigmaEvidence.detail.frame,
  );
  expect(sourceBox(storeFigmaEvidence.detail.carousel.id)).toEqual(
    storeFigmaEvidence.detail.carousel,
  );
  expect(sourceBox(storeFigmaEvidence.detail.foregroundSurface.id)).toEqual(
    storeFigmaEvidence.detail.foregroundSurface,
  );
  expect(sourceBox(storeFigmaEvidence.ranking.frame.id)).toEqual(
    storeFigmaEvidence.ranking.frame,
  );
  expect(sourceBox(storeFigmaEvidence.ranking.hero.id)).toEqual(
    storeFigmaEvidence.ranking.hero,
  );
  expect(sourceBox(storeFigmaEvidence.ranking.list.id)).toEqual(
    storeFigmaEvidence.ranking.list,
  );
  expect(sourceBox(storeFigmaEvidence.ranking.listSurface.id)).toEqual(
    storeFigmaEvidence.ranking.listSurface,
  );

  const carouselChildren = document.nodeChanges.filter(
    (node) => parentId(id(node)) === storeFigmaEvidence.detail.carousel.id,
  );
  expect(id(carouselChildren.at(-1)!)).toBe('270:26712');
  expect(parentId('270:26713')).toBe('270:26712');
  expect(rotation('270:26713')).toBeCloseTo(0, 8);
  expect(rotation('270:26640')).toBeCloseTo(10, 5);
  expect(rotation('270:26675')).toBeCloseTo(5, 5);
  expect(storeFigmaEvidence.detail.backSurfaces).toEqual([
    { id: '270:26640', rotationDegrees: 10 },
    { id: '270:26675', rotationDegrees: 5 },
  ]);

  const foreground = nodes.get('270:26713')!;
  expect(foreground.fillPaints).toHaveLength(1);
  expect(foreground.fillPaints![0]).toMatchObject({
    color: {
      a: 1,
      b: 0.986985445022583,
      g: 0.986985445022583,
      r: 0.986985445022583,
    },
    opacity: 1,
    type: 'SOLID',
    visible: true,
  });
  expect(foreground.strokePaints).toBeUndefined();
  expect(foreground.effects).toEqual([
    expect.objectContaining({
      color: {
        a: 1,
        b: 0.7266751527786255,
        g: 0.4772217571735382,
        r: 0.5354275703430176,
      },
      offset: { x: 2, y: 2 },
      radius: 10,
      type: 'DROP_SHADOW',
      visible: true,
    }),
  ]);

  const searchSurface = nodes.get('270:26624')!;
  expect(searchSurface.fillPaints![0]).toMatchObject({
    color: { a: 1, b: 1, g: 1, r: 1 },
    opacity: 0.20000000298023224,
    visible: true,
  });
  expect(searchSurface.effects?.map((effect) => effect.type)).toEqual([
    'GLASS',
    'DROP_SHADOW',
  ]);
  expect(storeFigmaEvidence.detail.searchGlass).toMatchObject({
    nativeSupport: false,
    sourceSurfaceId: '270:26624',
  });

  const rankingSurface = nodes.get('825:7026')!;
  expect(rankingSurface.strokePaints).toEqual([
    expect.objectContaining({
      color: {
        a: 1,
        b: 0.9803921580314636,
        g: 0.545098066329956,
        r: 0.6549019813537598,
      },
      visible: false,
    }),
  ]);
  expect(rankingSurface.effects?.map((effect) => effect.type)).toEqual([
    'DROP_SHADOW',
  ]);

  for (const rootId of [
    storeFigmaEvidence.detail.carousel.id,
    storeFigmaEvidence.ranking.list.id,
  ]) {
    expect(descendants(rootId).filter((node) => node.type === 'INSTANCE')).toEqual([]);
    expect(descendants(rootId).filter((node) => node.type === 'SYMBOL')).toEqual([]);
  }

  const pageInstances = descendants(storeFigmaEvidence.detail.frame.id).filter(
    (node) => node.type === 'INSTANCE',
  );
  expect(pageInstances.map(id)).toEqual(['270:26760']);
  expect(pageInstances[0]?.symbolData?.symbolID).toEqual({
    sessionID: 228,
    localID: 19794,
  });
  expect(nodes.get('228:19794')?.type).toBe('SYMBOL');
});

test('runtime store modules stay compact and cannot import audit-only artifacts', () => {
  const runtimeEvidence = [
    path.join('design', 'storeCardRenderEvidence.ts'),
    path.join('design', 'rankingRenderEvidence.ts'),
  ];
  for (const file of runtimeEvidence) {
    expect(statSync(file).size).toBeLessThan(60_000);
    expect(readFileSync(file, 'utf8')).not.toMatch(/SourceAudit|sourceAudit|paintEffectNodes/);
  }
  for (const file of [
    path.join('features', 'store', 'StoreScreen.tsx'),
    path.join('features', 'store', 'StoreRankingScreen.tsx'),
    path.join('features', 'store', 'PublicationCarousel.tsx'),
    path.join('features', 'store', 'PublicationCard.tsx'),
  ]) {
    expect(readFileSync(file, 'utf8')).not.toMatch(/SourceAudit|SourceAudit\.ts/);
  }
});
