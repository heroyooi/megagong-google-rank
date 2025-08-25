'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { useAuth } from '@/context/AuthContext';

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState('');
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    if (!user) return;
    if (user.email !== adminEmail) router.replace('/');
  }, [user, adminEmail, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchUsers();
    const unsub = onSnapshot(doc(db, 'permissions', 'keywordManagers'), (snap) => {
      setManagers(snap.data()?.uids || []);
    });
    return () => unsub();
  }, []);

  const handleAdd = async () => {
    if (!selected) return;
    await setDoc(
      doc(db, 'permissions', 'keywordManagers'),
      { uids: arrayUnion(selected) },
      { merge: true }
    );
    setSelected('');
  };

  const handleRemove = async (uid) => {
    await setDoc(
      doc(db, 'permissions', 'keywordManagers'),
      { uids: arrayRemove(uid) },
      { merge: true }
    );
  };

  const managerUsers = users.filter((u) => managers.includes(u.id));

  return (
    <div style={{ padding: '2rem' }}>
      <h1>권한 설정</h1>
      <div style={{ marginBottom: '1rem' }}>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{ marginRight: '0.5rem' }}
        >
          <option value=''>회원 선택</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
              {u.displayName ? `(${u.displayName})` : ''}
            </option>
          ))}
        </select>
        <button onClick={handleAdd}>권한 부여</button>
      </div>
      <ul>
        {managerUsers.map((u) => (
          <li key={u.id} style={{ marginBottom: '0.5rem' }}>
            {u.email}
            {u.displayName ? `(${u.displayName})` : ''}
            <button
              style={{ marginLeft: '0.5rem' }}
              onClick={() => handleRemove(u.id)}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
      <Link href='/' style={{ display: 'inline-block', marginTop: '1rem' }}>
        메인으로
      </Link>
    </div>
  );
}

