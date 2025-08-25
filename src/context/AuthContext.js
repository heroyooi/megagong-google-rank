'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { auth } from '@/firebaseClient';

const AuthContext = createContext({ user: null, unverifiedEmail: null, logout: async () => {} });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setUnverifiedEmail(null);
        return;
      }
      try {
        await u.reload();
      } catch {}
      if (u.emailVerified) {
        setUser(u);
        setUnverifiedEmail(null);
      } else {
        setUser(null);
        setUnverifiedEmail(u.email);
      }
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUnverifiedEmail(null);
  };

  return (
    <AuthContext.Provider value={{ user, unverifiedEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
