'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type FeaturedTomb = {
  id: string;
  name: string;
  person?: string | null;
  era?: string | null;
  level?: string | null;
  coverUrl: string;
};

const CACHE_KEY = 'featured_tombs_v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

const buildSubtitle = (tomb: FeaturedTomb) => {
  const parts: string[] = [];
  if (tomb.person) parts.push(String(tomb.person));
  if (tomb.era) parts.push(String(tomb.era));
  return parts.filter(Boolean).join(' · ');
};

const readCache = (): FeaturedTomb[] | null => {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts?: number; tombs?: FeaturedTomb[] };
    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    const list = (parsed.tombs ?? []).filter((item) => Boolean(item?.id && item?.name && item?.coverUrl));
    return list.length ? list : null;
  } catch {
    return null;
  }
};

const writeCache = (tombs: FeaturedTomb[]) => {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), tombs }));
  } catch {
    // ignore
  }
};

export default function FamousTombCarousel() {
  const [items, setItems] = useState<FeaturedTomb[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const timerRef = useRef<number | null>(null);

  const active = items.length ? items[Math.max(0, Math.min(activeIndex, items.length - 1))] : null;
  const subtitle = useMemo(() => (active ? buildSubtitle(active) : ''), [active]);

  const loadFeatured = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/featured?limit=24', { cache: 'force-cache', signal });
      if (!response.ok) return null;
      const data = (await response.json()) as { tombs?: FeaturedTomb[] };
      const list = (data.tombs ?? []).filter((tomb) => Boolean(tomb?.id && tomb?.name && tomb?.coverUrl));
      return list;
    } catch (error) {
      const anyError = error as { name?: unknown };
      if (anyError?.name === 'AbortError') return null;
      return null;
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached?.length) {
      setItems(shuffle(cached));
      setActiveIndex(0);
      setIsLoaded(true);
    }

    const controller = new AbortController();
    (async () => {
      try {
        const fresh = await loadFeatured(controller.signal);
        if (!fresh?.length) return;
        setItems(shuffle(fresh));
        setActiveIndex(0);
        writeCache(fresh);
      } catch (error) {
        const anyError = error as { name?: unknown };
        if (anyError?.name !== 'AbortError') {
          // ignore other errors
        }
      } finally {
        setIsLoaded(true);
      }
    })();

    return () => controller.abort();
  }, [loadFeatured]);

  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (items.length <= 1) return;
    timerRef.current = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 10000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [items.length]);

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const handleShuffle = useCallback(() => {
    setItems((prev) => shuffle(prev));
    setActiveIndex(0);
  }, []);

  const handleImageError = useCallback(() => {
    // Skip broken cover URLs quickly.
    handleNext();
  }, [handleNext]);

  if (!items.length && !isLoaded) {
    return (
      <section className="featured-strip" aria-label="名人古墓随机轮播">
        <div className="featured-strip-header">
          <div>
            <div className="featured-strip-title">名人古墓 · 随机推荐</div>
            <div className="featured-strip-sub">加载中…</div>
          </div>
        </div>
        <div className="featured-card featured-card--loading" />
      </section>
    );
  }

  if (!active) {
    return (
      <section className="featured-strip" aria-label="名人古墓随机轮播">
        <div className="featured-strip-header">
          <div>
            <div className="featured-strip-title">名人古墓 · 随机推荐</div>
            <div className="featured-strip-sub">暂无可轮播的数据</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="featured-strip" aria-label="名人古墓随机轮播">
      <div className="featured-strip-header">
        <div>
          <div className="featured-strip-title">名人古墓 · 随机推荐</div>
          <div className="featured-strip-sub">{subtitle || '点击卡片查看详情'}</div>
        </div>
        <div className="featured-strip-actions">
          <button className="ghost-button" onClick={handleShuffle}>换一批</button>
          <button className="ghost-button" onClick={handleNext}>下一个</button>
        </div>
      </div>

      <Link className="featured-card" href={`/tombs/${active.id}`}>
        <div className="featured-card-image">
          <img src={active.coverUrl} alt={active.name} onError={handleImageError} loading="eager" />
        </div>
        <div className="featured-card-body">
          <div className="featured-card-name">{active.name}</div>
          {subtitle && <div className="featured-card-meta">{subtitle}</div>}
          <div className="featured-card-cta">点击查看详情 →</div>
        </div>
      </Link>
    </section>
  );
}
