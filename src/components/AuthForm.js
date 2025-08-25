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
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import styles from './AuthForm.module.scss';

export default function AuthForm({ mode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (mode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!cred.user.emailVerified) {
          await signOut(auth);
          setError('이메일 인증 후 로그인 가능합니다.');
          return;
        }
        router.push('/');
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: nickname });
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setMessage('인증 이메일이 전송되었습니다. 메일을 확인해주세요.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{mode === 'login' ? '로그인' : '회원가입'}</h1>
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
            required
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
      {message && <p className={styles.message}>{message}</p>}
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
