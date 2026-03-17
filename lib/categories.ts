import type { Tomb } from './types';
import { inferPersonFromName } from './utils';

export type CategorySlug = 'imperial' | 'generals' | 'ministers' | 'literati' | 'women' | 'martyrs';

export type CategoryConfig = {
  slug: CategorySlug;
  label: string;
  summary: string;
  feature: string;
  featureHighlight?: string;
};

export const CATEGORY_GROUPS: CategoryConfig[] = [
  {
    slug: 'imperial',
    label: '帝王陵寝',
    summary: '涵盖历代帝王、皇后及追封皇帝的陵墓。',
    feature: '规模宏大，建筑规制严苛，通常位于风水绝佳的山川之间，是地图上的“核心地标”。'
  },
  {
    slug: 'generals',
    label: '勋臣名将',
    summary: '涵盖开国元勋、镇国将军以及历代封侯拜相者，武将。',
    feature: '墓葬常配有石甲、石马等武将石刻，体现“披坚执锐、护卫江山”的威武之气。'
  },
  {
    slug: 'ministers',
    label: '贤相良臣',
    summary: '涵盖历代名相、谏官及在地方治绩显赫的文官。',
    feature: '墓址多与其祖籍或治地相关，常有记功碑林，承载着儒家“治国平天下”的抱负。'
  },
  {
    slug: 'literati',
    label: '文人雅士',
    summary: '涵盖著名诗人、文学家、思想家及书画大家。',
    feature: '墓葬往往小巧幽静，多依山傍水，是后世学子登临凭吊、吟诗唱和的灵感圣地。'
  },
  {
    slug: 'women',
    label: '巾帼芳魂',
    summary: '涵盖历史上有名的才女、侠女、和亲公主或传奇女性。',
    feature: '相比帝王将相的厚重，此类墓葬常带有一种凄美或温婉的文学色彩，文化价值极高。'
  },
  {
    slug: 'martyrs',
    label: '峥嵘烈骨',
    summary: '涵盖从近代鸦片战争起，直至新中国建立前，所有为民族独立与人民解放牺牲的先烈。',
    feature: '相比古代墓葬的“幽静”，此类墓园多为近代陵园风格，常伴有纪念碑与红星元素，象征着',
    featureHighlight: '“浩气长存、热血报国”。'
  }
];

export const CATEGORY_LINKS = CATEGORY_GROUPS.map(({ slug, label }) => ({ slug, label }));

export const getCategoryBySlug = (slug: string) => CATEGORY_GROUPS.find((item) => item.slug === slug);

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, '');
const normalizeKeyText = (value?: string | null) =>
  value
    ? normalizeText(value).replace(/[·•・。.,，、()（）[\]【】]/g, '')
    : '';

const TOMB_KEYWORD_PATTERN = /(墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟|祠堂|祠)/;
const TOMB_SUFFIX_PATTERN = /(墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟|祠堂|祠)$/;
const ADMIN_SUFFIX_PATTERN = /(特别行政区|自治区|自治州|自治县|地区|盟|州|市|县|区|旗)$/;

const getPersonName = (tomb: Tomb) => {
  const person = tomb.person?.trim();
  if (person) return person;
  return inferPersonFromName(tomb.name)?.trim() ?? '';
};

const hasTombKeyword = (tomb: Tomb) =>
  TOMB_KEYWORD_PATTERN.test(tomb.name ?? '') || TOMB_KEYWORD_PATTERN.test(tomb.category ?? '');

const hasPersonAndTombKeyword = (tomb: Tomb) => Boolean(getPersonName(tomb)) && hasTombKeyword(tomb);

const hasLikelyIndividualPersonTomb = (tomb: Tomb) => {
  const personName = getPersonName(tomb);
  if (!personName) return false;
  const name = tomb.name?.trim() ?? '';
  if (!name) return false;
  if (/(墓葬群|墓群|墓地)$/.test(name)) return false;
  return /(陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟|祠堂|祠)$/.test(name);
};

const normalizeNameForHeuristics = (value: string) =>
  value
    .replace(/（.*?）/g, '')
    .replace(/[()（）].*?[()（）]/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, '')
    .trim();

const ANONYMOUS_TOMB_HINT_PATTERN = /(无名|不详|未知|佚名)/;
const NUMBERED_LABEL_PATTERN =
  /(?:[A-Za-z]?\d+[A-Za-z]?\d*|[一二三四五六七八九十百千两〇零甲乙丙丁戊己庚辛壬癸]+)(?:[-—–~至]\s*(?:\d+|[一二三四五六七八九十百千两〇零]+))?号/;
