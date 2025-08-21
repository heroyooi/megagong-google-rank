'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// ===== Firebase (client) =====
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
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
    return { keyword, rank: data.activeRank ?? 'N/A' };
  } catch {
    return { keyword, rank: '오류 발생' };
  }
}

/** 키워드 배열을 1초 간격으로 순차 fetch + 실패 재시도 */
async function fetchSequentially(
  keywords,
  retryCount = 5,
  onUpdate = () => {}
) {
  let results = {};
  let failed = [];

  // 최초: 로딩 표기
  for (const kw of keywords) {
    onUpdate(kw, 'loading'); // UI에서 "데이터 로드 중..." 같은 표기
  }

  for (const kw of keywords) {
    const r = await fetchRank(kw);
    results[r.keyword] = r.rank;
    onUpdate(r.keyword, r.rank);
    if (r.rank === '오류 발생') failed.push(r.keyword);
    await delay(1000); // 서버 부하 방지
  }

  // 재시도 루프
  while (failed.length > 0 && retryCount > 0) {
    const retryTargets = [...failed];
    failed = [];
    for (const kw of retryTargets) {
      onUpdate(kw, 'loading');
      const r = await fetchRank(kw);
      results[r.keyword] = r.rank;
      onUpdate(r.keyword, r.rank);
      if (r.rank === '오류 발생') failed.push(r.keyword);
      await delay(1000);
    }
    retryCount -= 1;
  }

  return results;
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
  const [isGongDone, setIsGongDone] = useState(false);
  const [isSobangDone, setIsSobangDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const allSeoData = useSeoDataRealtime();

  // 초기 리스트 표시용
  useEffect(() => {
    const initG = {};
    gongKeywords.forEach((k) => (initG[k] = null));
    setGongState(initG);
    const initS = {};
    sobangKeywords.forEach((k) => (initS[k] = null));
    setSobangState(initS);
  }, []);

  const handleFetchGong = async () => {
    setIsGongDone(false);
    setMsg(null);
    const next = { ...gongState };
    const result = await fetchSequentially(gongKeywords, 5, (kw, val) => {
      next[kw] = val;
      setGongState({ ...next });
    });
    // 결과 반영
    setGongState((prev) => ({ ...prev, ...result }));
    setIsGongDone(true);
    setMsg('공무원 키워드 순위 가져오기가 완료되었습니다.');
  };

  const handleFetchSobang = async () => {
    setIsSobangDone(false);
    setMsg(null);
    const next = { ...sobangState };
    const result = await fetchSequentially(sobangKeywords, 5, (kw, val) => {
      next[kw] = val;
      setSobangState({ ...next });
    });
    setSobangState((prev) => ({ ...prev, ...result }));
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
      const rankings = {
        gong: gongState,
        sobang: sobangState,
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
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>구글 검색 순위 비교(SEO)</h1>
      <p style={{ color: '#666', marginTop: 0 }}>금요일만 저장 가능합니다.</p>

      {/* 크롤링 영역 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        {/* 공무원 */}
        <div
          style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0 }}>
              공무원 핵심 키워드({gongKeywords.length})
            </h3>
            <button onClick={handleFetchGong}>순위 가져오기</button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            {gongKeywords.map((kw, idx) => (
              <li
                key={kw}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr 100px',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid #f5f5f5',
                }}
              >
                <span>{idx + 1}</span>
                <span>{kw}</span>
                <span style={{ textAlign: 'right' }}>
                  {gongState[kw] === 'loading'
                    ? '데이터 로드 중...'
                    : gongState[kw] === null
                    ? '집계전'
                    : rankText(gongState[kw])}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 소방 */}
        <div
          style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0 }}>
              소방 핵심 키워드({sobangKeywords.length})
            </h3>
            <button onClick={handleFetchSobang}>순위 가져오기</button>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            {sobangKeywords.map((kw, idx) => (
              <li
                key={kw}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr 100px',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid #f5f5f5',
                }}
              >
                <span>{idx + 1}</span>
                <span>{kw}</span>
                <span style={{ textAlign: 'right' }}>
                  {sobangState[kw] === 'loading'
                    ? '데이터 로드 중...'
                    : sobangState[kw] === null
                    ? '집계전'
                    : rankText(sobangState[kw])}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 입력/저장 영역 */}
      <div
        style={{
          border: '1px solid #e5e5e5',
          borderRadius: 8,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr',
            alignItems: 'center',
          }}
        >
          <label htmlFor='seo_date'>날짜(금요일)</label>
          <input
            id='seo_date'
            type='date'
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: 8,
              border: '1px solid #ddd',
              borderRadius: 6,
              maxWidth: 220,
            }}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr',
            alignItems: 'start',
          }}
        >
          <label htmlFor='seo_note' style={{ marginTop: 6 }}>
            비고
          </label>
          <textarea
            id='seo_note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder='비고를 입력하세요'
            style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              padding: '8px 16px',
              cursor: canSave && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? '저장 중...' : '검색 순위 저장'}
          </button>
        </div>

        {msg && <p style={{ margin: 0, color: '#444' }}>{msg}</p>}
        {!isFriday(date) && (
          <p style={{ color: '#d00', margin: 0 }}>
            ※ 금요일만 저장할 수 있습니다.
          </p>
        )}
      </div>

      {/* 저장된 데이터 테이블 */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>SEO 순위 데이터</h3>
        {Object.keys(allSeoData).length === 0 ? (
          <p>저장된 데이터가 없습니다.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {Object.entries(allSeoData).map(([d, details]) => {
              const gong = details?.rankings?.gong ?? {};
              const sobang = details?.rankings?.sobang ?? {};
              return (
                <div
                  key={d}
                  style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: 8,
                    padding: 16,
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  <p style={{ fontWeight: 600, margin: 0 }}>{d}</p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                    }}
                  >
                    {/* 공무원 테이블 */}
                    <div>
                      <h4 style={{ margin: '4px 0' }}>공무원</h4>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          border: '1px solid #333',
                        }}
                      >
                        <thead>
                          <tr>
                            <th
                              style={{
                                textAlign: 'left',
                                padding: 8,
                                borderBottom: '1px solid #333',
                              }}
                            >
                              핵심키워드
                            </th>
                            <th
                              style={{
                                textAlign: 'right',
                                padding: 8,
                                borderBottom: '1px solid #333',
                              }}
                            >
                              순위
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(gong).map(([kw, r]) => (
                            <tr key={kw}>
                              <td
                                style={{
                                  padding: 8,
                                  borderBottom: '1px solid #444',
                                }}
                              >
                                {kw}
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  textAlign: 'right',
                                  borderBottom: '1px solid #444',
                                }}
                              >
                                {r === 'loading'
                                  ? '로딩'
                                  : r === null
                                  ? '집계전'
                                  : r}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 소방 테이블 */}
                    <div>
                      <h4 style={{ margin: '4px 0' }}>소방</h4>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          border: '1px solid #333',
                        }}
                      >
                        <thead>
                          <tr>
                            <th
                              style={{
                                textAlign: 'left',
                                padding: 8,
                                borderBottom: '1px solid #333',
                              }}
                            >
                              핵심키워드
                            </th>
                            <th
                              style={{
                                textAlign: 'right',
                                padding: 8,
                                borderBottom: '1px solid #333',
                              }}
                            >
                              순위
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(sobang).map(([kw, r]) => (
                            <tr key={kw}>
                              <td
                                style={{
                                  padding: 8,
                                  borderBottom: '1px solid #444',
                                }}
                              >
                                {kw}
                              </td>
                              <td
                                style={{
                                  padding: 8,
                                  textAlign: 'right',
                                  borderBottom: '1px solid #444',
                                }}
                              >
                                {r === 'loading'
                                  ? '로딩'
                                  : r === null
                                  ? '집계전'
                                  : r}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <strong>비고</strong>
                    <div style={{ marginTop: 6 }}>
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
