import Image from 'next/image';
import Link from 'next/link';
import MobileMenu from './MobileMenu';
import ThemeToggle from './ThemeToggle';
import styles from './marketing.module.css';

const links = [
  { href: '#mibo', label: 'Mibo' },
  { href: '#community', label: '应用社区' },
  { href: '#pricing', label: '套餐' },
] as const;

export default function MarketingHeader() {
  return <header className={styles.header}>
    <Link href="/" className={styles.brand} aria-label="IntelliDeploy 首页"><Image src="/marketing/logo.svg" width={48} height={48} alt="" priority /><span>IntelliDeploy</span></Link>
    <nav className={styles.desktopNav} aria-label="首页导航">{links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}</nav>
    <div className={styles.headerActions}><ThemeToggle /><Link href="/login" className={styles.signIn}>登录</Link><Link href="/register" className={styles.primaryNav}>免费注册</Link><MobileMenu /></div>
  </header>;
}
