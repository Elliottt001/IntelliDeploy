import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { mobileDesignSource } from '../design/mobileEvidence';
import {
  homeCards,
  homeFigmaEvidence,
  homeSuggestions,
} from '../features/home/homeContent';

type KiwiNode = {
  effects?: readonly { type: string }[];
  fillPaints?: readonly { type: string }[];
  guid: { localID: number; sessionID: number };
  name: string;
  parentIndex?: { guid: { localID: number; sessionID: number } };
  rectangleTopLeftCornerRadius?: number;
  size?: { x: number; y: number };
  strokePaints?: readonly { type: string }[];
  symbolData?: { symbolID?: { localID: number; sessionID: number } };
  transform?: { m02: number; m12: number };
  type: string;
};

function nodeId(node: KiwiNode) {
  return `${node.guid.sessionID}:${node.guid.localID}`;
}

function parentId(node: KiwiNode) {
  return node.parentIndex
    ? `${node.parentIndex.guid.sessionID}:${node.parentIndex.guid.localID}`
    : null;
}

function kiwiMap() {
  const kiwi = JSON.parse(
    readFileSync(
      path.join(mobileDesignSource, 'design-data/document.kiwi.json'),
      'utf8',
    ),
  ) as { nodeChanges: KiwiNode[] };
  return new Map(kiwi.nodeChanges.map((node) => [nodeId(node), node]));
}

function descendantIds(nodes: Map<string, KiwiNode>, rootId: string) {
  const childMap = new Map<string | null, string[]>();
  for (const node of nodes.values()) {
    const parent = parentId(node);
    childMap.set(parent, [...(childMap.get(parent) ?? []), nodeId(node)]);
  }
  const stack = [rootId];
  const descendants: string[] = [];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childMap.get(current) ?? []) {
      descendants.push(child);
      stack.push(child);
    }
  }
  return descendants;
}

function sourceBox(node: KiwiNode) {
  return {
    height: Math.round(node.size?.y ?? 0),
    id: nodeId(node),
    width: Math.round(node.size?.x ?? 0),
    x: Math.round(node.transform?.m02 ?? 0),
    y: Math.round(node.transform?.m12 ?? 0),
  };
}

test('home content is honest static inspiration and routes to approved destinations', () => {
  expect(homeSuggestions.every((item) => item.source === 'curated')).toBe(true);
  expect(homeCards.map(({ key, href }) => [key, href])).toEqual([
    ['store', '/store'],
    ['products', '/app-gallery'],
    ['community', '/community'],
    ['profile', '/app-gallery'],
  ]);
});

