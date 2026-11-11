import { expect, test, vi } from 'vitest';
import { loadMarketingData } from '../lib/marketing-data';

const publicationPage = { items: [], next_cursor: null };
const skus = [{ id: 'cny', name: '额度包', provider: 'alipay' as const, currency: 'CNY' as const, amount_minor: 9900, units: 10000, period: null }];

test('loads community and pricing in parallel', async () => {
  const client = { listPublications: vi.fn(async () => publicationPage), listPublicSkus: vi.fn(async () => skus) };
  await expect(loadMarketingData(client)).resolves.toEqual({ community: { status: 'ready', data: publicationPage }, pricing: { status: 'ready', data: skus } });
  expect(client.listPublications).toHaveBeenCalledOnce();
  expect(client.listPublicSkus).toHaveBeenCalledOnce();
});

test('each dynamic section can fail without erasing the other', async () => {
  const communityFailure = { listPublications: vi.fn(async () => { throw new Error('offline'); }), listPublicSkus: vi.fn(async () => skus) };
  await expect(loadMarketingData(communityFailure)).resolves.toEqual({ community: { status: 'error' }, pricing: { status: 'ready', data: skus } });
  const pricingFailure = { listPublications: vi.fn(async () => publicationPage), listPublicSkus: vi.fn(async () => { throw new Error('offline'); }) };
  await expect(loadMarketingData(pricingFailure)).resolves.toEqual({ community: { status: 'ready', data: publicationPage }, pricing: { status: 'error' } });
});
