'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { useAuth } from '@/context/AuthContext';

export default function useKeywordPermission() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    if (!user) {
      setAllowed(false);
      return;
    }
    const ref = doc(db, 'permissions', 'keywordManagers');
    const unsub = onSnapshot(ref, (snap) => {
      const uids = snap.data()?.uids || [];
      setAllowed(uids.includes(user.uid));
    });
    return () => unsub();
  }, [user]);

  return allowed;
}
