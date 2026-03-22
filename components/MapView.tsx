'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { haversineMeters, normalizeText } from '../lib/utils';

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig?: { securityJsCode: string };
    __amapPromise?: Promise<void>;
  }
}

type MapPoint = {
  id?: string;
  name?: string;
  level?: string;
  province?: string;
  city?: string;
  county?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  count?: number;
};

type Props = {
  tombs: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  near: { lat: number; lng: number } | null;
  isViewportLoading?: boolean;
  onViewportChange?: (payload: {
    center: { lat: number; lng: number };
    radius: number;
    zoom: number;
    bounds: { west: number; south: number; east: number; north: number } | null;
  }) => void;
  preserveNearbyView?: boolean;
  focusSelected?: boolean;
  autoFit?: boolean;
  resetKey?: number;
};

export default function MapView({
  tombs,
  selectedId,
  onSelect,
  near,
  isViewportLoading = false,
  onViewportChange,
  preserveNearbyView = false,
  focusSelected = true,
  autoFit = true,
  resetKey
}: Props) {
  const INITIAL_CENTER: [number, number] = [108.95, 34.27];
  const INITIAL_ZOOM = 4.8;
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const markersByIdRef = useRef<Map<string, any>>(new Map());
  const massMarksRef = useRef<any>(null);
  const massStyleRef = useRef<{ key: string; style: any[] } | null>(null);
  const selectedMarkerRef = useRef<any>(null);
  const lastLabeledIdRef = useRef<string | null>(null);
  const labelMarkersRef = useRef<any[]>([]);
  const geoRef = useRef<any>(null);
  const districtLayerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const resolvingRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastFitKeyRef = useRef<string | null>(null);
  const lastFocusKeyRef = useRef<string | null>(null);
  const lastSelectedIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const pointsRef = useRef<Array<MapPoint & { lat: number; lng: number }>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(INITIAL_ZOOM);
  const [geocoderReady, setGeocoderReady] = useState(false);
  const [resolvedCoords, setResolvedCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const key = process.env.NEXT_PUBLIC_AMAP_KEY;
  const security = process.env.NEXT_PUBLIC_AMAP_SECURITY;

  const points = useMemo(() => {
    const COUNTY_TOKEN_PATTERN = /([\u4e00-\u9fa5]{1,12}(?:自治县|县|区|旗|市))/g;
    const CITY_TOKEN_PATTERN = /([\u4e00-\u9fa5]{1,12}(?:市|地区|盟|州|自治州))/g;

    const matchLastToken = (value: string | undefined, pattern: RegExp) => {
      if (!value) return '';
      const matches = Array.from(value.matchAll(pattern)).map((m) => m[1]).filter(Boolean);
      return matches.length ? matches[matches.length - 1] : '';
    };

    const extractCityKey = (tomb: MapPoint) => {
      const field = matchLastToken(tomb.city ?? '', CITY_TOKEN_PATTERN);
      const address = matchLastToken(tomb.address ?? '', CITY_TOKEN_PATTERN);
      return normalizeText(field || address);
    };

    const extractCountyKey = (tomb: MapPoint) => {
      const field = matchLastToken(tomb.county ?? '', COUNTY_TOKEN_PATTERN);
      const address = matchLastToken(tomb.address ?? '', COUNTY_TOKEN_PATTERN);
      return normalizeText(field || address);
    };

    const buildProvinceKey = (tomb: MapPoint) =>
      [normalizeText(tomb.name ?? ''), normalizeText(tomb.province ?? '')].join('|');

    const buildAdminKey = (tomb: MapPoint) =>
      [buildProvinceKey(tomb), extractCityKey(tomb), extractCountyKey(tomb)].join('|');

    const groupsWithRealCoords = new Set<string>();
    tombs.forEach((tomb) => {
      if (!tomb.name) return;
      if (tomb.lat == null || tomb.lng == null) return;
      groupsWithRealCoords.add(buildProvinceKey(tomb));
      groupsWithRealCoords.add(buildAdminKey(tomb));
    });

    type CandidatePoint = (MapPoint & { lat: number; lng: number }) & {
      __nameKey: string;
      __provinceKey: string;
      __cityKey: string;
      __countyKey: string;
      __priority: number;
    };

    const seenId = new Set<string>();
    const candidates: CandidatePoint[] = [];

    tombs.forEach((tomb) => {
      const resolved = tomb.id ? resolvedCoords[tomb.id] : undefined;
      const hasRealCoords = tomb.lat != null && tomb.lng != null;
      const lat = tomb.lat ?? resolved?.lat;
      const lng = tomb.lng ?? resolved?.lng;
      if (lat == null || lng == null) return;

      if (!hasRealCoords && resolved && tomb.name) {
        const provinceKey = buildProvinceKey(tomb);
        const adminKey = buildAdminKey(tomb);
        if (groupsWithRealCoords.has(adminKey) || groupsWithRealCoords.has(provinceKey)) {
          return;
        }
      }

      if (tomb.id) {
        if (seenId.has(tomb.id)) return;
        seenId.add(tomb.id);
      }

      const nameKey = normalizeText(tomb.name ?? '');
      const provinceKey = normalizeText(tomb.province ?? '');
      const cityKey = extractCityKey(tomb);
      const countyKey = extractCountyKey(tomb);
      const priority =
        (hasRealCoords ? 10 : 0) +
        (tomb.level === 'national' ? 2 : 0) +
        (tomb.address ? 1 : 0) +
        (cityKey ? 1 : 0) +
        (countyKey ? 1 : 0);

      candidates.push({
        ...tomb,
        lat,
        lng,
        __nameKey: nameKey,
        __provinceKey: provinceKey,
        __cityKey: cityKey,
        __countyKey: countyKey,
        __priority: priority
      });
    });

    const passthrough: CandidatePoint[] = [];
    const mergeCandidates: CandidatePoint[] = [];

    candidates.forEach((point) => {
      if ((point.count ?? 1) > 1 || !point.id || point.__nameKey.length < 2) {
        passthrough.push(point);
        return;
      }
      mergeCandidates.push(point);
    });

    const gridSize = 0.02; // ~2.2km lat, used for near-neighbor lookups
    const toCell = (lat: number, lng: number) => ({
      x: Math.floor(lat / gridSize),
      y: Math.floor(lng / gridSize)
    });
    const cellKey = (nameKey: string, x: number, y: number) => `${nameKey}|${x}|${y}`;
    const cellIndex = new Map<string, CandidatePoint[]>();

    const isDup = (a: CandidatePoint, b: CandidatePoint) => {
      const distance = haversineMeters(a.lat, a.lng, b.lat, b.lng);
      if (distance <= 300) return true;
      const provinceMatch = Boolean(a.__provinceKey && b.__provinceKey && a.__provinceKey === b.__provinceKey);
      const provinceLooseMatch = Boolean(
        (a.__provinceKey && !b.__provinceKey) || (!a.__provinceKey && b.__provinceKey)
      );
      if (provinceMatch && distance <= 1500) return true;
      if (provinceLooseMatch && distance <= 800) return true;
      const countyMatch = Boolean(a.__countyKey && b.__countyKey && a.__countyKey === b.__countyKey);
      const cityMatch = Boolean(a.__cityKey && b.__cityKey && a.__cityKey === b.__cityKey);
      if ((countyMatch || cityMatch) && distance <= 2500) return true;
      return false;
    };

    const clustered: CandidatePoint[] = [...passthrough];
    const sorted = [...mergeCandidates].sort((a, b) => b.__priority - a.__priority);

    sorted.forEach((candidate) => {
      const cell = toCell(candidate.lat, candidate.lng);
      let found = false;
      for (let dx = -1; dx <= 1 && !found; dx += 1) {
        for (let dy = -1; dy <= 1 && !found; dy += 1) {
          const bucket = cellIndex.get(cellKey(candidate.__nameKey, cell.x + dx, cell.y + dy));
          if (!bucket?.length) continue;
          for (const existing of bucket) {
            if (isDup(existing, candidate)) {
              found = true;
              break;
            }
          }
        }
      }
      if (found) return;

      clustered.push(candidate);
      const bucketKey = cellKey(candidate.__nameKey, cell.x, cell.y);
      const bucket = cellIndex.get(bucketKey);
      if (bucket) bucket.push(candidate);
      else cellIndex.set(bucketKey, [candidate]);
    });

    return clustered.map((point) => {
      const { __nameKey, __provinceKey, __cityKey, __countyKey, __priority, ...rest } = point;
      return rest;
    });
  }, [tombs, resolvedCoords]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const hasClusters = useMemo(() => points.some((item) => (item.count ?? 1) > 1), [points]);

  const shouldUseMassMarks = useMemo(() => {
    if (!mapReady) return false;
    if (!window.AMap?.MassMarks) return false;
    return hasClusters || points.length > 1600;
  }, [points.length, mapReady, hasClusters]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!key) {
      setLoadError('未配置高德 Key，地图暂不可用');
      return;
    }

    const loadAmap = () => {
      if (window.AMap) return Promise.resolve();
      if (window.__amapPromise) return window.__amapPromise;
      if (security) {
        window._AMapSecurityConfig = { securityJsCode: security };
      }
      window.__amapPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('高德地图脚本加载失败'));
        document.head.appendChild(script);
      });
      return window.__amapPromise;
    };

    loadAmap()
      .then(() => {
        if (!window.AMap || mapRef.current) return;
        mapRef.current = new window.AMap.Map(containerRef.current, {
          viewMode: '2D',
          zoom: INITIAL_ZOOM,
          center: INITIAL_CENTER,
          features: ['bg', 'road', 'building', 'point'],
          mapStyle: 'amap://styles/normal',
          showLabel: true
        });
        setMapZoom(mapRef.current.getZoom?.() ?? 0);
        const bounds = new window.AMap.Bounds([73.5, 18.0], [135.5, 53.6]);
        mapRef.current.setLimitBounds(bounds);
        mapRef.current.setZooms([4, 12]);
        mapRef.current.on('complete', () => {
          setMapReady(true);
          setMapZoom(mapRef.current?.getZoom?.() ?? 0);
        });

        window.AMap.plugin(['AMap.Scale', 'AMap.ToolBar'], () => {
          mapRef.current?.addControl(new window.AMap.Scale());
          mapRef.current?.addControl(new window.AMap.ToolBar({ position: 'RB' }));
        });
        window.AMap.plugin(['AMap.Geocoder'], () => {
          if (!geocoderRef.current) {
            geocoderRef.current = new window.AMap.Geocoder({ radius: 1000 });
          }
          setGeocoderReady(true);
        });

        if (window.AMap.DistrictLayer?.Country) {
          districtLayerRef.current = new window.AMap.DistrictLayer.Country({
            zIndex: 3,
            depth: 2,
            styles: {
              fill: 'rgba(255,255,255,0.02)',
              'stroke-width': 1,
              stroke: 'rgba(178,75,47,0.35)',
              'province-stroke': 'rgba(178,75,47,0.35)',
              'city-stroke': 'rgba(178,75,47,0.2)'
            }
          });
          mapRef.current.add(districtLayerRef.current);
        }

        fetch('/geo/china-provinces.json')
          .then((res) => res.json())
          .then((geojson) => {
            if (!mapRef.current) return;
            geoRef.current = new window.AMap.GeoJSON({
              geoJSON: geojson,
              getPolygon: (feature: any, lnglats: any[]) => {
                return new window.AMap.Polygon({
                  path: lnglats,
                  fillOpacity: 0.02,
                  strokeColor: '#b24b2f',
                  strokeOpacity: 0.25,
                  strokeWeight: 1
                });
              }
            });
            mapRef.current.add(geoRef.current);
          })
          .catch(() => {
          });
      })
      .catch(() => {
        setLoadError('地图加载失败，请检查高德 Key 与安全密钥配置');
      });
  }, [key, security]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    if (resetKey == null) return;
    labelMarkersRef.current.forEach((marker) => marker?.setMap?.(null));
    labelMarkersRef.current = [];
    mapRef.current.setZoomAndCenter?.(INITIAL_ZOOM, INITIAL_CENTER);
  }, [resetKey, mapReady]);

  useEffect(() => {
    if (mapReady || loadError) return;
    const timer = window.setTimeout(() => {
      if (!mapReady) {
        setLoadError('地图未显示：请检查高德 Key 绑定域名与安全密钥是否匹配');
      }
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [mapReady, loadError]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const update = () => {
      if (!mapRef.current) return;
      const zoom = mapRef.current.getZoom?.() ?? 0;
      setMapZoom(zoom);
    };
    update();
    mapRef.current.on('zoomend', update);
    return () => {
      mapRef.current?.off?.('zoomend', update);
    };
  }, [mapReady]);

  const buildDotHtml = (active: boolean) =>
    `<div style="width:14px;height:14px;border-radius:999px;background:${
      active ? '#b24b2f' : '#1f7a6c'
    };box-shadow:0 0 0 4px ${active ? 'rgba(178,75,47,0.18)' : 'rgba(31,122,108,0.15)'}"></div>`;

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const buildMarkerLabelHtml = (name: string) => `
    <div class="tomb-label tomb-label--interactive tomb-label--nameOnly">
      <div class="tomb-label-name">${escapeHtml(name)}</div>
    </div>
  `;

  const buildOverlayLabelHtml = (name: string) => `
    <div style="transform: translate(-50%, -100%);">
      ${buildMarkerLabelHtml(name)}
    </div>
  `;

  const clearMarkerLabel = (marker: any) => {
    if (!marker?.setLabel) return;
    try {
      marker.setLabel(null);
    } catch {
      if (!window.AMap?.Pixel) return;
      marker.setLabel({
        content: '',
        direction: 'top',
        offset: new window.AMap.Pixel(0, 0)
      });
    }
  };

  const styleIndexForCount = (countRaw: number) => {
    const count = Number.isFinite(countRaw) && countRaw > 0 ? countRaw : 1;
    if (count <= 1) return 0;
    if (count < 10) return 1;
    if (count < 30) return 2;
    if (count < 120) return 3;
    return 4;
  };

  const buildMassStyle = (zoom: number) => {
    if (!window.AMap?.Pixel || !window.AMap?.Size) return null;
    const bucket = zoom >= 10 ? 'hi' : zoom >= 7 ? 'mid' : 'low';
    if (massStyleRef.current?.key === bucket) return massStyleRef.current.style;

    const base = bucket === 'low' ? 18 : bucket === 'mid' ? 15 : 12;
    const sizes = [base, base + 10, base + 16, base + 22, base + 28];

    const svgCircleDataUri = (fill: string, size: number, stroke = 'rgba(255,255,255,0.9)', strokeWidth = 2) => {
      const radius = Math.max(1, size / 2 - strokeWidth);
      const center = size / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${center}" cy="${center}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/></svg>`;
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    };

    const AMap = window.AMap;
    const make = (fill: string, size: number) => ({
      url: svgCircleDataUri(fill, size),
      anchor: new AMap.Pixel(size / 2, size / 2),
      size: new AMap.Size(size, size)
    });

    const style = [
      make('#1f7a6c', sizes[0]),
      make('#1f7a6c', sizes[1]),
      make('#1f7a6c', sizes[2]),
      make('#1f7a6c', sizes[3]),
      make('#1f7a6c', sizes[4])
    ];

    massStyleRef.current = { key: bucket, style };
    return style;
  };

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!mapRef.current || !mapReady || shouldUseMassMarks) return;

    markersRef.current.forEach((marker) => mapRef.current.remove(marker));
    markersRef.current = [];
    markersByIdRef.current.clear();

    const shouldShowLabels = false;
    const batchSize =
      points.length > 30_000 ? 250 : points.length > 20_000 ? 300 : points.length > 12_000 ? 400 : points.length > 6_000 ? 600 : 900;

    const created: any[] = [];
    let cancelled = false;

    const formatCount = (count: number) => {
      if (count >= 1000) {
        const value = Math.round((count / 1000) * 10) / 10;
        return `${value}k`;
      }
      return String(count);
    };

    const buildClusterHtml = (count: number) => `
      <div style="min-width:22px;height:22px;border-radius:999px;background:#1f7a6c;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;box-shadow:0 0 0 4px rgba(31,122,108,0.15)">
        ${escapeHtml(formatCount(count))}
      </div>
    `;

    const addBatch = (startIndex: number) => {
      if (!mapRef.current || cancelled) return;
      const endIndex = Math.min(startIndex + batchSize, points.length);
      const batch: any[] = [];

      for (let index = startIndex; index < endIndex; index += 1) {
        const tomb = points[index];
        if (!tomb) continue;
        const count = tomb.count ?? 1;
        const isCluster = count > 1 || !tomb.id;
        const active = tomb.id === selectedIdRef.current;
        const title = tomb.name ?? tomb.id ?? '';

        const marker: any = new window.AMap.Marker({
          position: [tomb.lng, tomb.lat],
          title,
          content: isCluster ? buildClusterHtml(count) : buildDotHtml(active)
        });

        if (active && !isCluster && window.AMap?.Pixel) {
          const labelName = tomb.name ?? tomb.id ?? '已选中点位';
          marker.setLabel?.({
            content: buildMarkerLabelHtml(labelName),
            direction: 'top',
            offset: new window.AMap.Pixel(0, -8)
          });
        }

        if (shouldShowLabels && !isCluster) {}

        marker.on('click', () => {
          if (!mapRef.current) return;
          if (isCluster) {
            const currentZoom = mapRef.current.getZoom?.() ?? 0;
            const nextZoom = Math.min(currentZoom + 1.8, 12);
            mapRef.current.setZoomAndCenter?.(nextZoom, [tomb.lng, tomb.lat]);
            return;
          }
          if (tomb.id) onSelect(tomb.id);
        });
        created.push(marker);
        batch.push(marker);
        if (tomb.id) {
          markersByIdRef.current.set(tomb.id, marker);
        }
      }

      if (batch.length) {
        mapRef.current.add(batch);
      }

      markersRef.current = created;
      if (endIndex < points.length) {
        window.requestAnimationFrame(() => addBatch(endIndex));
        return;
      }

      if (!autoFit || preserveNearbyView) return;
      if (!created.length) return;

      const maxFitMarkers = 600;
      let fitMarkers = created;
      if (fitMarkers.length > maxFitMarkers) {
        const stride = Math.ceil(fitMarkers.length / maxFitMarkers);
        fitMarkers = fitMarkers.filter((_, index) => index % stride === 0);
        if (fitMarkers.length > maxFitMarkers) {
          fitMarkers = fitMarkers.slice(0, maxFitMarkers);
        }
      }

      const fitKey = fitMarkers.length
        ? `${points.length}:${fitMarkers.length}:${points.slice(0, 24).map((tomb) => tomb.id ?? '').join('|')}`
        : null;
      if (fitKey && lastFitKeyRef.current !== fitKey) {
        lastFitKeyRef.current = fitKey;
        mapRef.current.setFitView(fitMarkers, false, [80, 80, 80, 80]);
      }
    };

    addBatch(0);

    return () => {
      cancelled = true;
      created.forEach((marker) => mapRef.current?.remove?.(marker));
    };
  }, [points, onSelect, mapReady, autoFit, preserveNearbyView, shouldUseMassMarks]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    if (!window.AMap?.Marker) return;

    let timer: number | null = null;
    const map = mapRef.current;
    const AMap = window.AMap;

    const clear = () => {
      labelMarkersRef.current.forEach((marker) => marker?.setMap?.(null));
      labelMarkersRef.current = [];
    };

    const rebuild = () => {
      if (!mapRef.current) return;
      clear();

      const minLabelZoom = 6.0;
      if (mapZoom < minLabelZoom) return;

      const bounds = mapRef.current.getBounds?.();
      if (!bounds) return;
      const readCoord = (lnglat: any) => ({
        lat: lnglat?.lat ?? lnglat?.getLat?.(),
        lng: lnglat?.lng ?? lnglat?.getLng?.()
      });
      const neRaw = readCoord(bounds.getNorthEast?.());
      const swRaw = readCoord(bounds.getSouthWest?.());
      if (neRaw.lat == null || neRaw.lng == null || swRaw.lat == null || swRaw.lng == null) return;

      const box = {
        west: Math.min(neRaw.lng, swRaw.lng),
        south: Math.min(neRaw.lat, swRaw.lat),
        east: Math.max(neRaw.lng, swRaw.lng),
        north: Math.max(neRaw.lat, swRaw.lat)
      };

      const gridPx =
        mapZoom >= 11.2 ? 90 :
        mapZoom >= 10.6 ? 110 :
        mapZoom >= 10 ? 130 :
        mapZoom >= 9 ? 150 :
        mapZoom >= 8 ? 170 :
        mapZoom >= 7 ? 200 :
        230;
      const maxLabels =
        mapZoom >= 11.2 ? 240 :
        mapZoom >= 10.6 ? 170 :
        mapZoom >= 10 ? 120 :
        mapZoom >= 9 ? 80 :
        mapZoom >= 8 ? 55 :
        mapZoom >= 7 ? 35 :
        18;

      const seen = new Set<string>();
      const selected: Array<MapPoint & { id: string; lat: number; lng: number }> = [];
      const candidates = pointsRef.current;

      const stride =
        candidates.length > maxLabels * 80
          ? Math.ceil(candidates.length / (maxLabels * 40))
          : 1;

      for (let index = 0; index < candidates.length; index += stride) {
        const item = candidates[index];
        if (!item.id) continue;
        if (item.id === selectedIdRef.current) continue;
        if (!item.name) continue;
        if ((item.count ?? 1) > 1) continue;
        if (item.lat < box.south || item.lat > box.north || item.lng < box.west || item.lng > box.east) continue;

        const pixel = mapRef.current.lngLatToContainer?.([item.lng, item.lat]);
        if (!pixel) continue;
        const gx = Math.floor((pixel.x ?? 0) / gridPx);
        const gy = Math.floor((pixel.y ?? 0) / gridPx);
        const key = `${gx},${gy}`;
        if (seen.has(key)) continue;
        seen.add(key);

        selected.push(item as MapPoint & { id: string; lat: number; lng: number });
        if (selected.length >= maxLabels) break;
      }

      selected.forEach((item) => {
        const content = buildOverlayLabelHtml(item.name ?? item.id);
        const marker = new AMap.Marker({
          position: [item.lng, item.lat],
          zIndex: 920,
          content
        });
        marker.on('click', () => onSelect(item.id));
        marker.setMap(map);
        labelMarkersRef.current.push(marker);
      });
    };

    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(rebuild, 160);
    };

    schedule();
    map.on('moveend', schedule);
    map.on('zoomend', schedule);

    return () => {
      if (timer) window.clearTimeout(timer);
      map.off?.('moveend', schedule);
      map.off?.('zoomend', schedule);
      clear();
    };
  }, [mapReady, mapZoom, onSelect, points, shouldUseMassMarks, selectedId]);

  useEffect(() => {
    if (!mapRef.current || !mapReady || !shouldUseMassMarks) return;
    if (!window.AMap?.MassMarks) return;

    markersRef.current.forEach((marker) => mapRef.current.remove(marker));
    markersRef.current = [];
    markersByIdRef.current.clear();

    if (!massMarksRef.current) {
      const AMap = window.AMap;
      massMarksRef.current = new AMap.MassMarks([], {
        opacity: 0.95,
        zIndex: 110,
        cursor: 'pointer',
        style: buildMassStyle(mapZoom) ?? []
      });

      massMarksRef.current.on('click', (event: any) => {
        const data = event?.data ?? null;
        if (!data) return;
        const count = typeof data.count === 'number' ? data.count : 1;
        if (count > 1) {
          const currentZoom = mapRef.current?.getZoom?.() ?? 0;
          const nextZoom = Math.min(currentZoom + 1.8, 12);
          const lnglat = data.lnglat ?? event?.lnglat;
          if (lnglat) {
            mapRef.current?.setZoomAndCenter?.(nextZoom, lnglat);
          }
          return;
        }
        if (data.id) {
          onSelect(String(data.id));
        }
      });
    }

    massMarksRef.current.setMap(mapRef.current);

    return () => {
      massMarksRef.current?.setMap?.(null);
      massMarksRef.current = null;
    };
  }, [mapReady, shouldUseMassMarks, onSelect]);

  useEffect(() => {
    if (!mapReady || !shouldUseMassMarks) return;
    if (!massMarksRef.current) return;
    const style = buildMassStyle(mapZoom);
    if (style && massMarksRef.current.setStyle) {
      massMarksRef.current.setStyle(style);
    }
    const data = points
      .map((item) => {
        const countRaw = typeof item.count === 'number' ? item.count : 1;
        const count = Number.isFinite(countRaw) && countRaw > 0 ? countRaw : 1;
        return {
          id: count <= 1 ? item.id : undefined,
          lnglat: [item.lng, item.lat],
          count,
          style: styleIndexForCount(count)
        };
      })
      .filter(
        (
          item
        ): item is {
          id: string | undefined;
          lnglat: number[];
          count: number;
          style: number;
        } => Boolean(item)
      )
      .filter((item) => item.lnglat[0] != null && item.lnglat[1] != null);
    massMarksRef.current.setData(data);
  }, [points, mapZoom, mapReady, shouldUseMassMarks]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const prevId = lastSelectedIdRef.current;
    const nextId = selectedId;

    if (prevId && prevId !== nextId) {
      const marker = markersByIdRef.current.get(prevId);
      marker?.setContent?.(buildDotHtml(false));
    }
    if (nextId) {
      const marker = markersByIdRef.current.get(nextId);
      marker?.setContent?.(buildDotHtml(true));
    }
    lastSelectedIdRef.current = nextId;
  }, [selectedId, tombs, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    if (shouldUseMassMarks) {
      const prev = lastLabeledIdRef.current;
      if (prev) {
        const marker = markersByIdRef.current.get(prev);
        clearMarkerLabel(marker);
      }
      lastLabeledIdRef.current = null;
      return;
    }
    if (!window.AMap?.Pixel) return;

    const prev = lastLabeledIdRef.current;
    if (prev && prev !== selectedId) {
      const marker = markersByIdRef.current.get(prev);
      clearMarkerLabel(marker);
    }

    if (!selectedId) {
      lastLabeledIdRef.current = null;
      return;
    }

    const marker = markersByIdRef.current.get(selectedId);
    if (!marker) {
      lastLabeledIdRef.current = null;
      return;
    }

    const point = pointsRef.current.find((item) => item.id === selectedId) ?? null;
    const labelName = point?.name ?? selectedId;
    marker.setLabel?.({
      content: buildMarkerLabelHtml(labelName),
      direction: 'top',
      offset: new window.AMap.Pixel(0, -8)
    });
    lastLabeledIdRef.current = selectedId;
  }, [selectedId, mapReady, shouldUseMassMarks, points]);

  const buildGeoAddress = (tomb: MapPoint) => {
    const address = tomb.address?.trim() ?? '';
    const parts = [tomb.province, tomb.city, tomb.county].filter(Boolean) as string[];
    if (address) {
      const prefix = parts.filter((part) => !address.includes(part)).join('');
      return `${prefix}${address}`.trim();
    }
    const fallback = [...parts, tomb.name].filter(Boolean).join('');
    return fallback || null;
  };

  const focusOnTomb = (tomb: MapPoint, resolved?: { lat: number; lng: number }) => {
    if (!mapRef.current) return false;
    if (preserveNearbyView) return true;
    const marker = tomb.id ? markersByIdRef.current.get(tomb.id) : null;
    if (marker) {
      mapRef.current.setFitView([marker], false, [120, 120, 120, 120]);
      const currentZoom = mapRef.current.getZoom?.() ?? 0;
      if (currentZoom < 10.5) {
        mapRef.current.setZoom(10.5);
      }
      return true;
    }
    const lat = tomb.lat ?? resolved?.lat;
    const lng = tomb.lng ?? resolved?.lng;
    if (lat == null || lng == null) return false;
    const currentZoom = mapRef.current.getZoom?.() ?? 0;
    const nextZoom = Math.max(currentZoom, 10.5);
    mapRef.current.setZoomAndCenter(nextZoom, [lng, lat]);
    return true;
  };

  useEffect(() => {
    if (!mapRef.current || !selectedId || !focusSelected) return;
    const tomb = tombs.find((item) => item.id === selectedId);
    if (!tomb?.id) return;
    const resolved = resolvedCoords[tomb.id];
    const focusKey = `${tomb.id}:${resolved?.lat ?? tomb.lat ?? 'x'}:${resolved?.lng ?? tomb.lng ?? 'x'}:${
      preserveNearbyView ? 'nearby' : 'single'
    }`;
    if (focusKey === lastFocusKeyRef.current) return;
    if (focusOnTomb(tomb, resolved)) {
      lastFocusKeyRef.current = focusKey;
    }
  }, [selectedId, tombs, resolvedCoords, mapReady, preserveNearbyView, focusSelected]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    if (!shouldUseMassMarks) {
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.setMap?.(null);
        selectedMarkerRef.current = null;
      }
      return;
    }
    if (!selectedId) {
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.setMap?.(null);
        selectedMarkerRef.current = null;
      }
      return;
    }
    if (!window.AMap?.Marker) return;
    const point = pointsRef.current.find((item) => item.id === selectedId) ?? null;
    if (!point) {
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.setMap?.(null);
        selectedMarkerRef.current = null;
      }
      return;
    }

    const marker = selectedMarkerRef.current ?? new window.AMap.Marker({ zIndex: 999 });
    selectedMarkerRef.current = marker;
    marker.setPosition?.([point.lng, point.lat]);
    marker.setContent?.(buildDotHtml(true));

    const labelName = point.name ?? point.id ?? '已选中点位';
    marker.setLabel?.({
      content: buildMarkerLabelHtml(labelName),
      direction: 'top',
      offset: new window.AMap.Pixel(0, -8)
    });

    marker.setMap?.(mapRef.current);
  }, [selectedId, mapReady, shouldUseMassMarks]);

  useEffect(() => {
    if (!mapRef.current || !geocoderRef.current || !selectedId || !geocoderReady) return;
    const tomb = tombs.find((item) => item.id === selectedId);
    if (!tomb?.id) return;
    const tombId = tomb.id;
    if ((tomb.lat != null && tomb.lng != null) || resolvedCoords[tomb.id]) return;
    if (resolvingRef.current.has(tombId)) return;
    const address = buildGeoAddress(tomb);
    if (!address) return;
    resolvingRef.current.add(tombId);
    geocoderRef.current.getLocation(address, (status: string, result: any) => {
      resolvingRef.current.delete(tombId);
      if (status !== 'complete') return;
      const location = result?.geocodes?.[0]?.location;
      if (!location) return;
      const lng = location.lng ?? location.getLng?.();
      const lat = location.lat ?? location.getLat?.();
      if (lng == null || lat == null) return;
      setResolvedCoords((prev) => ({ ...prev, [tombId]: { lat, lng } }));
    });
  }, [selectedId, tombs, resolvedCoords, geocoderReady]);

  useEffect(() => {
    if (!mapRef.current || !geocoderRef.current || !geocoderReady) return;
    const queue = tombs
      .filter((tomb) => tomb.level === 'external' || (tomb.id ?? '').startsWith('manual-'))
      .filter((tomb) => tomb.lat == null && tomb.lng == null)
      .filter((tomb) => Boolean(tomb.id))
      .filter((tomb) => !resolvedCoords[tomb.id!] && !resolvingRef.current.has(tomb.id!))
      .slice(0, 3) as Array<MapPoint & { id: string }>;
    if (!queue.length) return;
    let cancelled = false;
    const resolveNext = (index: number) => {
      if (cancelled || index >= queue.length) return;
      const tomb = queue[index];
      const address = buildGeoAddress(tomb);
      if (!address) {
        resolveNext(index + 1);
        return;
      }
      resolvingRef.current.add(tomb.id);
      geocoderRef.current.getLocation(address, (status: string, result: any) => {
        resolvingRef.current.delete(tomb.id);
        if (!cancelled && status === 'complete') {
          const location = result?.geocodes?.[0]?.location;
          const lng = location?.lng ?? location?.getLng?.();
          const lat = location?.lat ?? location?.getLat?.();
          if (lng != null && lat != null) {
            setResolvedCoords((prev) => ({ ...prev, [tomb.id]: { lat, lng } }));
          }
        }
        resolveNext(index + 1);
      });
    };
    resolveNext(0);
    return () => {
      cancelled = true;
    };
  }, [tombs, resolvedCoords, geocoderReady]);

  useEffect(() => {
    if (!mapRef.current || !near) return;
    mapRef.current.setZoomAndCenter(11, [near.lng, near.lat]);
  }, [near]);

  useEffect(() => {
    if (!mapRef.current || !mapReady || !onViewportChange) return;
    let timer: number | null = null;
    const readCoord = (lnglat: any) => ({
      lat: lnglat?.lat ?? lnglat?.getLat?.(),
      lng: lnglat?.lng ?? lnglat?.getLng?.()
    });
    const trigger = () => {
      if (!mapRef.current) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!mapRef.current) return;
        const centerRaw = readCoord(mapRef.current.getCenter());
        const bounds = mapRef.current.getBounds?.();
        const neRaw = bounds ? readCoord(bounds.getNorthEast?.()) : null;
        const swRaw = bounds ? readCoord(bounds.getSouthWest?.()) : null;
        if (
          centerRaw?.lat == null ||
          centerRaw?.lng == null ||
          neRaw?.lat == null ||
          neRaw?.lng == null ||
          swRaw?.lat == null ||
          swRaw?.lng == null
        ) {
          return;
        }
        const radius = Math.max(
          haversineMeters(centerRaw.lat, centerRaw.lng, neRaw.lat, neRaw.lng),
          haversineMeters(centerRaw.lat, centerRaw.lng, swRaw.lat, swRaw.lng)
        );
        const boundsPayload = {
          west: Math.min(neRaw.lng, swRaw.lng),
          south: Math.min(neRaw.lat, swRaw.lat),
          east: Math.max(neRaw.lng, swRaw.lng),
          north: Math.max(neRaw.lat, swRaw.lat)
        };
        onViewportChange({
          center: { lat: centerRaw.lat, lng: centerRaw.lng },
          radius,
          zoom: mapRef.current.getZoom?.() ?? 0,
          bounds: boundsPayload
        });
      }, 350);
    };
    mapRef.current.on('zoomend', trigger);
    mapRef.current.on('moveend', trigger);
    trigger();
    return () => {
      if (timer) window.clearTimeout(timer);
      mapRef.current?.off?.('zoomend', trigger);
      mapRef.current?.off?.('moveend', trigger);
    };
  }, [onViewportChange, mapReady]);

  return (
    <>
      {!loadError && !mapReady && (
        <div className="map-chip" style={{ position: 'absolute', top: 20, left: 20 }}>
          地图加载中…
        </div>
      )}
      {!loadError && mapReady && isViewportLoading && (
        <div className="map-chip" style={{ position: 'absolute', top: 20, left: 20 }}>
          点位加载中…
        </div>
      )}
      {loadError && (
        <div className="map-chip" style={{ position: 'absolute', top: 20, left: 20 }}>
          {loadError}
        </div>
      )}
      <div ref={containerRef} className="map-canvas" />
    </>
  );
}
