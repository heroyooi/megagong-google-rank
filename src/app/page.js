'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rank, setRank] = useState(null);
  const [error, setError] = useState(null);

  const fetchRank = async () => {
    if (!keyword) return;
    setLoading(true);
    setError(null);
    setRank(null);

    try {
      const res = await fetch(`/api/rank/${encodeURIComponent(keyword)}`);
      if (!res.ok) {
        throw new Error('검색 실패');
      }
      const data = await res.json();
      setRank(data.activeRank);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Google Rank Checker</h1>
        <div className={styles.search}>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="검색어를 입력하세요"
          />
          <button onClick={fetchRank}>검색</button>
        </div>
        {loading && <p>검색 중...</p>}
        {error && <p>오류: {error}</p>}
        {rank !== null && !loading && !error && (
          <p>메가공 순위: {rank}</p>
        )}
      </main>
    </div>
  );
}

