import type { Tomb } from './types';

type TombSourceLabelPayload = Pick<Tomb, 'id' | 'level' | 'source' | 'province' | 'city' | 'county'>;

export const isHeritageListSource = (payload: TombSourceLabelPayload) => {
  const title = payload.source?.title ?? '';
  return title.includes('文物保护单位') || title.includes('文保单位');
};

const isSinorelicSource = (payload: TombSourceLabelPayload) => {
  const title = payload.source?.title ?? '';
  const note = payload.source?.note ?? '';
  return (
    payload.id.startsWith('sinorelic-') ||
    title.includes('华夏古迹图') ||
    note.includes('sinorelic.com')
  );
};

const isHuaxiaTombZhiSource = (payload: TombSourceLabelPayload) => {
  const title = payload.source?.title ?? '';
  return title.includes('华夏古墓志') || title.includes('华夏古墓誌');
};

const extractLastMatch = (value: string, pattern: RegExp) => {
  if (!value) return null;
  const matches = Array.from(value.matchAll(pattern)).map((match) => match[1]).filter(Boolean);
  return matches.length ? matches[matches.length - 1] : null;
};

const extractProvinceFromTitle = (title: string) =>
  extractLastMatch(title, /([\u4e00-\u9fa5]{1,12}(?:省|自治区|特别行政区))/g);

const extractCityFromTitle = (title: string) => extractLastMatch(title, /([\u4e00-\u9fa5]{1,12}市)/g);

const extractCountyFromTitle = (title: string) =>
  extractLastMatch(title, /([\u4e00-\u9fa5]{1,12}(?:区|县|旗|市))/g);

const buildHeritageListLabel = (payload: TombSourceLabelPayload) => {
  const title = payload.source?.title ?? '';

  if (payload.level === 'national' || title.includes('全国重点')) {
    return '全国重点文物保护单位名录';
  }

  if (payload.level === 'provincial') {
    const province = payload.province ?? extractProvinceFromTitle(title);
    return province ? `${province}文物保护单位名录` : '省级文物保护单位名录';
  }

  if (payload.level === 'city') {
    const city = payload.city ?? extractCityFromTitle(title);
    const province = payload.province ?? extractProvinceFromTitle(title);
    if (city) return `${city}文物保护单位名录`;
    if (province) return `${province}市级文物保护单位名录`;
    return '市级文物保护单位名录';
  }

  if (payload.level === 'county') {
    const city = payload.city ?? extractCityFromTitle(title);
    const countyFromTitle = extractCountyFromTitle(title);
    const county =
      payload.county ??
      (countyFromTitle && countyFromTitle !== city ? countyFromTitle : null) ??
      null;
    const province = payload.province ?? extractProvinceFromTitle(title);
    if (county) return `${county}文物保护单位名录`;
    if (city) return `${city}县级文物保护单位名录`;
    if (province) return `${province}县级文物保护单位名录`;
    return '县级文物保护单位名录';
  }

  const province = payload.province ?? extractProvinceFromTitle(title);
  const city = payload.city ?? extractCityFromTitle(title);
  const county = payload.county ?? extractCountyFromTitle(title);
  const token = county || city || province;
  return token ? `${token}文物保护单位名录` : '文物保护单位名录';
};

export const buildTombSourceLabel = (payload: TombSourceLabelPayload) => {
  const title = payload.source?.title ?? '';

  // Display priority:
  // 1) Heritage protection unit lists (authoritative)
  // 2) 华夏古迹图 (when not in heritage lists)
  // 3) 华夏古墓志 (other known datasets)
  // 4) Online fallback (temporary/external)
  if (isHeritageListSource(payload)) return buildHeritageListLabel(payload);
  if (isSinorelicSource(payload)) return '华夏古迹图';
  if (isHuaxiaTombZhiSource(payload)) return '华夏古墓志';
  if (payload.level === 'external') return '联网检索';
  return title || '数据集';
};
