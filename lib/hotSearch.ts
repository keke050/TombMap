export type HotSearchItemType = 'person' | 'city' | 'dynasty' | 'province';

export type HotSearchItem = {
  id: string;
  type: HotSearchItemType;
  label: string;
  apply: {
    person?: string;
    keyword?: string;
    province?: string;
    city?: string;
    county?: string;
    level?: string;
    nearby?: null;
    radius?: number;
  };
};

const PERSON_ITEMS: HotSearchItem[] = [
  { id: 'p-cao-cao', type: 'person', label: '曹操', apply: { person: '曹操' } },
  { id: 'p-liu-bei', type: 'person', label: '刘备', apply: { person: '刘备' } },
  { id: 'p-zhuge-liang', type: 'person', label: '诸葛亮', apply: { person: '诸葛亮' } },
  { id: 'p-sun-quan', type: 'person', label: '孙权', apply: { person: '孙权' } },
  { id: 'p-xiang-yu', type: 'person', label: '项羽', apply: { person: '项羽' } },
  { id: 'p-qin-shi-huang', type: 'person', label: '秦始皇', apply: { person: '秦始皇' } },
  { id: 'p-han-wu-di', type: 'person', label: '汉武帝', apply: { person: '汉武帝' } },
  { id: 'p-tang-tai-zong', type: 'person', label: '唐太宗', apply: { person: '唐太宗' } },
  { id: 'p-wu-ze-tian', type: 'person', label: '武则天', apply: { person: '武则天' } },
  { id: 'p-li-bai', type: 'person', label: '李白', apply: { person: '李白' } },
  { id: 'p-du-fu', type: 'person', label: '杜甫', apply: { person: '杜甫' } },
  { id: 'p-su-shi', type: 'person', label: '苏轼', apply: { person: '苏轼' } },
  { id: 'p-yue-fei', type: 'person', label: '岳飞', apply: { person: '岳飞' } },
  { id: 'p-zhu-yuan-zhang', type: 'person', label: '朱元璋', apply: { person: '朱元璋' } },
  { id: 'p-kang-xi', type: 'person', label: '康熙', apply: { person: '康熙' } },
  { id: 'p-qian-long', type: 'person', label: '乾隆', apply: { person: '乾隆' } },
  { id: 'p-cheng-ji-si-han', type: 'person', label: '成吉思汗', apply: { person: '成吉思汗' } },
  { id: 'p-hu-bi-lie', type: 'person', label: '忽必烈', apply: { person: '忽必烈' } }
];

const CITY_ITEMS: HotSearchItem[] = [
  { id: 'c-xian', type: 'city', label: '西安市', apply: { city: '西安市' } },
  { id: 'c-luoyang', type: 'city', label: '洛阳市', apply: { city: '洛阳市' } },
  { id: 'c-kaifeng', type: 'city', label: '开封市', apply: { city: '开封市' } },
  { id: 'c-beijing', type: 'city', label: '北京市', apply: { city: '北京市' } },
  { id: 'c-nanjing', type: 'city', label: '南京市', apply: { city: '南京市' } },
  { id: 'c-chengdu', type: 'city', label: '成都市', apply: { city: '成都市' } },
  { id: 'c-hangzhou', type: 'city', label: '杭州市', apply: { city: '杭州市' } },
  { id: 'c-suzhou', type: 'city', label: '苏州市', apply: { city: '苏州市' } },
  { id: 'c-yangzhou', type: 'city', label: '扬州市', apply: { city: '扬州市' } },
  { id: 'c-xianyang', type: 'city', label: '咸阳市', apply: { city: '咸阳市' } },
  { id: 'c-anyang', type: 'city', label: '安阳市', apply: { city: '安阳市' } },
  { id: 'c-jinan', type: 'city', label: '济南市', apply: { city: '济南市' } },
  { id: 'c-shanghai', type: 'city', label: '上海市', apply: { city: '上海市' } },
  { id: 'c-guangzhou', type: 'city', label: '广州市', apply: { city: '广州市' } },
  { id: 'c-wuhan', type: 'city', label: '武汉市', apply: { city: '武汉市' } }
];

