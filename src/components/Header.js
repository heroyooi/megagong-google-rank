'use client';

import { useEffect, useState } from 'react';
import styles from '@/styles/header.module.scss';

export default function Header() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    const initial = stored || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <header>
      <div className={styles.header_inner}>
        {theme === 'light' ? (
          <img src='/images/logo_blk.png' alt='Nextstudy logo' />
        ) : (
          <img src='/images/logo.png' alt='Nextstudy logo' />
        )}
        <button onClick={toggleTheme}>
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>
    </header>
  );
}
