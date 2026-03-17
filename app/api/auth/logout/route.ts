import { NextResponse } from 'next/server';
import { clearUserCookie } from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  await clearUserCookie();
  return NextResponse.json({ ok: true });
}

