import type { components } from '@intellideploy/api-client';
export type Publication = components['schemas']['PublicationResponse'];
export type CommunityCardCopy = {author:string|null;time:string|null;body:string|null};
export const unavailablePostCopy:CommunityCardCopy={author:null,time:null,body:null};
export const toPublicationDetailCard = (item: Publication) => ({
 id: item.id, title: item.name, summary: item.summary.trim() || '查看应用介绍', creator: item.creator,
 previewUrl: item.preview_url ?? null, availability: item.available ? '可使用' as const : '暂不可用' as const,
});
export type DiscoveryCardModel = ReturnType<typeof toPublicationDetailCard>;
export const selectFeaturedPublication = (items: readonly Publication[]) => items.find(item => item.available) ?? items[0];
