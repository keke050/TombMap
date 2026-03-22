import { NextResponse } from 'next/server';
import { getTombDetail, listRelatedTombs, recordTombSummary } from '../../../../lib/data';
import { fetchRichImages, fetchRichSummary } from '../../../../lib/media';
import { buildImageQueries, buildSummaryQueries, inferPersonFromName } from '../../../../lib/utils';
import { readSegmentParam } from '../../../../lib/nextParams';
import { readUserId } from '../../../../lib/auth';
import { hasDatabase, query } from '../../../../lib/db';
import type { TombDetail } from '../../../../lib/types';

export const runtime = 'nodejs';

const DETAIL_CACHE_TTL = 1000 * 60 * 2;
const DETAIL_CACHE_MAX_ENTRIES = 120;

type TombDetailPayload = {
  tomb: TombDetail;
};

const detailCache = new Map<string, { ts: number; base?: TombDetailPayload; rich?: TombDetailPayload }>();

const isFresh = (timestamp: number) => Date.now() - timestamp < DETAIL_CACHE_TTL;

const setCachedDetail = (id: string, payload: TombDetailPayload, rich: boolean) => {
  const existing = detailCache.get(id);
  detailCache.set(
    id,
    rich
      ? {
          ts: Date.now(),
          base: existing?.base,
          rich: payload
        }
      : {
          ts: Date.now(),
          base: payload,
          rich: existing?.rich
        }
  );
  while (detailCache.size > DETAIL_CACHE_MAX_ENTRIES) {
    const firstKey = detailCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    detailCache.delete(firstKey);
  }
};

const getCachedDetail = (id: string, rich: boolean) => {
  const cached = detailCache.get(id);
  if (!cached || !isFresh(cached.ts)) return null;
  if (rich) return cached.rich ?? null;
  return cached.rich ?? cached.base ?? null;
};

const buildAnonymousCacheHeaders = () => ({
  'Cache-Control': 'public, max-age=30, s-maxage=180, stale-while-revalidate=1800',
  Vary: 'Cookie'
});

const buildUserCacheHeaders = () => ({
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie'
});

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

const buildRichPayload = async (detail: TombDetail): Promise<TombDetailPayload> => {
  const inferredPerson = detail.person ?? inferPersonFromName(detail.name);
  const summaryQueries = buildSummaryQueries(detail.name, inferredPerson);
  const summaryQuery = summaryQueries[0] || detail.name || inferredPerson || '';
  const summaryFallbacks = summaryQueries.slice(1);
  const imageQueries = buildImageQueries(detail.name, inferredPerson);
  const imageQuery = imageQueries[0] ?? '';
  const imageFallbacks = imageQueries.slice(1);
  const seedImages = detail.images ?? [];
  const shouldFetchImages = seedImages.length === 0;
  const [images, summary, relatedTombs] = await Promise.all([
    shouldFetchImages ? fetchRichImages(imageQuery, imageFallbacks) : Promise.resolve([]),
    fetchRichSummary(summaryQuery, summaryFallbacks, {
      name: detail.name,
      person: detail.person,
      aliases: detail.aliases
    }),
    listRelatedTombs(detail, 6)
  ]);
  recordTombSummary(detail, summary);

  const briefSummary = buildBriefSummary(summary?.extract ?? detail.description);
  return {
    tomb: {
      ...detail,
      description: briefSummary ?? undefined,
      reference: summary ? { title: summary.title, url: summary.url, source: summary.source } : detail.reference,
      images: seedImages.length ? seedImages : images,
      relatedTombs,
      favorited: false,
      liked: false,
      checkedIn: false
    }
  };
};

const buildBasePayload = (detail: TombDetail): TombDetailPayload => ({
  tomb: {
    ...detail,
    relatedTombs: [],
    favorited: false,
    liked: false,
    checkedIn: false
  }
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id?: string | string[] }> }
) {
  const resolvedParams = await context.params;
  const tombId = readSegmentParam(resolvedParams?.id);
  if (!tombId) {
    return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
  }

  const requestUrl = new URL(request.url);
  const rich = requestUrl.searchParams.get('rich') === '1';
  const userId = await readUserId();
  const cachedPublicPayload = getCachedDetail(tombId, rich);

  if (!userId && cachedPublicPayload) {
    return NextResponse.json(cachedPublicPayload, { headers: buildAnonymousCacheHeaders() });
  }

  let payload = cachedPublicPayload;
  if (!payload) {
    const detail = await getTombDetail(tombId);
    if (!detail) {
      return NextResponse.json({ error: '未找到' }, { status: 404 });
    }
    payload = rich ? await buildRichPayload(detail) : buildBasePayload(detail);
    setCachedDetail(tombId, payload, rich);
  }

  if (!userId) {
    return NextResponse.json(payload, { headers: buildAnonymousCacheHeaders() });
  }

  let favorited = false;
  let liked = false;
  let checkedIn = false;
  if (hasDatabase) {
    const statusResult = await query<{ favorited: boolean; liked: boolean; checked_in: boolean }>(
      `SELECT
        EXISTS(SELECT 1 FROM public.favorites WHERE tomb_id = $1 AND user_id = $2) AS favorited,
        EXISTS(SELECT 1 FROM public.likes WHERE tomb_id = $1 AND user_id = $2) AS liked,
        EXISTS(SELECT 1 FROM public.checkins WHERE tomb_id = $1 AND user_id = $2) AS checked_in`,
      [tombId, userId]
    ).catch(() => null);
    favorited = Boolean(statusResult?.rows[0]?.favorited);
    liked = Boolean(statusResult?.rows[0]?.liked);
    checkedIn = Boolean(statusResult?.rows[0]?.checked_in);
  }

  return NextResponse.json(
    {
      tomb: {
        ...payload.tomb,
        favorited,
        liked,
        checkedIn
      }
    },
    { headers: buildUserCacheHeaders() }
  );
}
