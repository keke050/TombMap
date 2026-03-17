import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { hasDatabase, query } from '../../../../../lib/db';
import { readUserId } from '../../../../../lib/auth';
import { readSegmentParam } from '../../../../../lib/nextParams';

export const runtime = 'nodejs';

const schema = z.object({
  content: z.string().min(1).max(280)
});

const clampInt = (value: string | null, fallback: number, options: { min: number; max: number }) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < options.min) return options.min;
  if (rounded > options.max) return options.max;
  return rounded;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id?: string | string[] }> }
) {
  if (!hasDatabase) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 503 });
  }
  const resolvedParams = await context.params;
  const tombId = readSegmentParam(resolvedParams?.id);
  if (!tombId) {
    return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
  }

  const userId = await readUserId();
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get('limit'), 10, { min: 1, max: 50 });
  const page = clampInt(url.searchParams.get('page'), 1, { min: 1, max: 1000 });
  const offset = (page - 1) * limit;

  const totalResult = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.comments WHERE tomb_id = $1', [
    tombId
  ]);
  const total = Number(totalResult.rows[0]?.count ?? 0);
  const comments = await query<{ id: string; content: string; created_at: string; user_label: string; user_id: string }>(
    `SELECT comments.id, comments.content, comments.created_at, comments.user_id, COALESCE(users.display_label, '游客') AS user_label
     FROM public.comments
     LEFT JOIN public.users ON users.id = comments.user_id
     WHERE comments.tomb_id = $1
     ORDER BY comments.created_at DESC, comments.id DESC
     LIMIT $2
     OFFSET $3`,
    [tombId, limit, offset]
  );

  return NextResponse.json({
    comments: comments.rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      userLabel: row.user_label,
      canDelete: Boolean(userId && row.user_id === userId)
    })),
    page,
    limit,
    total,
    hasMore: offset + limit < total
  });
}

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

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '评论内容不合法' }, { status: 400 });
  }

  const id = crypto.randomUUID();

  await query('INSERT INTO public.comments (id, tomb_id, user_id, content) VALUES ($1, $2, $3, $4)', [
    id,
    tombId,
    userId,
    parsed.data.content
  ]);

  return NextResponse.json({ ok: true });
}
