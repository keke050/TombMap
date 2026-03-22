import Link from 'next/link';
import type { Tomb } from '../../../lib/types';
import { listTombs } from '../../../lib/data';
import { readSegmentParam } from '../../../lib/nextParams';
import UserMenuGate from '../../../components/UserMenuGate';
import {
  CATEGORY_GROUPS,
  dedupeCategoryTombs,
  getCategoryBySlug,
  matchesCategory,
  matchesSearch,
  sortTombsByLevel
} from '../../../lib/categories';

const levelLabel: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  county: '县级',
  external: '外部/百科'
};

type PageProps = {
  params?: Promise<{ slug?: string | string[] }>;
  searchParams?: Promise<{ q?: string }>;
};

const decodeSlug = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const buildMeta = (tomb: Tomb) => {
  const parts: string[] = [];
  if (tomb.level) parts.push(levelLabel[tomb.level] ?? tomb.level);
  if (tomb.person) parts.push(tomb.person);
  if (tomb.era) parts.push(tomb.era);
  const location = [tomb.province, tomb.city, tomb.county].filter(Boolean).join(' · ');
  if (location) parts.push(location);
  if (tomb.lat == null || tomb.lng == null) parts.push('坐标待补');
  return parts.filter(Boolean).join(' · ');
};

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const slugValue = readSegmentParam(resolvedParams?.slug);
  if (!slugValue) {
    return (
      <div className="detail-page">
        <div className="detail-page-card">
          <div className="detail-page-header">
            <div>
              <h1>缺少分类参数</h1>
              <div className="detail-page-meta">可用分类：{CATEGORY_GROUPS.map((item) => item.label).join('、')}</div>
            </div>
            <div className="inline-actions">
              <UserMenuGate />
              <Link className="ghost-button" href="/">
                返回地图
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const slug = decodeSlug(slugValue);
  const category = getCategoryBySlug(slug);
  if (!category) {
    return (
      <div className="detail-page">
        <div className="detail-page-card">
          <div className="detail-page-header">
            <div>
              <h1>未找到分类</h1>
              <div className="detail-page-meta">可用分类：{CATEGORY_GROUPS.map((item) => item.label).join('、')}</div>
            </div>
            <div className="inline-actions">
              <UserMenuGate />
              <Link className="ghost-button" href="/">
                返回地图
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const query = (resolvedSearchParams?.q ?? '').trim();
  const tombs = await listTombs(
    {
      limit: 50000
    },
    { emptyMode: 'all' }
  );

  const categoryItems = dedupeCategoryTombs(tombs.filter((tomb) => matchesCategory(tomb, category.slug)));
  const searched = query ? categoryItems.filter((tomb) => matchesSearch(tomb, query)) : categoryItems;
  const sorted = sortTombsByLevel(searched);

  return (
    <div className="detail-page">
      <div className="detail-page-card">
        <div className="detail-page-header">
          <div>
            <h1>
              {category.label} · 已收录 {categoryItems.length} 处古墓
            </h1>
            <div className="detail-page-meta">{category.summary}</div>
            <div className="detail-page-meta">
              {category.feature}
              {category.featureHighlight && <strong>{category.featureHighlight}</strong>}
            </div>
            {query && (
              <div className="detail-page-meta">
                已匹配 {sorted.length} / {categoryItems.length}
              </div>
            )}
          </div>
          <div className="inline-actions">
            <UserMenuGate />
            <Link className="ghost-button" href="/">
              返回地图
            </Link>
          </div>
        </div>

        <form className="category-search" action="">
          <input
            name="q"
            defaultValue={query}
            placeholder="搜索人物、墓名、地点、年代等关键字"
            aria-label="分类内搜索"
          />
          <button className="primary-button" type="submit">
            搜索
          </button>
        </form>

        {sorted.length === 0 && <div className="footer-note">暂无匹配的古墓数据。</div>}

        {sorted.length > 0 && (
          <div className="province-list">
            {sorted.map((tomb) => (
              <Link key={tomb.id} className="result-item province-item" href={`/tombs/${tomb.id}`}>
                <div className="result-title">{tomb.name}</div>
                <div className="result-meta">{buildMeta(tomb)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
