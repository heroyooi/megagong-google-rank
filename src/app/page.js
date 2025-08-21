'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.scss';

// ===== Firebase (client) =====
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

// --- Firebase init (same-file to keep single-file requirement) ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let db = null;
if (typeof window !== 'undefined') {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  db = getFirestore();
}

// ====== Keywords (원본 유지) ======
const gongKeywords = [
  '공무원',
  '공무원시험',
  '공무원인강추천',
  '공무원종류',
  '9급공무원',
  '9급공무원시험',
  '7급공무원',
  '7급공무원시험',
  '공무원국어',
  '9급공무원국어',
  '공무원영어',
  '9급공무원영어',
  '공무원행정법',
  '7급헌법',
];

const sobangKeywords = [
  '소방',
  '소방공무원',
  '소방경채',
  '소방공무원경채',
  '소방가산점',
  '소방관시험',
  '소방직공무원',
  '소방특채',
  '소방공무원시험과목',
  '소방공무원경쟁률',
  '소방공채',
  '소방공무원가산점',
  '소방체력',
  '소방관계법규',
  '소방행정법',
  '응급처치학',
];

// ====== Utils ======
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/** 이번 주 금요일(한국시간 기준) 반환 */
function getFridayOfWeek(base = new Date()) {
  // 브라우저 로컬 시간이 KST이면 그대로 사용
  const date = new Date(base);
  const day = date.getDay(); // 0=Sun ... 5=Fri
  const diff = 5 - day;
  date.setDate(date.getDate() + diff);
  // yyyy-mm-dd 형태로 변환
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** yyyy-mm-dd가 금요일인지 검사 */
function isFriday(yyyyMMdd) {
  const d = new Date(yyyyMMdd);
  return d.getDay() === 5;
}

/** 비고 줄바꿈 처리 */
function renderNote(note) {
  if (!note || !note.trim()) return '없음';
  return note.split('\n').map((line, idx) => (
    <span key={idx}>
      {line}
      <br />
    </span>
  ));
}

/** rank 표시 텍스트 */
function rankText(value) {
  if (value === '오류 발생') return '오류 발생';
  if (value === 'N/A' || value === null || value === undefined)
    return '순위 없음';
  return `${value}위`;
}

// ====== API ======
async function fetchRank(keyword) {
  try {
    const res = await fetch(`/api/rank/${encodeURIComponent(keyword)}`, {
      method: 'GET',
    });
    if (!res.ok) throw new Error('검색 실패');
    const data = await res.json();
    return { keyword, rank: data.activeRank ?? 'N/A', source: data.sourceUrl || '' };
  } catch {
    return { keyword, rank: '오류 발생', source: '' };
  }
}

/** 키워드 배열을 1초 간격으로 순차 fetch + 실패 재시도 */
async function fetchSequentially(
  keywords,
  retryCount = 5,
  onUpdate = () => {}
) {
  let results = {};
  let sources = {};
  let failed = [];

  // 최초: 로딩 표기
  for (const kw of keywords) {
    onUpdate(kw, 'loading', ''); // UI에서 "데이터 로드 중..." 같은 표기
  }

  for (const kw of keywords) {
    const r = await fetchRank(kw);
    results[r.keyword] = r.rank;
    sources[r.keyword] = r.source;
    onUpdate(r.keyword, r.rank, r.source);
    if (r.rank === '오류 발생') failed.push(r.keyword);
    await delay(1000); // 서버 부하 방지
  }

  // 재시도 루프
  while (failed.length > 0 && retryCount > 0) {
    const retryTargets = [...failed];
    failed = [];
    for (const kw of retryTargets) {
      onUpdate(kw, 'loading', '');
      const r = await fetchRank(kw);
      results[r.keyword] = r.rank;
      sources[r.keyword] = r.source;
      onUpdate(r.keyword, r.rank, r.source);
      if (r.rank === '오류 발생') failed.push(r.keyword);
      await delay(1000);
    }
    retryCount -= 1;
  }

  return { ranks: results, sources };
}

/** Firestore: 저장 */
async function logSeoData({ date, note, rankings }) {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  if (!isFriday(date)) throw new Error('금요일만 저장할 수 있습니다.');
  const ref = doc(db, 'seoRanks', date); // 날짜를 문서 ID로
  await setDoc(
    ref,
    {
      date,
      note,
      rankings,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
  return true;
}

/** Firestore: 삭제 */
async function deleteSeoData(date) {
  if (!db) throw new Error('Firebase가 초기화되지 않았습니다.');
  const ref = doc(db, 'seoRanks', date);
  await deleteDoc(ref);
  return true;
}

/** Firestore: 실시간 구독 */
function useSeoDataRealtime() {
  const [data, setData] = useState({});
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'seoRanks'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const obj = {};
      snap.forEach((docSnap) => {
        obj[docSnap.id] = docSnap.data();
      });
      setData(obj);
    });
    return () => unsub && unsub();
  }, []);
  return data;
}

