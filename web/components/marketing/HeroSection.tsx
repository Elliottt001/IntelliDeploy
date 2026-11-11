import Image from 'next/image';
import Link from 'next/link';
import { marketingCopy } from './content';
import styles from './marketing.module.css';

export default function HeroSection() {
  const { hero } = marketingCopy;
  return <section className={styles.hero} aria-labelledby="hero-title">
    <div className={styles.heroGlow} aria-hidden="true" />
    <p className={styles.eyebrow}>{hero.eyebrow}</p>
    <h1 id="hero-title" className={styles.heroTitle}>让想法成为<br /><span>真正可用</span>的应用</h1>
    <div className={styles.heroBottom}>
      <p className={styles.heroDescription}>{hero.description}</p>
      <div className={styles.heroActions}><Link className={styles.ctaPrimary} href={hero.primaryHref}>{hero.primaryLabel}<span aria-hidden="true">↗</span></Link><Link className={styles.ctaSecondary} href={hero.secondaryHref}>{hero.secondaryLabel}</Link></div>
    </div>
    <div className={styles.heroCat}><Image src="/marketing/mibo-hero.png" alt="Mibo 创建助手" width={760} height={760} priority /></div>
  </section>;
}
