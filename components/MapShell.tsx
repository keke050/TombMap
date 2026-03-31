'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_LINKS } from '../lib/categories';
import { hasPreciseCoords } from '../lib/utils';
import type { Tomb } from '../lib/types';
import CommentsPanel from './CommentsPanel';
import DetailCard from './DetailCard';
import FamousTombCarousel from './FamousTombCarousel';
import HotSearchPanel from './HotSearchPanel';
import MobileProfilePanel from './MobileProfilePanel';
import OfficialHeritageLinks from './OfficialHeritageLinks';
import SearchRankPanel from './SearchRankPanel';
import TopicCollectionsGrid from './TopicCollectionsGrid';
import UserMenuGate from './UserMenuGate';
import { prefetchTombDetail } from '../lib/tombDetailPrefetch';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

type StatsSummary = {
  total: number;
  byProvince: [string, number][];
};

type MarkerPoint = {
  id?: string;
  lat: number;
  lng: number;
  name?: string;
  count?: number;
};

type SearchPatch = Partial<{
  keyword: string;
  person: string;
  era: string;
  province: string;
  city: string;
  county: string;
  level: string;
  nearby: { lat: number; lng: number } | null;
  radius: number;
}>;

const buildStats = (items: Tomb[]): StatsSummary => {
  const counts = new Map<string, number>();
  items.forEach((tomb) => {
    const name = tomb.province ?? '未知';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  const byProvince = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return { total: items.length, byProvince };
};

const levelOptions = [
  { label: '全部', value: '' },
  { label: '国家级', value: 'national' },
  { label: '省级', value: 'provincial' },
  { label: '市级', value: 'city' },
  { label: '县级', value: 'county' },
  { label: '外部/百科', value: 'external' }
];

const levelLabel: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  city: '市级',
  county: '县级',
  external: '外部/百科'
};

const dynastyOptions = [
  '先秦',
  '春秋',
  '战国',
  '秦',
  '西汉',
  '东汉',
  '汉',
  '三国',
  '魏晋',
  '南北朝',
  '隋',
  '唐',
  '五代',
  '北宋',
  '南宋',
  '宋',
  '辽',
  '金',
  '元',
  '明',
  '清',
  '民国'
];

const normalizeAdminToken = (value: string) => value.trim().replace(/\*+$/g, '');

const isPrefectureLike = (value: string) => /(市|地区|自治州|盟)$/.test(value);

const buildPrefectureLabel = (tomb: Tomb) => {
  const province = normalizeAdminToken(tomb.province ?? '');
  const cityRaw = normalizeAdminToken(tomb.city ?? '');
  const city = cityRaw && cityRaw !== province && isPrefectureLike(cityRaw) ? cityRaw : '';
  if (province && city) return `${province}${city}`;
  return province || city || '';
};

const provinceOptions = [
  '北京市',
  '天津市',
  '上海市',
  '重庆市',
  '河北省',
  '山西省',
  '辽宁省',
  '吉林省',
  '黑龙江省',
  '江苏省',
  '浙江省',
  '安徽省',
  '福建省',
  '江西省',
  '山东省',
  '河南省',
  '湖北省',
  '湖南省',
  '广东省',
  '海南省',
  '四川省',
  '贵州省',
  '云南省',
  '陕西省',
  '甘肃省',
  '青海省',
  '台湾省',
  '内蒙古自治区',
  '广西壮族自治区',
  '西藏自治区',
  '宁夏回族自治区',
  '新疆维吾尔自治区',
  '香港特别行政区',
  '澳门特别行政区'
];

export default function MapShell() {
  const [viewportTombs, setViewportTombs] = useState<MarkerPoint[]>([]);
  const [tombs, setTombs] = useState<Tomb[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusSelected, setFocusSelected] = useState(false);
  const [resultProvinceFilter, setResultProvinceFilter] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [person, setPerson] = useState('');
  const [era, setEra] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [level, setLevel] = useState('');
  const [onlyWithCoords, setOnlyWithCoords] = useState(false);
  const [includeExternal, setIncludeExternal] = useState(false);
  const [nearby, setNearby] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(20000);
  const [status, setStatus] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [overallStats, setOverallStats] = useState<StatsSummary | null>(null);
  const [isOverallStatsLoading, setIsOverallStatsLoading] = useState(false);
  const [isProvinceStatsExpanded, setIsProvinceStatsExpanded] = useState(true);
  const [nearbyTombs, setNearbyTombs] = useState<Tomb[]>([]);
  const [isViewportLoading, setIsViewportLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [rankRefreshToken, setRankRefreshToken] = useState(0);
  const [activeMobileTab, setActiveMobileTab] = useState<'map' | 'discover' | 'profile'>('map');
  const [userRefreshKey, setUserRefreshKey] = useState(0);
  const lastNearbyKeyRef = useRef<string | null>(null);
  const lastViewportKeyRef = useRef<string | null>(null);
  const viewportResultCacheRef = useRef<Map<string, MarkerPoint[]>>(new Map());
  const viewportAbortRef = useRef<AbortController | null>(null);
  const overallTotalDisplay = overallStats
    ? overallStats.total >= 10000
      ? '10000+'
      : overallStats.total.toLocaleString()
    : isOverallStatsLoading
      ? '…'
      : '—';

  const statsView = useMemo(() => stats ?? buildStats(tombs), [stats, tombs]);
  const hasNameQuery = useMemo(() => Boolean(person.trim() || keyword.trim()), [person, keyword]);
  const hasSearchFilters = useMemo(
    () => Boolean(person.trim() || keyword.trim() || era.trim() || province || city || county || level || nearby),
    [city, county, era, keyword, level, nearby, person, province]
  );
  const anchorTomb = useMemo(() => {
    if (selectedId) {
      return tombs.find((tomb) => tomb.id === selectedId) ?? nearbyTombs.find((tomb) => tomb.id === selectedId) ?? null;
    }
    return tombs.length === 1 ? tombs[0] : null;
  }, [nearbyTombs, selectedId, tombs]);
  const selectedTomb = useMemo(() => {
    if (!selectedId) return null;
    return tombs.find((tomb) => tomb.id === selectedId) ?? nearbyTombs.find((tomb) => tomb.id === selectedId) ?? null;
  }, [nearbyTombs, selectedId, tombs]);
  const shouldLoadNearby = useMemo(
    () => Boolean(hasSearched && !nearby && anchorTomb && (focusSelected || hasNameQuery || tombs.length === 1)),
    [anchorTomb, focusSelected, hasNameQuery, hasSearched, nearby, tombs.length]
  );
  const mapTombs = useMemo(() => {
    if (!shouldLoadNearby || nearbyTombs.length === 0) return tombs;
    const existing = new Set(tombs.map((tomb) => tomb.id));
    return [...tombs, ...nearbyTombs.filter((tomb) => !existing.has(tomb.id))];
  }, [tombs, nearbyTombs, shouldLoadNearby]);
  const preserveNearbyView = shouldLoadNearby && nearbyTombs.length > 0 && tombs.length === 1;

  const filteredTombs = useMemo(() => {
    if (!resultProvinceFilter) return tombs;
    return tombs.filter((tomb) => (tomb.province ?? '未知') === resultProvinceFilter);
  }, [tombs, resultProvinceFilter]);

  const filteredMapTombs = useMemo(() => {
    if (!resultProvinceFilter) return mapTombs;
    return mapTombs.filter((tomb) => (tomb.province ?? '未知') === resultProvinceFilter);
  }, [mapTombs, resultProvinceFilter]);

  useEffect(() => {
    if (!hasSearched) return;
    if (!resultProvinceFilter) return;
    const next = filteredTombs[0]?.id ?? null;
    if (!next) {
      setSelectedId(null);
      return;
    }
    const exists = selectedId && filteredTombs.some((tomb) => tomb.id === selectedId);
    if (!exists) {
      setSelectedId(next);
    }
  }, [filteredTombs, hasSearched, resultProvinceFilter, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const fetchOverallStats = async () => {
      setIsOverallStatsLoading(true);
      const params = new URLSearchParams();
      if (onlyWithCoords) params.set('hasCoords', '1');
      if (includeExternal) params.set('includeExternal', '1');
      const response = await fetch(`/api/tombs/stats?${params.toString()}`, { cache: 'force-cache' });
      if (cancelled) return;
      setIsOverallStatsLoading(false);
      if (!response.ok) return;
      const data = await response.json();
      if (!cancelled && data?.stats) {
        setOverallStats(data.stats);
      }
    };
    fetchOverallStats();
    return () => {
      cancelled = true;
    };
  }, [onlyWithCoords, includeExternal]);

  useEffect(() => {
    setViewportTombs([]);
    lastViewportKeyRef.current = null;
    viewportAbortRef.current?.abort();
    viewportResultCacheRef.current.clear();
    setIsViewportLoading(false);
  }, [onlyWithCoords, includeExternal]);

  useEffect(() => {
    if (!hasSearched) return;
    viewportAbortRef.current?.abort();
    setIsViewportLoading(false);
  }, [hasSearched]);

  const handleViewportChange = useCallback(
    (payload: {
      zoom: number;
      bounds?: { west: number; south: number; east: number; north: number } | null;
    }) => {
      if (hasSearched) return;
      if (!payload?.bounds) return;

      const zoom = payload.zoom ?? 0;
      const bounds = payload.bounds;
      const detailZoom = 7.1;
      const labelZoom = 7.6;
      const cluster = zoom < detailZoom;
      const withName = zoom >= labelZoom;

      const decimals = zoom >= 11 ? 4 : zoom >= 9 ? 3 : zoom >= 7 ? 2 : 1;
      const factor = 10 ** decimals;
      const roundCoord = (value: number) => Math.round(value * factor) / factor;
      const roundedBounds = {
        west: roundCoord(bounds.west),
        south: roundCoord(bounds.south),
        east: roundCoord(bounds.east),
        north: roundCoord(bounds.north)
      };
      const bboxKey = [roundedBounds.west, roundedBounds.south, roundedBounds.east, roundedBounds.north].join(',');
      const zoomBucket = zoom < 7.5 ? Math.round(zoom * 2) / 2 : Math.round(zoom * 10) / 10;
      const key = JSON.stringify({
        bboxKey,
        zoomBucket,
        cluster,
        withName,
        onlyWithCoords,
        includeExternal
      });
      if (lastViewportKeyRef.current === key) return;
      lastViewportKeyRef.current = key;

      viewportAbortRef.current?.abort();
      const controller = new AbortController();
      viewportAbortRef.current = controller;
      const cachedViewport = viewportResultCacheRef.current.get(key);
      if (cachedViewport) {
        setViewportTombs(cachedViewport);
        setIsViewportLoading(false);
        return;
      }

      setIsViewportLoading(true);

      const params = new URLSearchParams();
      params.set('bbox', bboxKey);
      params.set('zoom', String(zoomBucket));
      if (cluster) params.set('cluster', '1');
      if (withName) params.set('withName', '1');
      if (!cluster) {
        const limit = zoom < 8.6 ? 8_000 : zoom < 9.8 ? 16_000 : zoom < 10.7 ? 28_000 : 42_000;
        params.set('limit', String(limit));
      }
      if (onlyWithCoords) params.set('hasCoords', '1');
      if (includeExternal) params.set('includeExternal', '1');

      fetch(`/api/tombs/markers?${params.toString()}`, { signal: controller.signal, cache: 'force-cache' })
        .then((response) => {
          if (!response.ok) return null;
          return response.json();
        })
        .then((data) => {
          if (!data || controller.signal.aborted) return;
          const next = Array.isArray(data?.tombs) ? (data.tombs as MarkerPoint[]) : [];
          setViewportTombs(next);
          viewportResultCacheRef.current.set(key, next);
          const maxEntries = 24;
          while (viewportResultCacheRef.current.size > maxEntries) {
            const firstKey = viewportResultCacheRef.current.keys().next().value as string | undefined;
            if (!firstKey) break;
            viewportResultCacheRef.current.delete(firstKey);
          }
        })
        .catch(() => {
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsViewportLoading(false);
        });
    },
    [hasSearched, onlyWithCoords, includeExternal]
  );

  const trackSearchHit = useCallback(
    (id: string) => {
      if (!hasSearched) return;
      if (!hasSearchFilters) return;
      fetch(`/api/tombs/${id}/search`, { method: 'POST' })
        .then(() => setRankRefreshToken((prev) => prev + 1))
        .catch(() => {});
    },
    [hasSearchFilters, hasSearched]
  );

  const handleSelect = useCallback(
    (id: string) => {
      prefetchTombDetail(id);
      setSelectedId(id);
      setFocusSelected(true);
      trackSearchHit(id);
    },
    [trackSearchHit]
  );

  const handleResetMap = () => {
    viewportAbortRef.current?.abort();
    lastViewportKeyRef.current = null;
    lastNearbyKeyRef.current = null;
    viewportResultCacheRef.current.clear();

    setHasSearched(false);
    setTombs([]);
    setNearbyTombs([]);
    setSelectedId(null);
    setFocusSelected(false);
    setStats(null);
    setStatus('');
    setResultProvinceFilter(null);

    setKeyword('');
    setPerson('');
    setEra('');
    setProvince('');
    setCity('');
    setCounty('');
    setLevel('');
    setNearby(null);
    setRadius(20000);
    setOnlyWithCoords(false);
    setIncludeExternal(false);

    setViewportTombs([]);
    setIsViewportLoading(false);
    setResetKey((prev) => prev + 1);
  };

  const fetchTombs = async (patch?: SearchPatch) => {
    const nextPerson = patch?.person ?? person;
    const nextKeyword = patch?.keyword ?? keyword;
    const nextEra = patch?.era ?? era;
    const nextProvince = patch?.province ?? province;
    const nextCity = patch?.city ?? city;
    const nextCounty = patch?.county ?? county;
    const nextLevel = patch?.level ?? level;
    const nextNearby = patch?.nearby !== undefined ? patch.nearby : nearby;
    const nextRadius = patch?.radius ?? radius;

    if (patch) {
      if (patch.person !== undefined) setPerson(nextPerson);
      if (patch.keyword !== undefined) setKeyword(nextKeyword);
      if (patch.era !== undefined) setEra(nextEra);
      if (patch.province !== undefined) setProvince(nextProvince);
      if (patch.city !== undefined) setCity(nextCity);
      if (patch.county !== undefined) setCounty(nextCounty);
      if (patch.level !== undefined) setLevel(nextLevel);
      if (patch.nearby !== undefined) setNearby(nextNearby);
      if (patch.radius !== undefined) setRadius(nextRadius);
    }

    const trimmedPerson = nextPerson.trim();
    const trimmedKeyword = nextKeyword.trim();
    const hasInput = Boolean(
      trimmedPerson || trimmedKeyword || nextEra || nextProvince || nextCity || nextCounty || nextLevel || nextNearby
    );
    const shouldAutoSelectTop = Boolean(trimmedPerson || trimmedKeyword);
    setIsSearching(true);
    setFocusSelected(false);
    setResultProvinceFilter(null);
    const q = trimmedKeyword;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (trimmedPerson) params.set('person', trimmedPerson);
    if (nextEra) params.set('era', nextEra);
    if (nextProvince) params.set('province', nextProvince);
    if (nextCity) params.set('city', nextCity);
    if (nextCounty) params.set('county', nextCounty);
    if (nextLevel) params.set('level', nextLevel);
    if (onlyWithCoords) params.set('hasCoords', '1');
    if (includeExternal) params.set('includeExternal', '1');
    if (!hasInput) params.set('stats', '1');
    if (nextNearby) {
      params.set('near', `${nextNearby.lat},${nextNearby.lng}`);
      params.set('radius', String(nextRadius));
    }
    const response = await fetch(`/api/tombs?${params.toString()}`, { cache: 'force-cache' });
    setIsSearching(false);
    if (!response.ok) return;
    const data = await response.json();
    setTombs(data.tombs);
    setStats(data.stats ?? null);
    setHasSearched(true);
    if (!hasInput) {
      setStatus('已随机展示各省全国文保单位');
    }
	    if (data.tombs.length) {
	      if (shouldAutoSelectTop) {
	        const topId = data.tombs[0].id;
	        setSelectedId(topId);
	        fetch(`/api/tombs/${topId}/search`, { method: 'POST' })
	          .then(() => setRankRefreshToken((prev) => prev + 1))
	          .catch(() => {});
	      } else {
	        const exists = selectedId && data.tombs.some((tomb: Tomb) => tomb.id === selectedId);
	        if (!exists) {
	          setSelectedId(data.tombs[0].id);
	        }
	      }
	    }
  };

  useEffect(() => {
    if (!shouldLoadNearby || !anchorTomb) {
      setNearbyTombs([]);
      lastNearbyKeyRef.current = null;
      return;
    }
    if (anchorTomb.lat == null || anchorTomb.lng == null) {
      setNearbyTombs([]);
      lastNearbyKeyRef.current = null;
      return;
    }
    const key = [
      anchorTomb.id,
      anchorTomb.lat,
      anchorTomb.lng,
      onlyWithCoords ? 'coords' : 'all',
      includeExternal ? 'external' : 'no-external'
    ].join(':');
    if (lastNearbyKeyRef.current === key) return;
    lastNearbyKeyRef.current = key;
    let cancelled = false;
    const loadNearby = async () => {
      const params = new URLSearchParams();
      params.set('near', `${anchorTomb.lat},${anchorTomb.lng}`);
      params.set('radius', '20000');
      params.set('limit', '240');
      if (onlyWithCoords) params.set('hasCoords', '1');
      if (includeExternal) params.set('includeExternal', '1');
      const response = await fetch(`/api/tombs?${params.toString()}`, { cache: 'force-cache' });
      if (cancelled) return;
      if (!response.ok) return;
      const data = await response.json();
      if (!cancelled) {
        setNearbyTombs(Array.isArray(data?.tombs) ? data.tombs : []);
      }
    };
    loadNearby();
    return () => {
      cancelled = true;
    };
  }, [shouldLoadNearby, anchorTomb, onlyWithCoords, includeExternal]);

  const provinces = useMemo(() => provinceOptions, []);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setStatus('当前浏览器不支持定位');
      return;
    }
    setStatus('正在获取定位…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearby({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('已开启定位');
      },
      () => setStatus('定位失败，请检查权限'),
      { enableHighAccuracy: true }
    );
  };

  const buildProvinceHref = (name: string) => `/provinces/${encodeURIComponent(name)}`;

  return (
    <div className="map-page">
      {/* 手机端底部 Tab 栏 */}
      <nav className="mobile-bottom-tabs" aria-label="导航标签">
        <button
          type="button"
          className={`mobile-tab-btn ${activeMobileTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('map')}
          aria-current={activeMobileTab === 'map' ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
          <span>地图</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${activeMobileTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('discover')}
          aria-current={activeMobileTab === 'discover' ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          <span>发现</span>
        </button>
        <button
          type="button"
          className={`mobile-tab-btn ${activeMobileTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('profile')}
          aria-current={activeMobileTab === 'profile' ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>个人</span>
        </button>
      </nav>

      {/* 手机端内容区（根据 Tab 切换） */}
      <div className="mobile-tab-content">

        {/* ── Tab 1：地图 ── */}
        <div className={`mobile-map-wrap ${activeMobileTab === 'map' ? '' : 'hidden-mobile'}`}>
          <div className="map-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-identity">
            <Image className="brand-logo" src="/brand-logo.png" alt="寻迹 Logo" width={84} height={84} priority />
            <div className="brand-text">
              <div className="brand-title">寻迹</div>
              <div className="brand-sub">寻找中华大地的古墓与文保遗迹</div>
            </div>
          </div>
          <nav className="brand-nav brand-nav--map-only-desktop" aria-label="内容分类">
            {CATEGORY_LINKS.map((item) => (
              <Link key={item.slug} className="category-chip" href={`/categories/${item.slug}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="topbar-actions">
          <UserMenuGate key={userRefreshKey} />
        </div>
      </header>

      <aside className="sidebar left-panel">
        <section className="panel panel--search">
          <div className="search-toolbar">
            <button className="primary-button primary-button--jade" onClick={() => fetchTombs()}>
              {isSearching ? '检索中…' : '开始检索'}
            </button>
          </div>
          <div className="search-row">
            <div className="field">
              <label>人物 / 称谓</label>
              <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="如：曹操、李白" />
            </div>
            <div className="field">
              <label>古墓关键词</label>
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="如：陵、墓、冢" />
            </div>
            <div className="field">
              <label>朝代</label>
              <input
                list="dynasty-options"
                value={era}
                onChange={(e) => setEra(e.target.value)}
                placeholder="如：唐、东汉、明"
              />
              <datalist id="dynasty-options">
                {dynastyOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="search-row">
            <div className="field">
              <label>省份</label>
              <input list="province-options" value={province} onChange={(e) => setProvince(e.target.value)} />
              <datalist id="province-options">
                {provinces.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>城市（可选）</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="如：西安市" />
            </div>
            <div className="field">
              <label>区县（可选）</label>
              <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="如：临潼区" />
            </div>
          </div>
          <div className="search-row search-row--full">
            <div className="field">
              <label>文保级别</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                {levelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="search-options-bar">
            <div className="search-row search-row--checks">
              <div className="field field--checkbox-tight">
                <label>
                  <input
                    type="checkbox"
                    checked={onlyWithCoords}
                    onChange={(e) => setOnlyWithCoords(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  只显示有精确坐标的点位
                </label>
              </div>
              <div className="field field--checkbox-tight">
                <label>
                  <input
                    type="checkbox"
                    checked={includeExternal}
                    onChange={(e) => setIncludeExternal(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  搜索时包含外部/百科结果
                </label>
              </div>
            </div>
            <div className="search-toolbar search-toolbar--secondary">
              <div className="inline-actions">
                <button className="ghost-button" onClick={handleLocate}>附近探索</button>
                <button className="ghost-button" onClick={() => {
                  setNearby(null);
                  setStatus('已关闭定位');
                }}>清除定位</button>
              </div>
            </div>
          </div>
          {nearby && (
            <div className="search-row">
              <div className="field">
                <label>附近半径（公里）：{Math.round(radius / 1000)}</label>
                <input
                  type="range"
                  min={5000}
                  max={80000}
                  step={5000}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          {status && <p className="footer-note search-status">{status}</p>}
        </section>

        <div className={`stats-results${hasSearched ? ' stats-results--after-search' : ''}`}>
          <section className="panel stats-panel">
          <h3>统计</h3>
          <div className="stats-total">
            <span className="stats-label">当前结果</span>
            <span className="stats-value">{statsView.total}</span>
            <span className="stats-unit">处古墓</span>
          </div>
          <div className="stats-list">
            {statsView.byProvince.length === 0 && <div className="footer-note">暂无统计数据</div>}
            {statsView.byProvince.map(([name, count]) => (
              <button
                key={name}
                type="button"
                className={`stats-row ${resultProvinceFilter === name ? 'active' : ''}`}
                onClick={() => setResultProvinceFilter((prev) => (prev === name ? null : name))}
                aria-pressed={resultProvinceFilter === name}
                title={resultProvinceFilter === name ? '取消筛选' : `只看 ${name}`}
              >
                <span className="stats-name">{name}</span>
                <span className="stats-count">{count}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>检索结果{resultProvinceFilter ? ` · ${resultProvinceFilter}` : ''}</h3>
          <div className="result-list">
          {!hasSearched && (
            <div className="footer-note">
              {isViewportLoading
                ? '点位加载中…（按当前视野）'
                : `地图按视野加载点位（当前 ${viewportTombs.length} 个），拖动/放大查看更多；也可设置条件并点击“开始检索”。`}
            </div>
          )}
          {hasSearched && tombs.length === 0 && (
            <div className="footer-note">暂无结果，尝试缩小范围，或取消“只显示有精确坐标的点位”。</div>
          )}
          {hasSearched && tombs.length > 0 && filteredTombs.length === 0 && (
            <div className="footer-note">该省暂无结果，点击上方省份可取消筛选。</div>
          )}
            {hasSearched && filteredTombs.map((tomb) => {
              const prefectureLabel = buildPrefectureLabel(tomb);
              return (
                <button
                  key={tomb.id}
                  type="button"
                  className={`result-item ${selectedId === tomb.id ? 'active' : ''}`}
                  onClick={() => handleSelect(tomb.id)}
                  onMouseEnter={() => prefetchTombDetail(tomb.id)}
                  onFocus={() => prefetchTombDetail(tomb.id)}
                >
                  <div className="result-title">{tomb.name}</div>
                  <div className="result-meta">
                    {tomb.person ? `${tomb.person} · ` : ''}
                    {levelLabel[tomb.level] ?? tomb.level}
                    {prefectureLabel ? ` · ${prefectureLabel}` : ''}
                    {(tomb.lat == null || tomb.lng == null)
                      ? ' · 坐标待补'
                      : !hasPreciseCoords(tomb)
                        ? ' · 坐标较粗'
                        : ''}
                    {tomb.level === 'external' ? ' · 外部来源/临时数据' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        </div>
      </aside>

      <section className="map-stage">
        <div className="map-header">
          <div className="map-header-summary">
            <div className="map-header-total">
              <span className="map-header-label">
                全国已收录
              </span>
              <span className="map-header-value">
                {overallTotalDisplay}
              </span>
              <span className="map-header-unit">处古墓</span>
              <button
                type="button"
                className="map-header-toggle"
                onClick={() => setIsProvinceStatsExpanded((prev) => !prev)}
                aria-controls="map-header-provinces"
                aria-expanded={isProvinceStatsExpanded}
                title={isProvinceStatsExpanded ? '收起各省份统计' : '展开各省份统计'}
              >
                {isProvinceStatsExpanded ? '收起' : '展开'}
              </button>
            </div>
            {nearby && <div className="map-chip map-header-chip">附近模式 · 半径 {Math.round(radius / 1000)} km</div>}
            <div className="map-header-actions">
              <button className="ghost-button" onClick={handleResetMap}>刷新地图</button>
            </div>
          </div>
          <div
            id="map-header-provinces"
            className="map-header-provinces"
            style={isProvinceStatsExpanded ? undefined : { display: 'none' }}
            aria-hidden={!isProvinceStatsExpanded}
          >
            {!overallStats && isOverallStatsLoading && <div className="map-header-loading">统计加载中…</div>}
            {(overallStats?.byProvince ?? []).map(([name, count]) =>
              name === '未知' ? (
                <span key={name} className="map-province-chip map-province-chip--disabled">
                  {name} {count}
                </span>
              ) : (
                <Link key={name} className="map-province-chip" href={buildProvinceHref(name)}>
                  {name} {count}
                </Link>
              )
            )}
          </div>
        </div>
        <MapView
          tombs={hasSearched ? filteredMapTombs : viewportTombs}
          selectedId={selectedId}
          onSelect={handleSelect}
          near={nearby}
          preserveNearbyView={preserveNearbyView}
          focusSelected={focusSelected}
          autoFit={hasSearched}
          isViewportLoading={!hasSearched && isViewportLoading}
          onViewportChange={handleViewportChange}
          resetKey={resetKey}
        />
      </section>

      <aside className="sidebar right-panel">
        {selectedId ? (
          <>
            <DetailCard
              tombId={selectedId}
              onClose={() => setSelectedId(null)}
              onSelectTomb={handleSelect}
              initialTomb={selectedTomb}
            />
            <CommentsPanel tombId={selectedId} />
          </>
	        ) : (
	          <>
	            <section className="panel empty-detail">
	              <HotSearchPanel compact count={9} onApply={(patch) => fetchTombs(patch)} />
	            </section>
	            <SearchRankPanel onSelect={handleSelect} refreshToken={rankRefreshToken} limit={10} />
	          </>
	        )}
      </aside>
      </div>
      </div>

        {/* ── Tab 2：发现 ── */}
        {activeMobileTab === 'discover' && (
          <div className="discover-tab">
            <nav className="discover-category-nav" aria-label="内容分类">
              {CATEGORY_LINKS.map((item) => (
                <Link key={item.slug} className="category-chip" href={`/categories/${item.slug}`}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <FamousTombCarousel />
            <TopicCollectionsGrid />
            <OfficialHeritageLinks />
          </div>
        )}

        {/* ── Tab 3：个人 ── */}
        {activeMobileTab === 'profile' && (
          <MobileProfilePanel onUserChange={() => setUserRefreshKey((k) => k + 1)} />
        )}

        <footer className="site-footer">
          <div className="footer-left">
            <div className="footer-brand">
              <Image className="footer-logo" src="/brand-logo.png" alt="寻迹 Logo" width={96} height={96} />
              <div className="footer-brand-text">
                <div className="footer-title">寻迹</div>
                <div className="footer-sub">探寻山河遗迹，守望千年记忆</div>
              </div>
            </div>
            <p className="footer-desc">
              以权威文保名录为基础，补全古墓坐标、人物与时代信息。
              <br />
              为考古爱好者与历史研究者提供可靠的寻访入口。
            </p>
          </div>
          <div className="footer-right">
            <div className="footer-sources">
              <div className="footer-label">参考来源</div>
              <div className="footer-item">全国重点文物保护单位名录</div>
              <div className="footer-item">各省市自治区文物保护单位名录</div>
              <div className="footer-item">维基百科&amp;百度百科</div>
              <div className="footer-item footer-item-quoted">「华夏古迹图」平台</div>
            </div>
            <div className="footer-contact">
              <div className="footer-label">联系方式</div>
              <div className="footer-item">邮箱：2783729050@qq.com</div>
              <div className="footer-item">微信：z2783729050</div>
            </div>
          </div>
          <div className="footer-qr">
            <div className="footer-label">微信二维码</div>
            <Image className="footer-qr-image" src="/author-qr.jpg" alt="作者微信二维码" width={140} height={140} />
            <div className="footer-note">扫码交流 · 资料共建</div>
          </div>
        </footer>
      </div>

      {/* 桌面端专属（手机通过 Tab 访问的内容在 mobile-tab-content 内部） */}
      <div className="desktop-extras">
        <FamousTombCarousel />
        <TopicCollectionsGrid />
        <OfficialHeritageLinks />
      </div>
    </div>
  );
}
