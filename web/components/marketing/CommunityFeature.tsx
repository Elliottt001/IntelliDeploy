import Image from 'next/image';
import Link from 'next/link';
import { marketingCopy } from './content';
import styles from './marketing.module.css';

export default function CommunityFeature() {
  const content = marketingCopy.community;
  return <section id="community" className={`${styles.feature} ${styles.communityFeature}`}>
    <div className={styles.storeStage}><Image className={styles.featureScreenshot} src="/marketing/feature-appstore.png" alt="应用社区浏览界面" width={980} height={760} /><div className={styles.orbit} aria-hidden="true" /></div>
    <div className={styles.featureCopy}><p className={styles.eyebrow}>{content.label}</p><h2>{content.title}</h2><p>{content.description}</p><Link href={content.href}>{content.action}<span aria-hidden="true"> →</span></Link></div>
  </section>;
}
