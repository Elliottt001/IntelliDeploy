import { marketingCopy } from './content';
import styles from './marketing.module.css';

export default function CapabilityStrip() {
  return <section className={styles.capability} aria-label="产品能力">{marketingCopy.capabilities.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{description}</p></article>)}</section>;
}
