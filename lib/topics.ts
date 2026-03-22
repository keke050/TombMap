import { dedupeCategoryTombs, isDisplayableTomb, sortTombsByLevel } from './categories';
import type { Tomb } from './types';
import { inferPersonFromName, normalizeText } from './utils';

export type TopicMember = {
  name: string;
  aliases?: string[];
};

export type TopicConfig = {
  slug: string;
  label: string;
  badge: string;
  summary: string;
  description: string;
  accent: string;
  glow: string;
  members: TopicMember[];
};

export const TOPIC_GROUPS: TopicConfig[] = [
  {
    slug: 'tang-song-eight-masters',
    label: '唐宋八大家',
    badge: '唐宋古文',
    summary: '从韩愈到三苏，以墓址串起唐宋古文革新的山河脉络。',
    description: '汇集韩愈、柳宗元、欧阳修、三苏、曾巩、王安石等人物相关古墓。',
    accent: 'rgba(31, 122, 108, 0.92)',
    glow: 'rgba(31, 122, 108, 0.18)',
    members: [
      { name: '韩愈', aliases: ['韩文公'] },
      { name: '柳宗元', aliases: ['柳子厚'] },
      { name: '欧阳修', aliases: ['欧阳文忠'] },
      { name: '苏洵', aliases: ['苏明允', '三苏'] },
      { name: '苏轼', aliases: ['苏东坡', '苏文忠', '三苏'] },
      { name: '苏辙', aliases: ['苏子由', '三苏'] },
      { name: '曾巩', aliases: ['曾子固'] },
      { name: '王安石', aliases: ['王荆公', '王文公'] }
    ]
  },
  {
    slug: 'three-sus',
    label: '三苏',
    badge: '苏门家学',
    summary: '苏洵、苏轼、苏辙父子三人的墓葬与文脉线索。',
    description: '聚焦眉山三苏相关古墓，适合连线浏览父子三人的生平遗迹。',
    accent: 'rgba(201, 164, 92, 0.94)',
    glow: 'rgba(201, 164, 92, 0.2)',
    members: [
      { name: '苏洵', aliases: ['苏明允', '三苏'] },
      { name: '苏轼', aliases: ['苏东坡', '苏文忠', '三苏'] },
      { name: '苏辙', aliases: ['苏子由', '三苏'] }
    ]
  },
  {
    slug: 'early-tang-four',
    label: '初唐四杰',
    badge: '盛唐先声',
    summary: '王勃、杨炯、卢照邻、骆宾王，共同铺开初唐文坛的锋芒。',
    description: '收录初唐四杰相关人物古墓，便于对照其人生轨迹与地理分布。',
    accent: 'rgba(178, 75, 47, 0.9)',
    glow: 'rgba(178, 75, 47, 0.18)',
    members: [
      { name: '王勃' },
      { name: '杨炯' },
      { name: '卢照邻' },
      { name: '骆宾王' }
    ]
  },
  {
    slug: 'bamboo-grove-seven-sages',
    label: '竹林七贤',
    badge: '魏晋风流',
    summary: '从嵇康到阮籍，沿着魏晋名士的墓址重走竹林逸响。',
    description: '聚焦魏晋名士群体，适合从墓葬分布中理解“竹林七贤”的时代气质。',
    accent: 'rgba(68, 102, 66, 0.92)',
    glow: 'rgba(68, 102, 66, 0.18)',
    members: [
      { name: '嵇康' },
      { name: '阮籍' },
      { name: '山涛' },
      { name: '向秀' },
      { name: '刘伶' },
      { name: '王戎' },
      { name: '阮咸' }
    ]
  },
  {
    slug: 'northern-song-five-masters',
    label: '北宋五子',
    badge: '理学诸贤',
    summary: '周敦颐、邵雍、张载、二程，构成北宋理学的核心人物群。',
    description: '围绕北宋五子梳理理学人物古墓，适合结合地域分布做专题阅读。',
    accent: 'rgba(63, 82, 150, 0.9)',
    glow: 'rgba(63, 82, 150, 0.16)',
    members: [
      { name: '周敦颐', aliases: ['周元公'] },
      { name: '邵雍', aliases: ['邵康节'] },
      { name: '张载', aliases: ['张横渠'] },
      { name: '程颢', aliases: ['明道先生'] },
      { name: '程颐', aliases: ['伊川先生'] }
    ]
  },
  {
    slug: 'song-four-masters',
    label: '宋四家',
    badge: '翰墨风骨',
    summary: '苏轼、黄庭坚、米芾、蔡襄，以墓葬线索串联书法史名家。',
    description: '专题汇集宋四家相关古墓，适合从书法与地方遗迹双线浏览。',
    accent: 'rgba(125, 73, 128, 0.9)',
    glow: 'rgba(125, 73, 128, 0.16)',
    members: [
      { name: '苏轼', aliases: ['苏东坡', '苏文忠'] },
      { name: '黄庭坚', aliases: ['黄山谷'] },
      { name: '米芾', aliases: ['米元章'] },
      { name: '蔡襄', aliases: ['蔡忠惠'] }
    ]
  }
];

export const getTopicBySlug = (slug: string) => TOPIC_GROUPS.find((item) => item.slug === slug);

const buildTopicMemberTokens = (member: TopicMember) =>
  Array.from(new Set([member.name, ...(member.aliases ?? [])].map((item) => normalizeText(item)).filter(Boolean)));

const buildTopicSearchText = (tomb: Tomb) =>
  [
    tomb.name,
    tomb.person,
    inferPersonFromName(tomb.name),
    tomb.aliases?.join(' '),
    tomb.category
  ]
    .filter(Boolean)
    .join(' ');

const matchesTopicMember = (tomb: Tomb, member: TopicMember) => {
  const searchText = normalizeText(buildTopicSearchText(tomb));
  if (!searchText) return false;
  return buildTopicMemberTokens(member).some((token) => searchText.includes(token));
};

export const getMatchedTopicMembers = (tomb: Tomb, topic: TopicConfig) =>
  topic.members.filter((member) => matchesTopicMember(tomb, member)).map((member) => member.name);

export const matchesTopic = (tomb: Tomb, topic: TopicConfig) => getMatchedTopicMembers(tomb, topic).length > 0;

export const getTopicTombs = (tombs: Tomb[], topic: TopicConfig) => {
  const matched = dedupeCategoryTombs(tombs.filter((tomb) => isDisplayableTomb(tomb) && matchesTopic(tomb, topic)));

  return sortTombsByLevel(matched).sort((a, b) => {
    const memberDelta = getMatchedTopicMembers(b, topic).length - getMatchedTopicMembers(a, topic).length;
    if (memberDelta !== 0) return memberDelta;
    return (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans-CN');
  });
};
