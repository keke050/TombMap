import { NextResponse } from 'next/server';
import { readUserId } from '../../../../../lib/auth';
import { readSegmentParam } from '../../../../../lib/nextParams';
import { recordTombSearchHit } from '../../../../../lib/data';
import { hasDatabase } from '../../../../../lib/db';

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

  await recordTombSearchHit(tombId);
  return NextResponse.json({ ok: true });
}
