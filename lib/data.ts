import type { Tomb, TombDetail } from './types';
import { hasDatabase, hasTombDatabase, query } from './db';
import {
  extractPersonHintsFromName,
  hasPreciseCoords,
  haversineMeters,
  inferPersonFromName,
  isArtifactTombName,
  normalizeText
} from './utils';
import { fetchBaikeSummary, fetchRichSummary, fetchWikiSearchTitles } from './media';
import { geocodeAddress } from './geocode';
import seedData from '../data/seed/tombs.json';

const seedTombs = seedData as Tomb[];

const PROVINCES = [
  '北京市',
  '天津市',
  '上海市',
  '重庆市',
  '河北省',
  '山西省',
  '辽宁省',
  '吉林省',
  '黑龙江省',
  '江苏省',
  '浙江省',
  '安徽省',
  '福建省',
  '江西省',
  '山东省',
  '河南省',
  '湖北省',
  '湖南省',
  '广东省',
  '海南省',
  '四川省',
  '贵州省',
  '云南省',
  '陕西省',
  '甘肃省',
  '青海省',
  '台湾省',
  '内蒙古自治区',
  '广西壮族自治区',
  '西藏自治区',
  '宁夏回族自治区',
  '新疆维吾尔自治区',
  '香港特别行政区',
  '澳门特别行政区'
];

const TOMB_NAME_PATTERN = /(墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟|祠堂|祠)/;
const TOMB_STRONG_PATTERN = /(墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|冢|坟|祠堂|祠)/;
const TOMB_SUFFIX_PATTERN = /(墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟|祠堂|祠)$/;
const TEMPLE_NAME_PATTERN = /(庙|寺|观|宫|殿)/;

type TombOverrideMatch = {
  id?: string;
  name?: string;
  province?: string;
  level?: string;
  era_contains?: string;
  category_contains?: string;
};

type TombOverride = {
  match: TombOverrideMatch;
  person?: string;
  aliases?: string[];
};

type PersonAlias = {
  person: string;
  aliases: string[];
};

