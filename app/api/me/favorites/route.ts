import { NextResponse } from 'next/server';
import { readUserId } from '../../../../lib/auth';
import { hasDatabase, query } from '../../../../lib/db';
import { listTombsByIds } from '../../../../lib/data';

export const runtime = 'nodejs';

export async function GET() {
  if (!hasDatabase) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 503 });
  }
  const userId = await readUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const result = await query<{ tomb_id: string }>(
    'SELECT tomb_id FROM public.favorites WHERE user_id = $1 ORDER BY created_at DESC NULLS LAST LIMIT 200',
    [userId]
  ).catch(() => null);
  const ids = (result?.rows ?? []).map((row) => row.tomb_id).filter(Boolean);

  const tombs = await listTombsByIds(ids);
  return NextResponse.json({ tombs });
}
