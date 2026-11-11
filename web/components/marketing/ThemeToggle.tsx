'use client';

import { useEffect, useState } from 'react';
import { applyTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme';
import styles from './marketing.module.css';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'), []);
  const next = theme === 'dark' ? 'light' : 'dark';
  return <button className={styles.iconButton} type="button" aria-label={`切换为${next === 'dark' ? '深色' : '浅色'}模式`} onClick={() => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    setTheme(next);
  }}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span></button>;
}
