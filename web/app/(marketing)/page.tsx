import Link from 'next/link';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import styles from '@/components/marketing/marketing.module.css';

export default function MarketingHome() {
  return <div className={styles.page}><MarketingHeader /><main id="main-content"><h1>让想法成为真正可用的应用</h1><Link href="/create">开始创建</Link></main></div>;
}
