import Link from 'next/link';
import AutoImage from '../../../components/AutoImage';
import FavoriteButton from '../../../components/FavoriteButton';
import UserMenuGate from '../../../components/UserMenuGate';
import { buildAmapNavigationUrl } from '../../../lib/amap';
import { fetchRichImages, fetchRichSummary } from '../../../lib/media';
import { buildImageQueries, buildSummaryQueries, inferPersonFromName } from '../../../lib/utils';
import { getTombDetail, recordTombSummary } from '../../../lib/data';
import { readSegmentParam } from '../../../lib/nextParams';

const levelLabel: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  county: '县级',
  external: '外部/百科',
  // Backward/alternate tokens
  country: '国家级',
  province: '省级'
};

export default async function TombDetailPage({ params }: { params?: Promise<{ id?: string | string[] }> }) {
  const resolvedParams = await params;
  const tombId = readSegmentParam(resolvedParams?.id);
  if (!tombId) {
    return (
      <div className="detail-page">
        <div className="detail-page-card">
          <h1>缺少古墓 id</h1>
          <Link href="/">返回地图</Link>
        </div>
      </div>
    );
  }

  const detail = await getTombDetail(tombId);
  if (!detail) {
    return (
      <div className="detail-page">
        <div className="detail-page-card">
          <h1>未找到古墓信息</h1>
          <Link href="/">返回地图</Link>
        </div>
      </div>
    );
  }

  const inferredPerson = detail.person ?? inferPersonFromName(detail.name);
  const summaryQueries = buildSummaryQueries(detail.name, inferredPerson);
  const summaryQuery = summaryQueries[0] || detail.name || inferredPerson || '';
  const summaryFallbacks = summaryQueries.slice(1);
  const imageQueries = buildImageQueries(detail.name, inferredPerson);
  const imageQuery = imageQueries[0] ?? '';
  const imageFallbacks = imageQueries.slice(1);
  const [summary, images] = await Promise.all([
    fetchRichSummary(summaryQuery, summaryFallbacks, {
      name: detail.name,
      person: detail.person,
      aliases: detail.aliases
    }),
    fetchRichImages(imageQuery, imageFallbacks)
  ]);
  recordTombSummary(detail, summary);

  const levelText = detail.level ? (levelLabel[detail.level] ?? detail.level) : '';
  const navUrl =
    detail.lat != null && detail.lng != null
      ? buildAmapNavigationUrl({ lat: detail.lat, lng: detail.lng, name: detail.name, source: '寻迹' })
      : null;

  return (
    <div className="detail-page">
      <div className="detail-page-card">
        <div className="detail-page-header">
          <div>
            <h1>{detail.name}</h1>
            <div className="detail-page-meta">
              {detail.person ? `人物：${detail.person}` : ''}
              {detail.era ? ` · 年代：${detail.era}` : ''}
              {levelText ? ` · 级别：${levelText}` : ''}
            </div>
            <div className="detail-page-meta">
              {detail.address || `${detail.province ?? ''}${detail.city ?? ''}${detail.county ?? ''}`}
            </div>
          </div>
          <div className="inline-actions">
            <UserMenuGate />
            <FavoriteButton tombId={detail.id} />
            {navUrl && (
              <a className="ghost-button" href={navUrl} target="_blank" rel="noreferrer">
                高德导航
              </a>
            )}
            <Link className="ghost-button" href="/">返回地图</Link>
          </div>
        </div>

        <AutoImage images={images} alt={detail.name} className="detail-page-image" />

        {summary?.extract && (
          <section className="detail-page-section">
            <h3>简介</h3>
            <p>{summary.extract}</p>
            {summary.url && (
              <p>
                <a href={summary.url} target="_blank" rel="noreferrer">
                  资料来源：{summary.source} · {summary.title}
                </a>
              </p>
            )}
          </section>
        )}

        <section className="detail-page-section">
          <h3>文保信息</h3>
          <ul>
            <li>级别：{levelText || detail.level}</li>
            <li>类别：{detail.category}</li>
            {detail.era && <li>年代：{detail.era}</li>}
            {detail.province && <li>省份：{detail.province}</li>}
            {detail.city && <li>城市：{detail.city}</li>}
            {detail.county && <li>区县：{detail.county}</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
