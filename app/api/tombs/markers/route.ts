import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listTombs } from '../../../../lib/data';
import type { Tomb } from '../../../../lib/types';

export const runtime = 'nodejs';

type MarkerPoint = {
  id?: string;
  lat: number;
  lng: number;
  name?: string;
  count?: number;
};

const querySchema = z.object({
  limit: z.string().optional(),
  includeExternal: z.string().optional(),
  hasCoords: z.string().optional(),
  bbox: z.string().optional(),
  zoom: z.string().optional(),
  cluster: z.string().optional(),
  withName: z.string().optional()
});

const CACHE_TTL = 1000 * 60 * 30;
const markersCache = new Map<string, { ts: number; tombs: Array<Required<Pick<MarkerPoint, 'id' | 'lat' | 'lng'>> & { name?: string }> }>();

const clampLimit = (value: number, fallback: number) => {
  if (Number.isNaN(value) || value <= 0) return fallback;
  return Math.min(Math.max(1, value), 120_000);
};

const toMarker = (tomb: Tomb): (Required<Pick<MarkerPoint, 'id' | 'lat' | 'lng'>> & { name?: string }) | null => {
  const lat = tomb.lat;
  const lng = tomb.lng;
  if (lat == null || lng == null) return null;
  const name = tomb.name?.trim() || undefined;
  return { id: tomb.id, lat, lng, name };
};

const isFresh = (timestamp: number) => Date.now() - timestamp < CACHE_TTL;

const parseBbox = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split(',').map((token) => Number(token.trim()));
  if (parts.length !== 4) return null;
  const [westRaw, southRaw, eastRaw, northRaw] = parts;
  if ([westRaw, southRaw, eastRaw, northRaw].some((item) => Number.isNaN(item))) return null;
  const west = Math.min(westRaw, eastRaw);
  const east = Math.max(westRaw, eastRaw);
  const south = Math.min(southRaw, northRaw);
  const north = Math.max(southRaw, northRaw);
  if (west < -180 || east > 180 || south < -90 || north > 90) return null;
  if (east - west <= 0 || north - south <= 0) return null;
  return { west, south, east, north };
};

const filterByBbox = <T extends { lat: number; lng: number }>(items: T[], bbox: { west: number; south: number; east: number; north: number }) => {
  const result: T[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.lat >= bbox.south && item.lat <= bbox.north && item.lng >= bbox.west && item.lng <= bbox.east) {
      result.push(item);
    }
  }
  return result;
};

const buildClusters = (
  items: Array<Required<Pick<MarkerPoint, 'id' | 'lat' | 'lng'>> & { name?: string }>,
  bbox: { west: number; south: number; east: number; north: number },
  zoom: number,
  withName: boolean,
  limit: number | null
): MarkerPoint[] => {
  const cols = zoom < 5.5 ? 42 : zoom < 7 ? 55 : zoom < 8.5 ? 70 : 90;
  const rows = zoom < 5.5 ? 28 : zoom < 7 ? 40 : zoom < 8.5 ? 52 : 70;
  const spanLng = Math.max(0.0001, bbox.east - bbox.west);
  const spanLat = Math.max(0.0001, bbox.north - bbox.south);
  const cellLng = spanLng / cols;
  const cellLat = spanLat / rows;

  const buckets = new Map<
    string,
    { count: number; sumLng: number; sumLat: number; id?: string; lng?: number; lat?: number; name?: string }
  >();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const cx = Math.floor((item.lng - bbox.west) / cellLng);
    const cy = Math.floor((item.lat - bbox.south) / cellLat);
    const key = `${cx},${cy}`;
    let entry = buckets.get(key);
    if (!entry) {
      entry = { count: 0, sumLng: 0, sumLat: 0, id: item.id, lng: item.lng, lat: item.lat, name: item.name };
      buckets.set(key, entry);
    }
    entry.count += 1;
    entry.sumLng += item.lng;
    entry.sumLat += item.lat;
  }

  const data: MarkerPoint[] = [];
  buckets.forEach((entry) => {
    const count = entry.count;
    const lng = count ? entry.sumLng / count : entry.lng;
    const lat = count ? entry.sumLat / count : entry.lat;
    if (lng == null || lat == null) return;
    if (count <= 1) {
      data.push({ id: entry.id, lat, lng, name: withName ? entry.name : undefined, count: 1 });
      return;
    }
    data.push({ lat, lng, count });
  });

  data.sort((a, b) => (b.count ?? 1) - (a.count ?? 1));
  return limit ? data.slice(0, limit) : data;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = querySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const limit = parsed.data.limit ? clampLimit(Number(parsed.data.limit), 60_000) : 60_000;
  const includeExternal = parsed.data.includeExternal === '1';
  const hasCoords = parsed.data.hasCoords === '1';
  const withName = parsed.data.withName === '1';
  const bbox = parseBbox(parsed.data.bbox);
  const zoom = parsed.data.zoom ? Number(parsed.data.zoom) : 0;
  const shouldCluster = parsed.data.cluster === '1';

  const cacheKey = JSON.stringify({ limit, includeExternal, hasCoords });
  const cached = markersCache.get(cacheKey);
  if (cached && isFresh(cached.ts)) {
    const filtered = bbox ? filterByBbox(cached.tombs, bbox) : cached.tombs;
    const tombs = shouldCluster && bbox
      ? buildClusters(filtered, bbox, Number.isFinite(zoom) ? zoom : 0, withName, limit)
      : filtered.map((item) => ({ id: item.id, lat: item.lat, lng: item.lng, name: withName ? item.name : undefined }));
    return NextResponse.json({ tombs }, { headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=86400' } });
  }

  const tombs = await listTombs(
    {
      includeExternal,
      hasCoords,
      limit
    },
    { emptyMode: 'all' }
  );

  const markers = tombs.map(toMarker).filter(Boolean) as Array<Required<Pick<MarkerPoint, 'id' | 'lat' | 'lng'>> & { name?: string }>;
  markersCache.set(cacheKey, { ts: Date.now(), tombs: markers });

  const filtered = bbox ? filterByBbox(markers, bbox) : markers;
  const responseTombs = shouldCluster && bbox
    ? buildClusters(filtered, bbox, Number.isFinite(zoom) ? zoom : 0, withName, limit)
    : filtered.map((item) => ({ id: item.id, lat: item.lat, lng: item.lng, name: withName ? item.name : undefined }));

  return NextResponse.json(
    { tombs: responseTombs },
    {
      headers: {
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=86400'
      }
    }
  );
}
