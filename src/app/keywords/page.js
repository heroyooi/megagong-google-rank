'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import styles from './page.module.scss';

export default function KeywordManager() {
  const [gong, setGong] = useState([]);
  const [sobang, setSobang] = useState([]);
  const [newGong, setNewGong] = useState('');
  const [newGongColor, setNewGongColor] = useState('#000000');
  const [newSobang, setNewSobang] = useState('');
  const [newSobangColor, setNewSobangColor] = useState('#000000');
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    if (!db) return;
    const unsubG = onSnapshot(doc(db, 'keywords', 'gong'), (snap) => {
      setGong(snap.data()?.list || []);
    });
    const unsubS = onSnapshot(doc(db, 'keywords', 'sobang'), (snap) => {
      setSobang(snap.data()?.list || []);
    });
    return () => {
      unsubG();
      unsubS();
    };
  }, []);

  const update = async (group, arr) => {
    if (!db) return;
    await setDoc(doc(db, 'keywords', group), { list: arr });
  };

  const add = async (group) => {
    const value = group === 'gong' ? newGong.trim() : newSobang.trim();
    const color = group === 'gong' ? newGongColor : newSobangColor;
    if (!value) return;
    const item = { keyword: value, color };
    const arr = group === 'gong' ? [...gong, item] : [...sobang, item];
    await update(group, arr);
    if (group === 'gong') {
      setNewGong('');
      setNewGongColor('#000000');
    } else {
      setNewSobang('');
      setNewSobangColor('#000000');
    }
  };

  const remove = async (group, index) => {
    const arr = group === 'gong' ? [...gong] : [...sobang];
    arr.splice(index, 1);
    await update(group, arr);
  };

  const changeColor = async (group, index, color) => {
    const arr = group === 'gong' ? [...gong] : [...sobang];
    arr[index] = { ...arr[index], color };
    if (group === 'gong') setGong(arr);
    else setSobang(arr);
    await update(group, arr);
  };

  const onDragStart = (group, index) => {
    setDrag({ group, index });
  };

  const onDrop = async (group, index) => {
    if (!drag || drag.group !== group) return setDrag(null);
    const arr = group === 'gong' ? [...gong] : [...sobang];
    const [moved] = arr.splice(drag.index, 1);
    arr.splice(index, 0, moved);
    setDrag(null);
    await update(group, arr);
  };

  return (
    <div className={styles.container}>
      <h1>키워드 관리자</h1>
      <div className={styles.group}>
        <h2 className={styles.groupTitle}>공무원</h2>
        <ul className={styles.list}>
          {gong.map((kw, idx) => (
            <li
              key={kw.keyword}
              className={styles.item}
              draggable
              onDragStart={() => onDragStart('gong', idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop('gong', idx)}
            >
              <div className={styles.keyword}>
                <input
                  type='color'
                  className={styles.colorInput}
                  value={kw.color || '#000000'}
                  onChange={(e) => changeColor('gong', idx, e.target.value)}
                />
                <span>{kw.keyword}</span>
              </div>
              <button
                className={styles.button}
                onClick={() => remove('gong', idx)}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.controls}>
          <input
            type='color'
            className={styles.colorInput}
            value={newGongColor}
            onChange={(e) => setNewGongColor(e.target.value)}
          />
          <input
            type='text'
            value={newGong}
            onChange={(e) => setNewGong(e.target.value)}
            placeholder='키워드 추가'
          />
          <button className={styles.button} onClick={() => add('gong')}>
            추가
          </button>
        </div>
      </div>
      <div className={styles.group}>
        <h2 className={styles.groupTitle}>소방</h2>
        <ul className={styles.list}>
          {sobang.map((kw, idx) => (
            <li
              key={kw.keyword}
              className={styles.item}
              draggable
              onDragStart={() => onDragStart('sobang', idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop('sobang', idx)}
            >
              <div className={styles.keyword}>
                <input
                  type='color'
                  className={styles.colorInput}
                  value={kw.color || '#000000'}
                  onChange={(e) => changeColor('sobang', idx, e.target.value)}
                />
                <span>{kw.keyword}</span>
              </div>
              <button
                className={styles.button}
                onClick={() => remove('sobang', idx)}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.controls}>
          <input
            type='color'
            className={styles.colorInput}
            value={newSobangColor}
            onChange={(e) => setNewSobangColor(e.target.value)}
          />
          <input
            type='text'
            value={newSobang}
            onChange={(e) => setNewSobang(e.target.value)}
            placeholder='키워드 추가'
          />
          <button className={styles.button} onClick={() => add('sobang')}>
            추가
          </button>
        </div>
      </div>
      <Link href='/' className={`${styles.button} ${styles.backButton}`}>
        메인으로
      </Link>
    </div>
  );
}

