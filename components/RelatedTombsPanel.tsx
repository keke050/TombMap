'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Tomb } from '../lib/types';
import { prefetchTombDetail } from '../lib/tombDetailPrefetch';

const levelLabel: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  county: '县级',
  external: '外部/百科'
};

const buildMeta = (tomb: Tomb) => {
  const parts: string[] = [];
  if (tomb.person) parts.push(tomb.person);
  if (tomb.era) parts.push(tomb.era);
  if (tomb.level) parts.push(levelLabel[tomb.level] ?? tomb.level);
  const location = [tomb.province, tomb.city].filter(Boolean).join(' · ');
  if (location) parts.push(location);
  return parts.join(' · ');
};

export default function RelatedTombsPanel({
  items,
  title = '相关推荐',
  currentId,
  onSelect,
  maxItems = 3
}: {
  items: Tomb[];
  title?: string;
  currentId?: string;
  onSelect?: (id: string) => void;
  maxItems?: number;
}) {
  const router = useRouter();
  const visibleItems = items.filter((item) => item.id !== currentId).slice(0, Math.max(1, maxItems));
  if (!visibleItems.length) return null;

  return (
    <section className="detail-page-section">
      <h3>{title}</h3>
      <div className="related-list">
        {visibleItems.map((item) =>
          onSelect ? (
            <button
              key={item.id}
              type="button"
              className={`result-item related-item-button ${item.id === currentId ? 'active' : ''}`}
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => prefetchTombDetail(item.id)}
              onFocus={() => prefetchTombDetail(item.id)}
            >
              <div className="result-title">{item.name}</div>
              <div className="result-meta">{buildMeta(item)}</div>
            </button>
          ) : (
            <Link
              key={item.id}
              className="result-item province-item"
              href={`/tombs/${item.id}`}
              onMouseEnter={() => void router.prefetch(`/tombs/${item.id}`)}
              onFocus={() => void router.prefetch(`/tombs/${item.id}`)}
            >
              <div className="result-title">{item.name}</div>
              <div className="result-meta">{buildMeta(item)}</div>
            </Link>
          )
        )}
      </div>
    </section>
  );
}