// ====== UI ======
export default function Home() {
  // 입력/상태
  const [date, setDate] = useState(getFridayOfWeek());
  const [note, setNote] = useState('');
  const [gongState, setGongState] = useState({}); // {keyword: rank|'loading'|undefined}
  const [sobangState, setSobangState] = useState({});
  const [gongSource, setGongSource] = useState({});
  const [sobangSource, setSobangSource] = useState({});
  const [isGongDone, setIsGongDone] = useState(false);
  const [isSobangDone, setIsSobangDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const allSeoData = useSeoDataRealtime();

  const handleDelete = async (targetDate) => {
    if (!window.confirm(`${targetDate} 데이터를 삭제하시겠습니까?`)) return;
    try {
      await deleteSeoData(targetDate);
      setMsg('삭제되었습니다.');
    } catch (e) {
      setMsg(`삭제 중 오류: ${e.message}`);
    }
  };

  // 초기 리스트 표시용
  useEffect(() => {
    const initG = {};
    gongKeywords.forEach((k) => (initG[k] = null));
    setGongState(initG);
    const initGs = {};
    gongKeywords.forEach((k) => (initGs[k] = ''));
    setGongSource(initGs);
    const initS = {};
    sobangKeywords.forEach((k) => (initS[k] = null));
    setSobangState(initS);
    const initSs = {};
    sobangKeywords.forEach((k) => (initSs[k] = ''));
    setSobangSource(initSs);
  }, []);

  const handleFetchGong = async () => {
    setIsGongDone(false);
    setMsg(null);
    const nextRank = { ...gongState };
    const nextSrc = { ...gongSource };
    const result = await fetchSequentially(gongKeywords, 5, (kw, val, src) => {
      nextRank[kw] = val;
      nextSrc[kw] = src;
      setGongState({ ...nextRank });
      setGongSource({ ...nextSrc });
    });
    // 결과 반영
    setGongState((prev) => ({ ...prev, ...result.ranks }));
    setGongSource((prev) => ({ ...prev, ...result.sources }));
    setIsGongDone(true);
    setMsg('공무원 키워드 순위 가져오기가 완료되었습니다.');
  };

  const handleFetchSobang = async () => {
    setIsSobangDone(false);
    setMsg(null);
    const nextRank = { ...sobangState };
    const nextSrc = { ...sobangSource };
    const result = await fetchSequentially(sobangKeywords, 5, (kw, val, src) => {
      nextRank[kw] = val;
      nextSrc[kw] = src;
      setSobangState({ ...nextRank });
      setSobangSource({ ...nextSrc });
    });
    setSobangState((prev) => ({ ...prev, ...result.ranks }));
    setSobangSource((prev) => ({ ...prev, ...result.sources }));
    setIsSobangDone(true);
    setMsg('소방 키워드 순위 가져오기가 완료되었습니다.');
  };

  const canSave = useMemo(() => {
    // 두 그룹 모두 완료 + 금요일 + 최소 하나라도 값 있음
    const hasGong = Object.values(gongState).some((v) => v && v !== 'loading');
    const hasSobang = Object.values(sobangState).some(
      (v) => v && v !== 'loading'
    );
    return isGongDone && isSobangDone && isFriday(date) && hasGong && hasSobang;
  }, [isGongDone, isSobangDone, date, gongState, sobangState]);

  const handleSave = async () => {
    if (!canSave) {
      setMsg(
        '공무원/소방 순위를 먼저 모두 가져오고(완료), 금요일 날짜로 선택 후 저장하세요.'
      );
      return;
    }
    try {
      setSaving(true);
      setMsg(null);
      const combine = (keywords, ranks, sources) =>
        Object.fromEntries(
          keywords.map((kw) => [kw, { rank: ranks[kw], source: sources[kw] }])
        );

      const rankings = {
        gong: combine(gongKeywords, gongState, gongSource),
        sobang: combine(sobangKeywords, sobangState, sobangSource),
      };
      await logSeoData({ date, note: note.trim(), rankings });
      setNote('');
      setMsg('저장되었습니다.');
    } catch (e) {
      setMsg(`저장 중 오류: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>구글 검색 순위 비교(SEO)</h1>
      <p className={styles.notice}>금요일만 저장 가능합니다.</p>

      {/* 크롤링 영역 */}
      <div className={styles.keywordGrid}>
        {/* 공무원 */}
        <div className={styles.keywordBox}>
          <div className={styles.keywordHeader}>
            <h3>공무원 핵심 키워드({gongKeywords.length})</h3>
            <button onClick={handleFetchGong}>순위 가져오기</button>
          </div>
          <ul className={styles.keywordList}>
            {gongKeywords.map((kw, idx) => (
              <li key={kw} className={styles.keywordItem}>
                <span>{idx + 1}</span>
                <span>{kw}</span>
                <span className={styles.keywordRank}>
                  {gongState[kw] === 'loading'
                    ? '로드중'
                    : gongState[kw] === null
                    ? '집계전'
                    : rankText(gongState[kw])}
                  {gongSource[kw] && gongState[kw] !== 'loading' && (
                    <a
                      className={styles.keywordSource}
                      href={gongSource[kw]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {gongSource[kw].replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 소방 */}
        <div className={styles.keywordBox}>
          <div className={styles.keywordHeader}>
            <h3>소방 핵심 키워드({sobangKeywords.length})</h3>
            <button onClick={handleFetchSobang}>순위 가져오기</button>
          </div>
          <ul className={styles.keywordList}>
            {sobangKeywords.map((kw, idx) => (
              <li key={kw} className={styles.keywordItem}>
                <span>{idx + 1}</span>
                <span>{kw}</span>
                <span className={styles.keywordRank}>
                  {sobangState[kw] === 'loading'
                    ? '로드중'
                    : sobangState[kw] === null
                    ? '집계전'
                    : rankText(sobangState[kw])}
                  {sobangSource[kw] && sobangState[kw] !== 'loading' && (
                    <a
                      className={styles.keywordSource}
                      href={sobangSource[kw]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {sobangSource[kw].replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 입력/저장 영역 */}
      <div className={styles.form}>
        <div className={styles.formRow}>
          <label htmlFor='seo_date'>날짜(금요일)</label>
          <input
            id='seo_date'
            type='date'
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={styles.input}
          />
        </div>

        <div className={`${styles.formRow} ${styles.formRowAlignStart}`}>
          <label htmlFor='seo_note' className={styles.noteLabel}>
            비고
          </label>
          <textarea
            id='seo_note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder='비고를 입력하세요'
            className={styles.textarea}
          />
        </div>

        <div className={styles.formActions}>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={styles.saveButton}
          >
            {saving ? '저장 중...' : '검색 순위 저장'}
          </button>
        </div>

        {msg && <p className={styles.message}>{msg}</p>}
        {!isFriday(date) && (
          <p className={styles.warning}>※ 금요일만 저장할 수 있습니다.</p>
        )}
      </div>

      {/* 저장된 데이터 테이블 */}
      <div className={styles.savedData}>
        <h3 className={styles.savedTitle}>SEO 순위 데이터</h3>
        {Object.keys(allSeoData).length === 0 ? (
          <p>저장된 데이터가 없습니다.</p>
        ) : (
          <div className={styles.savedGrid}>
            {Object.entries(allSeoData).map(([d, details]) => {
              const gong = details?.rankings?.gong ?? {};
              const sobang = details?.rankings?.sobang ?? {};
              return (
                <div key={d} className={styles.savedCard}>
                  <div className={styles.savedHeader}>
                    <p className={styles.savedDate}>{d}</p>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDelete(d)}
                    >
                      삭제
                    </button>
                  </div>
                  <div className={styles.tablesGrid}>
                    {/* 공무원 테이블 */}
                    <div>
                      <h4 className={styles.tableTitle}>공무원</h4>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>핵심키워드</th>
                            <th>순위</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(gong).map(([kw, r]) => {
                            const value = typeof r === 'object' ? r.rank : r;
                            return (
                              <tr key={kw}>
                                <td>{kw}</td>
                                <td>
                                  {value === 'loading'
                                    ? '로딩'
                                    : value === null
                                    ? '집계전'
                                    : value}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* 소방 테이블 */}
                    <div>
                      <h4 className={styles.tableTitle}>소방</h4>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>핵심키워드</th>
                            <th>순위</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(sobang).map(([kw, r]) => {
                            const value = typeof r === 'object' ? r.rank : r;
                            return (
                              <tr key={kw}>
                                <td>{kw}</td>
                                <td>
                                  {value === 'loading'
                                    ? '로딩'
                                    : value === null
                                    ? '집계전'
                                    : value}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <strong>비고</strong>
                    <div className={styles.note}>
                      {renderNote(details?.note)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
