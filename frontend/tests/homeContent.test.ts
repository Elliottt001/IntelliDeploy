import { expect, test } from 'vitest';

import {
  homeCards,
  homeFigmaEvidence,
  homeSuggestions,
} from '../features/home/homeContent';

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
    closedHome: 'kiwi/mobile nodes expose page home compositions directly; no reusable symbol instance governs the home layout',
    expandedHomes: 'expanded page frames are direct home-state compositions; card geometry is measured from frame children',
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
