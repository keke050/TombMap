import { NextResponse } from 'next/server';
import { readUserId } from '../../../../lib/auth';
import { hasDatabase, query } from '../../../../lib/db';
import { listTombsByIds } from '../../../../lib/data';

export const runtime = 'nodejs';

type CommentItem = { tombId: string; content: string; createdAt: string };

export async function GET() {
  if (!hasDatabase) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 503 });
  }
  const userId = await readUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const result = await query<{ tomb_id: string; content: string; created_at: string }>(
    'SELECT tomb_id, content, created_at FROM public.comments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200',
    [userId]
  ).catch(() => null);
  const items: CommentItem[] = (result?.rows ?? [])
    .map((row) => ({ tombId: row.tomb_id, content: row.content, createdAt: row.created_at }))
    .filter((row) => Boolean(row.tombId));

  const tombs = await listTombsByIds(items.map((item) => item.tombId));
  const tombMap = new Map(tombs.map((tomb) => [tomb.id, tomb]));
  const data = items.map((item) => ({ ...item, tomb: tombMap.get(item.tombId) ?? null }));
  return NextResponse.json({ items: data });
}
