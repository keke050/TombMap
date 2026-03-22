import type { TombDetail } from './types';

type CachedDetail = {
  ts: number;
  data: TombDetail;
};

const DETAIL_CACHE_TTL = 1000 * 60 * 5;
const detailCache = new Map<string, CachedDetail>();
const inFlightRequests = new Map<string, Promise<TombDetail | null>>();

const cacheKey = (id: string, rich: boolean) => `${rich ? 'rich' : 'base'}:${id}`;

const isFresh = (entry?: CachedDetail | null) => Boolean(entry && Date.now() - entry.ts < DETAIL_CACHE_TTL);

const storeDetail = (id: string, detail: TombDetail, rich: boolean) => {
  detailCache.set(cacheKey(id, rich), { ts: Date.now(), data: detail });
  if (rich) {
    detailCache.set(cacheKey(id, false), { ts: Date.now(), data: detail });
  }
};

export const getCachedTombDetail = (id: string) => {
  const richEntry = detailCache.get(cacheKey(id, true));
  if (richEntry && isFresh(richEntry)) return richEntry.data;

  const baseEntry = detailCache.get(cacheKey(id, false));
  if (baseEntry && isFresh(baseEntry)) return baseEntry.data;

  return null;
};

export const loadTombDetail = async (id: string, options: { rich?: boolean } = {}): Promise<TombDetail | null> => {
  const tombId = id.trim();
  if (!tombId) return null;

  const rich = Boolean(options.rich);
  const cached = detailCache.get(cacheKey(tombId, rich));
  if (cached && isFresh(cached)) return cached.data;

  if (!rich) {
    const richCached = detailCache.get(cacheKey(tombId, true));
    if (richCached && isFresh(richCached)) return richCached.data;
  }

  const key = cacheKey(tombId, rich);
  const inFlight = inFlightRequests.get(key);
  if (inFlight) return inFlight;

  const promise = fetch(`/api/tombs/${encodeURIComponent(tombId)}${rich ? '?rich=1' : ''}`, {
    cache: 'force-cache'
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json().catch(() => null)) as { tomb?: TombDetail } | null;
      const detail = data?.tomb ?? null;
      if (detail) {
        storeDetail(tombId, detail, rich);
      }
      return detail;
    })
    .catch(() => null)
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, promise);
  return promise;
};

export const prefetchTombDetail = (id: string, options: { rich?: boolean } = {}) => {
  void loadTombDetail(id, options);
};
