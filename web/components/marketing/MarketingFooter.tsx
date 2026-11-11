import Link from 'next/link';
import styles from './marketing.module.css';

const links = [['开始创建', '/create'], ['应用社区', '/community'], ['我的应用', '/apps'], ['登录', '/login'], ['注册', '/register']] as const;

export default function MarketingFooter() {
  return <footer className={styles.footer}>
    <div className={styles.footerMarquee} aria-hidden="true">INTELLIDEPLOY · BUILD WHAT MATTERS · </div>
    <div className={styles.footerInner}><div><p className={styles.eyebrow}>INTELLIDEPLOY</p><h2>把你的下一步<br />变成可使用的应用。</h2></div><nav aria-label="页脚导航">{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav></div>
    <div className={styles.footerBottom}><span>© 2026 IntelliDeploy</span><span>真实需求 · 可验证交付 · 持续调整</span></div>
  </footer>;
}
