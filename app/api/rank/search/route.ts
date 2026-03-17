import { NextResponse } from 'next/server';
import { listTombSearchRank } from '../../../../lib/data';
import { hasDatabase } from '../../../../lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ tombs: [] });
  }
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') ?? '12');
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, Math.floor(limitParam))) : 12;
  const tombs = await listTombSearchRank({ limit });
  return NextResponse.json({ tombs });
}
