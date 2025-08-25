'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, googleProvider } from '@/firebaseClient';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import styles from './AuthForm.module.scss';

export default function AuthForm({ mode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        // 원하면 로그인 후 이동
        // router.replace('/');
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        if (nickname) {
          await updateProfile(cred.user, { displayName: nickname });
        }
        // 이메일 인증 관련 로직 전부 제거
        // 원하면 가입 후 이동
        // router.replace('/');
      }
    } catch (err) {
      setError(err?.message || '로그인/회원가입 중 오류가 발생했습니다.');
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // 원하면 소셜 로그인 후 이동
      // router.replace('/');
    } catch (err) {
      setError(err?.message || 'Google 로그인 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {mode === 'login' ? '로그인' : '회원가입'}
      </h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          className={styles.input}
          type='email'
          placeholder='이메일'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={styles.input}
          type='password'
          placeholder='비밀번호'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === 'signup' && (
          <input
            className={styles.input}
            type='text'
            placeholder='닉네임'
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        )}
        <button type='submit' className={styles.submitButton}>
          {mode === 'login' ? '로그인' : '회원가입'}
        </button>
      </form>

      <button onClick={handleGoogle} className={styles.googleButton}>
        Google로 {mode === 'login' ? '로그인' : '회원가입'}
      </button>

      {error && <p className={styles.error}>{error}</p>}

      {mode === 'login' ? (
        <p className={styles.switch}>
          계정이 없나요? <Link href='/signup'>회원가입</Link>
        </p>
      ) : (
        <p className={styles.switch}>
          이미 계정이 있나요? <Link href='/login'>로그인</Link>
        </p>
      )}
    </div>
  );
}
