import MarketingHeader from '@/components/marketing/MarketingHeader';
import HeroSection from '@/components/marketing/HeroSection';
import CapabilityStrip from '@/components/marketing/CapabilityStrip';
import MiboFeature from '@/components/marketing/MiboFeature';
import CommunityFeature from '@/components/marketing/CommunityFeature';
import CommunityPreview from '@/components/marketing/CommunityPreview';
import DeliveryFlow from '@/components/marketing/DeliveryFlow';
import { loadMarketingData } from '@/lib/marketing-data';
import styles from '@/components/marketing/marketing.module.css';

export const dynamic = 'force-dynamic';

export default async function MarketingHome() {
  const data = await loadMarketingData();
  return <div className={styles.page}><MarketingHeader /><main id="main-content"><HeroSection /><CapabilityStrip /><MiboFeature /><CommunityFeature /><CommunityPreview state={data.community} /><DeliveryFlow /></main></div>;
}
