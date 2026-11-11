import Image from 'next/image';
import Link from 'next/link';
import { marketingCopy } from './content';
import styles from './marketing.module.css';

export default function MiboFeature() {
  const content = marketingCopy.mibo;
  return <section id="mibo" className={`${styles.feature} ${styles.miboFeature}`}>
    <div className={styles.featureCopy}><p className={styles.eyebrow}>{content.label}</p><h2>{content.title}</h2><p>{content.description}</p><Link href={content.href}>{content.action}<span aria-hidden="true"> →</span></Link></div>
    <div className={styles.chatStage}><Image className={styles.featureScreenshot} src="/marketing/feature-chat.png" alt="Mibo 需求对话界面" width={1010} height={760} /><Image className={styles.smallCat} src="/marketing/mibo-small.png" alt="" width={260} height={260} /></div>
  </section>;
}