const NUMBERED_TOMB_ENDING_PATTERN = /(墓葬群|墓群|墓区|墓地|墓葬|墓|冢|坟|陵园|陵寝|陵墓|陵)$/;

const isAnonymousOrNumberedTomb = (tomb: Tomb) => {
  const name = normalizeNameForHeuristics(tomb.name ?? '');
  if (!name) return false;

  if (ANONYMOUS_TOMB_HINT_PATTERN.test(name)) return true;
  if (!NUMBERED_LABEL_PATTERN.test(name)) return false;

  // Only filter out if it's actually a tomb-like label.
  return NUMBERED_TOMB_ENDING_PATTERN.test(name);
};

export const buildSearchText = (tomb: Tomb) =>
  [
    tomb.name,
    tomb.person,
    tomb.aliases?.join(' '),
    tomb.category,
    tomb.era,
    tomb.address,
    tomb.province,
    tomb.city,
    tomb.county
  ]
    .filter(Boolean)
    .join(' ');

export const isDisplayableTomb = (tomb: Tomb) => {
  const name = tomb.name?.trim() ?? '';
  if (!name) return false;
  if (/^(?:\.|@|{|})/.test(name)) return false;
  if (/mw-parser-output|hlist|navbox|font-size|padding-|margin-|display:|@media|border-|background|content:|skin-/i.test(name)) {
    return false;
  }
  const hasChinese = /[\u4e00-\u9fa5]/.test(name);
  if (name.length > 80 && !hasChinese) return false;
  return true;
};

export const matchesSearch = (tomb: Tomb, query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const text = normalizeText(buildSearchText(tomb));
  const tokens = trimmed
    .split(/\s+/)
    .map((token) => normalizeText(token))
    .filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((token) => text.includes(token));
};

const includesAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(normalizeText(keyword)));

const imperialKeywords = [
  '皇帝',
  '帝王',
  '皇后',
  '皇太后',
  '太后',
  '皇妃',
  '贵妃',
  '皇贵妃',
  '皇陵',
  '帝陵',
  '皇室',
  '宗室',
  '皇亲',
  '太子',
  '皇子'
];

const nonImperialPersonKeywords = [
  '将军',
  '元帅',
  '大将',
  '上将',
  '中将',
  '少将',
  '都督',
  '武侯',
  '武将',
  '节度使',
  '总兵',
  '提督',
  '都统',
  '统帅',
  '镇国',
  '护国',
  '开国元勋',
  '开国功臣',
  '勋臣',
  '丞相',
  '宰相',
  '相国',
  '尚书',
  '侍郎',
  '御史',
  '谏官',
  '参政',
  '参知',
  '太师',
  '太傅',
  '太尉',
  '首辅',
  '阁老',
  '刺史',
  '巡抚',
  '总督',
  '知府',
  '知州',
  '布政使',
  '按察使',
  '诗人',
  '词人',
  '文学家',
  '思想家',
  '书法家',
  '画家',
  '学者',
  '名士',
  '先生',
  '烈士',
  '英烈',
  '革命',
  '志士',
  '殉国'
];

const ROYAL_WANG_EPITHET_CHARS =
  '恭惠庄靖康安宣昭端定宪悼怀襄顺简景武文成敬烈肃毅思哲敏献元孝懿荣永德圣穆';

const ROYAL_WANG_PREFIX_TOKENS = [
  '亲王',
  '郡王',
  '藩王',
  '嗣王',
  '国王',
  '女王',
  '王后',
  '王妃',
  '楚',
  '汉',
  '赵',
  '魏',
  '韩',
  '燕',
  '秦',
  '齐',
  '鲁',
  '梁',
  '晋',
  '宋',
  '吴',
  '越',
  '蜀',
  '闽',
  '周',
  '唐',
  '隋',
  '夏',
  '商',
  '辽',
  '金',
  '元',
  '明',
  '清',
  '北魏',
  '东瓯',
  '南越',
  '苏禄',
  '鱼凫',
  '柏灌',
  '高句丽',
  '纣',
  '汤'
];

const ROYAL_WANG_FOREIGN_NAME_CHARS = '奴斯孜买提汗什甫曼萨';

const ROYAL_WANG_TOMB_SUFFIX_PATTERN = /(墓群|墓区|墓地|墓葬|墓|陵园|陵寝|陵墓|陵|冢|坟)/;

