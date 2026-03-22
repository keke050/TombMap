import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readUserId, setAccountPassword } from '../../../../lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  password: z.string().min(8).max(72),
  oldPassword: z.string().min(1).max(72).optional().nullable()
});

export async function PATCH(request: Request) {
  const userId = await readUserId();
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误（密码不合法）' }, { status: 400 });
  }

  try {
    await setAccountPassword(userId, { password: parsed.data.password, oldPassword: parsed.data.oldPassword ?? null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

