import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserProfile, readUserId, updateUserProfile } from '../../../lib/auth';
import { hasDatabase, query } from '../../../lib/db';

export const runtime = 'nodejs';

const patchSchema = z.object({
  label: z.string().min(1).max(20).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  gender: z.enum(['unknown', 'male', 'female']).optional().nullable(),
  age: z.number().int().min(1).max(120).optional().nullable()
});

const getCounts = async (userId: string) => {
  if (!hasDatabase) {
    return { likes: 0, checkins: 0, comments: 0, favorites: 0 };
  }

  const [likes, checkins, comments, favorites] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.likes WHERE user_id = $1', [userId]).catch(() => null),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.checkins WHERE user_id = $1', [userId]).catch(() => null),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.comments WHERE user_id = $1', [userId]).catch(() => null),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.favorites WHERE user_id = $1', [userId]).catch(() => null)
  ]);

  return {
    likes: Number(likes?.rows?.[0]?.count ?? 0),
    checkins: Number(checkins?.rows?.[0]?.count ?? 0),
    comments: Number(comments?.rows?.[0]?.count ?? 0),
    favorites: Number(favorites?.rows?.[0]?.count ?? 0)
  };
};

export async function GET() {
  if (!hasDatabase) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 503 });
  }
  const userId = await readUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const user = await getUserProfile(userId);
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }
  const counts = await getCounts(userId);
  return NextResponse.json({ user, counts });
}

export async function PATCH(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 503 });
  }
  const userId = await readUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  const next = await updateUserProfile(userId, parsed.data);
  if (!next) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }
  return NextResponse.json({ user: next });
}