const looksLikeRoyalWangTitle = (title: string) => {
  const trimmed = title.replace(/\s+/g, '');
  if (!trimmed || !trimmed.endsWith('王')) return false;
  if (/(宾王|野王)$/.test(trimmed)) return false;

  const normalized = normalizeText(trimmed);
  if (includesAny(normalized, ROYAL_WANG_PREFIX_TOKENS)) return true;

  const lastIndex = trimmed.lastIndexOf('王');
  if (lastIndex > 0) {
    const prevChar = trimmed[lastIndex - 1];
    if (ROYAL_WANG_EPITHET_CHARS.includes(prevChar)) return true;
    const prefix = trimmed.slice(0, lastIndex);
    if (/[0-9一二三四五六七八九十百千两]$/.test(prefix)) return true;
  }

  if (new RegExp(`[${ROYAL_WANG_FOREIGN_NAME_CHARS}]`).test(trimmed)) return true;

  return trimmed.length >= 3;
};

const looksLikeRoyalWangTombName = (name: string) => {
  if (!name) return false;
  if (!ROYAL_WANG_TOMB_SUFFIX_PATTERN.test(name)) return false;

  const explicitRoyal = /(亲王|郡王|藩王|嗣王|国王|女王|王后|王妃)(?:墓群|墓区|墓地|墓葬|墓|陵园|陵寝|陵墓|陵|冢|坟)/;
  if (explicitRoyal.test(name)) return true;

  const matches = name.matchAll(/([\u4e00-\u9fa5]{1,15}?王)(?:墓群|墓区|墓地|墓葬|墓|陵园|陵寝|陵墓|陵|冢|坟)/g);
  for (const match of matches) {
    const title = match[1];
    if (looksLikeRoyalWangTitle(title)) return true;
  }
  return false;
};

const isImperial = (tomb: Tomb) => {
  const text = normalizeText(buildSearchText(tomb));
  const person = tomb.person?.trim() ?? '';
  const name = tomb.name ?? '';
  if (person && /帝$/.test(person)) return true;
  if (person && /皇后|皇太后|太后|皇妃|贵妃|皇贵妃/.test(person)) return true;
  if (/皇陵|帝陵|皇后陵|太后陵|皇太后陵|帝王陵|皇帝陵/.test(name)) return true;
  if (includesAny(text, imperialKeywords)) return true;
  if (looksLikeRoyalWangTombName(name)) return true;
  const hasLing = name.includes('陵');
  if (!hasLing) return false;
  if (includesAny(text, ['烈士', '英烈', '革命', '陵园', '纪念碑'])) return false;
  if (person && !includesAny(normalizeText(person), imperialKeywords) && includesAny(normalizeText(person), nonImperialPersonKeywords)) {
    return false;
  }
  return true;
};

const isMartyr = (tomb: Tomb) => {
  const text = normalizeText(buildSearchText(tomb));
  const era = tomb.era ?? '';
  const category = tomb.category ?? '';
  if (/新中国|中华人民共和国|建国后/.test(era)) return false;
  if (/新中国|中华人民共和国|建国后/.test(category)) return false;
  return (
    includesAny(text, [
      '烈士',
      '英烈',
      '革命',
      '抗日',
      '抗战',
      '抗倭',
      '起义',
      '红军',
      '八路军',
      '新四军',
      '义勇军',
      '解放战争',
      '北伐',
      '辛亥',
      '鸦片战争',
      '殉国',
      '殉难',
      '烈士陵园',
      '纪念碑'
    ]) ||
    includesAny(era, ['近代', '近现代', '民国', '清末', '辛亥', '抗日', '抗战', '解放战争']) ||
    includesAny(category, ['近现代', '革命', '烈士', '纪念'])
  );
};

const isWomen = (tomb: Tomb) => {
  const text = normalizeText(buildSearchText(tomb));
  return includesAny(text, [
    '夫人',
    '公主',
    '王妃',
    '妃',
    '皇后',
    '皇太后',
    '太后',
    '贵妃',
    '皇贵妃',
    '才女',
    '侠女',
    '女史',
    '女诗人',
    '女文学家',
    '女画家',
    '巾帼',
    '烈女'
  ]);
};

const isGeneral = (tomb: Tomb) => {
  const text = normalizeText(buildSearchText(tomb));
  return includesAny(text, [
    '将军',
    '元帅',
    '大将',
    '上将',
    '中将',
    '少将',
    '都督',
    '武侯',
    '武将',
    '节度使',
    '总兵',
    '提督',
    '都统',
    '统帅',
    '镇国',
    '护国',
    '骠骑',
    '车骑',
    '卫将军',
    '开国元勋',
    '开国功臣',
    '勋臣'
  ]);
};

