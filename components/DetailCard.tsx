'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { buildAmapNavigationUrl } from '../lib/amap';
import { buildTombSourceLabel, isHeritageListSource } from '../lib/source';
import type { Tomb, TombDetail } from '../lib/types';
import { getCachedTombDetail, loadTombDetail } from '../lib/tombDetailPrefetch';
import AutoImage from './AutoImage';
import RelatedTombsPanel from './RelatedTombsPanel';

const levelLabel: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  county: '县级',
  external: '外部/百科'
};

const buildInitialDetail = (tomb?: Tomb | null): TombDetail | null => {
  if (!tomb) return null;
  return {
    ...tomb,
    images: tomb.image_urls?.map((url) => ({ url, source: '本地图片' })) ?? [],
    stats: {
      likes: 0,
      checkins: 0,
      comments: 0
    },
    commentList: []
  };
};

export default function DetailCard({
  tombId,
  onClose,
  onSelectTomb,
  initialTomb
}: {
  tombId: string;
  onClose: () => void;
  onSelectTomb?: (id: string) => void;
  initialTomb?: Tomb | null;
}) {
  const [detail, setDetail] = useState<TombDetail | null>(() => getCachedTombDetail(tombId) ?? buildInitialDetail(initialTomb));
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [liking, setLiking] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const loadVersionRef = useRef(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const loadVersion = ++loadVersionRef.current;
    const cached = getCachedTombDetail(tombId);
    setDetail(cached ?? buildInitialDetail(initialTomb));
    setLoading(!cached);
    setEnriching(false);

    const hydrate = async () => {
      const base = cached ?? (await loadTombDetail(tombId));
      if (cancelled || loadVersion !== loadVersionRef.current) return;
      if (base) {
        setDetail(base);
      }
      setLoading(false);

      const current = base ?? getCachedTombDetail(tombId) ?? buildInitialDetail(initialTomb);
      if (!current || current.description || (current.relatedTombs?.length ?? 0) > 0) {
        return;
      }

      setEnriching(true);
      const rich = await loadTombDetail(tombId, { rich: true });
      if (cancelled || loadVersion !== loadVersionRef.current) return;
      if (rich) {
        setDetail((prev) => {
          if (!prev || prev.id !== rich.id) return rich;
          return {
            ...prev,
            description: rich.description ?? prev.description,
            reference: rich.reference ?? prev.reference,
            images: rich.images?.length ? rich.images : prev.images,
            relatedTombs: rich.relatedTombs?.length ? rich.relatedTombs : prev.relatedTombs,
            commentList: rich.commentList?.length ? rich.commentList : prev.commentList
          };
        });
      }
      if (!cancelled && loadVersion === loadVersionRef.current) {
        setEnriching(false);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [initialTomb, tombId]);

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
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        favorited: Boolean(data.favorited)
      };
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

  const handleOpenDetailPage = () => {
    void router.prefetch(`/tombs/${tombId}`);
    router.push(`/tombs/${tombId}`);
  };

  const visibleDetail = detail ?? buildInitialDetail(initialTomb);
  if (!visibleDetail) {
    return (
      <div className="detail-card">
        <div className="detail-title">{loading ? '加载中…' : '暂无信息'}</div>
        <button className="ghost-button" onClick={onClose}>关闭</button>
      </div>
    );
  }

  const isExternal = visibleDetail.level === 'external';
  const sourceLabel = buildTombSourceLabel(visibleDetail);
  const heritageLevelLabel = isHeritageListSource(visibleDetail) ? (levelLabel[visibleDetail.level] ?? visibleDetail.level) : null;

  return (
    <div className="detail-card">
      <div className="detail-header">
        <div className="detail-title">{visibleDetail.name}</div>
        <div className="detail-tags">
          <span className="tag">{levelLabel[visibleDetail.level] ?? visibleDetail.level}</span>
          <span className="tag">{visibleDetail.category}</span>
          {visibleDetail.era && <span className="tag">{visibleDetail.era}</span>}
          {isExternal && <span className="tag">外部来源/临时数据</span>}
        </div>
        {visibleDetail.person && <div className="footer-note">人物：{visibleDetail.person}</div>}
        <div className="footer-note">
          {visibleDetail.address || `${visibleDetail.province ?? ''}${visibleDetail.city ?? ''}${visibleDetail.county ?? ''}`}
        </div>
        {isExternal && <div className="footer-note">外部来源数据未入库，仅供参考。</div>}
        {(visibleDetail.lat == null || visibleDetail.lng == null) && (
          <div className="footer-note">坐标待补，可尝试地图自动定位</div>
        )}
      </div>

      <AutoImage images={visibleDetail.images} alt={visibleDetail.name} className="detail-image" />

      <div className="detail-actions">
        <button className="primary-button" onClick={handleCheckin} disabled={checkingIn}>
          {checkingIn ? '处理中…' : visibleDetail.checkedIn ? '取消打卡' : '打卡'} {visibleDetail.stats.checkins}
        </button>
        <button className="primary-button primary-button--jade" onClick={handleLike} disabled={liking}>
          {liking ? '处理中…' : visibleDetail.liked ? '取消点赞' : '点赞'} {visibleDetail.stats.likes}
        </button>
        <button className="ghost-button" onClick={handleFavorite}>{visibleDetail.favorited ? '已收藏' : '收藏'}</button>
        <button
          className="ghost-button"
          onClick={handleNavigate}
          disabled={visibleDetail.lat == null || visibleDetail.lng == null}
          title={visibleDetail.lat == null || visibleDetail.lng == null ? '坐标缺失，暂无法导航' : '使用高德地图规划路线'}
        >
          导航
        </button>
      </div>

      {visibleDetail.description && (
        <div className="field">
          <label>简介</label>
          <div className="footer-note">{visibleDetail.description}</div>
          {visibleDetail.reference?.url && (
            <div className="footer-note">
              <a href={visibleDetail.reference.url} target="_blank" rel="noreferrer">
                资料来源：{visibleDetail.reference.source} · {visibleDetail.reference.title}
              </a>
            </div>
          )}
        </div>
      )}

      <div className="inline-actions detail-card-actions">
        <button
          className="ghost-button"
          onClick={handleOpenDetailPage}
          onMouseEnter={() => void router.prefetch(`/tombs/${tombId}`)}
          onFocus={() => void router.prefetch(`/tombs/${tombId}`)}
        >
          查看详情
        </button>
        <button className="ghost-button detail-card-close" onClick={onClose}>关闭卡片</button>
      </div>

      <RelatedTombsPanel
        items={visibleDetail.relatedTombs ?? []}
        currentId={visibleDetail.id}
        onSelect={onSelectTomb}
        maxItems={3}
      />
      {visibleDetail.source?.title && (
        <>
          {heritageLevelLabel && <div className="footer-note">文保级别：{heritageLevelLabel}</div>}
          <div className="footer-note">来源：{sourceLabel}</div>
        </>
      )}
      {enriching && !visibleDetail.description && <div className="footer-note">补充资料加载中…</div>}
    </div>
  );
}
