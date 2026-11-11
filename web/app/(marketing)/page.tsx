import MarketingPage from '@/components/marketing/MarketingPage';
import { loadMarketingData } from '@/lib/marketing-data';

export const dynamic = 'force-dynamic';

export default async function MarketingHome() {
  const data = await loadMarketingData();
  return <MarketingPage {...data} />;
}
