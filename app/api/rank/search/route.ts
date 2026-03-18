import { NextResponse } from 'next/server';
import { listTombSearchRank } from '../../../../lib/data';
import { hasDatabase } from '../../../../lib/db';

export const runtime = 'nodejs';

const buildCacheHeaders = () => ({
  'Cache-Control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=300'
});

export async function GET(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ tombs: [] }, { headers: buildCacheHeaders() });
  }
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') ?? '10');
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(10, Math.floor(limitParam))) : 10;
  try {
    const tombs = await listTombSearchRank({ limit });
    return NextResponse.json({ tombs }, { headers: buildCacheHeaders() });
  } catch (error) {
    console.error('[rank/search] failed to list rank', error);
    const message =
      process.env.NODE_ENV === 'production'
        ? '排行加载失败'
        : error instanceof Error
          ? error.message
          : '排行加载失败（开发环境错误信息获取失败）';
    return NextResponse.json(
      { tombs: [], error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