const isMinister = (tomb: Tomb) => {
  const text = normalizeText(buildSearchText(tomb));
  return includesAny(text, [
    '丞相',
    '宰相',
    '相国',
    '尚书',
    '侍郎',
    '御史',
    '谏官',
    '谏议',
    '参政',
    '参知',
    '太师',
    '太傅',
    '太尉',
    '首辅',
    '阁老',
    '刺史',
    '巡抚',
    '总督',
    '知府',
    '知州',
    '布政使',
    '按察使',
    '贤臣',
    '名相'
  ]);
};

const isLiterati = (tomb: Tomb) => {
  if (!hasPersonAndTombKeyword(tomb)) return false;
  const text = normalizeText(buildSearchText(tomb));
  return includesAny(text, [
    '诗人',
    '词人',
    '文学家',
    '思想家',
    '哲学家',
    '文人',
    '名士',
    '学者',
    '学家',
    '史学',
    '教育家',
    '作家',
    '文豪',
    '诗圣',
    '诗仙',
    '诗鬼',
    '诗佛',
    '词宗',
    '词圣',
    '国学',
    '儒学',
    '大师',
    '国画',
    '书法家',
    '画家',
    '书画',
    '大儒',
    '先生'
  ]);
};

export const inferCategorySlug = (tomb: Tomb): CategorySlug | null => {
  if (!isDisplayableTomb(tomb)) return null;
  if (isAnonymousOrNumberedTomb(tomb)) return null;
  if (isMartyr(tomb)) return 'martyrs';
  if (isImperial(tomb)) return 'imperial';
  if (isWomen(tomb)) return 'women';
  if (isGeneral(tomb)) return 'generals';
  if (isMinister(tomb)) return 'ministers';
  if (isLiterati(tomb)) return 'literati';
  if (hasLikelyIndividualPersonTomb(tomb)) return 'literati';
  return null;
};

export const matchesCategory = (tomb: Tomb, slug: CategorySlug) => inferCategorySlug(tomb) === slug;

const levelRank: Record<string, number> = {
  national: 0,
  provincial: 1,
  city: 2,
  county: 3,
  external: 4
};