const tombOverrides: TombOverride[] = [
  {
    match: { id: 'wiki-city-450200-1' },
    person: '柳宗元',
    aliases: ['柳子厚', '柳侯']
  },
  {
    match: { name: '安阳高陵', era_contains: '东汉', province: '河南省', category_contains: '古墓葬' },
    person: '曹操',
    aliases: ['魏武帝', '魏武王']
  },
  {
    match: { name: '秦始皇陵', era_contains: '秦', province: '陕西省', category_contains: '古墓葬' },
    person: '嬴政',
    aliases: ['秦始皇']
  },
  {
    match: { name: '泰陵', era_contains: '隋', province: '陕西省', category_contains: '古墓葬' },
    person: '杨坚',
    aliases: ['隋文帝']
  },
  {
    match: { name: '隋炀帝陵', era_contains: '隋', province: '陕西省', category_contains: '古墓葬' },
    person: '杨广',
    aliases: ['隋炀帝']
  },
  {
    match: { name: '隋炀帝陵', era_contains: '隋', province: '江苏省', category_contains: '古墓葬' },
    person: '杨广',
    aliases: ['隋炀帝']
  },
  {
    match: { name: '长陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘邦',
    aliases: ['汉高祖']
  },
  {
    match: { name: '安陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘盈',
    aliases: ['汉惠帝']
  },
  {
    match: { name: '霸陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘恒',
    aliases: ['汉文帝']
  },
  {
    match: { name: '阳陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘启',
    aliases: ['汉景帝']
  },
  {
    match: { name: '茂陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘彻',
    aliases: ['汉武帝']
  },
  {
    match: { name: '平陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘弗陵',
    aliases: ['汉昭帝']
  },
  {
    match: { name: '杜陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘询',
    aliases: ['汉宣帝']
  },
  {
    match: { name: '渭陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘奭',
    aliases: ['汉元帝']
  },
  {
    match: { name: '延陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘骜',
    aliases: ['汉成帝']
  },
  {
    match: { name: '义陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘欣',
    aliases: ['汉哀帝']
  },
  {
    match: { name: '康陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘衎',
    aliases: ['汉平帝']
  },
  {
    match: { name: '汉太上皇陵', era_contains: '西汉', province: '陕西省', category_contains: '古墓葬' },
    person: '刘太公',
    aliases: ['汉太上皇']
  },
  {
    match: { name: '献陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李渊',
    aliases: ['唐高祖']
  },
  {
    match: { name: '昭陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李世民',
    aliases: ['唐太宗']
  },
  {
    match: { name: '乾陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李治',
    aliases: ['唐高宗', '武则天', '则天皇后']
  },
  {
    match: { name: '定陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李显',
    aliases: ['唐中宗']
  },
  {
    match: { name: '桥陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李旦',
    aliases: ['唐睿宗']
  },
  {
    match: { name: '泰陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李隆基',
    aliases: ['唐玄宗']
  },
  {
    match: { name: '建陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李亨',
    aliases: ['唐肃宗']
  },
  {
    match: { name: '元陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李豫',
    aliases: ['唐代宗']
  },
  {
    match: { name: '崇陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李适',
    aliases: ['唐德宗']
  },
  {
    match: { name: '丰陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李诵',
    aliases: ['唐顺宗']
  },
  {
    match: { name: '景陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李纯',
    aliases: ['唐宪宗']
  },
  {
    match: { name: '光陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李恒',
    aliases: ['唐穆宗']
  },
  {
    match: { name: '庄陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李湛',
    aliases: ['唐敬宗']
  },
  {
    match: { name: '章陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李昂',
    aliases: ['唐文宗']
  },
  {
    match: { name: '端陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李炎',
    aliases: ['唐武宗']
  },
  {
    match: { name: '贞陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李忱',
    aliases: ['唐宣宗']
  },
  {
    match: { name: '简陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李漼',
    aliases: ['唐懿宗']
  },
  {
    match: { name: '靖陵', era_contains: '唐', province: '陕西省', category_contains: '古墓葬' },
    person: '李儇',
    aliases: ['唐僖宗']
  },
  {
    match: { name: '明孝陵', era_contains: '明', province: '江苏省', category_contains: '古墓葬' },
    person: '朱元璋',
    aliases: ['明太祖', '洪武帝']
  },
  {
    match: { name: '景泰陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱祁钰',
    aliases: ['明代宗', '景泰帝']
  },
  {
    match: { name: '十三陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '明代皇帝',
    aliases: ['朱棣', '朱高炽', '朱瞻基', '朱祁镇', '朱见深', '朱祐樘', '朱厚照', '朱厚熜', '朱载坖', '朱翊钧', '朱常洛', '朱由校', '朱由检']
  },
  {
    match: { name: '长陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱棣',
    aliases: ['明成祖', '永乐帝']
  },
  {
    match: { name: '献陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱高炽',
    aliases: ['明仁宗']
  },
  {
    match: { name: '景陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱瞻基',
    aliases: ['明宣宗']
  },
  {
    match: { name: '裕陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱祁镇',
    aliases: ['明英宗']
  },
  {
    match: { name: '茂陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱见深',
    aliases: ['明宪宗']
  },
  {
    match: { name: '泰陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱祐樘',
    aliases: ['明孝宗']
  },
  {
    match: { name: '康陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱厚照',
    aliases: ['明武宗']
  },
  {
    match: { name: '永陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱厚熜',
    aliases: ['明世宗', '嘉靖帝']
  },
  {
    match: { name: '昭陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱载坖',
    aliases: ['明穆宗', '隆庆帝']
  },
  {
    match: { name: '定陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱翊钧',
    aliases: ['明神宗', '万历帝']
  },
  {
    match: { name: '庆陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱常洛',
    aliases: ['明光宗', '泰昌帝']
  },
  {
    match: { name: '德陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱由校',
    aliases: ['明熹宗', '天启帝']
  },
  {
    match: { name: '思陵', era_contains: '明', province: '北京市', category_contains: '古墓葬' },
    person: '朱由检',
    aliases: ['明思宗', '崇祯帝']
  },
  {
    match: { name: '福陵', era_contains: '清', province: '辽宁省', category_contains: '古墓葬' },
    person: '努尔哈赤',
    aliases: ['清太祖']
  },
  {
    match: { name: '清昭陵', era_contains: '清', province: '辽宁省', category_contains: '古墓葬' },
    person: '皇太极',
    aliases: ['清太宗']
  },
  {
    match: { name: '昭陵', era_contains: '清', province: '辽宁省', category_contains: '古墓葬' },
    person: '皇太极',
    aliases: ['清太宗']
  },
  {
    match: { name: '清东陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '清代帝王',
    aliases: ['福临', '玄烨', '弘历', '奕詝', '载淳', '载湉', '顺治', '康熙', '乾隆', '咸丰', '同治', '光绪']
  },
  {
    match: { name: '清西陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '清代帝王',
    aliases: ['胤禛', '颙琰', '旻宁', '雍正', '嘉庆', '道光']
  },
  {
    match: { name: '孝陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '福临',
    aliases: ['顺治帝', '清世祖']
  },
  {
    match: { name: '景陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '玄烨',
    aliases: ['康熙帝', '清圣祖', '康熙']
  },
  {
    match: { name: '裕陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '弘历',
    aliases: ['乾隆帝', '清高宗', '乾隆']
  },
  {
    match: { name: '定陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '奕詝',
    aliases: ['咸丰帝', '清文宗', '咸丰']
  },
  {
    match: { name: '惠陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '载淳',
    aliases: ['同治帝', '清穆宗', '同治']
  },
  {
    match: { name: '崇陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '载湉',
    aliases: ['光绪帝', '清德宗', '光绪']
  },
  {
    match: { name: '泰陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '胤禛',
    aliases: ['雍正帝', '清世宗', '雍正']
  },
  {
    match: { name: '昌陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '颙琰',
    aliases: ['嘉庆帝', '清仁宗', '嘉庆']
  },
  {
    match: { name: '慕陵', era_contains: '清', province: '河北省', category_contains: '古墓葬' },
    person: '旻宁',
    aliases: ['道光帝', '清宣宗', '道光']
  },
  {
    match: { name: '东汉光武帝原陵', province: '河南省', category_contains: '古墓葬' },
    person: '刘秀',
    aliases: ['汉光武帝', '光武帝']
  },
  {
    match: { name: '光武帝陵', province: '河南省', category_contains: '古墓葬' },
    person: '刘秀',
    aliases: ['汉光武帝', '光武帝']
  },
  {
    match: { name: '汉献帝禅陵', province: '河南省', category_contains: '古墓葬' },
    person: '刘协',
    aliases: ['汉献帝']
  },
  {
    match: { name: '惠陵', era_contains: '三国', province: '四川省', category_contains: '古墓葬' },
    person: '刘备',
    aliases: ['蜀汉昭烈帝', '汉昭烈帝', '昭烈帝']
  },
  {
    match: { name: '吴大帝孙权蒋陵', era_contains: '三国', province: '江苏省', category_contains: '古墓葬' },
    person: '孙权',
    aliases: ['吴大帝']
  },
  {
    match: { name: '吳大帝孫權蔣陵', era_contains: '东吴', province: '江苏省', category_contains: '古墓葬' },
    person: '孙权',
    aliases: ['吳大帝', '吴大帝']
  },
  {
    match: { name: '北魏孝文帝元宏长陵', era_contains: '北魏', province: '河南省', category_contains: '古墓葬' },
    person: '元宏',
    aliases: ['北魏孝文帝']
  },
  {
    match: { name: '北魏宣武帝景陵', era_contains: '北魏', province: '河南省', category_contains: '古墓葬' },
    person: '元恪',
    aliases: ['北魏宣武帝']
  },
  {
    match: { name: '北魏孝明帝元诩定陵', era_contains: '北魏', province: '河南省', category_contains: '古墓葬' },
    person: '元诩',
    aliases: ['北魏孝明帝']
  },
  {
    match: { name: '北魏孝庄帝静陵', era_contains: '北魏', province: '河南省', category_contains: '古墓葬' },
    person: '元子攸',
    aliases: ['北魏孝庄帝']
  },
  {
    match: { name: '北周静帝恭陵', era_contains: '北周', province: '陕西省', category_contains: '古墓葬' },
    person: '宇文阐',
    aliases: ['北周静帝']
  },
  {
    match: { name: '北周文帝成陵', era_contains: '北周', province: '陕西省', category_contains: '古墓葬' },
    person: '宇文泰',
    aliases: ['北周文帝']
  },
  {
    match: { name: '宋少帝陵', province: '广东省', category_contains: '古墓葬' },
    person: '赵昺',
    aliases: ['宋少帝', '宋末帝']
  },
  {
    match: { name: '明皇陵', era_contains: '明', province: '安徽省', category_contains: '古墓葬' },
    person: '朱元璋',
    aliases: ['明太祖', '洪武帝']
  },
  {
    match: { name: '西夏陵', era_contains: '西夏', province: '宁夏回族自治区', category_contains: '古墓葬' },
    person: '西夏帝王',
    aliases: ['李元昊', '西夏景宗', '党项帝陵']
  }
];
const manualPersonAliasSupplements: PersonAlias[] = [
  {
    person: '武则天',
    aliases: ['则天皇后', '武曌', '武后']
  }
];

const normalizeAliasKey = (value?: string | null) => {
  if (!value) return null;
  const token = normalizeText(value);
  return token || null;
};

const isGenericPersonLabel = (value: string) => /(帝王|皇帝|诸帝|王朝|朝代)/.test(value);

const buildPersonAliasList = () => {
  const grouped = new Map<
    string,
    {
      person: string;
      aliases: Set<string>;
      manual: boolean;
      order: number;
    }
  >();
  let order = 0;

  const upsert = (personRaw?: string | null, aliasesRaw?: string[] | null, manual = false) => {
    const person = (personRaw ?? '').trim();
    if (!person) return;
    const key = normalizeAliasKey(person);
    if (!key) return;

    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        person,
        aliases: new Set<string>(),
        manual,
        order: order++
      };
      grouped.set(key, entry);
    } else if (manual && !entry.manual) {
      entry.manual = true;
      entry.person = person;
    }

    (aliasesRaw ?? []).forEach((alias) => {
      const trimmed = alias?.trim();
      if (!trimmed || trimmed === person) return;
      entry!.aliases.add(trimmed);
    });
  };

  tombOverrides.forEach((item) => upsert(item.person, item.aliases, false));
  manualPersonAliasSupplements.forEach((item) => upsert(item.person, item.aliases, true));

  return Array.from(grouped.values())
    .sort((a, b) => {
      if (a.manual !== b.manual) return a.manual ? -1 : 1;
      const aGeneric = isGenericPersonLabel(a.person);
      const bGeneric = isGenericPersonLabel(b.person);
      if (aGeneric !== bGeneric) return aGeneric ? 1 : -1;
      return a.order - b.order;
    })
    .map((item) => ({
      person: item.person,
      aliases: Array.from(item.aliases)
    }));
};

const personAliasList: PersonAlias[] = buildPersonAliasList();
const personAliasIndex = new Map<string, string[]>();
const personAliasSourceIndex = new Map<string, string[]>();
const personCanonicalIndex = new Map<string, string>();
const aliasToPerson = new Map<string, string>();

type SummaryIndexEntry = {
  tomb: Tomb;
  text: string;
  updatedAt: number;
};

const SUMMARY_INDEX_LIMIT = 2000;
const summaryIndex = new Map<string, SummaryIndexEntry>();

const trimSummaryIndex = () => {
  while (summaryIndex.size > SUMMARY_INDEX_LIMIT) {
    const firstKey = summaryIndex.keys().next().value as string | undefined;
    if (!firstKey) return;
    summaryIndex.delete(firstKey);
  }
};

const snapshotTomb = (tomb: Tomb): Tomb => ({
  id: tomb.id,
  name: tomb.name,
  person: tomb.person,
  aliases: tomb.aliases,
  level: tomb.level,
  category: tomb.category,
  era: tomb.era,
  province: tomb.province,
  city: tomb.city,
  county: tomb.county,
  address: tomb.address,
  lat: tomb.lat ?? null,
  lng: tomb.lng ?? null,
  image_urls: tomb.image_urls,
  source: tomb.source
});

const getSummarySearchText = (tombId?: string | null) => {
  if (!tombId) return null;
  return summaryIndex.get(tombId)?.text ?? null;
};

const listSummaryIndexTombs = () => Array.from(summaryIndex.values()).map((entry) => entry.tomb);

const normalizeToken = (value?: string | null) => {
  if (!value) return null;
  const token = normalizeText(value);
  if (!token || token.length < 2) return null;
  return token;
};

const normalizeSurnameToken = (value?: string | null) => {
  if (!value) return null;
  const token = normalizeText(value);
  if (!token) return null;
  if (!/[\u4e00-\u9fa5]/.test(token)) return null;
  if (token.length > 2) return null;
  return token;
};

personAliasList.forEach((item) => {
  const personKey = normalizeToken(item.person);
  if (!personKey) return;
  if (!personCanonicalIndex.has(personKey)) {
    personCanonicalIndex.set(personKey, item.person.trim());
  }
  const aliasTokens = item.aliases
    .map((alias) => normalizeToken(alias))
    .filter(Boolean) as string[];
  const aliasSources = item.aliases.map((alias) => alias.trim()).filter(Boolean);
  if (!personAliasIndex.has(personKey)) {
    personAliasIndex.set(personKey, []);
  }
  if (!personAliasSourceIndex.has(personKey)) {
    personAliasSourceIndex.set(personKey, []);
  }
  const existing = personAliasIndex.get(personKey)!;
  const existingSources = personAliasSourceIndex.get(personKey)!;
  aliasTokens.forEach((aliasToken) => {
    if (!existing.includes(aliasToken)) existing.push(aliasToken);
    if (!aliasToPerson.has(aliasToken)) aliasToPerson.set(aliasToken, personKey);
  });
  aliasSources.forEach((aliasSource) => {
    if (!existingSources.includes(aliasSource)) existingSources.push(aliasSource);
  });
});

export const recordTombSummary = (
  tomb: Tomb,
  summary?: { title?: string; extract?: string } | null
) => {
  if (!tomb?.id || !summary) return;
  const text = normalizeText([summary.title, summary.extract].filter(Boolean).join(' '));
  if (!text) return;
  if (summaryIndex.has(tomb.id)) {
    summaryIndex.delete(tomb.id);
  }
  summaryIndex.set(tomb.id, { tomb: snapshotTomb(tomb), text, updatedAt: Date.now() });
  trimSummaryIndex();
};

const inferProvince = (tomb: Tomb) => {
  if (tomb.province && PROVINCES.includes(tomb.province)) return tomb.province;
  if (tomb.address) {
    const match = PROVINCES.find((item) => tomb.address?.includes(item));
    if (match) return match;
  }
  return tomb.province ?? null;
};

const isOcrSource = (tomb: Tomb) => {
  const note = tomb.source?.note ?? '';
  return /OCR|识别|扫描/.test(note);
};

const qualityFilter = (tomb: Tomb, includeOcr = false) => {
  const category = tomb.category ?? '';
  const name = tomb.name ?? '';
  if (isArtifactTombName(name)) return false;
  if (/宗祠/.test(name) && !/墓/.test(name)) return false;
  if (TEMPLE_NAME_PATTERN.test(name) && !TOMB_NAME_PATTERN.test(name)) return false;
  const isTombLike =
    TOMB_NAME_PATTERN.test(name) || (category.includes('古墓葬') && Boolean(tomb.person));
  if (!isTombLike) return false;
  if (!includeOcr && isOcrSource(tomb)) return false;
  const inferred = inferProvince(tomb);
  return !inferred || PROVINCES.includes(inferred);
};

const normalizePerson = (tomb: Tomb) => {
  const person = tomb.person?.trim();
  if (!person) return null;
  if (person.length < 2) return null;
  if (person.length > 6) return null;
  if (/(墓|陵|祠|庙|故居|遗址|旧居|园|墓群)/.test(person)) return null;
  return person;
};

const matchOverride = (tomb: Tomb, match: TombOverrideMatch) => {
  if (match.id && tomb.id !== match.id) return false;
  if (match.name && tomb.name !== match.name) return false;
  if (match.province && tomb.province !== match.province) return false;
  if (match.level && tomb.level !== match.level) return false;
  if (match.era_contains && !(tomb.era ?? '').includes(match.era_contains)) return false;
  if (match.category_contains && !(tomb.category ?? '').includes(match.category_contains)) return false;
  return true;
};

const applyTombOverrides = (tomb: Tomb) =>
  tombOverrides.find((override) => matchOverride(tomb, override.match));

const TRAILING_TOMB_INDEX_PATTERNS = [
  // e.g. （9）, (9), （注4）, 【国6】, [9], [注4]
  /\s*[（(]\s*[\u4e00-\u9fa5]{0,2}\s*\d+(?:\s*[-－—–]\s*\d+)*\s*[）)]\s*$/,
  /\s*[\[【]\s*[\u4e00-\u9fa5]{0,2}\s*\d+(?:\s*[-－—–]\s*\d+)*\s*[\]】]\s*$/
];

const stripTrailingTombIndex = (name?: string | null) => {
  if (!name) return name;
  let result = name.trim();
  if (!result) return result;
  while (true) {
    const pattern = TRAILING_TOMB_INDEX_PATTERNS.find((item) => item.test(result));
    if (!pattern) break;
    result = result.replace(pattern, '').trim();
  }
  return result || name;
};

const normalizeTomb = (tomb: Tomb): Tomb => {
  const name = stripTrailingTombIndex(tomb.name);
  const province = inferProvince(tomb) ?? tomb.province;
  const override = applyTombOverrides(tomb);
  const personHints = extractPersonHintsFromName(name);
  const rawPerson = override?.person ?? tomb.person ?? personHints[0] ?? undefined;
  const person = normalizePerson({ ...tomb, person: rawPerson });
  const personKey = normalizeToken(rawPerson ?? null);
  const personAliases = personKey ? personAliasSourceIndex.get(personKey) ?? [] : [];
  const aliases = Array.from(
    new Set([...(tomb.aliases ?? []), ...personHints, ...(override?.aliases ?? []), ...personAliases])
  );
  const normalizedProvince = province ?? null;
  const sameAdmin = (a?: string | null, b?: string | null) =>
    Boolean(a && b && normalizeText(a) === normalizeText(b));
  const normalizedCity = sameAdmin(tomb.city, normalizedProvince) ? undefined : tomb.city;
  const normalizedCounty = sameAdmin(tomb.county, normalizedProvince) || sameAdmin(tomb.county, normalizedCity)
    ? undefined
    : tomb.county;
  return {
    ...tomb,
    name: name ?? tomb.name,
    province,
    city: normalizedCity,
    county: normalizedCounty,
    person: person ?? undefined,
    aliases: aliases.length ? aliases : undefined
  };
};

const isSinorelic = (tomb: Tomb) => {
  const note = tomb.source?.note ?? '';
  return tomb.id?.startsWith('sinorelic-') || note.includes('sinorelic.com');
};

const isHeritageListSource = (tomb: Tomb) => {
  const title = tomb.source?.title ?? '';
  return title.includes('文物保护单位') || title.includes('文保单位');
};

const isHuaxiaTombZhiSource = (tomb: Tomb) => {
  const title = tomb.source?.title ?? '';
  return title.includes('华夏古墓志') || title.includes('华夏古墓誌');
};

const pickPreferredSource = (primary: Tomb, secondary: Tomb) => {
  const primaryHeritage = isHeritageListSource(primary);
  const secondaryHeritage = isHeritageListSource(secondary);
  if (primaryHeritage && secondaryHeritage) {
    const rankPrimary = levelRank[primary.level] ?? 0;
    const rankSecondary = levelRank[secondary.level] ?? 0;
    if (rankSecondary > rankPrimary) return secondary.source;
    if (rankPrimary > rankSecondary) return primary.source;
    if (!primary.source?.year && secondary.source?.year) return secondary.source;
    if (!primary.source?.url && secondary.source?.url) return secondary.source;
    return primary.source ?? secondary.source;
  }
  if (primaryHeritage) return primary.source;
  if (secondaryHeritage) return secondary.source;
  if (isSinorelic(primary)) return primary.source;
  if (isSinorelic(secondary)) return secondary.source;
  if (isHuaxiaTombZhiSource(primary)) return primary.source;
  if (isHuaxiaTombZhiSource(secondary)) return secondary.source;
  return primary.source ?? secondary.source;
};

const imageSourceRank = (tomb: Tomb) => {
  if (isSinorelic(tomb)) return 0;
  if (isHuaxiaTombZhiSource(tomb)) return 1;
  return 2;
};

const mergeImageUrls = (items: Tomb[]) => {
  const ordered = [...items].sort((a, b) => imageSourceRank(a) - imageSourceRank(b));
  const urls: string[] = [];
  ordered.forEach((item) => {
    (item.image_urls ?? []).forEach((url) => {
      if (url && !urls.includes(url)) urls.push(url);
    });
  });
  return urls.length ? urls : undefined;
};

const buildSeedImages = (tomb: Tomb) => {
  const urls = tomb.image_urls ?? [];
  if (!urls.length) return undefined;
  const sourceLabel = isHuaxiaTombZhiSource(tomb)
    ? '华夏古墓志'
    : isSinorelic(tomb)
      ? '华夏古迹图'
      : '数据集';
  return urls.map((url) => ({ url, source: sourceLabel }));
};

const levelRank: Record<string, number> = {
  national: 4,
  provincial: 3,
  city: 2,
  county: 1
};

const matchLastToken = (value: string | undefined, pattern: RegExp) => {
  if (!value) return null;
  const matches = Array.from(value.matchAll(pattern)).map((match) => match[1]).filter(Boolean);
  return matches.length ? matches[matches.length - 1] : null;
};

const stripAdminPrefix = (token: string | null, markers: string[]) => {
  if (!token) return null;
  let result = token;
  markers.forEach((marker) => {
    if (result.includes(marker)) {
      result = result.split(marker).slice(-1)[0];
    }
  });
  return result || token;
};

const ADMIN_SUFFIX_PATTERN = /(特别行政区|自治区|自治州|自治县|地区|盟|州|市|县|区|旗)$/;

const stripAdminSuffix = (token: string) => token.replace(ADMIN_SUFFIX_PATTERN, '');

const normalizeAdminValue = (value?: string | null) => {
  if (!value) return null;
  const token = normalizeText(value);
  if (!token) return null;
  return token;
};

const CITY_FILTER_ALIASES: Record<string, string[]> = {
  // "大西安"常用口径：顺陵等点位实际在咸阳渭城区，但用户常按西安检索。
  西安: ['西安市', '咸阳市']
};

const matchesAdminField = (fieldValue?: string | null, filterValue?: string | null) => {
  if (!filterValue) return true;
  if (!fieldValue) return false;
  const fieldToken = normalizeAdminValue(fieldValue);
  const filterToken = normalizeAdminValue(filterValue);
  if (!fieldToken || !filterToken) return false;
  if (fieldToken === filterToken) return true;
  if (filterToken.length >= 2 && (fieldToken.includes(filterToken) || filterToken.includes(fieldToken))) {
    return true;
  }
  const fieldStripped = stripAdminSuffix(fieldToken);
  const filterStripped = stripAdminSuffix(filterToken);
  if (!fieldStripped || !filterStripped) return false;
  if (fieldStripped === filterStripped) return true;
  if (
    filterStripped.length >= 2 &&
    (fieldStripped.includes(filterStripped) || filterStripped.includes(fieldStripped))
  ) {
    return true;
  }
  return false;
};

const matchesAdminFilters = (tomb: Tomb, filters: TombFilters) => {
  if (filters.province && !matchesAdminField(tomb.province, filters.province)) return false;
  if (filters.city) {
    const filterToken = normalizeAdminValue(filters.city);
    const filterKey = filterToken ? stripAdminSuffix(filterToken) : null;
    const aliasGroup = filterKey ? CITY_FILTER_ALIASES[filterKey] : null;
    if (aliasGroup?.length) {
      const ok = aliasGroup.some((alias) => matchesAdminField(tomb.city, alias));
      if (!ok) return false;
    } else if (!matchesAdminField(tomb.city, filters.city)) {
      return false;
    }
  }
  if (filters.county && !matchesAdminField(tomb.county, filters.county)) return false;
  return true;
};

const shouldUseAdminLike = (value?: string | null) => {
  const token = normalizeText(value ?? '');
  return token.length >= 2;
};

const COUNTY_TOKEN_PATTERN = /([\u4e00-\u9fa5]{1,12}(?:自治县|县|区|旗|市))/g;

const extractCounty = (tomb: Tomb) => {
  const fieldRaw = (tomb.county ?? '').trim();
  const fieldMatch = fieldRaw ? matchLastToken(fieldRaw, COUNTY_TOKEN_PATTERN) : null;
  const fieldToken = fieldMatch ? stripAdminPrefix(fieldMatch, ['省', '自治区', '市', '州', '地区', '盟']) : null;

  const addressMatch = matchLastToken(tomb.address, COUNTY_TOKEN_PATTERN);
  const addressToken = addressMatch ? stripAdminPrefix(addressMatch, ['省', '自治区', '市', '州', '地区', '盟']) : null;

  if (fieldToken && addressToken) {
    if (!matchesAdminField(fieldToken, addressToken) && !matchesAdminField(addressToken, fieldToken)) {
      return addressToken;
    }
    return fieldToken;
  }
  return fieldToken ?? addressToken;
};

const CITY_TOKEN_PATTERN = /([\u4e00-\u9fa5]{1,12}(?:市|地区|盟|州|自治州))/g;

const extractCity = (tomb: Tomb) => {
  const fieldRaw = (tomb.city ?? '').trim();
  const fieldMatch = fieldRaw ? matchLastToken(fieldRaw, CITY_TOKEN_PATTERN) : null;
  const fieldToken = fieldMatch ? stripAdminPrefix(fieldMatch, ['省', '自治区', '地区', '盟']) : null;

  const addressMatch = matchLastToken(tomb.address, CITY_TOKEN_PATTERN);
  const addressToken = addressMatch ? stripAdminPrefix(addressMatch, ['省', '自治区', '地区', '盟']) : null;

  if (fieldToken && addressToken) {
    if (!matchesAdminField(fieldToken, addressToken) && !matchesAdminField(addressToken, fieldToken)) {
      return addressToken;
    }
    return fieldToken;
  }
  return fieldToken ?? addressToken;
};

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

const splitSearchTerms = (value: string) =>
  value
    .split(/[\s、,，/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

const PERSON_QUERY_STOPWORDS = new Set([
  '古墓',
  '陵墓',
  '陵园',
  '陵寝',
  '墓地',
  '墓群',
  '王陵',
  '帝陵',
  '皇陵',
  '祠堂',
  '祠',
  '宗祠',
  '陵',
  '墓',
  '冢',
  '坟',
  '遗址',
  '遗迹',
  '故居',
  '旧居',
  '古建筑',
  '建筑',
  '古迹'
]);

const COMPOUND_SURNAMES = [
  '欧阳',
  '司马',
  '诸葛',
  '上官',
  '司徒',
  '夏侯',
  '东方',
  '皇甫',
  '尉迟',
  '公羊',
  '赫连',
  '澹台',
  '公冶',
  '宗政',
  '濮阳',
  '淳于',
  '单于',
  '太叔',
  '申屠',
  '公孙',
  '仲孙',
  '轩辕',
  '令狐',
  '钟离',
  '宇文',
  '长孙',
  '慕容',
  '鲜于',
  '闾丘',
  '司空',
  '亓官',
  '司寇',
  '子车',
  '颛孙',
  '端木',
  '巫马',
  '公西',
  '漆雕',
  '乐正',
  '壤驷',
  '公良',
  '拓跋',
  '夹谷',
  '宰父',
  '谷梁',
  '段干',
  '百里',
  '东郭',
  '南门',
  '呼延',
  '羊舌',
  '微生',
  '梁丘',
  '左丘',
  '东门',
  '西门',
  '南宫'
];

const ALIAS_MARKER_PATTERN =
  /(?:字|号|别号|别名|别称|又名|又称|亦称|本名|原名|改名|谥号|追号|封号|尊号|号称|号曰|号为|字曰|字为)[：:\s]*([^，。、；;\n]{1,12})/g;

const ALIAS_ROLE_PATTERN =
  /(名将|将军|政治家|文学家|诗人|作家|书法家|画家|思想家|哲学家|科学家|教育家|革命家|企业家|工程师|医生|学者|大臣|官员|宰相|将领|英雄|领袖|人物|时期|时代|王朝|民族)/;

const isPersonLikeToken = (token: string) => {
  if (!token) return false;
  if (token.length < 2 || token.length > 6) return false;
  if (!/[\u4e00-\u9fa5]/.test(token)) return false;
  return !PERSON_QUERY_STOPWORDS.has(token);
};

const selectBaikePersonQuery = (personInput: string) => {
  const parts = splitSearchTerms(personInput).filter((item) => {
    const token = normalizeToken(item);
    return token ? isPersonLikeToken(token) : false;
  });
  if (parts.length === 1) return parts[0];
  if (!parts.length) {
    const token = normalizeToken(personInput);
    if (token && isPersonLikeToken(token)) return personInput;
  }
  return null;
};

const resolveSurname = (name?: string | null) => {
  if (!name) return null;
  const trimmed = name.trim();
  if (trimmed.length < 2) return null;
  const compound = COMPOUND_SURNAMES.find((surname) => trimmed.startsWith(surname));
  return compound ?? trimmed.slice(0, 1);
};

const normalizeAliasCandidate = (value: string) =>
  value
    .replace(/[“”"'‘’]/g, '')
    .replace(/[()（）]/g, '')
    .replace(/[·•・]/g, '')
    .replace(/\s+/g, '')
    .trim();

const isAliasCandidate = (value: string, canonical?: string | null) => {
  const cleaned = normalizeAliasCandidate(value);
  if (!cleaned) return false;
  const token = normalizeToken(cleaned);
  if (!token) return false;
  if (!isPersonLikeToken(token)) return false;
  if (canonical) {
    const canonicalToken = normalizeToken(canonical);
    if (canonicalToken && canonicalToken === token) return false;
  }
  if (ALIAS_ROLE_PATTERN.test(cleaned)) return false;
  return true;
};

const extractAliasesFromText = (text: string, canonical?: string | null) => {
  if (!text) return [];
  const segments = Array.from(text.matchAll(ALIAS_MARKER_PATTERN))
    .map((match) => match[1])
    .filter(Boolean);
  if (!segments.length) return [];
  const results = new Set<string>();
  segments.forEach((segment) => {
    segment
      .split(/[、,，/或和与及]/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((candidate) => {
        if (!isAliasCandidate(candidate, canonical)) return;
        results.add(normalizeAliasCandidate(candidate));
      });
  });
  return Array.from(results);
};

const inferPersonInputFromQuery = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = splitSearchTerms(trimmed);
  if (!parts.length) return null;
  const seen = new Set<string>();
  const personParts: string[] = [];
  parts.forEach((part) => {
    if (!part) return;
    const hasTombKeyword = TOMB_NAME_PATTERN.test(part);
    const stripped = stripTombSuffix(part) ?? part;
    const strippedToken = normalizeToken(stripped);
    if (strippedToken && isPersonLikeToken(strippedToken)) {
      if (!seen.has(strippedToken)) {
        seen.add(strippedToken);
        personParts.push(stripped);
      }
      return;
    }
    if (!hasTombKeyword) {
      const token = normalizeToken(part);
      if (token && isPersonLikeToken(token) && !seen.has(token)) {
        seen.add(token);
        personParts.push(part);
      }
    }
  });
  if (!personParts.length) return null;
  return personParts.join(' ');
};

const buildPersonTokens = (person?: string | null) => {
  if (!person) return [];
  const parts = splitSearchTerms(person.trim());
  if (!parts.length) return [];
  const tokens = new Set<string>();
  parts.forEach((part) => {
    const stripped = stripTombSuffix(part) ?? part;
    const baseToken = normalizeToken(stripped) ?? normalizeToken(part);
    if (!baseToken) return;
    tokens.add(baseToken);
    const canonical = aliasToPerson.get(baseToken);
    if (canonical) tokens.add(canonical);
    const canonicalAliases = personAliasIndex.get(canonical ?? baseToken) ?? [];
    canonicalAliases.forEach((aliasToken) => tokens.add(aliasToken));
  });
  return Array.from(tokens);
};

const resolveCanonicalPerson = (personInput: string, tokens: string[]) => {
  const normalized = normalizeToken(personInput);
  if (normalized && aliasToPerson.has(normalized)) {
    const canonicalToken = aliasToPerson.get(normalized)!;
    return personCanonicalIndex.get(canonicalToken) ?? personInput;
  }
  if (normalized && personCanonicalIndex.has(normalized)) {
    return personCanonicalIndex.get(normalized)!;
  }
  const tokenCanonical = tokens.find((token) => personCanonicalIndex.has(token));
  if (tokenCanonical) {
    return personCanonicalIndex.get(tokenCanonical)!;
  }
  return personInput;
};

type PersonContext = {
  query: string | null;
  tokens: string[];
  canonicalName: string | null;
  canonicalToken: string | null;
  aliasTokens: string[];
  hasAliasHint: boolean;
  surnameToken: string | null;
};

const buildPersonContext = async (personInput?: string | null): Promise<PersonContext> => {
  const trimmed = personInput?.trim() ?? '';
  if (!trimmed) {
    return {
      query: null,
      tokens: [],
      canonicalName: null,
      canonicalToken: null,
      aliasTokens: [],
      hasAliasHint: false,
      surnameToken: null
    };
  }

  const baseTokens = buildPersonTokens(trimmed);
  const tokenSet = new Set<string>(baseTokens);
  let canonicalName = resolveCanonicalPerson(trimmed, baseTokens);
  let canonicalToken = normalizeToken(canonicalName) ?? null;
  const aliasTokenSet = new Set<string>();
  let hasAliasHint = false;
  const normalizedInput = normalizeToken(trimmed);
  const baikeQuery = selectBaikePersonQuery(trimmed);

  const pushAliasToken = (value?: string | null) => {
    const token = normalizeToken(value ?? null);
    if (!token) return;
    if (!isPersonLikeToken(token)) return;
    aliasTokenSet.add(token);
  };

  pushAliasToken(trimmed);
  if (canonicalName) pushAliasToken(canonicalName);

  if (baikeQuery && canonicalToken && normalizedInput && canonicalToken !== normalizedInput) {
    hasAliasHint = true;
  }

  if (baikeQuery) {
    const fallbacks = canonicalName && canonicalName !== baikeQuery ? [canonicalName] : [];
    const summary = await fetchRichSummary(baikeQuery, fallbacks);
    if (summary) {
      const titleToken = normalizeToken(summary.title);
      const titleLooksPerson =
        summary.title &&
        titleToken &&
        isPersonLikeToken(titleToken) &&
        !TOMB_NAME_PATTERN.test(summary.title);
      if (titleLooksPerson) {
        if (!canonicalToken || canonicalToken !== titleToken) {
          canonicalName = summary.title;
          canonicalToken = titleToken;
          hasAliasHint = true;
        }
        pushAliasToken(summary.title);
      }

      const aliases = extractAliasesFromText(summary.extract, canonicalName);
      if (aliases.length) hasAliasHint = true;
      const surname = resolveSurname(canonicalName ?? trimmed);
      aliases.forEach((alias) => {
        pushAliasToken(alias);
        if (surname && !alias.startsWith(surname)) {
          pushAliasToken(`${surname}${alias}`);
        }
      });
    }
  }

  if (canonicalToken) {
    const staticAliases = personAliasIndex.get(canonicalToken) ?? [];
    staticAliases.forEach((aliasToken) => aliasTokenSet.add(aliasToken));
  }

  if (canonicalToken) aliasTokenSet.add(canonicalToken);
  aliasTokenSet.forEach((token) => tokenSet.add(token));
  if (canonicalToken) tokenSet.add(canonicalToken);

  const surnameToken = normalizeSurnameToken(resolveSurname(canonicalName ?? trimmed));

  return {
    query: trimmed,
    tokens: Array.from(tokenSet),
    canonicalName: canonicalName || trimmed,
    canonicalToken,
    aliasTokens: Array.from(aliasTokenSet),
    hasAliasHint,
    surnameToken
  };
};

const buildPersonCandidates = (tomb: Tomb) => {
  const candidates = new Set<string>();
  const pushCandidate = (value?: string | null) => {
    const token = normalizeToken(value ?? null);
    if (token) candidates.add(token);
  };
  pushCandidate(tomb.person);
  pushCandidate(inferPersonFromName(tomb.name));
  pushCandidate(stripTombSuffix(tomb.name));
  pushCandidate(tomb.name);
  pushCandidate(tomb.address);
  (tomb.aliases ?? []).forEach((alias) => pushCandidate(alias));

  const personKey = normalizeToken(tomb.person ?? null);
  if (personKey) {
    (personAliasIndex.get(personKey) ?? []).forEach((aliasToken) => candidates.add(aliasToken));
  }

  return candidates;
};

const matchesPersonStrict = (tomb: Tomb, context: PersonContext) => {
  const tokens = context.tokens;
  if (!tokens.length) return true;
  const candidates = buildPersonCandidates(tomb);
  if (!candidates.size) return false;
  return tokens.some((token) =>
    Array.from(candidates).some(
      (candidate) => candidate === token || candidate.includes(token) || token.includes(candidate)
    )
  );
};

const matchesPerson = (tomb: Tomb, context: PersonContext) => {
  const tokens = context.tokens;
  if (!tokens.length) return true;
  const candidates = buildPersonCandidates(tomb);

  const candidateMatch = tokens.some((token) =>
    Array.from(candidates).some(
      (candidate) => candidate === token || candidate.includes(token) || token.includes(candidate)
    )
  );
  if (candidateMatch) return true;

  if (context.surnameToken) {
    const personSurname = normalizeSurnameToken(tomb.person ?? null);
    if (personSurname && personSurname === context.surnameToken) return true;
    const segment = primaryNameSegment(tomb.name);
    if (segment && segment.length <= 4 && TOMB_SUFFIX_PATTERN.test(segment)) {
      const stripped = stripTombSuffix(segment);
      const strippedToken = normalizeSurnameToken(stripped);
      if (strippedToken && strippedToken === context.surnameToken) return true;
    }
  }

  const summaryText = getSummarySearchText(tomb.id);
  if (!summaryText) return false;
  return tokens.some((token) => summaryText.includes(token));
};

const buildSearchText = (tomb: Tomb) => {
  const inferred = inferPersonFromName(tomb.name);
  const stripped = stripTombSuffix(tomb.name);
  const summaryText = getSummarySearchText(tomb.id);
  return normalizeText(
    [
      tomb.name,
      tomb.person,
      inferred,
      stripped,
      tomb.era,
      tomb.category,
      tomb.address,
      tomb.province,
      tomb.city,
      tomb.county,
      ...(tomb.aliases ?? []),
      summaryText
    ]
      .filter(Boolean)
      .join(' ')
  );
};

const matchesTombNameQuery = (tomb: Tomb, queryToken: string) => {
  if (!queryToken) return true;
  const nameToken = normalizeText(tomb.name ?? '');
  if (nameToken && (nameToken.includes(queryToken) || queryToken.includes(nameToken))) return true;
  const aliases = tomb.aliases ?? [];
  for (const alias of aliases) {
    const aliasToken = normalizeText(alias);
    if (aliasToken && (aliasToken.includes(queryToken) || queryToken.includes(aliasToken))) {
      return true;
    }
  }
  return false;
};

const matchesTombAddressQuery = (tomb: Tomb, queryToken: string) => {
  if (!queryToken) return true;
  const addressToken = normalizeText(tomb.address ?? '');
  if (!addressToken) return false;
  return addressToken.includes(queryToken) || queryToken.includes(addressToken);
};

const matchesTombLocationQuery = (tomb: Tomb, queryToken: string) => {
  if (!queryToken) return true;
  const fields = [tomb.address, tomb.province, tomb.city, tomb.county];
  return fields.some((field) => {
    const token = normalizeText(field ?? '');
    if (!token) return false;
    return token.includes(queryToken) || queryToken.includes(token);
  });
};

const matchesTombPersonQuery = (tomb: Tomb, queryToken: string) => {
  if (!queryToken) return true;
  const personToken = normalizeText(tomb.person ?? inferPersonFromName(tomb.name) ?? '');
  if (!personToken) return false;
  return personToken.includes(queryToken) || queryToken.includes(personToken);
};

const sortTombsByQueryRelevance = (items: Tomb[], query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return items;
  const queryToken = normalizeText(trimmed);
  if (!queryToken) return items;

  const collator = new Intl.Collator('zh-Hans-CN');
  const ranked = items.map((tomb, idx) => {
    const nameHit = matchesTombNameQuery(tomb, queryToken);
    const exactNameHit = normalizeText(tomb.name ?? '') === queryToken;
    const exactAliasHit = !exactNameHit && (tomb.aliases ?? []).some((alias) => normalizeText(alias) === queryToken);
    const personHit = !nameHit && matchesTombPersonQuery(tomb, queryToken);
    const locationHit = !nameHit && !personHit && matchesTombLocationQuery(tomb, queryToken);
    const group = nameHit || personHit ? 0 : locationHit ? 1 : 2;
    return {
      tomb,
      idx,
      group,
      exact: exactNameHit || exactAliasHit ? 1 : 0,
      level: levelRank[tomb.level] ?? 0,
      score: tombScore(tomb),
      name: tomb.name ?? ''
    };
  });

  ranked.sort((a, b) => {
    if (a.group !== b.group) return a.group - b.group;
    if (a.exact !== b.exact) return b.exact - a.exact;
    if (a.level !== b.level) return b.level - a.level;
    if (a.score !== b.score) return b.score - a.score;
    const nameCmp = collator.compare(a.name, b.name);
    if (nameCmp) return nameCmp;
    return a.idx - b.idx;
  });

  return ranked.map((item) => item.tomb);
};

const tombScore = (tomb: Tomb) =>
  (tomb.lat != null ? 1 : 0) +
  (tomb.lng != null ? 1 : 0) +
  (tomb.address ? 1 : 0) +
  (tomb.county ? 1 : 0) +
  (tomb.city ? 1 : 0) +
  (tomb.era ? 1 : 0);

const getNameKey = (tomb: Tomb) => normalizeText(primaryNameSegment(tomb.name) ?? tomb.name ?? '');

const getPersonToken = (tomb: Tomb) =>
  normalizeToken(tomb.person ?? inferPersonFromName(tomb.name) ?? null);

const pickPrimaryTomb = (items: Tomb[]) => {
  const sinorelicItems = items.filter(isSinorelic);
  if (sinorelicItems.length) {
    return sinorelicItems.reduce((best, item) => {
      const rankBest = levelRank[best.level] ?? 0;
      const rankItem = levelRank[item.level] ?? 0;
      if (rankItem !== rankBest) return rankItem > rankBest ? item : best;
      return tombScore(item) > tombScore(best) ? item : best;
    });
  }
  const huaxiaItems = items.filter(isHuaxiaTombZhiSource);
  if (huaxiaItems.length) {
    return huaxiaItems.reduce((best, item) => {
      const rankBest = levelRank[best.level] ?? 0;
      const rankItem = levelRank[item.level] ?? 0;
      if (rankItem !== rankBest) return rankItem > rankBest ? item : best;
      return tombScore(item) > tombScore(best) ? item : best;
    });
  }
  return items.reduce((best, item) => {
    const rankBest = levelRank[best.level] ?? 0;
    const rankItem = levelRank[item.level] ?? 0;
    if (rankItem !== rankBest) return rankItem > rankBest ? item : best;
    return tombScore(item) > tombScore(best) ? item : best;
  });
};

const mergeTomb = (primary: Tomb, secondary: Tomb): Tomb => {
  const primaryHeritage = isHeritageListSource(primary);
  const secondaryHeritage = isHeritageListSource(secondary);
  const address = primary.address ?? secondary.address;
  const addressCity = address ? matchLastToken(address, CITY_TOKEN_PATTERN) : null;
  const addressCounty = address ? matchLastToken(address, COUNTY_TOKEN_PATTERN) : null;

  const secondaryCountyConflicts =
    Boolean(secondary.county && addressCounty) &&
    !matchesAdminField(secondary.county, addressCounty) &&
    !matchesAdminField(addressCounty as string, secondary.county as string);

  const pickCity = () => {
    if (primary.city) return primary.city;
    const candidate = secondary.city;
    if (!candidate) return undefined;
    if (secondaryCountyConflicts) return undefined;
    if (
      addressCity &&
      !matchesAdminField(candidate, addressCity) &&
      !matchesAdminField(addressCity as string, candidate)
    ) {
      return undefined;
    }
    return candidate;
  };

  const pickCounty = () => {
    if (primary.county) return primary.county;
    const candidate = secondary.county;
    if (!candidate) return undefined;
    if (
      addressCounty &&
      !matchesAdminField(candidate, addressCounty) &&
      !matchesAdminField(addressCounty as string, candidate)
    ) {
      return undefined;
    }
    return candidate;
  };

  return {
    id: primary.id,
    name: primary.name,
    person: primary.person ?? secondary.person,
    aliases: Array.from(new Set([...(primary.aliases ?? []), ...(secondary.aliases ?? [])])),
    level: (() => {
      if (primaryHeritage && secondaryHeritage) {
        return (levelRank[secondary.level] ?? 0) > (levelRank[primary.level] ?? 0)
          ? secondary.level
          : primary.level;
      }
      if (primaryHeritage) return primary.level;
      if (secondaryHeritage) return secondary.level;
      return (levelRank[secondary.level] ?? 0) > (levelRank[primary.level] ?? 0)
        ? secondary.level
        : primary.level;
    })(),
    category: primary.category ?? secondary.category,
    era: primary.era ?? secondary.era,
    province: primary.province ?? secondary.province,
    city: pickCity(),
    county: pickCounty(),
    address,
    lat: primary.lat ?? secondary.lat,
    lng: primary.lng ?? secondary.lng,
    image_urls: mergeImageUrls([primary, secondary]),
    source: pickPreferredSource(primary, secondary)
  };
};

const buildLocationKey = (tomb: Tomb) => {
  const province = tomb.province ?? '';
  const county = extractCounty(tomb) ?? '';
  const city = extractCity(tomb) ?? '';
  return county ? `${province}|${county}` : city ? `${province}|${city}` : province;
};

const dropProvinceOnlyDuplicates = (items: Tomb[]) => {
  const groups = new Map<string, Tomb[]>();
  items.forEach((tomb) => {
    const province = tomb.province ?? '';
    const key = `${getNameKey(tomb)}|${province}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(tomb);
    } else {
      groups.set(key, [tomb]);
    }
  });

  const result: Tomb[] = [];
  groups.forEach((group) => {
    if (group.length === 1) {
      result.push(group[0]);
      return;
    }
    const province = group[0]?.province ?? '';
    if (!province) {
      result.push(...group);
      return;
    }
    const provinceOnly = group.filter((tomb) => buildLocationKey(tomb) === province);
    const specific = group.filter((tomb) => buildLocationKey(tomb) !== province);
    if (specific.length && provinceOnly.length) {
      result.push(...specific);
      return;
    }
    result.push(...group);
  });
  return result;
};

const buildPersonLocationKey = (tomb: Tomb) => {
  const personToken = getPersonToken(tomb);
  if (!personToken) return null;
  const locationKey = buildLocationKey(tomb);
  if (!locationKey) return null;
  return `${personToken}|${locationKey}`;
};

const pickPrimaryByPersonLocation = (items: Tomb[]) => {
  const sinorelicItems = items.filter(isSinorelic);
  if (sinorelicItems.length) return pickPrimaryTomb(sinorelicItems);
  const huaxiaItems = items.filter(isHuaxiaTombZhiSource);
  if (huaxiaItems.length) return pickPrimaryTomb(huaxiaItems);
  return pickPrimaryTomb(items);
};

const mergeLooseByNameProvince = (items: Tomb[]) => {
  const isLowInfo = (tomb: Tomb) => tomb.lat == null || tomb.lng == null;

  const mergedLoose: Tomb[] = [];
  const looseGroups = new Map<string, Tomb[]>();
  items.forEach((tomb) => {
    const key = `${getNameKey(tomb)}|${tomb.province ?? ''}`;
    const group = looseGroups.get(key);
    if (group) {
      group.push(tomb);
    } else {
      looseGroups.set(key, [tomb]);
    }
  });

  looseGroups.forEach((group) => {
    if (group.length === 1) {
      mergedLoose.push(group[0]);
      return;
    }
    const high = group.filter((tomb) => !isLowInfo(tomb));
    if (!high.length) {
      const adminGroups = new Map<string, Tomb[]>();
      group.forEach((tomb) => {
        const city = normalizeText(extractCity(tomb) ?? '');
        const county = normalizeText(extractCounty(tomb) ?? '');
        const key = `${city}|${county}`;
        const existing = adminGroups.get(key);
        if (existing) {
          existing.push(tomb);
        } else {
          adminGroups.set(key, [tomb]);
        }
      });
      const adminKeys = Array.from(adminGroups.keys());
      const specificKeys = adminKeys.filter((key) => key.replace(/\|/g, '') !== '');
      if (adminGroups.size === 1 || specificKeys.length === 1) {
        const primary = pickPrimaryTomb(group);
        const merged = group.reduce((acc, item) => (item === primary ? acc : mergeTomb(acc, item)), primary);
        mergedLoose.push(merged);
        return;
      }
      adminGroups.forEach((items) => {
        if (items.length === 1) {
          mergedLoose.push(items[0]);
          return;
        }
        const primary = pickPrimaryTomb(items);
        const merged = items.reduce((acc, item) => (item === primary ? acc : mergeTomb(acc, item)), primary);
        mergedLoose.push(merged);
      });
      return;
    }
    const highLocationKeys = new Set(high.map((tomb) => buildLocationKey(tomb)));
    if (highLocationKeys.size === 1) {
      const primary = pickPrimaryTomb(group);
      const merged = group.reduce((acc, item) => (item === primary ? acc : mergeTomb(acc, item)), primary);
      mergedLoose.push(merged);
      return;
    }
    mergedLoose.push(...group);
  });

  return mergedLoose;
};

const dedupeTombs = (items: Tomb[]) => {
  const groups = new Map<string, Tomb[]>();

  items.forEach((tomb) => {
    const locationKey = buildLocationKey(tomb);
    const key = [getNameKey(tomb), locationKey].join('|');
    const group = groups.get(key);
    if (group) {
      group.push(tomb);
    } else {
      groups.set(key, [tomb]);
    }
  });

  const cityGroups = new Map<string, Tomb[]>();
  const passthrough: Tomb[][] = [];

  groups.forEach((group) => {
    const sample = group[0];
    const province = sample.province ?? '';
    const city = extractCity(sample) ?? '';
    if (!city) {
      passthrough.push(group);
      return;
    }
    const cityKey = [getNameKey(sample), province, city].join('|');
    const existing = cityGroups.get(cityKey);
    if (existing) {
      existing.push(...group);
    } else {
      cityGroups.set(cityKey, [...group]);
    }
  });

  const mergedGroups = [...passthrough, ...cityGroups.values()];
  const result: Tomb[] = [];
  mergedGroups.forEach((group) => {
    if (group.length === 1) {
      result.push(group[0]);
      return;
    }
    const primary = pickPrimaryTomb(group);
    const merged = group.reduce((acc, item) => (item === primary ? acc : mergeTomb(acc, item)), primary);
    result.push(merged);
  });

  const mergedLoose = mergeLooseByNameProvince(result);

  const mergedNearby = mergeNearbyTombs(mergedLoose);
  return dropProvinceOnlyDuplicates(mergeByPersonLocation(mergeByPersonName(mergedNearby)));
};

const adminOverlap = (a?: string | null, b?: string | null) => {
  if (!a || !b) return true;
  return matchesAdminField(a, b) || matchesAdminField(b, a);
};

const shouldMergeNearby = (a: Tomb, b: Tomb, maxMeters = 2500) => {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false;
  const distance = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  if (distance > maxMeters) return false;
  const cityA = extractCity(a);
  const cityB = extractCity(b);
  if (cityA && cityB && !adminOverlap(cityA, cityB)) return false;
  const countyA = extractCounty(a);
  const countyB = extractCounty(b);
  if (countyA && countyB && !adminOverlap(countyA, countyB)) return false;
  return true;
};

const mergeNearbyTombs = (items: Tomb[]) => {
  const groups = new Map<string, Tomb[]>();
  items.forEach((tomb) => {
    const key = `${getNameKey(tomb)}|${tomb.province ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(tomb);
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
    const visited = new Set<number>();
    for (let i = 0; i < group.length; i += 1) {
      if (visited.has(i)) continue;
      const stack = [i];
      const cluster: Tomb[] = [];
      visited.add(i);
      while (stack.length) {
        const idx = stack.pop();
        if (idx == null) continue;
        const tomb = group[idx];
        cluster.push(tomb);
        for (let j = 0; j < group.length; j += 1) {
          if (visited.has(j)) continue;
          if (shouldMergeNearby(tomb, group[j])) {
            visited.add(j);
            stack.push(j);
          }
        }
      }
      if (cluster.length === 1) {
        merged.push(cluster[0]);
        continue;
      }
      const primary = pickPrimaryTomb(cluster);
      const mergedItem = cluster.reduce(
        (acc, item) => (item === primary ? acc : mergeTomb(acc, item)),
        primary
      );
      merged.push(mergedItem);
    }
  });
  return merged;
};

const shouldMergeByPersonName = (a: Tomb, b: Tomb, maxMeters = 20000) => {
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const distance = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    if (distance <= maxMeters) return true;
  }
  const cityA = extractCity(a);
  const cityB = extractCity(b);
  if (cityA && cityB && adminOverlap(cityA, cityB)) return true;
  const countyA = extractCounty(a);
  const countyB = extractCounty(b);
  if (countyA && countyB && adminOverlap(countyA, countyB)) return true;
  return false;
};

const mergeByPersonName = (items: Tomb[]) => {
  const groups = new Map<string, Tomb[]>();
  const passthrough: Tomb[] = [];

  items.forEach((tomb) => {
    const personToken = getPersonToken(tomb);
    if (!personToken) {
      passthrough.push(tomb);
      return;
    }
    const province = tomb.province ?? '';
    const key = `${getNameKey(tomb)}|${personToken}|${province}`;
    const group = groups.get(key);
    if (group) {
      group.push(tomb);
    } else {
      groups.set(key, [tomb]);
    }
  });

  const merged: Tomb[] = [...passthrough];
  groups.forEach((group) => {
    if (group.length === 1) {
      merged.push(group[0]);
      return;
    }
    const visited = new Set<number>();
    for (let i = 0; i < group.length; i += 1) {
      if (visited.has(i)) continue;
      const stack = [i];
      const cluster: Tomb[] = [];
      visited.add(i);
      while (stack.length) {
        const idx = stack.pop();
        if (idx == null) continue;
        const tomb = group[idx];
        cluster.push(tomb);
        for (let j = 0; j < group.length; j += 1) {
          if (visited.has(j)) continue;
          if (shouldMergeByPersonName(tomb, group[j])) {
            visited.add(j);
            stack.push(j);
          }
        }
      }
      if (cluster.length === 1) {
        merged.push(cluster[0]);
        continue;
      }
      const primary = pickPrimaryByPersonLocation(cluster);
      const mergedItem = cluster.reduce(
        (acc, item) => (item === primary ? acc : mergeTomb(acc, item)),
        primary
      );
      merged.push(mergedItem);
    }
  });

  return merged;
};

function mergeByPersonLocation(items: Tomb[]) {
  const groups = new Map<string, Tomb[]>();
  const passthrough: Tomb[] = [];

  items.forEach((tomb) => {
    const key = buildPersonLocationKey(tomb);
    if (!key) {
      passthrough.push(tomb);
      return;
    }
    const group = groups.get(key);
    if (group) {
      group.push(tomb);
    } else {
      groups.set(key, [tomb]);
    }
  });

  const merged: Tomb[] = [...passthrough];
  groups.forEach((group) => {
    if (group.length === 1) {
      merged.push(group[0]);
      return;
    }
    const primary = pickPrimaryByPersonLocation(group);
    const mergedItem = group.reduce((acc, item) => (item === primary ? acc : mergeTomb(acc, item)), primary);
    merged.push(mergedItem);
  });

  return merged;
}

const matchesAliasToken = (candidate: string, aliasToken: string) =>
  candidate === aliasToken || candidate.endsWith(aliasToken) || aliasToken.endsWith(candidate);

const matchesAliasGroup = (tomb: Tomb, aliasTokens: string[]) => {
  if (!aliasTokens.length) return false;
  const candidates = buildPersonCandidates(tomb);

  for (const candidate of candidates) {
    for (const aliasToken of aliasTokens) {
      if (matchesAliasToken(candidate, aliasToken)) return true;
    }
  }
  return false;
};

const resolvePersonKeyForContext = (tomb: Tomb, context: PersonContext) => {
  if (!context.tokens.length) return null;
  const candidates = buildPersonCandidates(tomb);
  if (!candidates.size) return null;
  if (context.canonicalToken && candidates.has(context.canonicalToken)) return context.canonicalToken;
  for (const token of context.tokens) {
    for (const candidate of candidates) {
      if (candidate === token || candidate.includes(token) || token.includes(candidate)) {
        return token;
      }
    }
  }
  return null;
};

const dedupeTombsWithAliases = (items: Tomb[], context: PersonContext) => {
  if (!context.tokens.length) return dedupeTombs(items);
  const groups = new Map<string, Tomb[]>();

  items.forEach((tomb) => {
    const locationKey = buildLocationKey(tomb);
    const aliasHit = context.hasAliasHint ? matchesAliasGroup(tomb, context.aliasTokens) : false;
    const personKey = aliasHit ? context.canonicalToken : resolvePersonKeyForContext(tomb, context);
    const keyBase = personKey ? `person:${personKey}` : `name:${getNameKey(tomb)}`;
    const key = `${keyBase}|${locationKey}`;
    const group = groups.get(key);
    if (group) {
      group.push(tomb);
    } else {
      groups.set(key, [tomb]);
    }
  });

  const result: Tomb[] = [];
  groups.forEach((group, key) => {
    if (group.length === 1) {
      result.push(group[0]);
      return;
    }
    const isAliasGroup = key.startsWith('person:');
    if (isAliasGroup) {
      const primary = pickPrimaryTomb(group);
      const merged = group.reduce((acc, item) => (item === primary ? acc : mergeTomb(acc, item)), primary);
      result.push(merged);
      return;
    }

    const primary = pickPrimaryTomb(group);
    const merged = group.reduce((acc, item) => (item === primary ? acc : mergeTomb(acc, item)), primary);
    result.push(merged);
  });

  const mergedLoose = mergeLooseByNameProvince(result);
  const mergedNearby = mergeNearbyTombs(mergedLoose);
  return dropProvinceOnlyDuplicates(mergeByPersonLocation(mergeByPersonName(mergedNearby)));
};

export type TombFilters = {
  q?: string | null;
  person?: string | null;
  era?: string | null;
  province?: string | null;
  city?: string | null;
  county?: string | null;
  level?: string | null;
  near?: { lat: number; lng: number } | null;
  radius?: number | null;
  limit?: number | null;
  includeOcr?: boolean | null;
  includeExternal?: boolean | null;
  hasCoords?: boolean | null;
};

type TombListOptions = {
  emptyMode?: 'sample' | 'all';
};

type ExternalSummary = {
  title: string;
  url: string;
  extract: string;
  source: string;
};

const EXTERNAL_CACHE_TTL = 1000 * 60 * 60 * 12;
const externalQueryCache = new Map<string, { ts: number; tombs: Tomb[] }>();
const externalTombCache = new Map<string, { ts: number; tomb: Tomb }>();

const isCacheFresh = (timestamp: number) => Date.now() - timestamp < EXTERNAL_CACHE_TTL;

const readExternalQueryCache = (key: string) => {
  const cached = externalQueryCache.get(key);
  if (!cached) return null;
  if (!isCacheFresh(cached.ts)) {
    externalQueryCache.delete(key);
    return null;
  }
  return cached.tombs;
};

const writeExternalQueryCache = (key: string, tombs: Tomb[]) => {
  const timestamp = Date.now();
  externalQueryCache.set(key, { ts: timestamp, tombs });
  tombs.forEach((tomb) => externalTombCache.set(tomb.id, { ts: timestamp, tomb }));
};

const readExternalTombCache = (id: string) => {
  const cached = externalTombCache.get(id);
  if (!cached) return null;
  if (!isCacheFresh(cached.ts)) {
    externalTombCache.delete(id);
    return null;
  }
  return cached.tomb;
};

const buildExternalCacheKey = (filters: TombFilters, baseQuery: string, personQuery: string) => {
  const nearKey = filters.near
    ? `${filters.near.lat.toFixed(3)},${filters.near.lng.toFixed(3)}`
    : null;
  return JSON.stringify({
    baseQuery: baseQuery.trim(),
    personQuery: personQuery.trim(),
    era: filters.era ?? null,
    province: filters.province ?? null,
    city: filters.city ?? null,
    county: filters.county ?? null,
    level: filters.level ?? null,
    near: nearKey,
    radius: filters.radius ?? null
  });
};

const buildQueryTokens = (value: string) => {
  if (!value) return [];
  const parts = splitSearchTerms(value);
  const tokens = parts.map((part) => normalizeToken(part)).filter(Boolean) as string[];
  return Array.from(new Set(tokens));
};

const EXTERNAL_QUERY_SUFFIXES = [
  '陵墓',
  '墓',
  '墓地',
  '墓群',
  '帝陵',
  '王陵',
  '皇陵',
  '陵寝',
  '陵园',
  '陵',
  '冢',
  '坟',
  '祠堂',
  '祠'
];

const isTombQuery = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length < 2) return false;
  return TOMB_NAME_PATTERN.test(trimmed) || TOMB_STRONG_PATTERN.test(trimmed);
};

const buildExternalSearchQueries = (baseQuery: string, personQuery: string | null) => {
  const candidates = new Set<string>();
  const addVariants = (
    value: string,
    options: { includeBare: boolean; preferBare?: boolean }
  ) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    const includeBare = options.includeBare;
    const preferBare = options.preferBare ?? false;
    const add = (variant: string) => {
      if (variant.length >= 2) candidates.add(variant);
    };
    if (includeBare && preferBare) add(trimmed);
    EXTERNAL_QUERY_SUFFIXES.forEach((suffix) => {
      if (trimmed.endsWith(suffix)) return;
      add(`${trimmed} ${suffix}`);
      add(`${trimmed}${suffix}`);
    });
    if (includeBare && !preferBare) add(trimmed);
  };
  if (baseQuery) {
    const baseIsTomb = isTombQuery(baseQuery);
    addVariants(baseQuery, { includeBare: baseIsTomb, preferBare: baseIsTomb });
  }
  if (personQuery && personQuery.trim() && personQuery.trim() !== baseQuery.trim()) {
    const personIsTomb = isTombQuery(personQuery);
    addVariants(personQuery, { includeBare: personIsTomb, preferBare: personIsTomb });
  }
  return Array.from(candidates);
};

const pickExternalTombName = (summary: ExternalSummary, fallbackQuery: string) => {
  if (TOMB_NAME_PATTERN.test(summary.title)) return summary.title;
  const candidates = extractTombNameCandidates(summary.extract);
  if (candidates.length) return candidates[0];
  if (TOMB_NAME_PATTERN.test(fallbackQuery)) return fallbackQuery;
  return summary.title;
};

const buildExternalTomb = async (payload: {
  summary: ExternalSummary;
  query: string;
  personQuery: string;
  personTokens: string[];
}) => {
  const { summary, query, personQuery, personTokens } = payload;
  const titleHasTomb = TOMB_NAME_PATTERN.test(summary.title);
  const titleStrong = TOMB_STRONG_PATTERN.test(summary.title);
  const extractStrong = TOMB_STRONG_PATTERN.test(summary.extract);
  const queryHasTomb = TOMB_NAME_PATTERN.test(query);
  if (!titleHasTomb && !(queryHasTomb && extractStrong)) return null;
  if (titleHasTomb && !titleStrong && !extractStrong) return null;

  if (personTokens.length) {
    const haystack = normalizeText(`${summary.title} ${summary.extract}`);
    if (!personTokens.some((token) => haystack.includes(token))) {
      return null;
    }
  }

  const name = pickExternalTombName(summary, query);
  if (!name) return null;

  const canonicalPerson = personQuery
    ? resolveCanonicalPerson(personQuery, personTokens).trim()
    : '';
  const inferredPerson = inferPersonFromName(name) ?? '';
  const person = canonicalPerson || inferredPerson || undefined;

  const locationFromExtract = extractLocationFromText(summary.extract);
  const locationFromTitle = extractLocationFromText(summary.title);
  const province = locationFromExtract.province ?? locationFromTitle.province;
  const city = locationFromExtract.city ?? locationFromTitle.city;
  const county = locationFromExtract.county ?? locationFromTitle.county;
  const address = locationFromExtract.address ?? locationFromTitle.address;
  const coords =
    address && address.length >= 2 ? await geocodeAddress(address, city ?? undefined) : null;

  return {
    id: `external-${hashString(`${summary.title}-${summary.url ?? ''}`)}`,
    name,
    person,
    level: 'external',
    category: '外部检索',
    province: province ?? undefined,
    city: city ?? undefined,
    county: county ?? undefined,
    address: address ?? undefined,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    source: { title: summary.title, url: summary.url, note: summary.source }
  } as Tomb;
};

const matchesExternalFilters = (tomb: Tomb, filters: TombFilters) => {
  if (filters.level && filters.level !== 'external') return false;
  if (!matchesAdminFilters(tomb, filters)) return false;
  if (filters.hasCoords && !hasPreciseCoords(tomb)) return false;
  if (filters.near) {
    if (tomb.lat == null || tomb.lng == null) return false;
    const radius = filters.radius ?? 20000;
    const distance = haversineMeters(filters.near.lat, filters.near.lng, tomb.lat, tomb.lng);
    if (distance > radius) return false;
  }
  return true;
};

const fetchExternalFallback = async (payload: {
  filters: TombFilters;
  baseQuery: string;
  personQuery: string;
  personTokens: string[];
}) => {
  const { filters, baseQuery, personQuery, personTokens } = payload;
  if (filters.level && filters.level !== 'external') return [];
  const cacheKey = buildExternalCacheKey(filters, baseQuery, personQuery);
  const cached = readExternalQueryCache(cacheKey);
  if (cached) return cached;

  const queries = buildExternalSearchQueries(baseQuery, personQuery);
  if (!queries.length) {
    writeExternalQueryCache(cacheKey, []);
    return [];
  }

  const queryTokens = buildQueryTokens(baseQuery);
  const tokens = Array.from(new Set([...personTokens, ...queryTokens]));

  for (const query of queries) {
    const summary = await fetchRichSummary(query, [], {
      name: baseQuery,
      person: personQuery,
      aliases: []
    });
    if (!summary) continue;
    const tomb = await buildExternalTomb({
      summary,
      query,
      personQuery,
      personTokens: tokens
    });
    if (!tomb) continue;
    if (!matchesExternalFilters(tomb, filters)) continue;
    const results = [tomb];
    writeExternalQueryCache(cacheKey, results);
    return results;
  }

  writeExternalQueryCache(cacheKey, []);
  return [];
};

const baseSeedFilter = (filters: TombFilters, options: { includeAll?: boolean } = {}) => {
  const q = filters.q ? normalizeText(filters.q) : null;
  const radius = filters.radius ?? 20000;
  const includeOcr = Boolean(filters.includeOcr);
  const includeAll = Boolean(options.includeAll);
  const hasCoords = Boolean(filters.hasCoords);

  const base = seedTombs
    .map(normalizeTomb)
    .filter((tomb) => includeAll || qualityFilter(tomb, includeOcr))
    .filter((tomb) => (!hasCoords ? true : hasPreciseCoords(tomb)))
    .filter((tomb) => {
      if (filters.level && tomb.level !== filters.level) return false;
      if (!matchesEraFilter(tomb, filters.era)) return false;
      if (!matchesAdminFilters(tomb, filters)) return false;
      if (filters.near && tomb.lat != null && tomb.lng != null) {
        const distance = haversineMeters(filters.near.lat, filters.near.lng, tomb.lat, tomb.lng);
        if (distance > radius) return false;
      } else if (filters.near) {
        return false;
      }
      return true;
    });

  if (!q) return base;

  return base.filter((tomb) => {
    const haystack = buildSearchText(tomb);
    return haystack.includes(q);
  });
};

const matchesSummaryFilters = (tomb: Tomb, filters: TombFilters, includeOcr: boolean) => {
  if (!qualityFilter(tomb, includeOcr)) return false;
  if (filters.level && tomb.level !== filters.level) return false;
  if (!matchesEraFilter(tomb, filters.era)) return false;
  if (!matchesAdminFilters(tomb, filters)) return false;
  if (filters.hasCoords && !hasPreciseCoords(tomb)) return false;
  if (filters.near) {
    if (tomb.lat == null || tomb.lng == null) return false;
    const radius = filters.radius ?? 20000;
    const distance = haversineMeters(filters.near.lat, filters.near.lng, tomb.lat, tomb.lng);
    if (distance > radius) return false;
  }
  return true;
};

const summaryIndexFallback = (filters: TombFilters, personContext: PersonContext) => {
  const includeOcr = Boolean(filters.includeOcr);
  const q = filters.q ? normalizeText(filters.q) : null;
  const nameQueryToken =
    filters.q && TOMB_NAME_PATTERN.test(filters.q) ? normalizeText(filters.q) : null;
  const candidates = listSummaryIndexTombs()
    .map(normalizeTomb)
    .filter((tomb) => matchesSummaryFilters(tomb, filters, includeOcr));

  const queryFiltered = q
    ? candidates.filter((tomb) => buildSearchText(tomb).includes(q))
    : candidates;
  const personFiltered = personContext.tokens.length
    ? queryFiltered.filter((tomb) => matchesPersonStrict(tomb, personContext))
    : queryFiltered;

  if (!nameQueryToken || nameQueryToken.length < 2) return personFiltered;
  return personFiltered.filter((tomb) => matchesTombNameQuery(tomb, nameQueryToken));
};

const titleFallbackFilter = (filters: TombFilters, titles: string[]) => {
  const radius = filters.radius ?? 20000;
  const includeOcr = Boolean(filters.includeOcr);
  const hasCoords = Boolean(filters.hasCoords);
  const normalizedTitles = titles.map((title) => normalizeText(title)).filter(Boolean);
  if (!normalizedTitles.length) return [];

  return seedTombs
    .map(normalizeTomb)
    .filter((tomb) => qualityFilter(tomb, includeOcr))
    .filter((tomb) => {
      if (hasCoords && !hasPreciseCoords(tomb)) return false;
      if (filters.level && tomb.level !== filters.level) return false;
      if (!matchesEraFilter(tomb, filters.era)) return false;
      if (!matchesAdminFilters(tomb, filters)) return false;
      if (filters.near && tomb.lat != null && tomb.lng != null) {
        const distance = haversineMeters(filters.near.lat, filters.near.lng, tomb.lat, tomb.lng);
        if (distance > radius) return false;
      } else if (filters.near) {
        return false;
      }
      return true;
    })
    .filter((tomb) => {
      const name = normalizeText(tomb.name);
      const aliases = (tomb.aliases ?? []).map((alias) => normalizeText(alias));
      return normalizedTitles.some((title) => name.includes(title) || title.includes(name) || aliases.includes(title));
    });
};

const extractTombNamesFromText = (text: string) => {
  if (!text) return [];
  const matches = Array.from(
    text.matchAll(/([\u4e00-\u9fa5]{1,8}(?:墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟|祠堂|祠))/g)
  ).map((m) => m[1]);
  const normalized = matches.map((item) => normalizeText(item)).filter(Boolean);
  return Array.from(new Set(normalized));
};

const extractTombNameCandidates = (text: string) => {
  if (!text) return [];
  const matches = Array.from(
    text.matchAll(/([\u4e00-\u9fa5]{1,12}(?:墓群|墓地|陵园|陵寝|帝陵|王陵|皇陵|陵墓|墓|陵|冢|坟|祠堂|祠))/g)
  ).map((m) => m[1]?.trim());
  return Array.from(new Set(matches.filter(Boolean))) as string[];
};

const extractHonorificsFromText = (text: string) => {
  if (!text) return [];
  const matches = [
    ...Array.from(text.matchAll(/谥(?:号|曰|为)?([\u4e00-\u9fa5]{1,6})/g)).map((m) => m[1]),
    ...Array.from(text.matchAll(/追号(?:为)?([\u4e00-\u9fa5]{1,6})/g)).map((m) => m[1]),
    ...Array.from(text.matchAll(/封([\u4e00-\u9fa5]{1,6}侯)/g)).map((m) => m[1]),
    ...Array.from(text.matchAll(/封([\u4e00-\u9fa5]{1,6}公)/g)).map((m) => m[1])
  ].filter(Boolean);
  const normalized = matches.map((item) => normalizeText(item)).filter(Boolean);
  return Array.from(new Set(normalized));
};

const summaryFallbackFilter = (filters: TombFilters, summaryText: string) => {
  const radius = filters.radius ?? 20000;
  const includeOcr = Boolean(filters.includeOcr);
  const hasCoords = Boolean(filters.hasCoords);
  const normalizedSummary = normalizeText(summaryText);
  if (!normalizedSummary) return [];

  const candidates = extractTombNamesFromText(summaryText);
  const honorifics = extractHonorificsFromText(summaryText);
  if (!candidates.length && !honorifics.length) return [];

  const summaryProvinces = PROVINCES.filter((province) => summaryText.includes(province));

  return seedTombs
    .map(normalizeTomb)
    .filter((tomb) => qualityFilter(tomb, includeOcr))
    .filter((tomb) => {
      if (hasCoords && !hasPreciseCoords(tomb)) return false;
      if (filters.level && tomb.level !== filters.level) return false;
      if (!matchesEraFilter(tomb, filters.era)) return false;
      if (!matchesAdminFilters(tomb, filters)) return false;
      if (filters.near && tomb.lat != null && tomb.lng != null) {
        const distance = haversineMeters(filters.near.lat, filters.near.lng, tomb.lat, tomb.lng);
        if (distance > radius) return false;
      } else if (filters.near) {
        return false;
      }
      return true;
    })
    .filter((tomb) => {
      if (summaryProvinces.length && tomb.province && !summaryProvinces.includes(tomb.province)) {
        return false;
      }
      const name = normalizeText(tomb.name);
      const aliases = (tomb.aliases ?? []).map((alias) => normalizeText(alias));
      const candidateHit = candidates.includes(name) || aliases.some((alias) => candidates.includes(alias));
      if (candidateHit) return true;
      if (!honorifics.length) return false;
      return honorifics.some((honor) =>
        name.includes(honor) || aliases.some((alias) => alias.includes(honor))
      );
    });
};

const extractLocationFromText = (text: string) => {
  if (!text) {
    return { province: null, city: null, county: null, address: null };
  }
  const province = PROVINCES.find((item) => text.includes(item)) ?? null;
  const city = matchLastToken(text, /([\u4e00-\u9fa5]{1,6}市)/g);
  const countyRaw = matchLastToken(text, /([\u4e00-\u9fa5]{1,8}(?:区|县|旗|市))/g);
  const county = countyRaw && countyRaw !== city ? countyRaw : null;
  const address = [province, city, county].filter(Boolean).join('') || null;
  return { province, city, county, address };
};

const applyLocationQuery = (filters: TombFilters) => {
  if (!filters.q) return { filters, locationOnly: false };
  if (filters.province || filters.city || filters.county) return { filters, locationOnly: false };

  const location = extractLocationFromText(filters.q);
  if (!location.province && !location.city && !location.county) {
    return { filters, locationOnly: false };
  }

  let remaining = normalizeText(filters.q);
  [location.province, location.city, location.county].filter(Boolean).forEach((token) => {
    remaining = remaining.replace(normalizeText(token as string), '');
  });
  const locationOnly = remaining.length < 2;
  return {
    filters: {
      ...filters,
      province: location.province ?? filters.province ?? null,
      city: location.city ?? filters.city ?? null,
      county: location.county ?? filters.county ?? null,
      q: locationOnly ? null : filters.q
    },
    locationOnly
  };
};

const hashString = (value: string) =>
  Array.from(value).reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) >>> 0, 0).toString(16);

const isEmptySearch = (filters: TombFilters) =>
  !filters.q &&
  !filters.person &&
  !filters.era &&
  !filters.province &&
  !filters.city &&
  !filters.county &&
  !filters.level &&
  !filters.near;

const matchesEraFilter = (tomb: Tomb, era?: string | null) => {
  const normalizedQuery = normalizeText(era ?? '');
  if (!normalizedQuery) return true;
  const normalizedEra = normalizeText(tomb.era ?? '');
  if (!normalizedEra) return false;
  return normalizedEra.includes(normalizedQuery) || normalizedQuery.includes(normalizedEra);
};

const buildSeedSample = (filters: TombFilters) => {
  const includeOcr = Boolean(filters.includeOcr);
  const nationals = seedTombs
    .map(normalizeTomb)
    .filter((tomb) => qualityFilter(tomb, includeOcr))
    .filter((tomb) => tomb.level === 'national');
  const groups = new Map<string, Tomb[]>();
  nationals.forEach((tomb) => {
    const province = inferProvince(tomb) ?? tomb.province;
    if (!province) return;
    if (!groups.has(province)) groups.set(province, []);
    groups.get(province)!.push(tomb);
  });
  const picks: Tomb[] = [];
  groups.forEach((items) => {
    if (!items.length) return;
    const pick = items[Math.floor(Math.random() * items.length)];
    picks.push(pick);
  });
  return dedupeTombs(picks);
};

const buildStatsSummary = (items: Tomb[]) => {
  const counts = new Map<string, number>();
  items.forEach((tomb) => {
    const name = tomb.province ?? '未知';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  const byProvince = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return { total: items.length, byProvince };
};

export const getSeedStats = (
  filters: TombFilters,
  options: { dedupe?: boolean; includeAll?: boolean } = {}
) => {
  const items = baseSeedFilter(filters, { includeAll: options.includeAll });
  const scoped = options.dedupe === false ? items : dedupeTombs(items);
  return buildStatsSummary(scoped);
};

export const listTombs = async (filters: TombFilters, options: TombListOptions = {}): Promise<Tomb[]> => {
  const normalizedFilters: TombFilters = {
    ...filters,
    q: filters.q?.trim() || null,
    person: filters.person?.trim() || null,
    era: filters.era?.trim() || null,
    province: filters.province?.trim() || null,
    city: filters.city?.trim() || null,
    county: filters.county?.trim() || null,
    level: filters.level?.trim() || null,
    includeExternal: Boolean(filters.includeExternal),
    hasCoords: Boolean(filters.hasCoords)
  };
  const locationApplied = applyLocationQuery(normalizedFilters);
  let adjustedFilters = locationApplied.filters;
  let locationOnlyQuery = locationApplied.locationOnly;
  if (
    !adjustedFilters.q &&
    adjustedFilters.person &&
    !adjustedFilters.era &&
    !adjustedFilters.province &&
    !adjustedFilters.city &&
    !adjustedFilters.county
  ) {
    const personLocation = applyLocationQuery({ ...adjustedFilters, q: adjustedFilters.person });
    if (personLocation.locationOnly) {
      adjustedFilters = { ...personLocation.filters, person: null };
      locationOnlyQuery = true;
    }
  }
  const hasExplicitPersonQuery = Boolean(adjustedFilters.person && adjustedFilters.person.trim());
  const inferredPersonInput = adjustedFilters.person ?? inferPersonInputFromQuery(adjustedFilters.q);
  const personContext = await buildPersonContext(inferredPersonInput ?? null);
  const personTokens = personContext.tokens;
  const personQuery = (personContext.query ?? '').trim();
  const baseQuery = (adjustedFilters.q ?? '').trim() || personQuery;
  const relevanceQuery = adjustedFilters.q ?? adjustedFilters.person ?? null;
  const shouldFallback = !locationOnlyQuery && baseQuery.length >= 2;
  const emptyMode = options.emptyMode ?? 'sample';
  const nameQueryToken =
    adjustedFilters.q && TOMB_NAME_PATTERN.test(adjustedFilters.q) ? normalizeText(adjustedFilters.q) : null;
  const applyPersonFilter = (items: Tomb[]) => {
    if (!personTokens.length) return items;
    if (!hasExplicitPersonQuery && nameQueryToken && nameQueryToken.length >= 2) {
      return items.filter(
        (tomb) =>
          matchesPersonStrict(tomb, personContext) ||
          (isSinorelic(tomb) && matchesTombAddressQuery(tomb, nameQueryToken))
      );
    }
    return items.filter((tomb) => matchesPersonStrict(tomb, personContext));
  };
  const applyNameFilter = (items: Tomb[]) =>
    nameQueryToken && nameQueryToken.length >= 2
      ? items.filter(
          (tomb) =>
            matchesTombNameQuery(tomb, nameQueryToken) ||
            (isSinorelic(tomb) && matchesTombAddressQuery(tomb, nameQueryToken))
        )
      : items;
  const dedupeForSearch = (items: Tomb[]) => dedupeTombsWithAliases(items, personContext);

  if (isEmptySearch(adjustedFilters) && emptyMode === 'sample') {
    if (!hasTombDatabase) {
      return buildSeedSample(adjustedFilters);
    }

    const sampleResult = await query<Tomb>(
      `SELECT DISTINCT ON (province) id, name, person, aliases, level, category, era, province, city, county, address,
        ST_Y(geom)::float AS lat, ST_X(geom)::float AS lng, source
       FROM tombs
       WHERE level = 'national' AND province IS NOT NULL
       ORDER BY province, random()
       LIMIT 200`
    );
    const includeOcr = Boolean(filters.includeOcr);
    const rows = sampleResult.rows.map(normalizeTomb).filter((tomb: Tomb) => qualityFilter(tomb, includeOcr));
    return dedupeTombs(rows);
  }

  if (!hasTombDatabase) {
    const items = applyNameFilter(applyPersonFilter(baseSeedFilter(adjustedFilters)));
    const limit = adjustedFilters.limit ?? null;
    if (items.length || (!adjustedFilters.q && !adjustedFilters.person)) {
      let deduped = dedupeForSearch(items);
      if (adjustedFilters.includeExternal && shouldFallback) {
        const external = await fetchExternalFallback({
          filters: adjustedFilters,
          baseQuery,
          personQuery,
          personTokens
        });
        if (external.length) {
          const externalFiltered = applyNameFilter(applyPersonFilter(external));
          deduped = dedupeForSearch([...deduped, ...externalFiltered]);
        }
      }
      const sorted = relevanceQuery ? sortTombsByQueryRelevance(deduped, relevanceQuery) : deduped;
      return limit ? sorted.slice(0, limit) : sorted;
    }

    if (!shouldFallback) return [];

    const summary = await fetchRichSummary(baseQuery, []);
    if (summary?.extract) {
      const summaryItems = applyNameFilter(
        applyPersonFilter(summaryFallbackFilter(adjustedFilters, summary.extract))
      );
      if (summaryItems.length) {
        const dedupedSummary = dedupeForSearch(summaryItems);
        const sorted = relevanceQuery
          ? sortTombsByQueryRelevance(dedupedSummary, relevanceQuery)
          : dedupedSummary;
        return limit ? sorted.slice(0, limit) : sorted;
      }
    }
    const queries = [
      `${baseQuery} 墓`,
      `${baseQuery} 陵`,
      `${baseQuery} 冢`,
      `${baseQuery} 陵墓`,
      `${baseQuery} 墓地`,
      `${baseQuery} 祠`,
      `${baseQuery} 祠堂`
    ];
    const baikeSummaries = await Promise.all(queries.map((term) => fetchBaikeSummary(term)));
    for (const summaryItem of baikeSummaries) {
      if (!summaryItem?.extract) continue;
      const summaryItems = applyNameFilter(
        applyPersonFilter(summaryFallbackFilter(adjustedFilters, summaryItem.extract))
      );
      if (summaryItems.length) {
        const dedupedSummary = dedupeForSearch(summaryItems);
        const sorted = relevanceQuery
          ? sortTombsByQueryRelevance(dedupedSummary, relevanceQuery)
          : dedupedSummary;
        return limit ? sorted.slice(0, limit) : sorted;
      }
    }
    const baikeTitles = Array.from(
      new Set(baikeSummaries.map((item) => item?.title).filter(Boolean) as string[])
    );
    if (baikeTitles.length) {
      const baikeItems = applyNameFilter(applyPersonFilter(titleFallbackFilter(adjustedFilters, baikeTitles)));
      if (baikeItems.length) {
        const dedupedBaike = dedupeForSearch(baikeItems);
        const sorted = relevanceQuery
          ? sortTombsByQueryRelevance(dedupedBaike, relevanceQuery)
          : dedupedBaike;
        return limit ? sorted.slice(0, limit) : sorted;
      }
    }
    const titleResults = await Promise.all(queries.map((term) => fetchWikiSearchTitles(term, 5)));
    const titles = Array.from(new Set(titleResults.flat()));
    const fallbackItems = applyNameFilter(applyPersonFilter(titleFallbackFilter(adjustedFilters, titles)));
    const dedupedFallback = dedupeForSearch(fallbackItems);
    if (dedupedFallback.length) {
      const sorted = relevanceQuery
        ? sortTombsByQueryRelevance(dedupedFallback, relevanceQuery)
        : dedupedFallback;
      return limit ? sorted.slice(0, limit) : sorted;
    }
    const external = await fetchExternalFallback({
      filters: adjustedFilters,
      baseQuery,
      personQuery,
      personTokens
    });
    if (external.length) {
      const externalFiltered = applyNameFilter(applyPersonFilter(external));
      const sorted = relevanceQuery
        ? sortTombsByQueryRelevance(externalFiltered, relevanceQuery)
        : externalFiltered;
      return limit ? sorted.slice(0, limit) : sorted;
    }
    return [];
  }

  const conditions: string[] = [];
  const params: Array<string | number> = [];
  let idx = 1;

  if (adjustedFilters.level) {
    conditions.push(`level = $${idx++}`);
    params.push(adjustedFilters.level);
  }
  if (adjustedFilters.era) {
    conditions.push(`era ILIKE $${idx++}`);
    params.push(`%${adjustedFilters.era}%`);
  }
  if (adjustedFilters.province) {
    if (shouldUseAdminLike(adjustedFilters.province)) {
      conditions.push(`province ILIKE $${idx++}`);
      params.push(`%${adjustedFilters.province}%`);
    } else {
      conditions.push(`province = $${idx++}`);
      params.push(adjustedFilters.province);
    }
  }
  if (adjustedFilters.city) {
    if (shouldUseAdminLike(adjustedFilters.city)) {
      conditions.push(`city ILIKE $${idx++}`);
      params.push(`%${adjustedFilters.city}%`);
    } else {
      conditions.push(`city = $${idx++}`);
      params.push(adjustedFilters.city);
    }
  }
  if (adjustedFilters.county) {
    if (shouldUseAdminLike(adjustedFilters.county)) {
      conditions.push(`county ILIKE $${idx++}`);
      params.push(`%${adjustedFilters.county}%`);
    } else {
      conditions.push(`county = $${idx++}`);
      params.push(adjustedFilters.county);
    }
  }
  if (adjustedFilters.q) {
    conditions.push(`(search_text ILIKE $${idx} OR address ILIKE $${idx})`);
    params.push(`%${adjustedFilters.q}%`);
    idx += 1;
  }
  if (adjustedFilters.person) {
    conditions.push(`(search_text ILIKE $${idx} OR address ILIKE $${idx})`);
    params.push(`%${adjustedFilters.person}%`);
    idx += 1;
  }
  if (adjustedFilters.near) {
    conditions.push(
      `ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)::geography, $${idx++})`
    );
    params.push(adjustedFilters.near.lng, adjustedFilters.near.lat, adjustedFilters.radius ?? 20000);
  }
  if (adjustedFilters.hasCoords) {
    conditions.push('geom IS NOT NULL');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = adjustedFilters.limit ?? 10000;

  const result = await query<Tomb>(
    `SELECT id, name, person, aliases, level, category, era, province, city, county, address,
      ST_Y(geom)::float AS lat, ST_X(geom)::float AS lng, source
     FROM tombs
     ${whereClause}
     ORDER BY level, name
     LIMIT ${limit}`,
    params
  );

  const includeOcr = Boolean(adjustedFilters.includeOcr);
  const rows = result.rows
    .map((row) => normalizeTomb(row) as Tomb)
    .filter((tomb) => qualityFilter(tomb, includeOcr))
    .filter((tomb) => (!adjustedFilters.hasCoords ? true : hasPreciseCoords(tomb)));
  const locationFiltered = rows.filter((tomb) => matchesAdminFilters(tomb, adjustedFilters));
  const filtered = applyNameFilter(applyPersonFilter(locationFiltered));
  let merged = dedupeForSearch(filtered);
  if (!filtered.length && shouldFallback) {
    const summaryMatches = summaryIndexFallback(adjustedFilters, personContext);
    if (summaryMatches.length) {
      const dedupedSummary = dedupeForSearch(summaryMatches);
      const sorted = relevanceQuery
        ? sortTombsByQueryRelevance(dedupedSummary, relevanceQuery)
        : dedupedSummary;
      return limit ? sorted.slice(0, limit) : sorted;
    }
  }
  if (!filtered.length && shouldFallback) {
    const external = await fetchExternalFallback({
      filters: adjustedFilters,
      baseQuery,
      personQuery,
      personTokens
    });
    if (external.length) {
      const externalFiltered = applyNameFilter(applyPersonFilter(external));
      const sorted = relevanceQuery
        ? sortTombsByQueryRelevance(externalFiltered, relevanceQuery)
        : externalFiltered;
      return limit ? sorted.slice(0, limit) : sorted;
    }
  }
  if (adjustedFilters.includeExternal && shouldFallback) {
    const external = await fetchExternalFallback({
      filters: adjustedFilters,
      baseQuery,
      personQuery,
      personTokens
    });
    if (external.length) {
      const externalFiltered = applyNameFilter(applyPersonFilter(external));
      merged = dedupeForSearch([...merged, ...externalFiltered]);
    }
  }
  const sorted = relevanceQuery ? sortTombsByQueryRelevance(merged, relevanceQuery) : merged;
  return limit ? sorted.slice(0, limit) : sorted;
};

const pickRandomItems = <T>(items: T[], limit: number) => {
  if (limit <= 0) return [];
  if (items.length <= limit) return [...items];
  const picks: T[] = [];
  const seen = new Set<number>();
  while (picks.length < limit && seen.size < items.length) {
    const idx = Math.floor(Math.random() * items.length);
    if (seen.has(idx)) continue;
    seen.add(idx);
    picks.push(items[idx]!);
  }
  return picks;
};

export const listFamousTombs = async (options: { limit?: number } = {}): Promise<Tomb[]> => {
  const limit = Math.max(1, Math.min(60, Math.floor(options.limit ?? 18)));

  if (!hasTombDatabase) {
    const items = seedTombs
      .map(normalizeTomb)
      .filter((tomb) => Boolean(tomb.person && tomb.person.trim()))
      .filter((tomb) => (tomb.person ? tomb.name.includes(tomb.person) : false))
      .filter((tomb) => Boolean(tomb.image_urls?.length))
      .filter((tomb) => tomb.level !== 'external');
    return dedupeTombs(pickRandomItems(items, limit));
  }

  const result = await query<Tomb>(
    `SELECT id, name, person, aliases, level, category, era, province, city, county, address,
      ST_Y(geom)::float AS lat, ST_X(geom)::float AS lng, source
     FROM tombs
     WHERE person IS NOT NULL AND length(trim(person)) > 0 AND level <> 'external'
       AND position(person in name) > 0
       AND image_urls IS NOT NULL AND array_length(image_urls, 1) > 0
     ORDER BY random()
     LIMIT $1`,
    [limit]
  );
  return dedupeTombs(result.rows.map(normalizeTomb));
};

export const listTombsByIds = async (ids: string[]): Promise<Tomb[]> => {
  const unique = Array.from(new Set((ids ?? []).map((id) => id?.trim()).filter(Boolean))) as string[];
  if (!unique.length) return [];

  if (!hasTombDatabase) {
    const index = new Map(unique.map((id, idx) => [id, idx]));
    const items = seedTombs
      .filter((item) => index.has(item.id))
      .map(normalizeTomb)
      .sort((a, b) => (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0));
    return dedupeTombs(items);
  }

  const index = new Map(unique.map((id, idx) => [id, idx]));
  const result = await query<Tomb>(
    `SELECT id, name, person, aliases, level, category, era, province, city, county, address,
      ST_Y(geom)::float AS lat, ST_X(geom)::float AS lng, source
     FROM tombs
     WHERE id = ANY($1::text[])`,
    [unique]
  ).catch(() => null);

  const rows = (result?.rows ?? []).map(normalizeTomb).sort((a, b) => (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0));
  return dedupeTombs(rows);
};

const buildDetailWithoutInteractions = (tomb: Tomb): TombDetail => {
  const normalized = normalizeTomb(tomb);
  const images = buildSeedImages(normalized);
  return {
    ...normalized,
    images,
    stats: {
      likes: 0,
      checkins: 0,
      comments: 0
    },
    commentList: []
  };
};

const RELATED_SCORE_LEVEL: Record<string, number> = {
  national: 5,
  provincial: 4,
  city: 3,
  county: 2,
  external: 1
};

const relatedTombCandidates = dedupeTombs(
  seedTombs.map(normalizeTomb).filter((item) => qualityFilter(item))
);

const sharesPersonContext = (source: Tomb, candidate: Tomb) => {
  const sourceCandidates = buildPersonCandidates(source);
  if (!sourceCandidates.size) return false;
  const candidateCandidates = buildPersonCandidates(candidate);
  if (!candidateCandidates.size) return false;
  for (const token of sourceCandidates) {
    if (candidateCandidates.has(token)) return true;
  }
  return false;
};

const buildRelatedScore = (source: Tomb, candidate: Tomb) => {
  if (!candidate.id || candidate.id === source.id) return null;

  const sourceProvince = source.province ?? null;
  const candidateProvince = candidate.province ?? null;
  const sameCategory = normalizeText(source.category ?? '') === normalizeText(candidate.category ?? '');
  const sameProvince =
    sourceProvince && candidateProvince
      ? normalizeText(sourceProvince) === normalizeText(candidateProvince)
      : false;
  const sourceCity = extractCity(source);
  const candidateCity = extractCity(candidate);
  const sameCity = Boolean(sourceCity && candidateCity && adminOverlap(sourceCity, candidateCity));
  const sourceCounty = extractCounty(source);
  const candidateCounty = extractCounty(candidate);
  const sameCounty = Boolean(sourceCounty && candidateCounty && adminOverlap(sourceCounty, candidateCounty));
  const sameEra = Boolean(normalizeText(source.era ?? '')) && matchesEraFilter(candidate, source.era);
  const samePerson = sharesPersonContext(source, candidate);
  const sameLevel = Boolean(source.level && candidate.level && source.level === candidate.level);

  let distanceMeters: number | null = null;
  let distanceScore = 0;
  if (source.lat != null && source.lng != null && candidate.lat != null && candidate.lng != null) {
    distanceMeters = haversineMeters(source.lat, source.lng, candidate.lat, candidate.lng);
    if (distanceMeters <= 5_000) distanceScore = 28;
    else if (distanceMeters <= 20_000) distanceScore = 20;
    else if (distanceMeters <= 80_000) distanceScore = 12;
    else if (distanceMeters <= 200_000) distanceScore = 6;
  }

  const score =
    (samePerson ? 80 : 0) +
    (sameEra ? 34 : 0) +
    (sameCategory ? 22 : 0) +
    (sameProvince ? 16 : 0) +
    (sameCity ? 14 : 0) +
    (sameCounty ? 10 : 0) +
    (sameLevel ? 6 : 0) +
    distanceScore;

  const hasStrongSignal = samePerson || sameEra || sameCategory || sameProvince || sameCity || sameCounty || distanceScore > 0;
  if (!hasStrongSignal || score <= 0) return null;

  return { score, distanceMeters };
};

export const listRelatedTombs = async (tomb: Tomb, limit = 6): Promise<Tomb[]> => {
  const normalizedSource = normalizeTomb(tomb);
  const candidates = relatedTombCandidates;

  return candidates
    .map((candidate) => {
      const related = buildRelatedScore(normalizedSource, candidate);
      if (!related) return null;
      return {
        candidate,
        score: related.score,
        distanceMeters: related.distanceMeters
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right!.score !== left!.score) return right!.score - left!.score;
      const leftDistance = left!.distanceMeters ?? Number.POSITIVE_INFINITY;
      const rightDistance = right!.distanceMeters ?? Number.POSITIVE_INFINITY;
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      const leftLevel = RELATED_SCORE_LEVEL[left!.candidate.level ?? ''] ?? 0;
      const rightLevel = RELATED_SCORE_LEVEL[right!.candidate.level ?? ''] ?? 0;
      if (rightLevel !== leftLevel) return rightLevel - leftLevel;
      return left!.candidate.name.localeCompare(right!.candidate.name, 'zh-Hans-CN');
    })
    .slice(0, Math.max(1, Math.min(12, limit)))
    .map((entry) => entry!.candidate);
};

const buildDetailFromDatabaseInteractions = async (tomb: Tomb): Promise<TombDetail> => {
  const normalized = normalizeTomb(tomb);
  const images = buildSeedImages(normalized);

  const tombId = normalized.id;
  const statsResult = await query<{ likes: string; checkins: string; comments: string }>(
    `SELECT
      (SELECT COUNT(*)::text FROM public.likes WHERE tomb_id = $1) AS likes,
      (SELECT COUNT(*)::text FROM public.checkins WHERE tomb_id = $1) AS checkins,
      (SELECT COUNT(*)::text FROM public.comments WHERE tomb_id = $1) AS comments`,
    [tombId]
  );
  const stats = statsResult.rows[0];

  return {
    ...normalized,
    images,
    stats: {
      likes: Number(stats?.likes ?? 0),
      checkins: Number(stats?.checkins ?? 0),
      comments: Number(stats?.comments ?? 0)
    },
    commentList: []
  };
};

const resolveMergedSeedDetailTomb = (id: string, base: Tomb) => {
  const nameKey = getNameKey(base);
  const province = base.province ?? null;
  const candidates = seedTombs
    .map(normalizeTomb)
    .filter((tomb) => getNameKey(tomb) === nameKey)
    .filter((tomb) => !province || tomb.province === province);
  const deduped = dedupeTombs(candidates);
  return deduped.find((tomb) => tomb.id === id) ?? base;
};

const resolveMergedDatabaseDetailTomb = async (id: string, base: Tomb) => {
  const name = base.name?.trim();
  if (!name) return base;

  const params: Array<string | number | null> = [];
  const conditions: string[] = [];
  let idx = 1;

  if (base.province) {
    conditions.push(`province = $${idx++}`);
    params.push(base.province);
  }

  conditions.push(`(search_text ILIKE $${idx} OR name ILIKE $${idx} OR address ILIKE $${idx})`);
  params.push(`%${name}%`);
  idx += 1;

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const candidateResult = await query<Tomb>(
    `SELECT id, name, person, aliases, level, category, era, province, city, county, address,
      ST_Y(geom)::float AS lat, ST_X(geom)::float AS lng, source
     FROM tombs
     ${whereClause}
     LIMIT 400`,
    params
  ).catch(() => null);

  const rows = (candidateResult?.rows ?? []).map(normalizeTomb);
  const candidates = rows.some((row) => row.id === base.id) ? rows : [base, ...rows];
  const deduped = dedupeTombs(candidates);
  return deduped.find((tomb) => tomb.id === id) ?? base;
};

const DETAIL_BASE_CACHE_TTL = 1000 * 60 * 10;
const DETAIL_BASE_CACHE_MAX_ENTRIES = 200;
const detailBaseCache = new Map<string, { ts: number; tomb: Tomb }>();

const setDetailBaseCache = (id: string, tomb: Tomb) => {
  detailBaseCache.set(id, { ts: Date.now(), tomb });
  while (detailBaseCache.size > DETAIL_BASE_CACHE_MAX_ENTRIES) {
    const firstKey = detailBaseCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    detailBaseCache.delete(firstKey);
  }
};

export const getTombDetail = async (id: string): Promise<TombDetail | null> => {
  const external = readExternalTombCache(id);
  if (external && !hasTombDatabase) {
    return hasDatabase ? buildDetailFromDatabaseInteractions(external) : buildDetailWithoutInteractions(external);
  }

  const cachedBase = detailBaseCache.get(id);
  if (cachedBase && Date.now() - cachedBase.ts < DETAIL_BASE_CACHE_TTL) {
    return hasDatabase ? buildDetailFromDatabaseInteractions(cachedBase.tomb) : buildDetailWithoutInteractions(cachedBase.tomb);
  }

  const tomb = hasTombDatabase
    ? await query<Tomb>(
        `SELECT id, name, person, aliases, level, category, era, province, city, county, address,
          ST_Y(geom)::float AS lat, ST_X(geom)::float AS lng, source
         FROM tombs WHERE id = $1`,
        [id]
      )
        .then((result) => result.rows[0] ?? null)
        .catch(() => null)
    : seedTombs.find((item) => item.id === id) ?? null;

  if (!tomb) {
    if (external) {
      return hasDatabase ? buildDetailFromDatabaseInteractions(external) : buildDetailWithoutInteractions(external);
    }
    return null;
  }

  const normalized = normalizeTomb(tomb);
  const resolved = hasTombDatabase
    ? await resolveMergedDatabaseDetailTomb(id, normalized)
    : resolveMergedSeedDetailTomb(id, normalized);
  if (hasTombDatabase) {
    setDetailBaseCache(id, resolved);
  }

  return hasDatabase ? buildDetailFromDatabaseInteractions(resolved) : buildDetailWithoutInteractions(resolved);
};

export type TombSearchRankItem = {
  id: string;
  name: string;
  person?: string | null;
  era?: string | null;
  level?: string | null;
  province?: string | null;
  city?: string | null;
  county?: string | null;
  count: number;
};

export const recordTombSearchHit = async (tombId: string) => {
  const id = (tombId ?? '').trim();
  if (!id) return;

  if (!hasDatabase) {
    return;
  }

  await query(
    `INSERT INTO public.tomb_search_counts (tomb_id, search_count, updated_at)
     VALUES ($1, 1, now())
     ON CONFLICT (tomb_id)
     DO UPDATE SET search_count = public.tomb_search_counts.search_count + 1, updated_at = now()`,
    [id]
  );
};

export const listTombSearchRank = async (options: { limit?: number } = {}): Promise<TombSearchRankItem[]> => {
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 10)));

  if (!hasDatabase) {
    return [];
  }

  const result = await query<{ tomb_id: string; search_count: string }>(
    `SELECT tomb_id, search_count::text AS search_count
     FROM public.tomb_search_counts
     WHERE search_count > 0
     ORDER BY search_count DESC, updated_at DESC
     LIMIT $1`,
    [limit]
  );
  const rows = result.rows;
  const ids = rows.map((row) => row.tomb_id);
  const tombs = await listTombsByIds(ids);
  const tombById = new Map(tombs.map((tomb) => [tomb.id, tomb]));
  return rows
    .map((row) => {
      const tomb = tombById.get(row.tomb_id);
      if (!tomb) return null;
      return {
        id: tomb.id,
        name: tomb.name,
        person: tomb.person ?? null,
        era: tomb.era ?? null,
        level: tomb.level ?? null,
        province: tomb.province ?? null,
        city: tomb.city ?? null,
        county: tomb.county ?? null,
        count: Number(row.search_count ?? 0)
      } satisfies TombSearchRankItem;
    })
    .filter(Boolean) as TombSearchRankItem[];
};
