import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const querySchema = z.object({
  includeExternal: z.string().optional(),
  hasCoords: z.string().optional()
});

const buildCacheHeaders = () => ({
  // `s-maxage` for Vercel Edge CDN, `max-age` for browsers.
  'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400'
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = querySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const includeExternal = parsed.data.includeExternal === '1';
  const hasCoords = parsed.data.hasCoords === '1';

  // Keep results consistent with `GET /api/tombs?stats=1` (seed mode):
  // - applies the same seed quality filter + dedupe logic
  // - avoids drifting totals/province keys in UI
  const { getSeedStats } = await import('../../../../lib/data');
  const stats = getSeedStats({ includeExternal, hasCoords });
  return NextResponse.json({ stats }, { headers: buildCacheHeaders() });
}
