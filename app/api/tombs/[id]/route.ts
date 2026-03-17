import { NextResponse } from 'next/server';
import { getTombDetail, recordTombSummary } from '../../../../lib/data';
import { fetchRichImages, fetchRichSummary } from '../../../../lib/media';
import { buildImageQueries, buildSummaryQueries, inferPersonFromName } from '../../../../lib/utils';
import { readSegmentParam } from '../../../../lib/nextParams';
import { readUserId } from '../../../../lib/auth';
import { hasDatabase, query } from '../../../../lib/db';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id?: string | string[] }> }
) {
  const resolvedParams = await context.params;
  const tombId = readSegmentParam(resolvedParams?.id);
  if (!tombId) {
    return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
  }

  const detail = await getTombDetail(tombId);
  if (!detail) {
    return NextResponse.json({ error: '未找到' }, { status: 404 });
  }

  const userId = await readUserId();
  let favorited = false;
  let liked = false;
  let checkedIn = false;
  if (userId) {
    if (hasDatabase) {
      const [fav, like, checkin] = await Promise.all([
        query('SELECT 1 FROM public.favorites WHERE tomb_id = $1 AND user_id = $2 LIMIT 1', [tombId, userId]).catch(() => null),
        query('SELECT 1 FROM public.likes WHERE tomb_id = $1 AND user_id = $2 LIMIT 1', [tombId, userId]).catch(() => null),
        query('SELECT 1 FROM public.checkins WHERE tomb_id = $1 AND user_id = $2 LIMIT 1', [tombId, userId]).catch(() => null)
      ]);
      favorited = Boolean(fav?.rowCount);
      liked = Boolean(like?.rowCount);
      checkedIn = Boolean(checkin?.rowCount);
    }
  }

  const inferredPerson = detail.person ?? inferPersonFromName(detail.name);
  const summaryQueries = buildSummaryQueries(detail.name, inferredPerson);
  const summaryQuery = summaryQueries[0] || detail.name || inferredPerson || '';
  const summaryFallbacks = summaryQueries.slice(1);
  const imageQueries = buildImageQueries(detail.name, inferredPerson);
  const imageQuery = imageQueries[0] ?? '';
  const imageFallbacks = imageQueries.slice(1);
  const seedImages = detail.images ?? [];
  const shouldFetchImages = seedImages.length === 0;
  const [images, summary] = await Promise.all([
    shouldFetchImages ? fetchRichImages(imageQuery, imageFallbacks) : Promise.resolve([]),
    fetchRichSummary(summaryQuery, summaryFallbacks, {
      name: detail.name,
      person: detail.person,
      aliases: detail.aliases
    })
  ]);
  recordTombSummary(detail, summary);

  const buildBriefSummary = (text?: string | null) => {
    if (!text) return null;
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    const firstSentence = normalized.split('。')[0]?.trim();
    const base = firstSentence ? `${firstSentence}${normalized.includes('。') ? '。' : ''}` : normalized;
    const chars = Array.from(base);
    if (chars.length <= 80) return base;
    return `${chars.slice(0, 80).join('')}…`;
  };
  const briefSummary = buildBriefSummary(summary?.extract ?? detail.description);

  return NextResponse.json({
    tomb: {
      ...detail,
      description: briefSummary ?? undefined,
      reference: summary ? { title: summary.title, url: summary.url, source: summary.source } : detail.reference,
      images: seedImages.length ? seedImages : images,
      favorited,
      liked,
      checkedIn
    }
  });
}
