import type { MobileRoute } from '../navigation/mobileNavigation';

export const homeSuggestions = [
  {
    id: 'notes',
    label: 'AI Copilot',
    prompt: '创建一个用于记录、搜索和整理私人笔记的 AI Copilot',
    source: 'curated',
  },
  {
    id: 'habits',
    label: 'Notion 模版',
    prompt: '创建一个用于习惯记录和复盘的 Notion 模版工具',
    source: 'curated',
  },
  {
    id: 'inventory',
    label: '自动化工作流',
    prompt: '创建一个用于整理家庭物品清单的自动化工作流',
    source: 'curated',
  },
] as const;

export const homeCards = [
  { key: 'store', title: 'App Gallery', href: '/store', description: '发现可部署应用' },
  { key: 'products', title: '我的产品', href: '/app-gallery', description: '管理我的应用与工具' },
  { key: 'community', title: '广场', href: '/community', description: '探索分享，交流成长' },
  { key: 'profile', title: '我的', href: '/app-gallery', description: '查看收藏与最近使用' },
] as const satisfies readonly {
  description: string;
  href: MobileRoute;
  key: string;
  title: string;
}[];

export type HomeCardKey = (typeof homeCards)[number]['key'];

type FigmaBox = {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
};

type FigmaSurface = {
  height: number;
  id: string;
  width: number;
};

export type HomeStateTarget = {
  card: HomeCardKey;
  closedNodeId: string;
  expandedFrameId: string;
  expandedNodeId: string;
  interactionNodeId: string;
  motionTargetNodeId: string;
  sourceY: { closed: number; expanded: number };
};

