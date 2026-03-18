import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSeedStats, listTombs } from '../../../lib/data';
import type { Tomb } from '../../../lib/types';

export const runtime = 'nodejs';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = querySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const nearParam = parsed.data.near;
  const near = nearParam
    ? (() => {
        const [lat, lng] = nearParam.split(',').map(Number);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return { lat, lng };
      })()
    : null;

  const radius = parsed.data.radius ? Number(parsed.data.radius) : null;
  const limit = parsed.data.limit ? Number(parsed.data.limit) : null;
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

  const tombs = await listTombs(filters, { emptyMode: 'sample' });
  if (!includeStats) {
    return NextResponse.json({ tombs });
  }

  const statsSource = isEmptyQuery({ ...filters, near })
    ? await listTombs(filters, { emptyMode: 'all' })
    : tombs;
  const stats = buildStats(statsSource);
  const statsRaw = isEmptyQuery({ ...filters, near })
    ? getSeedStats(filters, { dedupe: false, includeAll: true })
    : null;

  return NextResponse.json({
    tombs,
    stats,
    statsRaw: statsRaw && statsRaw.total !== stats.total ? statsRaw : null
  });
}
