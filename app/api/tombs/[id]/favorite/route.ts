import { NextResponse } from 'next/server';
import { hasDatabase, query } from '../../../../../lib/db';
import { readUserId } from '../../../../../lib/auth';
import { readSegmentParam } from '../../../../../lib/nextParams';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ id?: string | string[] }> }
) {
  if (!hasDatabase) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 503 });
  }
  const userId = await readUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const resolvedParams = await context.params;
  const tombId = readSegmentParam(resolvedParams?.id);
  if (!tombId) {
    return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
  }

  const existing = await query('SELECT 1 FROM public.favorites WHERE tomb_id = $1 AND user_id = $2', [tombId, userId]);
  if (existing.rowCount) {
    await query('DELETE FROM public.favorites WHERE tomb_id = $1 AND user_id = $2', [tombId, userId]);
    const count = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.favorites WHERE user_id = $1', [
      userId
    ]);
    return NextResponse.json({ favorited: false, count: Number(count.rows[0]?.count ?? 0) });
  }

  await query('INSERT INTO public.favorites (tomb_id, user_id) VALUES ($1, $2)', [tombId, userId]);
  const count = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.favorites WHERE user_id = $1', [
    userId
  ]);
  return NextResponse.json({ favorited: true, count: Number(count.rows[0]?.count ?? 0) });
}
