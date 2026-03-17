import { normalizeText } from './utils';

const cache = new Map<string, { ts: number; images: Array<{ url: string; source: string }> }>();
const summaryCache = new Map<
  string,
  { ts: number; summary: { title: string; url: string; extract: string; source: string } | null }
>();
const searchCache = new Map<string, { ts: number; titles: string[] }>();
const baikeCache = new Map<
  string,
  { ts: number; card: { title?: string; url?: string; abstract?: string; desc?: string; image?: string } | null }
>();

const CACHE_TTL = 1000 * 60 * 60 * 12;
const TOMB_QUERY_PATTERN = /(墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟|祠堂|祠)/;
const IMAGE_FETCH_BUDGET_MS = 2500;
const IMAGE_FETCH_PER_QUERY_MS = 1200;
const SUMMARY_FETCH_BUDGET_MS = 2000;
const SUMMARY_FETCH_PER_QUERY_MS = 1200;
const normalizeImageUrl = (url?: string | null) => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^http:\/\//i, 'https://');
};

const safeFetchJson = async <T>(url: string, options?: RequestInit) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  if (timeoutMs <= 0) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
};

type Summary = { title: string; url: string; extract: string; source: string };

const isTombLikeQuery = (value?: string | null) => {
  if (!value) return false;
  return TOMB_QUERY_PATTERN.test(value);
};

const buildQueryTokens = (value?: string | null) => {
  if (!value) return [];
  const parts = value.split(/[\s、,，/]+/g).map((part) => part.trim()).filter(Boolean);
  const tokens = parts
    .map((part) => normalizeText(part))
    .filter((token) => token && token.length >= 2);
  return Array.from(new Set(tokens));
};

const isImageCandidateRelevant = (query: string, title?: string | null, description?: string | null) => {
  if (!title) return false;
  const queryToken = normalizeText(query);
  const titleToken = normalizeText(title);
  if (!queryToken || !titleToken) return false;
  const tombLike = isTombLikeQuery(query);
  const descToken = description ? normalizeText(description) : '';

  if (tombLike) {
    const titleHasTomb = TOMB_QUERY_PATTERN.test(title);
    const descHasTomb = description ? TOMB_QUERY_PATTERN.test(description) : false;
    if (!titleHasTomb && !descHasTomb) return false;
    return (
      titleToken.includes(queryToken) ||
      queryToken.includes(titleToken) ||
      (descToken ? descToken.includes(queryToken) : false)
    );
  }

  const tokens = buildQueryTokens(query);
  if (!tokens.length) return false;
  return tokens.some((token) => titleToken.includes(token) || token.includes(titleToken));
};

const buildSummaryTokens = (
  query: string,
  fallbacks: string[],
  context?: { name?: string | null; person?: string | null; aliases?: string[] | null }
) => {
  const tokens = [
    query,
    ...fallbacks,
    context?.name ?? '',
    context?.person ?? '',
    ...(context?.aliases ?? [])
  ]
    .map((item) => normalizeText(item || ''))
    .filter((item) => item && item.length >= 2);
  return Array.from(new Set(tokens));
};

const isSummaryRelevant = (
  summary: Summary,
  tokens: string[],
  query: string,
  context?: { name?: string | null; person?: string | null; aliases?: string[] | null }
) => {
  if (!tokens.length) return true;
  const haystack = normalizeText(`${summary.title} ${summary.extract}`);
  const titleToken = normalizeText(summary.title);
  const queryToken = normalizeText(query);
  const nameToken = normalizeText(context?.name ?? '');
  const personToken = normalizeText(context?.person ?? '');
  const aliasTokens = (context?.aliases ?? [])
    .map((alias) => normalizeText(alias))
    .filter((token) => token && token.length >= 2);
  const tombLike = isTombLikeQuery(context?.name ?? query);

  if (tombLike) {
    const titleMatchesName =
      nameToken && (titleToken.includes(nameToken) || nameToken.includes(titleToken));
    const titleMatchesPerson =
      personToken && (titleToken.includes(personToken) || personToken.includes(titleToken));
    const titleMatchesAlias = aliasTokens.some(
      (token) => titleToken.includes(token) || token.includes(titleToken)
    );
    if (!titleMatchesName && !titleMatchesPerson && !titleMatchesAlias) {
      return false;
    }
  } else if (personToken) {
    if (!haystack.includes(personToken)) return false;
  }

  return tokens.some((token) => haystack.includes(token)) || (queryToken ? haystack.includes(queryToken) : false);
};

