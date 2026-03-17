import Link from 'next/link';
import type { Tomb } from '../../../lib/types';
import { listTombs } from '../../../lib/data';
import { readSegmentParam } from '../../../lib/nextParams';
import UserMenuGate from '../../../components/UserMenuGate';

const levelLabel: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  county: '县级',
  external: '外部/百科'
};

type PageProps = {
  params?: Promise<{ name?: string | string[] }>;
};

const decodeName = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const buildMeta = (tomb: Tomb) => {
  const parts: string[] = [];
  if (tomb.person) parts.push(tomb.person);
  if (tomb.level) parts.push(levelLabel[tomb.level] ?? tomb.level);
  const location = [tomb.city, tomb.county].filter(Boolean).join(' · ');
  if (location) parts.push(location);
  if (tomb.lat == null || tomb.lng == null) parts.push('坐标待补');
  return parts.filter(Boolean).join(' · ');
};

export default async function ProvinceDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawName = readSegmentParam(resolvedParams?.name);
  if (!rawName) {
    return (
      <div className="detail-page">
        <div className="detail-page-card">
          <div className="detail-page-header">
            <div>
              <h1>缺少省份参数</h1>
            </div>
            <div className="inline-actions">
              <UserMenuGate />
              <Link className="ghost-button" href="/">返回地图</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const provinceName = decodeName(rawName);
  const tombs =
    provinceName === '未知'
      ? []
      : await listTombs(
          {
            province: provinceName
          },
          { emptyMode: 'all' }
        );

  return (
    <div className="detail-page">
      <div className="detail-page-card">
        <div className="detail-page-header">
          <div>
            <h1>{provinceName} · 已收录 {tombs.length} 处古墓</h1>
          </div>
          <div className="inline-actions">
            <UserMenuGate />
            <Link className="ghost-button" href="/">返回地图</Link>
          </div>
        </div>

        {provinceName === '未知' && (
          <div className="footer-note">暂无省份信息的古墓详情页。</div>
        )}

        {provinceName !== '未知' && tombs.length === 0 && (
          <div className="footer-note">暂无古墓数据。</div>
        )}

        {tombs.length > 0 && (
          <div className="province-list">
            {tombs.map((tomb) => (
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
