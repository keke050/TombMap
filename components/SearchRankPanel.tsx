'use client';

import { useEffect, useMemo, useState } from 'react';

type RankItem = {
  id: string;
  name: string;
  person?: string | null;
  era?: string | null;
  level?: string | null;
  province?: string | null;
  city?: string | null;
  county?: string | null;
  count: number;
};

const levelLabel: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  county: '县级',
  external: '外部/百科'
};

export default function SearchRankPanel({
  onSelect,
  refreshToken,
  limit = 12
}: {
  onSelect: (id: string) => void;
  refreshToken?: number;
  limit?: number;
}) {
  const [items, setItems] = useState<RankItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotate, setRotate] = useState(0);

  const effectiveLimit = useMemo(() => Math.max(1, Math.min(50, Math.floor(limit))), [limit]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/rank/search?limit=${effectiveLimit}`, { method: 'GET' }).catch(() => null);
      if (cancelled) return;
      if (!response?.ok) {
        setError('排行加载失败');
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (cancelled) return;
      setItems(Array.isArray(data?.tombs) ? data.tombs : []);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [effectiveLimit, refreshToken, rotate]);

  return (
    <section className="panel rank-panel" aria-label="搜索排行">
      <div className="rank-panel-header">
        <h3>搜索排行</h3>
        <button type="button" className="ghost-button" onClick={() => setRotate((prev) => prev + 1)} title="刷新排行">
          刷新
        </button>
      </div>

      {loading && <div className="footer-note">排行加载中…</div>}
      {!loading && error && <div className="footer-note">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="footer-note">暂无排行数据（从你开始搜索会逐步累计）。</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="rank-list">
          {items.map((item, index) => {
            const location = [item.province, item.city].filter(Boolean).join(' · ');
            const levelText = item.level ? (levelLabel[item.level] ?? item.level) : '';
            return (
              <button
                key={item.id}
                type="button"
                className="result-item rank-item"
                onClick={() => onSelect(item.id)}
                title="点击查看详情"
              >
                <div className="rank-row">
                  <div className="rank-index">{index + 1}</div>
                  <div className="rank-main">
                    <div className="rank-titleRow">
                      <div className="result-title">{item.name}</div>
                      <div className="rank-count">{item.count}</div>
                    </div>
                    <div className="result-meta">
                      {[item.era, levelText, location].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