export const sortTombsByLevel = (items: Tomb[]) =>
  [...items].sort((a, b) => {
    const rankA = levelRank[a.level] ?? 9;
    const rankB = levelRank[b.level] ?? 9;
    if (rankA !== rankB) return rankA - rankB;
    return (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans-CN');
  });

const primaryNameSegment = (name?: string | null) => {
  if (!name) return null;
  return (
    name
      .replace(/（.*?）/g, '')
      .replace(/[()（）].*?[()（）]/g, '')
      .replace(/(包括|含|以及|及其|等)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/[、,，/与及和]/)[0]
      ?.trim() || null
  );
};

const stripTombSuffix = (name?: string | null) => {
  if (!name) return null;
  const segment = primaryNameSegment(name);
  if (!segment) return null;
  const stripped = segment.replace(TOMB_SUFFIX_PATTERN, '');
  return stripped || segment;
};

const stripAdminSuffix = (token: string) => token.replace(ADMIN_SUFFIX_PATTERN, '');

const normalizeAdminToken = (value?: string | null) => {
  if (!value) return '';
  const token = normalizeKeyText(value);
  if (!token) return '';
  return stripAdminSuffix(token);
};

const buildLocationInfo = (tomb: Tomb) => {
  const provinceKey = normalizeAdminToken(tomb.province);
  const cityKey = normalizeAdminToken(tomb.city);
  const countyKey = normalizeAdminToken(tomb.county);
  if (countyKey) {
    return {
      provinceKey,
      cityKey,
      countyKey,
      key: [provinceKey, cityKey, countyKey].filter(Boolean).join('|'),
      specificity: 'county' as const
    };
  }
  if (cityKey) {
    return {
      provinceKey,
      cityKey,
      countyKey: '',
      key: [provinceKey, cityKey].filter(Boolean).join('|'),
      specificity: 'city' as const
    };
  }
  return {
    provinceKey,
    cityKey: '',
    countyKey: '',
    key: provinceKey,
    specificity: 'province' as const
  };
};

const tombScore = (tomb: Tomb) =>
  (tomb.lat != null ? 1 : 0) +
  (tomb.lng != null ? 1 : 0) +
  (tomb.address ? 1 : 0) +
  (tomb.county ? 1 : 0) +
  (tomb.city ? 1 : 0) +
  (tomb.era ? 1 : 0) +
  (tomb.person ? 1 : 0);

const mergeListTomb = (primary: Tomb, secondary: Tomb): Tomb => ({
  id: primary.id,
  name: primary.name,
  person: primary.person ?? secondary.person,
  aliases: primary.aliases ?? secondary.aliases,
  level: primary.level,
  category: primary.category ?? secondary.category,
  era: primary.era ?? secondary.era,
  province: primary.province ?? secondary.province,
  city: primary.city ?? secondary.city,
  county: primary.county ?? secondary.county,
  address: primary.address ?? secondary.address,
  lat: primary.lat ?? secondary.lat,
  lng: primary.lng ?? secondary.lng,
  source: primary.source ?? secondary.source
});

export const dedupeCategoryTombs = (items: Tomb[]) => {
  const groups = new Map<string, Tomb[]>();

  items.forEach((tomb) => {
    const personName = getPersonName(tomb);
    const personToken = normalizeKeyText(stripTombSuffix(personName) ?? personName);
    const strippedName = normalizeKeyText(stripTombSuffix(tomb.name) ?? tomb.name);
    const identity = personToken || strippedName || normalizeKeyText(tomb.name);
    const locationKey = buildLocationInfo(tomb).key;
    const key = `${identity}|${locationKey}`;
    const group = groups.get(key);
    if (group) {
      group.push(tomb);
    } else {
      groups.set(key, [tomb]);
    }
  });

  const merged: Tomb[] = [];
  groups.forEach((group) => {
    if (group.length === 1) {
      merged.push(group[0]);
      return;
    }
    const primary = group.reduce((best, item) => (tombScore(item) > tombScore(best) ? item : best));
    const mergedItem = group.reduce(
      (acc, item) => (item === primary ? acc : mergeListTomb(acc, item)),
      primary
    );
    merged.push(mergedItem);
  });

  const byIdentityProvince = new Map<string, Array<{ tomb: Tomb; identity: string; loc: ReturnType<typeof buildLocationInfo> }>>();

  merged.forEach((tomb) => {
    const personName = getPersonName(tomb);
    const personToken = normalizeKeyText(stripTombSuffix(personName) ?? personName);
    const strippedName = normalizeKeyText(stripTombSuffix(tomb.name) ?? tomb.name);
    const identity = personToken || strippedName || normalizeKeyText(tomb.name);
    const loc = buildLocationInfo(tomb);
    const key = `${identity}|${loc.provinceKey}`;
    const bucket = byIdentityProvince.get(key);
    if (bucket) {
      bucket.push({ tomb, identity, loc });
    } else {
      byIdentityProvince.set(key, [{ tomb, identity, loc }]);
    }
  });

  const final: Tomb[] = [];

  byIdentityProvince.forEach((entries) => {
    if (entries.length === 1) {
      final.push(entries[0].tomb);
      return;
    }

    const working = entries.map((entry) => ({ ...entry }));
    const removed = new Set<number>();

    const mergeInto = (targetIdx: number, sourceIdx: number) => {
      const target = working[targetIdx];
      const source = working[sourceIdx];
      const primary = tombScore(target.tomb) >= tombScore(source.tomb) ? target.tomb : source.tomb;
      const secondary = primary === target.tomb ? source.tomb : target.tomb;
      const mergedItem = mergeListTomb(primary, secondary);
      working[targetIdx] = {
        tomb: mergedItem,
        identity: target.identity,
        loc: buildLocationInfo(mergedItem)
      };
      removed.add(sourceIdx);
    };

    const countyByCity = new Map<string, number[]>();
    working.forEach((entry, idx) => {
      if (entry.loc.specificity !== 'county') return;
      const cityKey = entry.loc.cityKey;
      const list = countyByCity.get(cityKey) ?? [];
      list.push(idx);
      countyByCity.set(cityKey, list);
    });

    working.forEach((entry, idx) => {
      if (removed.has(idx)) return;
      if (entry.loc.specificity !== 'city') return;
      const matches = countyByCity.get(entry.loc.cityKey) ?? [];
      if (matches.length !== 1) return;
      const targetIdx = matches[0];
      if (removed.has(targetIdx)) return;
      mergeInto(targetIdx, idx);
    });

    const specificIndices = working
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry, idx }) => !removed.has(idx) && entry.loc.specificity !== 'province');

    working.forEach((entry, idx) => {
      if (removed.has(idx)) return;
      if (entry.loc.specificity !== 'province') return;
      if (specificIndices.length !== 1) return;
      const targetIdx = specificIndices[0].idx;
      if (removed.has(targetIdx)) return;
      mergeInto(targetIdx, idx);
    });

    working.forEach((entry, idx) => {
      if (!removed.has(idx)) final.push(entry.tomb);
    });
  });

  return final;
};
