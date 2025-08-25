'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import useKeywordPermission from '@/hooks/useKeywordPermission';
import styles from '@/styles/header.module.scss';

export default function Header() {
  const [theme, setTheme] = useState('light');
  const { user, unverifiedEmail, logout } = useAuth();
  const hasPermission = useKeywordPermission();
  const router = useRouter();

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

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login');
      router.refresh();
    } catch (err) {
      console.error('Failed to sign out', err);
      alert('로그아웃에 실패했습니다.');
    }
  };

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  return (
    <header>
      <div className={styles.header_inner}>
        <Link href='/'>
          {theme === 'light' ? (
            <img src='/images/logo_blk.png' alt='Nextstudy logo' />
          ) : (
            <img src='/images/logo.png' alt='Nextstudy logo' />
          )}
        </Link>

        <div className={styles.controls}>
          {/* 미인증 안내 (로그인/회원가입 페이지에서만 노출되도록 하고 싶으면 조건에 pathname 체크 추가) */}
          {!user && unverifiedEmail && (
            <span className={styles.notice}>
              {unverifiedEmail} 이메일로 인증 대기 중입니다. 메일의 링크를 눌러
              인증을 완료해주세요.
            </span>
          )}

          {user ? (
            <>
              <span className={styles.welcome}>
                {user.email}
                {user.displayName ? `(${user.displayName})` : ''}님 반갑습니다.
              </span>
              {user.email === adminEmail && (
                <Link href='/admin' className={styles.managerLink}>
                  권한 설정
                </Link>
              )}
              {hasPermission && (
                <Link href='/keywords' className={styles.managerLink}>
                  키워드 관리자
                </Link>
              )}
              <button onClick={handleLogout} className={styles.logout}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href='/login' className={styles.managerLink}>
                로그인
              </Link>
              <Link href='/signup' className={styles.managerLink}>
                회원가입
              </Link>
            </>
          )}

          <button onClick={toggleTheme} aria-label='Toggle theme'>
            {theme === 'light' ? (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' />
              </svg>
            ) : (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <circle cx='12' cy='12' r='5' />
                <path d='M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
