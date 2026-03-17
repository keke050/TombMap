export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•・。.,，、()（）[\]【】]/g, '');

export const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
};

const SPECIFIC_ADDRESS_TOKENS = [
  '路',
  '街',
  '巷',
  '镇',
  '乡',
  '村',
  '号',
  '弄',
  '段',
  '山',
  '寺',
  '园',
  '景区',
  '公园'
];

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const isEffectivelyRoundedTo = (value: number, decimals: number) =>
  Math.abs(value - roundTo(value, decimals)) < 1e-10;

export const addressSeemsSpecific = (input: {
  address?: string | null;
  province?: string | null;
  city?: string | null;
  county?: string | null;
}) => {
  const address = (input.address ?? '').trim();
  if (!address) return false;
  if (address.length >= 10) return true;
  if (SPECIFIC_ADDRESS_TOKENS.some((token) => address.includes(token))) return true;
  if (/\d/.test(address)) return true;

  // 太短、且看起来只是“省市区”组合时，避免落到城市中心点
  const province = (input.province ?? '').trim();
  const city = (input.city ?? '').trim();
  const county = (input.county ?? '').trim();
  const merged = [province, city, county].filter(Boolean).join('');
  if (merged && address.includes(merged) && address.length <= merged.length + 2) {
    return false;
  }

  return address.length >= 6;
};

export const coordsSeemPrecise = (input: { lat?: number | null; lng?: number | null }) => {
  const lat = input.lat;
  const lng = input.lng;
  if (lat == null || lng == null) return false;
  // 如果经纬度看起来被四舍五入到 0.001（约百米级），视为不够精确。
  if (isEffectivelyRoundedTo(lat, 3) || isEffectivelyRoundedTo(lng, 3)) return false;
  return true;
};

export const hasPreciseCoords = (input: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  province?: string | null;
  city?: string | null;
  county?: string | null;
}) => coordsSeemPrecise(input) && addressSeemsSpecific(input);

export const pickLabel = (email?: string | null) => {
  if (!email) return '游客';
  const [name] = email.split('@');
  return name.length > 8 ? `${name.slice(0, 6)}…` : name;
};

export const inferPersonFromName = (name?: string | null) => {
  if (!name) return null;
  const cleaned = name
    .replace(/（.*?）/g, '')
    .replace(/[()（）].*?[()（）]/g, '')
    .replace(/(包括|含|以及|及其|等)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const primary = cleaned.split(/[、,，/与及和]/)[0]?.trim();
  if (!primary) return null;
  const match = primary.match(/^(.{1,8}?)(?:墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟|祠堂|祠)$/);
  if (!match) return null;
  const person = match[1].trim();
  if (!person) return null;
  if (person.length < 2) return null;
  if (person.length > 6) return null;
  // Filter out generic/anonymous or numbered tomb labels (e.g. “2号墓”, “103号无名冢”, “2M10号墓”). These are not person names.
  if (/[0-9]/.test(person)) return null;
  if (/[一二三四五六七八九十百千两〇零甲乙丙丁戊己庚辛壬癸]+号/.test(person)) return null;
  if (/(无名|不详|未知)/.test(person)) return null;
  return person;
};

export const extractPersonHintsFromName = (name?: string | null) => {
  if (!name) return [];
  const chunks = Array.from(name.matchAll(/[（(]([^()（）]+)[)）]/g))
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  if (!chunks.length) return [];
  const hints = new Set<string>();
  chunks.forEach((chunk) => {
    const cleaned = chunk
      .replace(/(包括|含|以及|及其|等)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    Array.from(
      cleaned.matchAll(
        /([\u4e00-\u9fa5]{2,6})(?:墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟)/g
      )
    )
      .map((match) => match[1])
      .filter(Boolean)
      .forEach((candidate) => {
        if (candidate.endsWith('氏')) return;
        hints.add(candidate);
      });
  });
  return Array.from(hints);
};

export const buildSummaryQueries = (name?: string | null, person?: string | null) => {
  const inferred = person ?? inferPersonFromName(name);
  const extraTerms: string[] = [];
  if (name) {
    const matches = Array.from(name.matchAll(/[（(]([^()（）]+)[)）]/g)).map((m) => m[1]);
    matches.forEach((chunk) => {
      const cleaned = chunk
        .replace(/(包括|含|以及|等)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      cleaned
        .split(/[、,，/与及和]/g)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => extraTerms.push(item));
    });
  }
  const candidates = [
    name?.trim(),
    inferred?.trim(),
    ...extraTerms,
    inferred ? `${inferred} ${name ?? ''}`.trim() : null,
    inferred ? `${inferred} 墓` : null,
    inferred ? `${inferred} 陵` : null,
    inferred ? `${inferred} 冢` : null,
    inferred ? `${inferred} 陵墓` : null,
    inferred ? `${inferred} 墓地` : null,
    inferred ? `${inferred} 祠` : null,
    inferred ? `${inferred} 祠堂` : null
  ].filter(Boolean) as string[];
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = item.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildImageQueries = (name?: string | null, person?: string | null) => {
  const inferred = person ?? inferPersonFromName(name);
  const candidates: Array<string | null> = [];
  const push = (value?: string | null) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    candidates.push(trimmed);
  };

  if (name) {
    push(name);
  }

  if (inferred) {
    push(`${inferred} 陵墓`);
    push(`${inferred} 墓`);
    push(`${inferred} 陵`);
    push(`${inferred} 陵寝`);
    push(`${inferred} 冢`);
    push(`${inferred} 墓地`);
    push(inferred);
  }

  const normalized = candidates.filter(Boolean) as string[];
  const seen = new Set<string>();
  return normalized.filter((item) => {
    const key = item.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
