import type { components } from '@intellideploy/api-client';
import Link from 'next/link';
import type { LoadState } from '@/lib/marketing-data';
import styles from './marketing.module.css';

type PublicationPage = components['schemas']['PublicationPage'];

export default function CommunityPreview({ state }: { state: LoadState<PublicationPage> }) {
  return <section className={styles.communityPreview} aria-labelledby="community-title">
    <div className={styles.sectionHeading}><p className={styles.eyebrow}>PUBLIC APPS / LIVE DATA</p><h2 id="community-title">从社区开始，继续做成自己的应用</h2></div>
    {state.status === 'error' ? <div className={styles.stateCard}><p role="status">社区内容暂时无法加载。</p><Link href="/community">前往应用社区</Link></div>
      : state.data.items.length === 0 ? <div className={styles.stateCard}><p>社区暂时还没有公开应用。</p><Link href="/community">查看应用社区</Link></div>
        : <ul className={styles.publicationGrid}>{state.data.items.slice(0, 3).map((publication, index) => <li key={publication.id}>
          <span className={styles.cardIndex}>0{index + 1}</span>
          <h3><Link href={`/community/${publication.id}`}>{publication.name}</Link></h3>
          <p>{publication.summary}</p><span className={styles.statusDot}>{publication.available ? '正在运行' : '暂不可用'}</span>
        </li>)}</ul>}
  </section>;
}
