'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { buildAmapNavigationUrl } from '../lib/amap';
import { buildTombSourceLabel, isHeritageListSource } from '../lib/source';
import type { TombDetail } from '../lib/types';
import AutoImage from './AutoImage';
import RelatedTombsPanel from './RelatedTombsPanel';

const levelLabel: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  county: '县级',
  external: '外部/百科'
};

export default function DetailCard({
  tombId,
  onClose,
  onSelectTomb
}: {
  tombId: string;
  onClose: () => void;
  onSelectTomb?: (id: string) => void;
}) {
  const [detail, setDetail] = useState<TombDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [liking, setLiking] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const requestIdRef = useRef(0);
  const router = useRouter();

  const load = async (id = tombId) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const response = await fetch(`/api/tombs/${id}`);
    if (response.ok) {
      const data = await response.json();
      if (requestId !== requestIdRef.current) return;
      setDetail(data.tomb);
    }
    if (requestId === requestIdRef.current) {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDetail(null);
    load(tombId);
  }, [tombId]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const res = await fetch(`/api/tombs/${tombId}/like`, { method: 'POST' });
    if (!res.ok || !detail) {
      setLiking(false);
      return;
    }
    const data = await res.json().catch(() => null);
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        liked: Boolean(data?.liked),
        stats: { ...prev.stats, likes: Number(data?.count ?? prev.stats.likes) }
      };
    });
    setLiking(false);
  };

  const handleCheckin = async () => {
    if (checkingIn) return;
    setCheckingIn(true);
    const res = await fetch(`/api/tombs/${tombId}/checkin`, { method: 'POST' });
    if (!res.ok || !detail) {
      setCheckingIn(false);
      return;
    }
    const data = await res.json().catch(() => null);
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checkedIn: Boolean(data?.checkedIn),
        stats: { ...prev.stats, checkins: Number(data?.count ?? prev.stats.checkins) }
      };
    });
    setCheckingIn(false);
  };

  const handleFavorite = async () => {
    const res = await fetch(`/api/tombs/${tombId}/favorite`, { method: 'POST' });
    if (!res.ok || !detail) return;
    const data = await res.json();
    setDetail({
      ...detail,
      favorited: Boolean(data.favorited)
    });
  };

  const handleNavigate = () => {
    if (!detail) return;
    if (detail.lat == null || detail.lng == null) {
      window.alert('坐标缺失，暂无法导航（可尝试地图自动定位/补全坐标）');
      return;
    }
    const url = buildAmapNavigationUrl({
      lat: detail.lat,
      lng: detail.lng,
      name: detail.name,
      source: '寻迹'
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!detail) {
    return (
      <div className="detail-card">
        <div className="detail-title">{loading ? '加载中…' : '暂无信息'}</div>
        <button className="ghost-button" onClick={onClose}>关闭</button>
      </div>
    );
  }

  const isExternal = detail.level === 'external';
  const sourceLabel = buildTombSourceLabel(detail);
  const heritageLevelLabel = isHeritageListSource(detail) ? (levelLabel[detail.level] ?? detail.level) : null;

  return (
    <div className="detail-card">
      <div className="detail-header">
        <div className="detail-title">{detail.name}</div>
        <div className="detail-tags">
          <span className="tag">{levelLabel[detail.level] ?? detail.level}</span>
          <span className="tag">{detail.category}</span>
          {detail.era && <span className="tag">{detail.era}</span>}
          {isExternal && <span className="tag">外部来源/临时数据</span>}
        </div>
        {detail.person && <div className="footer-note">人物：{detail.person}</div>}
        <div className="footer-note">{detail.address || `${detail.province ?? ''}${detail.city ?? ''}${detail.county ?? ''}`}</div>
        {isExternal && <div className="footer-note">外部来源数据未入库，仅供参考。</div>}
        {(detail.lat == null || detail.lng == null) && (
          <div className="footer-note">坐标待补，可尝试地图自动定位</div>
        )}
      </div>

      <AutoImage images={detail.images} alt={detail.name} className="detail-image" />

      <div className="detail-actions">
        <button className="primary-button" onClick={handleCheckin} disabled={checkingIn}>
          {checkingIn ? '处理中…' : detail.checkedIn ? '取消打卡' : '打卡'} {detail.stats.checkins}
        </button>
        <button className="ghost-button" onClick={handleLike} disabled={liking}>
          {liking ? '处理中…' : detail.liked ? '取消点赞' : '点赞'} {detail.stats.likes}
        </button>
        <button className="ghost-button" onClick={handleFavorite}>{detail.favorited ? '已收藏' : '收藏'}</button>
        <button
          className="ghost-button"
          onClick={handleNavigate}
          disabled={detail.lat == null || detail.lng == null}
          title={detail.lat == null || detail.lng == null ? '坐标缺失，暂无法导航' : '使用高德地图规划路线'}
        >
          导航
        </button>
      </div>

      {detail.description && (
        <div className="field">
          <label>简介</label>
          <div className="footer-note">{detail.description}</div>
          {detail.reference?.url && (
            <div className="footer-note">
              <a href={detail.reference.url} target="_blank" rel="noreferrer">
                资料来源：{detail.reference.source} · {detail.reference.title}
              </a>
            </div>
          )}
        </div>
      )}

      <div className="inline-actions detail-card-actions">
        <button className="ghost-button" onClick={() => router.push(`/tombs/${tombId}`)}>查看详情</button>
        <button className="ghost-button detail-card-close" onClick={onClose}>关闭卡片</button>
      </div>

      <RelatedTombsPanel
        items={detail.relatedTombs ?? []}
        currentId={detail.id}
        onSelect={onSelectTomb}
        maxItems={3}
      />
      {detail.source?.title && (
        <>
          {heritageLevelLabel && <div className="footer-note">文保级别：{heritageLevelLabel}</div>}
          <div className="footer-note">来源：{sourceLabel}</div>
        </>
      )}
    </div>
  );
}
