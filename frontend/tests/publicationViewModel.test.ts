import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import {
  filterLoadedPublications,
  type Publication,
  sortByRecentUpdate,
  storeFigmaEvidence,
  toStoreCard,
} from '../features/store/publicationViewModel';

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

test('store evidence matches direct Kiwi geometry and honest no-symbol subtrees', () => {
  const source = '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221';
  const document = JSON.parse(
    readFileSync(path.join(source, 'design-data/document.kiwi.json'), 'utf8'),
  ) as {
    nodeChanges: Array<{
      guid: { localID: number; sessionID: number };
      parentIndex?: { guid: { localID: number; sessionID: number } };
      size?: { x: number; y: number };
      symbolData?: { symbolID?: { localID: number; sessionID: number } };
      transform?: { m02: number; m12: number };
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

  expect(storeFigmaEvidence.sourcePriority).toEqual([
    'kiwi-document',
    'original-fig-zip',
    'mobile-nodes',
  ]);
  expect(sourceBox(storeFigmaEvidence.detail.frame.id)).toEqual(
    storeFigmaEvidence.detail.frame,
  );
  expect(sourceBox(storeFigmaEvidence.detail.carousel.id)).toEqual(
    storeFigmaEvidence.detail.carousel,
  );
  expect(sourceBox(storeFigmaEvidence.detail.activeSurface.id)).toEqual(
    storeFigmaEvidence.detail.activeSurface,
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
