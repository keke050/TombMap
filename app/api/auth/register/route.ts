import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readUserId, registerWithPassword } from '../../../../lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72)
});

const isDbUnavailable = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const anyError = error as { code?: unknown; message?: unknown };
  const code = typeof anyError.code === 'string' ? anyError.code : '';
  const message = typeof anyError.message === 'string' ? anyError.message : '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    message.includes('DATABASE_URL is not configured')
  );
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误（邮箱或密码不合法）' }, { status: 400 });
  }

  const userId = await readUserId();
  try {
    const profile = await registerWithPassword({ userId, ...parsed.data });
    return NextResponse.json({ user: profile });
  } catch (error) {
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: '数据库连接失败，请检查 DATABASE_URL 或数据库服务' }, { status: 503 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