const DYNASTY_ITEMS: HotSearchItem[] = [
  { id: 'd-qin', type: 'dynasty', label: '秦代', apply: { keyword: '秦代' } },
  { id: 'd-han', type: 'dynasty', label: '汉代', apply: { keyword: '汉代' } },
  { id: 'd-xi-han', type: 'dynasty', label: '西汉', apply: { keyword: '西汉' } },
  { id: 'd-dong-han', type: 'dynasty', label: '东汉', apply: { keyword: '东汉' } },
  { id: 'd-wei-jin', type: 'dynasty', label: '魏晋', apply: { keyword: '魏晋' } },
  { id: 'd-sui', type: 'dynasty', label: '隋代', apply: { keyword: '隋代' } },
  { id: 'd-tang', type: 'dynasty', label: '唐代', apply: { keyword: '唐代' } },
  { id: 'd-song', type: 'dynasty', label: '宋代', apply: { keyword: '宋代' } },
  { id: 'd-yuan', type: 'dynasty', label: '元代', apply: { keyword: '元代' } },
  { id: 'd-ming', type: 'dynasty', label: '明代', apply: { keyword: '明代' } },
  { id: 'd-qing', type: 'dynasty', label: '清代', apply: { keyword: '清代' } },
  { id: 'd-zhanguo', type: 'dynasty', label: '战国', apply: { keyword: '战国' } },
  { id: 'd-sanguo', type: 'dynasty', label: '三国', apply: { keyword: '三国' } }
];

const PROVINCE_ITEMS: HotSearchItem[] = [
  { id: 'pr-shaanxi', type: 'province', label: '陕西省', apply: { province: '陕西省' } },
  { id: 'pr-henan', type: 'province', label: '河南省', apply: { province: '河南省' } },
  { id: 'pr-shandong', type: 'province', label: '山东省', apply: { province: '山东省' } },
  { id: 'pr-hebei', type: 'province', label: '河北省', apply: { province: '河北省' } },
  { id: 'pr-shanxi', type: 'province', label: '山西省', apply: { province: '山西省' } },
  { id: 'pr-jiangsu', type: 'province', label: '江苏省', apply: { province: '江苏省' } },
  { id: 'pr-zhejiang', type: 'province', label: '浙江省', apply: { province: '浙江省' } },
  { id: 'pr-anhui', type: 'province', label: '安徽省', apply: { province: '安徽省' } },
  { id: 'pr-hubei', type: 'province', label: '湖北省', apply: { province: '湖北省' } },
  { id: 'pr-hunan', type: 'province', label: '湖南省', apply: { province: '湖南省' } },
  { id: 'pr-sichuan', type: 'province', label: '四川省', apply: { province: '四川省' } },
  { id: 'pr-guangdong', type: 'province', label: '广东省', apply: { province: '广东省' } },
  { id: 'pr-fujian', type: 'province', label: '福建省', apply: { province: '福建省' } },
  { id: 'pr-liaoning', type: 'province', label: '辽宁省', apply: { province: '辽宁省' } }
];

const ALL_ITEMS: HotSearchItem[] = [...PERSON_ITEMS, ...CITY_ITEMS, ...DYNASTY_ITEMS, ...PROVINCE_ITEMS];

const hashString = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T,>(items: T[], rand: () => number) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const take = <T,>(items: T[], count: number) => items.slice(0, Math.max(0, count));

export const getChinaDateKey = (date: Date = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const key = `${year}-${month}-${day}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
  } catch {
    // Fallback: naive +8h. (Keeps "daily" behavior even if Intl tz fails.)
    const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
};

type DailyHotSearchOptions = {
  count?: number;
  rotate?: number;
  dateKey?: string;
};

export const getDailyHotSearchItems = (options: DailyHotSearchOptions = {}) => {
  const count = options.count ?? 14;
  const rotate = options.rotate ?? 0;
  const dateKey = options.dateKey || getChinaDateKey();
  const rand = mulberry32(hashString(`${dateKey}:${rotate}`));

  const persons = shuffle(PERSON_ITEMS, rand);
  const cities = shuffle(CITY_ITEMS, rand);
  const dynasties = shuffle(DYNASTY_ITEMS, rand);
  const provinces = shuffle(PROVINCE_ITEMS, rand);

  const picked = (() => {
    const personCount = Math.min(6, Math.max(4, Math.round(count * 0.4)));
    const cityCount = Math.min(4, Math.max(3, Math.round(count * 0.25)));
    const dynastyCount = Math.min(4, Math.max(3, Math.round(count * 0.2)));
    const provinceCount = Math.max(2, count - personCount - cityCount - dynastyCount);
    return [
      ...take(persons, personCount),
      ...take(cities, cityCount),
      ...take(dynasties, dynastyCount),
      ...take(provinces, provinceCount)
    ];
  })();

  const unique = new Map<string, HotSearchItem>();
  shuffle(picked, rand).forEach((item) => unique.set(item.id, item));
  const result = Array.from(unique.values());
  if (result.length >= count) return result.slice(0, count);

  const fallback = shuffle(ALL_ITEMS, rand);
  for (const item of fallback) {
    if (unique.has(item.id)) continue;
    unique.set(item.id, item);
    if (unique.size >= count) break;
  }
  return Array.from(unique.values()).slice(0, count);
};
