import Link from 'next/link';
import UserMenuGate from '../../../components/UserMenuGate';
import { getTopicBySlug, getMatchedTopicMembers, getTopicTombs } from '../../../lib/topics';
import type { Tomb } from '../../../lib/types';
import { listTombs } from '../../../lib/data';
import { readSegmentParam } from '../../../lib/nextParams';

const levelLabel: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  county: '县级',
  external: '外部/百科'
};

type PageProps = {
  params?: Promise<{ slug?: string | string[] }>;
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

export default async function TopicDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slugValue = readSegmentParam(resolvedParams?.slug);

  if (!slugValue) {
    return (
      <div className="detail-page">
        <div className="detail-page-card">
          <div className="detail-page-header">
            <div>
              <h1>缺少专题参数</h1>
              <div className="detail-page-meta">可用专题：人物合集专题页</div>
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

  const topic = getTopicBySlug(decodeSlug(slugValue));
  if (!topic) {
    return (
      <div className="detail-page">
        <div className="detail-page-card">
          <div className="detail-page-header">
            <div>
              <h1>未找到专题</h1>
              <div className="detail-page-meta">请从首页专题卡片重新进入。</div>
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

  const tombs = await listTombs(
    {
      limit: 50000
    },
    { emptyMode: 'all' }
  );
  const topicItems = getTopicTombs(tombs, topic);

  return (
    <div className="detail-page">
      <div className="detail-page-card">
        <div className="detail-page-header">
          <div>
            <h1>
              {topic.label} · 已收录 {topicItems.length} 处古墓
            </h1>
            <div className="detail-page-meta">{topic.summary}</div>
            <div className="detail-page-meta">{topic.description}</div>
          </div>
          <div className="inline-actions">
            <UserMenuGate />
            <Link className="ghost-button" href="/">
              返回地图
            </Link>
          </div>
        </div>

        <section className="detail-page-section">
          <div className="topic-member-list">
            {topic.members.map((member) => (
              <span key={member.name} className="topic-member-chip">
                {member.name}
              </span>
            ))}
          </div>
        </section>

        {topicItems.length ? (
          <div className="result-list topic-result-list">
            {topicItems.map((tomb) => {
              const matchedMembers = getMatchedTopicMembers(tomb, topic);

              return (
                <Link key={tomb.id} className="result-item topic-result-item" href={`/tombs/${tomb.id}`}>
                  <div className="topic-result-head">
                    <div className="result-title">{tomb.name}</div>
                    {matchedMembers.length ? <div className="topic-match-tag">{matchedMembers.join(' / ')}</div> : null}
                  </div>
                  <div className="result-meta">{buildMeta(tomb)}</div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="footer-note">当前专题暂无匹配的古墓数据。</div>
        )}
      </div>
    </div>
  );
}
