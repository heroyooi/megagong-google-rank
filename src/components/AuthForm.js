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
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: nickname });
      }
      router.push('/');
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
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h1>{mode === 'login' ? '로그인' : '회원가입'}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type='email'
          placeholder='이메일'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type='password'
          placeholder='비밀번호'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === 'signup' && (
          <input
            type='text'
            placeholder='닉네임'
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
        )}
        <button type='submit'>{mode === 'login' ? '로그인' : '회원가입'}</button>
      </form>
      <button onClick={handleGoogle} style={{ marginTop: '12px' }}>
        Google로 {mode === 'login' ? '로그인' : '회원가입'}
      </button>
      {error && <p style={{ color: 'red', marginTop: '8px' }}>{error}</p>}
      {mode === 'login' ? (
        <p style={{ marginTop: '8px' }}>
          계정이 없나요? <Link href='/signup'>회원가입</Link>
        </p>
      ) : (
        <p style={{ marginTop: '8px' }}>
          이미 계정이 있나요? <Link href='/login'>로그인</Link>
        </p>
      )}
    </div>
  );
}
