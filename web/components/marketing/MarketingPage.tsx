import type { MarketingData } from '@/lib/marketing-data';
import CapabilityStrip from './CapabilityStrip';
import CommunityFeature from './CommunityFeature';
import CommunityPreview from './CommunityPreview';
import DeliveryFlow from './DeliveryFlow';
import HeroSection from './HeroSection';
import MarketingFooter from './MarketingFooter';
import MarketingHeader from './MarketingHeader';
import MiboFeature from './MiboFeature';
import PricingSection from './PricingSection';
import styles from './marketing.module.css';

export default function MarketingPage({ community, pricing }: MarketingData) {
  return <div className={styles.page}><MarketingHeader /><main id="main-content"><HeroSection /><CapabilityStrip /><MiboFeature /><CommunityFeature /><CommunityPreview state={community} /><DeliveryFlow /><PricingSection state={pricing} /></main><MarketingFooter /></div>;
}
