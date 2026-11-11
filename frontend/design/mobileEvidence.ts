export const mobileDesignSource =
  '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221' as const;

export const mobileEvidence = {
  login: {
    pages: ['page-01'],
    frameIds: ['119:76618'],
    size: [375, 812],
  },
  home: {
    pages: [
      'page-02',
      'page-29',
      'page-30',
      'page-31',
      'page-32',
      'page-33',
      'page-34',
      'page-35',
    ],
    frameIds: [
      '270:26263',
      '188:16287',
      '188:16759',
      '266:21147',
      '268:22904',
      '268:23238',
      '268:23572',
      '268:23906',
    ],
    size: [375, 812],
  },
  store: {
    pages: ['page-03', 'page-40'],
    frameIds: ['270:26597', '825:6804'],
    size: [375, 812],
  },
  chatbot: {
    pages: [
      'page-46',
      'page-47',
      'page-48',
      'page-49',
      'page-50',
      'page-51',
      'page-52',
      'page-53',
      'page-54',
      'page-55',
      'page-58',
    ],
    frameIds: [
      '845:3479',
      '846:3544',
      '849:3608',
      '849:3705',
      '849:3794',
      '849:3883',
      '849:3972',
      '852:4061',
      '852:4150',
      '852:4242',
      '852:4391',
    ],
    size: [375, 812],
  },
  products: {
    pages: ['page-56', 'page-57'],
    frameIds: ['168:6299', '380:147'],
    size: [375, 812],
  },
  community: {
    pages: ['page-59', 'page-60'],
    frameIds: ['168:6358', '825:6452'],
    size: [375, 812],
  },
} as const;

export const mobileApprovedFrameIds = Object.values(mobileEvidence).flatMap(
  (evidence) => evidence.frameIds,
);

export const mobileComponentAuditedRoots = {
  settings: ['266:21480'],
  brandMark: ['270:26268', '270:26277'],
  back: ['845:3503', '845:3505'],
  share: ['845:3510', '845:3512'],
  search: ['270:26625'],
  bell: ['825:6482'],
  microphone: ['845:3535'],
  send: ['845:3539'],
  arrowRight: ['825:7024'],
  home: ['270:26532', '270:26534'],
  store: ['270:26538', '270:26540'],
  community: ['270:26546', '270:26548'],
  products: ['270:26552', '270:26554'],
  circleAction: ['845:3503', '845:3510'],
  bottomNav: ['270:26531'],
  glassCard: ['825:6575'],
} as const;
