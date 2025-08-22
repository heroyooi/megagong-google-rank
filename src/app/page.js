'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import styles from './page.module.scss';

const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
});

// ===== Firebase (client) =====
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/firebaseClient';

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
  const rank = getRankValue(value);
  if (rank === '오류 발생') return { primary: '오류 발생', detail: '' };
  if (rank === 'N/A' || rank === null || rank === undefined)
    return { primary: '순위 없음', detail: '' };
  const count =
    typeof value === 'object' && value.top10Count > 1 ? value.top10Count : 0;
  return {
    primary: `${rank}위`,
    detail: count ? `10위 내 포함 ${count}건` : '',
  };
}

// ====== API ======
async function fetchRank(keyword) {
  try {
    const res = await fetch(`/api/rank/${encodeURIComponent(keyword)}`, {
      method: 'GET',
    });
    if (!res.ok) throw new Error('검색 실패');
    const data = await res.json();
    return {
      keyword,
      rank: data.activeRank ?? 'N/A',
      source: data.sourceUrl || '',
      top10Count: data.top10Count || 0,
    };
  } catch {
    return { keyword, rank: '오류 발생', source: '', top10Count: 0 };
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
  let counts = {};
  let failed = [];

  // 최초: 로딩 표기
  for (const kw of keywords) {
    onUpdate(kw, 'loading', '', 0); // UI에서 "데이터 로드 중..." 같은 표기
  }

  for (const kw of keywords) {
    const r = await fetchRank(kw);
    results[r.keyword] = r.rank;
    sources[r.keyword] = r.source;
    counts[r.keyword] = r.top10Count;
    onUpdate(r.keyword, r.rank, r.source, r.top10Count);
    if (r.rank === '오류 발생') failed.push(r.keyword);
    await delay(1000); // 서버 부하 방지
  }

  // 재시도 루프
  while (failed.length > 0 && retryCount > 0) {
    const retryTargets = [...failed];
    failed = [];
    for (const kw of retryTargets) {
      onUpdate(kw, 'loading', '', 0);
      const r = await fetchRank(kw);
      results[r.keyword] = r.rank;
      sources[r.keyword] = r.source;
      counts[r.keyword] = r.top10Count;
      onUpdate(r.keyword, r.rank, r.source, r.top10Count);
      if (r.rank === '오류 발생') failed.push(r.keyword);
      await delay(1000);
    }
    retryCount -= 1;
  }

  return { ranks: results, sources, counts };
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

function getRankValue(r) {
  return typeof r === 'object' ? r?.rank : r;
}

function renderChange(curr, prev) {
  const c = getRankValue(curr);
  const p = getRankValue(prev);
  if (
    c === null ||
    p === null ||
    c === undefined ||
    p === undefined ||
    c === 'loading' ||
    p === 'loading' ||
    typeof c !== 'number' ||
    typeof p !== 'number'
  )
    return null;
  const diff = p - c;
  if (diff === 0) return <span className={styles.rankChange}>(-)</span>;
  const symbol = diff > 0 ? '▲' : '▼';
  const cls = diff > 0 ? styles.rankChangeUp : styles.rankChangeDown;
  return (
    <span className={`${styles.rankChange} ${cls}`}>
      ({`${symbol}${Math.abs(diff)}`})
    </span>
  );
}

// ====== UI ======
export default function Home() {
  // 입력/상태
  const [date, setDate] = useState(getFridayOfWeek());
  const [note, setNote] = useState('');
  const [gongKeywords, setGongKeywords] = useState([]);
  const [sobangKeywords, setSobangKeywords] = useState([]);
  const [gongColors, setGongColors] = useState({});
  const [sobangColors, setSobangColors] = useState({});
  const [gongState, setGongState] = useState({}); // {keyword: rank|'loading'|undefined}
  const [sobangState, setSobangState] = useState({});
  const [gongSource, setGongSource] = useState({});
  const [sobangSource, setSobangSource] = useState({});
  const [gongCount, setGongCount] = useState({});
  const [sobangCount, setSobangCount] = useState({});
  const [isGongDone, setIsGongDone] = useState(false);
  const [isSobangDone, setIsSobangDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const allSeoData = useSeoDataRealtime();
  const seoEntries = useMemo(() => Object.entries(allSeoData), [allSeoData]);
  const [chartLimit, setChartLimit] = useState(7);
  const [openCards, setOpenCards] = useState({});
  const [modalKeyword, setModalKeyword] = useState(null);
  const [modalGroup, setModalGroup] = useState(null);

  useEffect(() => {
    if (!db) return;
    const unsubG = onSnapshot(doc(db, 'keywords', 'gong'), (snap) => {
      const list = (snap.data()?.list || []).map((item) =>
        typeof item === 'string'
          ? { keyword: item, color: '#000000' }
          : item,
      );
      setGongKeywords(list.map((item) => item.keyword));
      const colors = {};
      list.forEach((item) => {
        colors[item.keyword] = item.color || '#000000';
      });
      setGongColors(colors);
    });
    const unsubS = onSnapshot(doc(db, 'keywords', 'sobang'), (snap) => {
      const list = (snap.data()?.list || []).map((item) =>
        typeof item === 'string'
          ? { keyword: item, color: '#000000' }
          : item,
      );
      setSobangKeywords(list.map((item) => item.keyword));
      const colors = {};
      list.forEach((item) => {
        colors[item.keyword] = item.color || '#000000';
      });
      setSobangColors(colors);
    });
    return () => {
      unsubG();
      unsubS();
    };
  }, []);

  const { gongChartOptions, sobangChartOptions } = useMemo(() => {
    if (seoEntries.length === 0)
      return { gongChartOptions: null, sobangChartOptions: null };
    const sorted = [...seoEntries].sort((a, b) => a[0].localeCompare(b[0]));
    const limited = sorted.slice(-chartLimit);
    const dates = limited.map(([d]) => d);
    const buildLineOptions = (keywords, group) => {
      let maxRank = 1;
      const rawSeries = keywords.map((kw) => {
        const data = limited.map(([, details]) => {
          const r = details?.rankings?.[group]?.[kw];
          const val = getRankValue(r);
          const num = typeof val === 'number' ? val : null;
          if (num !== null) maxRank = Math.max(maxRank, num);
          return num;
        });
        return { name: kw, type: 'line', data };
      });
      const finalMax = maxRank + 1;
      const series = rawSeries.map((s) => ({
        ...s,
        data: s.data.map((v) => (v == null ? finalMax : v)),
      }));
      const selected = {};
      keywords.forEach((kw, idx) => {
        selected[kw] = idx < 5;
      });
      const colorMap = group === 'gong' ? gongColors : sobangColors;
      const color = keywords.map((kw) => colorMap[kw] || '#000000');
      return {
        tooltip: { trigger: 'axis' },
        legend: { type: 'scroll', selected },
        grid: { left: 40, right: 20, top: 40, bottom: 40 },
        xAxis: { type: 'category', data: dates },
        yAxis: { type: 'value', inverse: true, min: 1, max: finalMax },
        series,
        color,
      };
    };

    return {
      gongChartOptions: buildLineOptions(gongKeywords, 'gong'),
      sobangChartOptions: buildLineOptions(sobangKeywords, 'sobang'),
    };
  }, [seoEntries, chartLimit, gongKeywords, sobangKeywords, gongColors, sobangColors]);

  const modalChartOptions = useMemo(() => {
    if (!modalKeyword || !modalGroup) return null;
    const sorted = [...seoEntries].sort((a, b) => a[0].localeCompare(b[0]));
    const dates = sorted.map(([d]) => d);
    let maxRank = 1;
    const data = sorted.map(([, details]) => {
      const r = details?.rankings?.[modalGroup]?.[modalKeyword];
      const val = getRankValue(r);
      const num = typeof val === 'number' ? val : null;
      if (num !== null) maxRank = Math.max(maxRank, num);
      return num;
    });
    const finalMax = maxRank + 1;
    const seriesData = data.map((v) => (v == null ? finalMax : v));
    const colorMap = modalGroup === 'gong' ? gongColors : sobangColors;
    const color = colorMap[modalKeyword] || '#000000';
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 40, bottom: 40 },
      xAxis: { type: 'category', data: dates },
      yAxis: { type: 'value', inverse: true, min: 1, max: finalMax },
      series: [{ name: modalKeyword, type: 'line', data: seriesData }],
      color: [color],
    };
  }, [modalKeyword, modalGroup, seoEntries, gongKeywords, sobangKeywords, gongColors, sobangColors]);

  const openModal = (kw, group) => {
    setModalKeyword(kw);
    setModalGroup(group);
  };

  const closeModal = () => {
    setModalKeyword(null);
    setModalGroup(null);
  };

  const toggleCard = (d) => {
    setOpenCards((prev) => ({ ...prev, [d]: !prev[d] }));
  };

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
    const initGc = {};
    gongKeywords.forEach((k) => (initGc[k] = 0));
    setGongCount(initGc);
    const initS = {};
    sobangKeywords.forEach((k) => (initS[k] = null));
    setSobangState(initS);
    const initSs = {};
    sobangKeywords.forEach((k) => (initSs[k] = ''));
    setSobangSource(initSs);
    const initSc = {};
    sobangKeywords.forEach((k) => (initSc[k] = 0));
    setSobangCount(initSc);
  }, [gongKeywords, sobangKeywords]);

  useEffect(() => {
    if (seoEntries.length > 0) {
      const latestDate = seoEntries[0][0];
      setOpenCards({ [latestDate]: true });
    }
  }, [seoEntries]);

  const handleFetchGong = async () => {
    setIsGongDone(false);
    setMsg(null);
    const nextRank = { ...gongState };
    const nextSrc = { ...gongSource };
    const nextCount = { ...gongCount };
    const result = await fetchSequentially(
      gongKeywords,
      5,
      (kw, val, src, cnt) => {
        nextRank[kw] = val;
        nextSrc[kw] = src;
        nextCount[kw] = cnt;
        setGongState({ ...nextRank });
        setGongSource({ ...nextSrc });
        setGongCount({ ...nextCount });
      }
    );
    // 결과 반영
    setGongState((prev) => ({ ...prev, ...result.ranks }));
    setGongSource((prev) => ({ ...prev, ...result.sources }));
    setGongCount((prev) => ({ ...prev, ...result.counts }));
    setIsGongDone(true);
    setMsg('공무원 키워드 순위 가져오기가 완료되었습니다.');
  };

  const handleFetchSobang = async () => {
    setIsSobangDone(false);
    setMsg(null);
    const nextRank = { ...sobangState };
    const nextSrc = { ...sobangSource };
    const nextCount = { ...sobangCount };
    const result = await fetchSequentially(
      sobangKeywords,
      5,
      (kw, val, src, cnt) => {
        nextRank[kw] = val;
        nextSrc[kw] = src;
        nextCount[kw] = cnt;
        setSobangState({ ...nextRank });
        setSobangSource({ ...nextSrc });
        setSobangCount({ ...nextCount });
      }
    );
    setSobangState((prev) => ({ ...prev, ...result.ranks }));
    setSobangSource((prev) => ({ ...prev, ...result.sources }));
    setSobangCount((prev) => ({ ...prev, ...result.counts }));
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
      const combine = (keywords, ranks, sources, counts) =>
        Object.fromEntries(
          keywords.map((kw) => {
            const entry = { rank: ranks[kw], source: sources[kw] };
            if (counts[kw] > 1) entry.top10Count = counts[kw];
            return [kw, entry];
          })
        );

      const rankings = {
        gong: combine(gongKeywords, gongState, gongSource, gongCount),
        sobang: combine(sobangKeywords, sobangState, sobangSource, sobangCount),
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
      <h1 className={styles.title}>
        NS <span>(Next SEO Master)</span>
      </h1>
      <h2 className={styles.subTitle}>구글 검색 순위 비교(SEO)</h2>
      <p className={styles.notice}>매주 금요일만 저장 가능합니다.</p>

      {/* 크롤링 영역 */}
      <div className={styles.keywordGrid}>
        {/* 공무원 */}
        <div className={styles.keywordBox}>
          <div className={styles.keywordHeader}>
            <h3>공무원 핵심 키워드({gongKeywords.length})</h3>
            <button onClick={handleFetchGong}>순위 가져오기</button>
          </div>
          <ul className={styles.keywordList}>
            {gongKeywords.map((kw, idx) => {
              const info =
                gongState[kw] === 'loading'
                  ? { primary: '로드중', detail: '' }
                  : gongState[kw] === null
                  ? { primary: '집계전', detail: '' }
                  : rankText({
                      rank: gongState[kw],
                      top10Count: gongCount[kw],
                    });
              return (
                <li key={kw} className={styles.keywordItem}>
                  <span>{idx + 1}</span>
                  <span style={{ color: gongColors[kw] || '#000000' }}>{kw}</span>
                  <span className={styles.keywordRank}>
                    <em>{info.primary}</em>
                    {info.detail && (
                      <span className={styles.keywordDetail}>
                        {info.detail}
                      </span>
                    )}
                    {gongSource[kw] && gongState[kw] !== 'loading' && (
                      <a
                        className={styles.keywordSource}
                        href={gongSource[kw]}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {gongSource[kw].replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 소방 */}
        <div className={styles.keywordBox}>
          <div className={styles.keywordHeader}>
            <h3>소방 핵심 키워드({sobangKeywords.length})</h3>
            <button onClick={handleFetchSobang}>순위 가져오기</button>
          </div>
          <ul className={styles.keywordList}>
            {sobangKeywords.map((kw, idx) => {
              const info =
                sobangState[kw] === 'loading'
                  ? { primary: '로드중', detail: '' }
                  : sobangState[kw] === null
                  ? { primary: '집계전', detail: '' }
                  : rankText({
                      rank: sobangState[kw],
                      top10Count: sobangCount[kw],
                    });
              return (
                <li key={kw} className={styles.keywordItem}>
                  <span>{idx + 1}</span>
                  <span style={{ color: sobangColors[kw] || '#000000' }}>{kw}</span>
                  <span className={styles.keywordRank}>
                    <em>{info.primary}</em>
                    {info.detail && (
                      <span className={styles.keywordDetail}>
                        {info.detail}
                      </span>
                    )}
                    {sobangSource[kw] && sobangState[kw] !== 'loading' && (
                      <a
                        className={styles.keywordSource}
                        href={sobangSource[kw]}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {sobangSource[kw].replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
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
        <h3 className={styles.subTitle}>핵심키워드별 메가공 SEO 순위</h3>
        {seoEntries.length === 0 ? (
          <p>저장된 데이터가 없습니다.</p>
        ) : (
          <>
            {gongChartOptions && sobangChartOptions && (
              <div className={styles.chartSection}>
                <div className={styles.chartControls}>
                  <label>
                    최근
                    <select
                      value={chartLimit}
                      onChange={(e) => setChartLimit(Number(e.target.value))}
                    >
                      {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    건
                  </label>
                </div>
                <div className={styles.chartGroup}>
                  <h5 className={styles.chartTitle}>공무원</h5>
                  <ReactECharts
                    key='gong-line'
                    className={styles.chart}
                    option={gongChartOptions}
                    notMerge
                  />
                </div>
                <div className={styles.chartGroup}>
                  <h5 className={styles.chartTitle}>소방</h5>
                  <ReactECharts
                    key='sobang-line'
                    className={styles.chart}
                    option={sobangChartOptions}
                    notMerge
                  />
                </div>
              </div>
            )}
            <div className={styles.savedGrid}>
              {seoEntries.map(([d, details], idx) => {
                const prevDetails = seoEntries[idx + 1]?.[1] || null;
                const gong = details?.rankings?.gong ?? {};
                const prevGong = prevDetails?.rankings?.gong ?? {};
                const sobang = details?.rankings?.sobang ?? {};
                const prevSobang = prevDetails?.rankings?.sobang ?? {};
                const isOpen = !!openCards[d];
                return (
                  <div key={d} className={styles.savedCard}>
                    <div className={styles.savedHeader}>
                      <p className={styles.savedDate}>{d}</p>
                      <div className={styles.headerButtons}>
                        <button
                          type='button'
                          className={styles.deleteButton}
                          onClick={() => handleDelete(d)}
                        >
                          삭제
                        </button>
                        <button
                          type='button'
                          className={styles.toggleButton}
                          onClick={() => toggleCard(d)}
                        >
                          {isOpen ? '-' : '+'}
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <>
                        <div className={styles.tablesGrid}>
                          {/* 공무원 테이블 */}
                          <div>
                            <h4 className={styles.tableTitle}>공무원</h4>
                            <table className={styles.dataTable}>
                              <colgroup>
                                <col width='45%' />
                                <col width='*' />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th>핵심키워드</th>
                                  <th>순위</th>
                                </tr>
                              </thead>
                              <tbody>
                                {gongKeywords.map((kw) => {
                                  const r = gong[kw];
                                  const value = getRankValue(r);
                                  const src =
                                    typeof r === 'object' && r?.source
                                      ? r.source
                                      : '';
                                  const prevValue = prevGong[kw];
                                  const info =
                                    value === 'loading'
                                      ? { primary: '로딩', detail: '' }
                                      : value === null
                                      ? { primary: '집계전', detail: '' }
                                      : rankText(r);
                                  return (
                                    <tr key={kw}>
                                      <td>
                                        <button
                                          type='button'
                                          className={styles.keywordButton}
                                          onClick={() => openModal(kw, 'gong')}
                                          style={{ color: gongColors[kw] || '#000000' }}
                                        >
                                          {kw}
                                        </button>
                                      </td>
                                      <td>
                                        {prevDetails &&
                                          renderChange(value, prevValue)}
                                        {info.primary}
                                        {info.detail && (
                                          <span
                                            className={styles.tableRankDetail}
                                          >
                                            {info.detail}
                                          </span>
                                        )}
                                        {src && (
                                          <a
                                            className={styles.tableSource}
                                            href={src}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                          >
                                            {src.replace(/^https?:\/\//, '')}
                                          </a>
                                        )}
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
                              <colgroup>
                                <col width='45%' />
                                <col width='*' />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th>핵심키워드</th>
                                  <th>순위</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sobangKeywords.map((kw) => {
                                  const r = sobang[kw];
                                  const value = getRankValue(r);
                                  const src =
                                    typeof r === 'object' && r?.source
                                      ? r.source
                                      : '';
                                  const prevValue = prevSobang[kw];
                                  const info =
                                    value === 'loading'
                                      ? { primary: '로딩', detail: '' }
                                      : value === null
                                      ? { primary: '집계전', detail: '' }
                                      : rankText(r);
                                  return (
                                    <tr key={kw}>
                                      <td>
                                        <button
                                          type='button'
                                          className={styles.keywordButton}
                                          onClick={() => openModal(kw, 'sobang')}
                                          style={{ color: sobangColors[kw] || '#000000' }}
                                        >
                                          {kw}
                                        </button>
                                      </td>
                                      <td>
                                        {prevDetails &&
                                          renderChange(value, prevValue)}
                                        {info.primary}
                                        {info.detail && (
                                          <span
                                            className={styles.tableRankDetail}
                                          >
                                            {info.detail}
                                          </span>
                                        )}
                                        {src && (
                                          <a
                                            className={styles.tableSource}
                                            href={src}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                          >
                                            {src.replace(/^https?:\/\//, '')}
                                          </a>
                                        )}
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
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      {modalKeyword && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className={styles.modalTitle}>{modalKeyword}</h4>
            {modalChartOptions && (
              <ReactECharts
                className={styles.modalChart}
                option={modalChartOptions}
                notMerge
              />
            )}
            <button
              type='button'
              className={styles.modalClose}
              onClick={closeModal}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
