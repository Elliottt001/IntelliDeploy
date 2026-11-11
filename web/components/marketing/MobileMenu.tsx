'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './marketing.module.css';

const links = [
  { href: '#mibo', label: 'Mibo' },
  { href: '#community', label: '应用社区' },
  { href: '#pricing', label: '套餐' },
] as const;

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', close);
    };
  }, [open]);
  return <div className={styles.mobileMenuWrap}>
    <button ref={trigger} className={styles.mobileTrigger} aria-expanded={open} aria-label={open ? '关闭导航菜单' : '打开导航菜单'} onClick={() => setOpen((value) => !value)}>菜单</button>
    {open && <nav className={styles.mobileMenu} aria-label="移动导航">
      {links.map((link, index) => <Link ref={index === 0 ? firstLink : undefined} href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
      <Link href="/login">登录</Link><Link href="/register" className={styles.primaryNav}>免费注册</Link>
    </nav>}
  </div>;
}
