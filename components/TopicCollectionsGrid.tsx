import type { CSSProperties } from 'react';
import Link from 'next/link';
import { TOPIC_GROUPS } from '../lib/topics';

export default function TopicCollectionsGrid() {
  return (
    <section className="topic-strip" aria-label="人物专题合集">
      <div className="topic-strip-header">
        <div>
          <div className="topic-strip-title">人物专题 · 名家合集</div>
          <div className="topic-strip-sub">精选专题，按人物群像浏览相关古墓</div>
        </div>
      </div>

      <div className="topic-grid">
        {TOPIC_GROUPS.map((topic) => {
          const preview = topic.members
            .slice(0, 4)
            .map((member) => member.name)
            .join(' · ');
          const style = {
            '--topic-accent': topic.accent,
            '--topic-glow': topic.glow
          } as CSSProperties;

          return (
            <Link key={topic.slug} className="topic-card" href={`/topics/${topic.slug}`} style={style}>
              <div className="topic-card-badge">{topic.badge}</div>
              <div className="topic-card-title">{topic.label}</div>
              <div className="topic-card-desc">{topic.summary}</div>
              <div className="topic-card-members">
                {preview}
                {topic.members.length > 4 ? ` 等 ${topic.members.length} 人` : ''}
              </div>
              <div className="topic-card-cta">进入专题人物古墓列表 →</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