export const fetchWikiImages = async (query: string) => {
  const key = query.trim();
  if (!key) return [];
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.images;

  const url =
    'https://zh.wikipedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: key,
      gsrlimit: '1',
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '700'
    }).toString();

  const data = await safeFetchJson<any>(url, { next: { revalidate: 43200 } });
  if (!data) return [];
  const pages = data?.query?.pages;
  if (!pages) return [];
  const candidates = Object.values(pages) as any[];
  for (const page of candidates) {
    const title = page?.title as string | undefined;
    const thumbnail = page?.thumbnail?.source as string | undefined;
    if (!thumbnail || !title) continue;
    if (!isImageCandidateRelevant(query, title)) continue;
    const images = [{ url: thumbnail, source: '维基百科 / 维基共享' }];
    cache.set(key, { ts: Date.now(), images });
    return images;
  }

  return [];
};

export const fetchWikiSummary = async (query: string) => {
  const key = query.trim();
  if (!key) return null;
  const cached = summaryCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.summary;

  const url =
    'https://zh.wikipedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: key,
      gsrlimit: '1',
      prop: 'extracts|info',
      exintro: '1',
      explaintext: '1',
      inprop: 'url',
      redirects: '1'
    }).toString();

  const data = await safeFetchJson<any>(url, { next: { revalidate: 43200 } });
  if (!data) return null;
  const pages = data?.query?.pages;
  if (!pages) return null;
  const first = Object.values(pages)[0] as any;
  const extract = (first?.extract as string | undefined)?.trim();
  const title = (first?.title as string | undefined)?.trim();
  const fullurl = (first?.fullurl as string | undefined)?.trim();
  if (!extract || !title) return null;

  const summary = {
    title,
    url: fullurl || `https://zh.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    extract,
    source: '维基百科'
  };
  summaryCache.set(key, { ts: Date.now(), summary });
  return summary;
};

const fetchBaikeCard = async (query: string) => {
  const key = query.trim();
  if (!key) return null;
  const cached = baikeCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.card;

  const url =
    'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?' +
    new URLSearchParams({
      scope: '103',
      format: 'json',
      appid: '379020',
      bk_key: key,
      bk_length: '600'
    }).toString();

  const data = await safeFetchJson<any>(url, { next: { revalidate: 43200 } });
  if (!data) return null;
  if (!data || data.errno) {
    baikeCache.set(key, { ts: Date.now(), card: null });
    return null;
  }

  const card = {
    title: typeof data.title === 'string' ? data.title : undefined,
    url: typeof data.url === 'string' ? data.url : undefined,
    abstract: typeof data.abstract === 'string' ? data.abstract : undefined,
    desc: typeof data.desc === 'string' ? data.desc : undefined,
    image: typeof data.image === 'string' ? data.image : undefined
  };
  baikeCache.set(key, { ts: Date.now(), card });
  return card;
};

export const fetchBaikeSummary = async (query: string) => {
  const card = await fetchBaikeCard(query);
  if (!card) return null;
  const extract = (card.abstract || card.desc || '').trim();
  const title = (card.title || query).trim();
  if (!extract || !title) return null;
  const url = card.url ? card.url.replace('http://', 'https://') : `https://baike.baidu.com/item/${encodeURIComponent(title)}`;
  return { title, url, extract, source: '百度百科' };
};

export const fetchBaikeImages = async (query: string) => {
  const card = await fetchBaikeCard(query);
  const image = card?.image?.trim();
  if (!image) return [];
  if (card?.title && !isImageCandidateRelevant(query, card.title)) return [];
  return [{ url: image.replace('http://', 'https://'), source: '百度百科' }];
};

export const fetchWikiSearchTitles = async (query: string, limit = 5) => {
  const key = `${query.trim()}::${limit}`;
  if (!query.trim()) return [];
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.titles;

  const url =
    'https://zh.wikipedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      list: 'search',
      srsearch: query,
      srlimit: String(limit)
    }).toString();

  const data = await safeFetchJson<any>(url, { next: { revalidate: 43200 } });
  if (!data) return [];
  const titles = (data?.query?.search ?? []).map((item: any) => item?.title).filter(Boolean);
  searchCache.set(key, { ts: Date.now(), titles });
  return titles;
};

const dedupeImages = (images: Array<{ url: string; source: string }>) => {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (!image.url) return false;
    const key = image.url.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const fetchCommonsImages = async (query: string) => {
  const key = `commons:${query.trim()}`;
  if (!query.trim()) return [];
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.images;

  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: query,
      gsrlimit: '6',
      gsrnamespace: '6',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '900'
    }).toString();

  const data = await safeFetchJson<any>(url, { next: { revalidate: 43200 } });
  const pages = data?.query?.pages;
  if (!pages) return [];
  const candidates = Object.values(pages) as any[];

  for (const page of candidates) {
    const title = (page?.title as string | undefined)?.replace(/^File:/i, '');
    const info = page?.imageinfo?.[0];
    const thumb = info?.thumburl as string | undefined;
    const original = info?.url as string | undefined;
    const imageUrl = thumb || original;
    if (!imageUrl || !title) continue;
    const desc = info?.extmetadata?.ImageDescription?.value as string | undefined;
    const cleanedDesc = desc ? stripHtml(desc) : undefined;
    if (!isImageCandidateRelevant(query, title, cleanedDesc)) continue;
    const images = [{ url: imageUrl, source: 'Wikimedia Commons' }];
    cache.set(key, { ts: Date.now(), images });
    return images;
  }

  return [];
};

