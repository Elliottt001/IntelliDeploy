import type { components } from '@intellideploy/api-client';
import { publicApi } from './community';

type Schema = components['schemas'];
export type LoadState<T> = { status: 'ready'; data: T } | { status: 'error' };
export type MarketingData = {
  community: LoadState<Schema['PublicationPage']>;
  pricing: LoadState<Schema['QuotaSku'][]>;
};
type MarketingClient = Pick<typeof publicApi, 'listPublications' | 'listPublicSkus'>;

export async function loadMarketingData(client: MarketingClient = publicApi): Promise<MarketingData> {
  const [community, pricing] = await Promise.allSettled([client.listPublications(), client.listPublicSkus()]);
  return {
    community: community.status === 'fulfilled' ? { status: 'ready', data: community.value } : { status: 'error' },
    pricing: pricing.status === 'fulfilled' ? { status: 'ready', data: pricing.value } : { status: 'error' },
  };
}
