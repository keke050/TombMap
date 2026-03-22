import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserProfile, readUserId, upgradeWithEmail } from '../../../../lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  inviteCode: z.string().min(4)
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const userId = await readUserId();
  if (!userId) {
    return NextResponse.json({ error: '请先以游客进入' }, { status: 401 });
  }

  const existing = await getUserProfile(userId);
  if (!existing) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  try {
    const profile = await upgradeWithEmail(userId, parsed.data.email, parsed.data.inviteCode);
    return NextResponse.json({ user: profile });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