test('home figma evidence preserves source priority and measured home geometry', () => {
  expect(homeFigmaEvidence.sourcePriority).toEqual([
    'kiwi-document',
    'original-fig-zip',
    'mobile-nodes',
  ]);
  expect(homeFigmaEvidence.originalFig).toEqual({
    present: true,
    sha256: '5951997a694f1da0a343029dfec889b81ea377e098eb94f0e4b9d61f589e949a',
    zipArchive: true,
  });
  expect(homeFigmaEvidence.closedHomeFrame).toEqual({
    id: '270:26263',
    page: 'page-02',
    size: { height: 812, width: 375 },
    transform: { x: 748, y: 1411 },
  });
  expect(homeFigmaEvidence.expandedHomeFrameIds).toEqual([
    '188:16287',
    '188:16759',
    '266:21147',
    '268:22904',
    '268:23238',
    '268:23572',
    '268:23906',
  ]);
  expect(homeFigmaEvidence.noSymbolReason).toEqual({
    closedHome: 'closed home frame is a direct Kiwi FRAME; measured wordcloud root has no symbol/component/instance metadata or descendant instances',
    expandedHomes: 'expanded home frames are direct Kiwi FRAME compositions; card roots/surfaces are plain frames with only settings icon descendants resolved as instances',
  });

  expect(homeFigmaEvidence.wordCloud.frame).toEqual({
    id: '270:26318',
    height: 111,
    width: 303,
    x: 39,
    y: 277,
  });
  expect(
    homeFigmaEvidence.wordCloud.items.map(({ id, text, x, y, width, height }) => ({
      height,
      id,
      text,
      width,
      x,
      y,
    })),
  ).toEqual([
    { height: 34, id: '270:26320', text: 'AI Copilot', width: 112, x: 98, y: 36 },
    { height: 20, id: '270:26321', text: 'Notion 模版', width: 77, x: 160, y: 11 },
    { height: 11, id: '270:26322', text: '同声传译', width: 32, x: 122, y: 6 },
    { height: 14, id: '270:26328', text: '复古像素风', width: 50, x: 88, y: 21 },
    { height: 11, id: '270:26329', text: '开源工具', width: 32, x: 182, y: 91 },
    { height: 14, id: '270:26330', text: '生物科技', width: 40, x: 160, y: 70 },
    { height: 14, id: '270:26331', text: 'Web3.0', width: 36, x: 233, y: 48 },
    { height: 14, id: '270:26332', text: '灵感配色', width: 40, x: 241, y: 85 },
    { height: 14, id: '270:26335', text: 'Vibe Coding', width: 58, x: 12, y: 52 },
    { height: 14, id: '270:26337', text: 'Prompt技巧', width: 55, x: 28, y: 86 },
    { height: 14, id: '270:26338', text: '知识管理', width: 40, x: 125, y: 86 },
    { height: 14, id: '270:26339', text: '番茄钟', width: 30, x: 213, y: 67 },
    { height: 14, id: '270:26343', text: '小众网站', width: 40, x: 50, y: 4 },
    { height: 14, id: '270:26344', text: '自动化工作流', width: 60, x: 73, y: 69 },
  ]);

  expect(homeFigmaEvidence.cards.map(({ key, closed, expandedSurface }) => ({
    closed,
    expandedSurface,
    key,
  }))).toEqual([
    {
      closed: { height: 70, id: '270:26345', width: 321, x: 28, y: 447 },
      expandedSurface: { height: 195, id: '270:26346', width: 321 },
      key: 'store',
    },
    {
      closed: { height: 69, id: '270:26431', width: 321, x: 28, y: 517 },
      expandedSurface: { height: 195, id: '270:26432', width: 321 },
      key: 'products',
    },
    {
      closed: { height: 69, id: '270:26460', width: 321, x: 28, y: 587 },
      expandedSurface: { height: 195, id: '270:26461', width: 321 },
      key: 'community',
    },
    {
      closed: { height: 68, id: '270:26504', width: 321, x: 28, y: 657 },
      expandedSurface: { height: 195, id: '270:26505', width: 321 },
      key: 'profile',
    },
  ]);
});

