import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSeedStats, listTombs } from '../../../lib/data';
import type { Tomb } from '../../../lib/types';

export const runtime = 'nodejs';

const ROUTE_CACHE_TTL = 1000 * 60 * 5;
const ROUTE_CACHE_MAX_ENTRIES = 24;

const querySchema = z.object({
  q: z.string().optional(),
  person: z.string().optional(),
  era: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  level: z.string().optional(),
  near: z.string().optional(),
  radius: z.string().optional(),
  limit: z.string().optional(),
  includeExternal: z.string().optional(),
  hasCoords: z.string().optional(),
  stats: z.string().optional()
});

type TombStats = {
  total: number;
  byProvince: [string, number][];
};

type TombListResponse = {
  tombs: Tomb[];
  stats?: TombStats;
  statsRaw?: TombStats | null;
};

const responseCache = new Map<string, { ts: number; payload: TombListResponse }>();

const buildStats = (items: Tomb[]) => {
  const counts = new Map<string, number>();
  items.forEach((tomb) => {
    const name = tomb.province ?? '未知';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  const byProvince = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return { total: items.length, byProvince };
};

const hasValue = (value?: string | null) => Boolean(value && value.trim());

const isEmptyQuery = (payload: {
  q?: string | null;
  person?: string | null;
  era?: string | null;
  province?: string | null;
  city?: string | null;
  county?: string | null;
  level?: string | null;
  near?: { lat: number; lng: number } | null;
}) =>
  !hasValue(payload.q) &&
  !hasValue(payload.person) &&
  !hasValue(payload.era) &&
  !hasValue(payload.province) &&
  !hasValue(payload.city) &&
  !hasValue(payload.county) &&
  !hasValue(payload.level) &&
  !payload.near;

const isFresh = (timestamp: number) => Date.now() - timestamp < ROUTE_CACHE_TTL;

const roundCoord = (value: number) => Math.round(value * 10_000) / 10_000;

const parseNear = (value?: string | null) => {
  if (!value) return { near: null, invalid: false };
  const [latRaw, lngRaw] = value.split(',').map((item) => Number(item.trim()));
  if (!Number.isFinite(latRaw) || !Number.isFinite(lngRaw)) return { near: null, invalid: true };
  if (latRaw < -90 || latRaw > 90 || lngRaw < -180 || lngRaw > 180) return { near: null, invalid: true };
  return { near: { lat: roundCoord(latRaw), lng: roundCoord(lngRaw) }, invalid: false };
};

const clampInt = (value: number, options: { min: number; max: number }) =>
  Math.min(options.max, Math.max(options.min, Math.floor(value)));

const parseLimit = (value?: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return clampInt(parsed, { min: 1, max: 5_000 });
};

const parseRadius = (value?: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return clampInt(parsed, { min: 100, max: 200_000 });
};

const buildCacheHeaders = (options: { emptyQuery: boolean; nearby: boolean; includeStats: boolean }) => {
  const { emptyQuery, nearby, includeStats } = options;
  if (nearby) {
    return {
      'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=1800'
    };
  }
  if (emptyQuery && includeStats) {
    return {
      'Cache-Control': 'public, max-age=120, s-maxage=900, stale-while-revalidate=86400'
    };
  }
  if (emptyQuery) {
    return {
      'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400'
    };
  }
  return {
    'Cache-Control': 'public, max-age=45, s-maxage=240, stale-while-revalidate=3600'
  };
};

const buildCacheKey = (payload: {
  q: string | null;
  person: string | null;
  era: string | null;
  province: string | null;
  city: string | null;
  county: string | null;
  level: string | null;
  near: { lat: number; lng: number } | null;
  radius: number | null;
  limit: number | null;
  includeExternal: boolean;
  hasCoords: boolean;
  includeStats: boolean;
}) => JSON.stringify(payload);

const setCachedPayload = (key: string, payload: TombListResponse) => {
  if (payload.tombs.length > 2_500) return;
  responseCache.set(key, { ts: Date.now(), payload });
  while (responseCache.size > ROUTE_CACHE_MAX_ENTRIES) {
    const firstKey = responseCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    responseCache.delete(firstKey);
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = querySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const parsedNear = parseNear(parsed.data.near);
  if (parsedNear.invalid) {
    return NextResponse.json({ error: 'near 参数错误，应为 lat,lng' }, { status: 400 });
  }
  const near = parsedNear.near;
  const radius = parseRadius(parsed.data.radius);
  const limit = parseLimit(parsed.data.limit);
  const includeExternal = parsed.data.includeExternal === '1';
  const hasCoords = parsed.data.hasCoords === '1';
  const includeStats = parsed.data.stats === '1';

  const filters = {
    q: parsed.data.q ?? null,
    person: parsed.data.person ?? null,
    era: parsed.data.era ?? null,
    province: parsed.data.province ?? null,
    city: parsed.data.city ?? null,
    county: parsed.data.county ?? null,
    level: parsed.data.level ?? null,
    near,
    radius,
    limit,
    includeExternal,
    hasCoords
  };

  const emptyQuery = isEmptyQuery({ ...filters, near });
  const cacheHeaders = buildCacheHeaders({
    emptyQuery,
    nearby: Boolean(near),
    includeStats
  });
  const cacheKey = buildCacheKey({
    ...filters,
    near,
    includeStats
  });
  const cached = responseCache.get(cacheKey);
  if (cached && isFresh(cached.ts)) {
    return NextResponse.json(cached.payload, { headers: cacheHeaders });
  }

  const tombs = await listTombs(filters, { emptyMode: 'sample' });
  if (!includeStats) {
    const payload: TombListResponse = { tombs };
    setCachedPayload(cacheKey, payload);
    return NextResponse.json(payload, { headers: cacheHeaders });
  }

  const statsSource = emptyQuery
    ? await listTombs(filters, { emptyMode: 'all' })
    : tombs;
  const stats = buildStats(statsSource);
  const statsRaw = emptyQuery
    ? getSeedStats(filters, { dedupe: false, includeAll: true })
    : null;

  const payload: TombListResponse = {
    tombs,
    stats,
    statsRaw: statsRaw && statsRaw.total !== stats.total ? statsRaw : null
  };
  setCachedPayload(cacheKey, payload);
  return NextResponse.json(payload, { headers: cacheHeaders });
}
