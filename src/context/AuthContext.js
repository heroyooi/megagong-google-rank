'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { auth } from '@/firebaseClient';

const AuthContext = createContext({ user: null, logout: async () => {} });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (u) => {
      // 이메일 인증 여부와 무관하게 그대로 user에 세팅
      setUser(u ?? null);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