test('home figma evidence matches direct Kiwi and FIG source records', () => {
  const nodes = kiwiMap();
  const originalFigHash = createHash('sha256')
    .update(readFileSync(path.join(mobileDesignSource, 'original/IntelliDeploy.fig')))
    .digest('hex');

  expect(homeFigmaEvidence.originalFig.sha256).toBe(originalFigHash);

  const closedHome = nodes.get(homeFigmaEvidence.closedHomeFrame.id);
  expect(closedHome).toMatchObject({
    name: '主界面',
    type: 'FRAME',
  });
  expect(homeFigmaEvidence.closedHomeFrame).toMatchObject({
    size: { height: Math.round(closedHome?.size?.y ?? 0), width: Math.round(closedHome?.size?.x ?? 0) },
    transform: { x: Math.round(closedHome?.transform?.m02 ?? 0), y: Math.round(closedHome?.transform?.m12 ?? 0) },
  });

  expect(
    homeFigmaEvidence.expandedHomeFrameIds.map((id) => {
      const node = nodes.get(id);
      return {
        height: Math.round(node?.size?.y ?? 0),
        id,
        parent: node ? parentId(node) : null,
        type: node?.type,
        width: Math.round(node?.size?.x ?? 0),
      };
    }),
  ).toEqual([
    { height: 812, id: '188:16287', parent: '129:1390', type: 'FRAME', width: 375 },
    { height: 812, id: '188:16759', parent: '129:1390', type: 'FRAME', width: 375 },
    { height: 812, id: '266:21147', parent: '129:1390', type: 'FRAME', width: 375 },
    { height: 812, id: '268:22904', parent: '129:1390', type: 'FRAME', width: 375 },
    { height: 812, id: '268:23238', parent: '129:1390', type: 'FRAME', width: 375 },
    { height: 812, id: '268:23572', parent: '129:1390', type: 'FRAME', width: 375 },
    { height: 812, id: '268:23906', parent: '129:1390', type: 'FRAME', width: 375 },
  ]);

  expect(sourceBox(nodes.get(homeFigmaEvidence.wordCloud.frame.id)!)).toEqual(
    homeFigmaEvidence.wordCloud.frame,
  );
  for (const item of homeFigmaEvidence.wordCloud.items) {
    const source = nodes.get(item.id);
    expect({
      ...sourceBox(source!),
      text: source?.name,
    }).toEqual({
      height: item.height,
      id: item.id,
      text: item.text,
      width: item.width,
      x: item.x,
      y: item.y,
    });
  }

  for (const card of homeFigmaEvidence.cards) {
    expect(sourceBox(nodes.get(card.closed.id)!)).toEqual(card.closed);
    expect(sourceBox(nodes.get(card.expandedSurface.id)!)).toMatchObject({
      height: card.expandedSurface.height,
      id: card.expandedSurface.id,
      width: card.expandedSurface.width,
    });
  }

  expect(homeFigmaEvidence.sourceInspection.wordCloud).toEqual({
    background: {
      cornerRadius: 30,
      effectTypes: ['INNER_SHADOW', 'INNER_SHADOW', 'NOISE'],
      fillTypes: ['GRADIENT_RADIAL'],
      id: '270:26319',
      strokeTypes: ['GRADIENT_LINEAR'],
    },
    descendantInstances: [],
    instanceCount: 0,
    nodeCount: 27,
    rootSymbolKeys: [],
  });
  expect(homeFigmaEvidence.sourceInspection.cards).toEqual([
    {
      background: {
        cornerRadius: 30,
        effectTypes: ['INNER_SHADOW', 'INNER_SHADOW', 'NOISE', 'INNER_SHADOW', 'GLASS'],
        fillTypes: ['GRADIENT_RADIAL'],
        id: '270:26347',
        strokeTypes: ['GRADIENT_LINEAR'],
      },
      descendantInstances: [{ height: 38, id: '270:26353', name: '设置', symbolId: '248:20538', symbolKeys: ['symbolData', 'derivedSymbolData', 'derivedSymbolDataLayoutVersion'], width: 38, x: 301, y: 60 }],
      key: 'store',
      nodeCount: 86,
      rootOwnFillTypes: [],
      rootSymbolKeys: [],
      surfaceSymbolKeys: [],
    },
    {
      background: {
        cornerRadius: 30,
        effectTypes: ['INNER_SHADOW', 'INNER_SHADOW', 'NOISE', 'INNER_SHADOW', 'GLASS'],
        fillTypes: ['GRADIENT_RADIAL'],
        id: '270:26433',
        strokeTypes: ['GRADIENT_LINEAR'],
      },
      descendantInstances: [{ height: 38, id: '270:26439', name: '设置', symbolId: '248:20538', symbolKeys: ['symbolData', 'derivedSymbolData', 'derivedSymbolDataLayoutVersion'], width: 38, x: 63, y: 58 }],
      key: 'products',
      nodeCount: 29,
      rootOwnFillTypes: [],
      rootSymbolKeys: [],
      surfaceSymbolKeys: [],
    },
    {
      background: {
        cornerRadius: 30,
        effectTypes: ['INNER_SHADOW', 'INNER_SHADOW', 'NOISE', 'INNER_SHADOW', 'GLASS'],
        fillTypes: ['GRADIENT_RADIAL'],
        id: '270:26462',
        strokeTypes: ['GRADIENT_LINEAR'],
      },
      descendantInstances: [{ height: 38, id: '270:26487', name: '设置', symbolId: '248:20538', symbolKeys: ['symbolData', 'derivedSymbolData', 'derivedSymbolDataLayoutVersion'], width: 38, x: 303, y: 56 }],
      key: 'community',
      nodeCount: 44,
      rootOwnFillTypes: [],
      rootSymbolKeys: [],
      surfaceSymbolKeys: [],
    },
    {
      background: {
        cornerRadius: 30,
        effectTypes: ['INNER_SHADOW', 'INNER_SHADOW', 'NOISE', 'GLASS'],
        fillTypes: ['GRADIENT_RADIAL'],
        id: '270:26506',
        strokeTypes: ['GRADIENT_LINEAR'],
      },
      descendantInstances: [{ height: 38, id: '270:26529', name: '设置', symbolId: '248:20538', symbolKeys: ['symbolData', 'derivedSymbolData', 'derivedSymbolDataLayoutVersion'], width: 38, x: 63, y: 54 }],
      key: 'profile',
      nodeCount: 26,
      rootOwnFillTypes: [],
      rootSymbolKeys: [],
      surfaceSymbolKeys: [],
    },
  ]);

  expect(
    homeFigmaEvidence.cards.map((card) => {
      const rootIds = [
        card.closed.id,
        ...descendantIds(nodes, card.closed.id),
      ];
      const instances = rootIds
        .map((id) => nodes.get(id)!)
        .filter((node) => node.type === 'INSTANCE')
        .map((node) => ({
          height: Math.round(node.size?.y ?? 0),
          id: nodeId(node),
          name: node.name,
          symbolId: `${node.symbolData?.symbolID?.sessionID}:${node.symbolData?.symbolID?.localID}`,
          width: Math.round(node.size?.x ?? 0),
          x: Math.round(node.transform?.m02 ?? 0),
          y: Math.round(node.transform?.m12 ?? 0),
        }));
      return {
        instances,
        key: card.key,
        nodeCount: rootIds.length,
        rootOwnFillTypes: nodes.get(card.closed.id)?.fillPaints?.map((paint) => paint.type) ?? [],
      };
    }),
  ).toEqual([
    {
      instances: [{ height: 38, id: '270:26353', name: '设置', symbolId: '248:20538', width: 38, x: 301, y: 60 }],
      key: 'store',
      nodeCount: 86,
      rootOwnFillTypes: [],
    },
    {
      instances: [{ height: 38, id: '270:26439', name: '设置', symbolId: '248:20538', width: 38, x: 63, y: 58 }],
      key: 'products',
      nodeCount: 29,
      rootOwnFillTypes: [],
    },
    {
      instances: [{ height: 38, id: '270:26487', name: '设置', symbolId: '248:20538', width: 38, x: 303, y: 56 }],
      key: 'community',
      nodeCount: 44,
      rootOwnFillTypes: [],
    },
    {
      instances: [{ height: 38, id: '270:26529', name: '设置', symbolId: '248:20538', width: 38, x: 63, y: 54 }],
      key: 'profile',
      nodeCount: 26,
      rootOwnFillTypes: [],
    },
  ]);

  expect(
    homeFigmaEvidence.expandedStates.map((state) => {
      const ids = [state.frameId, ...descendantIds(nodes, state.frameId)];
      return {
        frameId: state.frameId,
        instanceCount: ids.filter((id) => nodes.get(id)?.type === 'INSTANCE').length,
        nodeCount: ids.length,
        page: state.page,
      };
    }),
  ).toEqual(homeFigmaEvidence.expandedStates);
});
