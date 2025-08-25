'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseClient';
import AuthForm from '@/components/AuthForm';

export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/');
    });
    return () => unsub();
  }, [router]);

  return <AuthForm mode='signup' />;
}
