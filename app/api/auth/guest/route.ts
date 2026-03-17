import { NextResponse } from 'next/server';
import { createGuestUser, getUserProfile, readUserId } from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const userId = await readUserId();
  if (userId) {
    try {
      const profile = await getUserProfile(userId);
      if (profile) {
        return NextResponse.json({ user: profile });
      }
    } catch {
      return NextResponse.json({ error: '数据库连接失败，请稍后重试' }, { status: 503 });
    }
  }

  try {
    const profile = await createGuestUser();
    return NextResponse.json({ user: profile });
  } catch {
    return NextResponse.json({ error: '数据库连接失败，请稍后重试' }, { status: 503 });
  }
}