const fetchOpenverseImages = async (query: string) => {
  const key = `openverse:${query.trim()}`;
  if (!query.trim()) return [];
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.images;

  const url =
    'https://api.openverse.org/v1/images?' +
    new URLSearchParams({
      q: query,
      page_size: '8'
    }).toString();

  const data = await safeFetchJson<any>(url, { next: { revalidate: 43200 } });
  const results = (data?.results ?? []) as any[];
  if (!results.length) return [];

  for (const item of results) {
    const title = item?.title as string | undefined;
    const description = item?.description as string | undefined;
    const imageUrl = normalizeImageUrl(
      (item?.thumbnail as string | undefined) || (item?.url as string | undefined)
    );
    if (!imageUrl || !title) continue;
    if (!isImageCandidateRelevant(query, title, description)) continue;
    const sourceLabel = item?.source ? `Openverse · ${item.source}` : 'Openverse';
    const images = [{ url: imageUrl, source: sourceLabel }];
    cache.set(key, { ts: Date.now(), images });
    return images;
  }

  return [];
};

const fetchBaiduSerpApiImages = async (query: string) => {
  const key = `serpapi:baidu:${query.trim()}`;
  if (!query.trim()) return [];
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.images;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  const url =
    'https://serpapi.com/search?' +
    new URLSearchParams({
      engine: 'baidu',
      q: query,
      api_key: apiKey,
      output: 'json'
    }).toString();

  const data = await safeFetchJson<any>(url, { next: { revalidate: 43200 } });
  const organic = (data?.organic_results ?? []) as any[];
  if (!organic.length) return [];

  for (const item of organic) {
    const title = item?.title as string | undefined;
    const description = item?.snippet as string | undefined;
    const imageUrl = normalizeImageUrl(
      (item?.image as string | undefined) || (item?.thumbnail as string | undefined)
    );
    if (!imageUrl || !title) continue;
    if (!isImageCandidateRelevant(query, title, description)) continue;
    const images = [{ url: imageUrl, source: '百度搜索（SerpApi）' }];
    cache.set(key, { ts: Date.now(), images });
    return images;
  }

  return [];
};

const fetchImagesFromSources = async (query: string) => {
  const wiki = await fetchWikiImages(query);
  if (wiki.length) return dedupeImages(wiki);
  const commons = await fetchCommonsImages(query);
  if (commons.length) return dedupeImages(commons);
  const baike = await fetchBaikeImages(query);
  if (baike.length) return dedupeImages(baike);
  const openverse = await fetchOpenverseImages(query);
  if (openverse.length) return dedupeImages(openverse);
  const baiduSerp = await fetchBaiduSerpApiImages(query);
  return dedupeImages(baiduSerp);
};

export const fetchRichImages = async (query: string, fallbacks: string[] = []) => {
  const queries = [query, ...fallbacks].filter((item) => item && item.trim());
  if (!queries.length) return [];
  const start = Date.now();
  for (const candidate of queries) {
    const remaining = IMAGE_FETCH_BUDGET_MS - (Date.now() - start);
    if (remaining <= 0) break;
    const result = await withTimeout(
      fetchImagesFromSources(candidate),
      Math.min(IMAGE_FETCH_PER_QUERY_MS, remaining)
    );
    if (result && result.length) return result;
  }
  return [];
};

export const fetchRichSummary = async (
  query: string,
  fallbacks: string[] = [],
  context?: { name?: string | null; person?: string | null; aliases?: string[] | null }
) => {
  const queries = [query, ...fallbacks].filter((item) => item && item.trim());
  const start = Date.now();
  for (const candidate of queries) {
    const remaining = SUMMARY_FETCH_BUDGET_MS - (Date.now() - start);
    if (remaining <= 0) break;
    const result = await withTimeout(
      (async () => (await fetchBaikeSummary(candidate)) || (await fetchWikiSummary(candidate)))(),
      Math.min(SUMMARY_FETCH_PER_QUERY_MS, remaining)
    );
    if (result) {
      const tokens = buildSummaryTokens(candidate, fallbacks, context);
      if (isSummaryRelevant(result, tokens, candidate, context)) {
        return result;
      }
    }
  }
  return null;
};
