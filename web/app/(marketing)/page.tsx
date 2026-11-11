import MarketingHeader from '@/components/marketing/MarketingHeader';
import HeroSection from '@/components/marketing/HeroSection';
import CapabilityStrip from '@/components/marketing/CapabilityStrip';
import MiboFeature from '@/components/marketing/MiboFeature';
import CommunityFeature from '@/components/marketing/CommunityFeature';
import styles from '@/components/marketing/marketing.module.css';

export default function MarketingHome() {
  return <div className={styles.page}><MarketingHeader /><main id="main-content"><HeroSection /><CapabilityStrip /><MiboFeature /><CommunityFeature /></main></div>;
}
