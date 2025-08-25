'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseClient';
import AuthForm from '@/components/AuthForm';

export default function LoginPage() {
  const router = useRouter();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) router.replace('/');
    });
    return () => unsub();
  }, []);

  return <AuthForm mode='login' />;
}
