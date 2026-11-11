import type { components } from '@intellideploy/api-client';

export type Publication = components['schemas']['PublicationResponse'];

export type StoreCard = {
  id: string;
  name: string;
  summary: string;
  creator: string;
  previewUrl: string | null;
  availability: '可使用' | '暂不可用';
  updatedAt: string;
};

export const storeFigmaEvidence = {
  sourcePriority: ['kiwi-document', 'original-fig-zip', 'mobile-nodes'],
  originalFig: {
    present: true,
    sha256: '5951997a694f1da0a343029dfec889b81ea377e098eb94f0e4b9d61f589e949a',
    zipArchive: true,
  },
  detail: {
    frame: { id: '270:26597', width: 375, height: 812, x: 1189, y: 1411 },
    search: { id: '270:26623', width: 295, height: 36, x: 20.584259033203125, y: 0 },
    carousel: { id: '270:26636', width: 336.16851806640625, height: 439.9969482421875, x: 0, y: 112 },
    activeSurface: { id: '270:26640', width: 271, height: 399, x: 69.28564453125, y: 0 },
    bottomActions: { id: '270:26756', width: 336.16851806640625, height: 54, x: 0, y: 578.9969482421875 },
    noSymbolReason: 'carousel 270:26636 has no INSTANCE or SYMBOL descendants; its card surfaces are direct Kiwi nodes',
  },
  ranking: {
    frame: { id: '825:6804', width: 375, height: 812, x: 4051, y: 2102 },
    header: { id: '825:6983', width: 334, height: 38, x: 27, y: 47 },
    hero: { id: '845:3359', width: 305, height: 123, x: 35, y: 184 },
    list: { id: '845:3357', width: 322, height: 428, x: 28, y: 324 },
    listSurface: { id: '825:7026', width: 305, height: 400.4200439453125, x: 9, y: 27.579952239990234 },
    rowHeight: 55.813331604003906,
    noSymbolReason: 'ranking list 845:3357 has no INSTANCE or SYMBOL descendants; its surface and rows are direct Kiwi frames',
  },
} as const;

export const toStoreCard = (item: Publication): StoreCard => ({
  id: item.id,
  name: item.name,
  summary: item.summary,
  creator: item.creator,
  previewUrl: item.preview_url ?? null,
  availability: item.available ? '可使用' : '暂不可用',
  updatedAt: item.updated_at,
});

export const filterLoadedPublications = (items: Publication[], query: string) => {
  const needle = query.trim().toLocaleLowerCase();
  return needle
    ? items.filter((item) =>
        `${item.name} ${item.summary} ${item.creator}`
          .toLocaleLowerCase()
          .includes(needle),
      )
    : items;
};

export const sortByRecentUpdate = (items: Publication[]) =>
  [...items].sort(
    (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at),
  );

export function mergePublicationPages(
  current: Publication[],
  incoming: Publication[],
) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}
