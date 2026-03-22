import { NextResponse } from 'next/server';
import { hasDatabase, query } from '../../../../../../lib/db';
import { readUserId } from '../../../../../../lib/auth';
import { readSegmentParam } from '../../../../../../lib/nextParams';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id?: string | string[]; commentId?: string | string[] }> }
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
  const commentId = readSegmentParam(resolvedParams?.commentId);
  if (!tombId || !commentId) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  const existing = await query<{ user_id: string }>('SELECT user_id FROM public.comments WHERE id = $1 AND tomb_id = $2', [
    commentId,
    tombId
  ]).catch(() => null);
  const owner = existing?.rows?.[0]?.user_id ?? null;
  if (!owner) {
    return NextResponse.json({ error: '评论不存在' }, { status: 404 });
  }
  if (owner !== userId) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  await query('DELETE FROM public.comments WHERE id = $1 AND tomb_id = $2 AND user_id = $3', [commentId, tombId, userId]);
  return NextResponse.json({ ok: true });
}