export const homeFigmaEvidence = {
  sourcePriority: ['kiwi-document', 'original-fig-zip', 'mobile-nodes'],
  originalFig: {
    present: true,
    sha256: '5951997a694f1da0a343029dfec889b81ea377e098eb94f0e4b9d61f589e949a',
    zipArchive: true,
  },
  closedHomeFrame: {
    id: '270:26263',
    page: 'page-02',
    size: { height: 812, width: 375 },
    transform: { x: 748, y: 1411 },
  },
  expandedHomeFrameIds: [
    '188:16287',
    '188:16759',
    '266:21147',
    '268:22904',
    '268:23238',
    '268:23572',
    '268:23906',
  ],
  expandedStates: [
    { frameId: '188:16287', instanceCount: 0, nodeCount: 200, page: 'page-29' },
    { frameId: '188:16759', instanceCount: 0, nodeCount: 203, page: 'page-30' },
    { frameId: '266:21147', instanceCount: 4, nodeCount: 295, page: 'page-31' },
    { frameId: '268:22904', instanceCount: 4, nodeCount: 295, page: 'page-32' },
    { frameId: '268:23238', instanceCount: 4, nodeCount: 295, page: 'page-33' },
    { frameId: '268:23572', instanceCount: 4, nodeCount: 295, page: 'page-34' },
    { frameId: '268:23906', instanceCount: 4, nodeCount: 295, page: 'page-35' },
  ],
  noSymbolReason: {
    closedHome: 'closed home frame is a direct Kiwi FRAME; measured wordcloud root has no symbol/component/instance metadata or descendant instances',
    expandedHomes: 'expanded home frames are direct Kiwi FRAME compositions; card roots/surfaces are plain frames with only settings icon descendants resolved as instances',
  },
  wordCloud: {
    frame: { height: 111, id: '270:26318', width: 303, x: 39, y: 277 },
    items: [
      { color: '#8A65FF', fontSize: 24, height: 34, id: '270:26320', text: 'AI Copilot', width: 112, x: 98, y: 36 },
      { color: '#6598FF', fontSize: 14, height: 20, id: '270:26321', opacity: 0.72, text: 'Notion 模版', width: 77, x: 160, y: 11 },
      { color: '#54AEF3', fontSize: 8, height: 11, id: '270:26322', opacity: 0.7, text: '同声传译', width: 32, x: 122, y: 6 },
      { color: '#A3B2FF', fontSize: 10, height: 14, id: '270:26328', text: '复古像素风', width: 50, x: 88, y: 21 },
      { color: '#D582FF', fontSize: 8, height: 11, id: '270:26329', text: '开源工具', width: 32, x: 182, y: 91 },
      { color: '#A997FF', fontSize: 10, height: 14, id: '270:26330', text: '生物科技', width: 40, x: 160, y: 70 },
      { color: '#7C62FF', fontSize: 10, height: 14, id: '270:26331', opacity: 0.65, text: 'Web3.0', width: 36, x: 233, y: 48 },
      { color: '#7C62FF', fontSize: 10, height: 14, id: '270:26332', opacity: 0.65, text: '灵感配色', width: 40, x: 241, y: 85 },
      { color: '#6598FF', fontSize: 10, height: 14, id: '270:26335', opacity: 0.75, text: 'Vibe Coding', width: 58, x: 12, y: 52 },
      { color: '#7C62FF', fontSize: 10, height: 14, id: '270:26337', opacity: 0.72, text: 'Prompt技巧', width: 55, x: 28, y: 86 },
      { color: '#A78BFA', fontSize: 10, height: 14, id: '270:26338', opacity: 0.7, text: '知识管理', width: 40, x: 125, y: 86 },
      { color: '#7C62FF', fontSize: 10, height: 14, id: '270:26339', text: '番茄钟', width: 30, x: 213, y: 67 },
      { color: '#6598FF', fontSize: 10, height: 14, id: '270:26343', text: '小众网站', width: 40, x: 50, y: 4 },
      { color: '#7B5CF6', fontSize: 10, height: 14, id: '270:26344', text: '自动化工作流', width: 60, x: 73, y: 69 },
    ] satisfies readonly (FigmaBox & {
      color: string;
      fontSize: number;
      opacity?: number;
      text: string;
    })[],
  },
  cards: [
    {
      closed: { height: 70, id: '270:26345', width: 321, x: 28, y: 447 },
      expandedSurface: { height: 195, id: '270:26346', width: 321 },
      expandedState: { frameId: '268:22904', y: 328 },
      key: 'store',
    },
    {
      closed: { height: 69, id: '270:26431', width: 321, x: 28, y: 517 },
      expandedSurface: { height: 195, id: '270:26432', width: 321 },
      expandedState: { frameId: '268:23238', y: 401 },
      key: 'products',
    },
    {
      closed: { height: 69, id: '270:26460', width: 321, x: 28, y: 587 },
      expandedSurface: { height: 195, id: '270:26461', width: 321 },
      expandedState: { frameId: '268:23572', y: 465 },
      key: 'community',
    },
    {
      closed: { height: 68, id: '270:26504', width: 321, x: 28, y: 657 },
      expandedSurface: { height: 195, id: '270:26505', width: 321 },
      expandedState: { frameId: '268:23906', y: 544 },
      key: 'profile',
    },
  ] satisfies readonly {
    closed: FigmaBox;
    expandedSurface: FigmaSurface;
    expandedState: { frameId: string; y: number };
    key: HomeCardKey;
  }[],
  homeStateTargets: [
    {
      card: 'store',
      closedNodeId: '266:21248',
      expandedFrameId: '268:22904',
      expandedNodeId: '268:23005',
      interactionNodeId: '266:21248',
      motionTargetNodeId: '268:22904',
      sourceY: { closed: 447, expanded: 328 },
    },
    {
      card: 'products',
      closedNodeId: '266:21339',
      expandedFrameId: '268:23238',
      expandedNodeId: '268:23425',
      interactionNodeId: '266:21339',
      motionTargetNodeId: '268:23238',
      sourceY: { closed: 517, expanded: 401 },
    },
    {
      card: 'community',
      closedNodeId: '266:21373',
      expandedFrameId: '268:23572',
      expandedNodeId: '268:23788',
      interactionNodeId: '266:21373',
      motionTargetNodeId: '268:23572',
      sourceY: { closed: 587, expanded: 465 },
    },
    {
      card: 'profile',
      closedNodeId: '268:22898',
      expandedFrameId: '268:23906',
      expandedNodeId: '268:24166',
      interactionNodeId: '268:22898',
      motionTargetNodeId: '268:23906',
      sourceY: { closed: 657, expanded: 544 },
    },
  ] satisfies readonly HomeStateTarget[],
  sourceInspection: {
    wordCloud: {
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
    },
    cards: [
      {
        background: {
          cornerRadius: 30,
          effectTypes: ['INNER_SHADOW', 'INNER_SHADOW', 'NOISE', 'INNER_SHADOW', 'GLASS'],
          fillTypes: ['GRADIENT_RADIAL'],
          id: '270:26347',
          strokeTypes: ['GRADIENT_LINEAR'],
        },
        descendantInstances: [
          {
            height: 38,
            id: '270:26353',
            name: '设置',
            symbolId: '248:20538',
            symbolKeys: ['symbolData', 'derivedSymbolData', 'derivedSymbolDataLayoutVersion'],
            width: 38,
            x: 301,
            y: 60,
          },
        ],
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
        descendantInstances: [
          {
            height: 38,
            id: '270:26439',
            name: '设置',
            symbolId: '248:20538',
            symbolKeys: ['symbolData', 'derivedSymbolData', 'derivedSymbolDataLayoutVersion'],
            width: 38,
            x: 63,
            y: 58,
          },
        ],
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
        descendantInstances: [
          {
            height: 38,
            id: '270:26487',
            name: '设置',
            symbolId: '248:20538',
            symbolKeys: ['symbolData', 'derivedSymbolData', 'derivedSymbolDataLayoutVersion'],
            width: 38,
            x: 303,
            y: 56,
          },
        ],
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
        descendantInstances: [
          {
            height: 38,
            id: '270:26529',
            name: '设置',
            symbolId: '248:20538',
            symbolKeys: ['symbolData', 'derivedSymbolData', 'derivedSymbolDataLayoutVersion'],
            width: 38,
            x: 63,
            y: 54,
          },
        ],
        key: 'profile',
        nodeCount: 26,
        rootOwnFillTypes: [],
        rootSymbolKeys: [],
        surfaceSymbolKeys: [],
      },
    ],
  },
} as const;
