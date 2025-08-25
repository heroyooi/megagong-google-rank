'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);

  return <AuthForm mode='signup' />;
}
