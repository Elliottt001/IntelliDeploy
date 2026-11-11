import type { MobileRoute } from '../navigation/mobileNavigation';

export const homeSuggestions = [
  {
    id: 'notes',
    label: '做一个可搜索的私人笔记应用',
    prompt: '创建一个可搜索的私人笔记应用',
    source: 'curated',
  },
  {
    id: 'habits',
    label: '做一个习惯记录和复盘工具',
    prompt: '创建一个习惯记录和复盘工具',
    source: 'curated',
  },
  {
    id: 'inventory',
    label: '做一个家庭物品清单',
    prompt: '创建一个家庭物品清单',
    source: 'curated',
  },
] as const;

export const homeCards = [
  { key: 'store', title: 'App Gallery', href: '/store', description: '发现可部署应用' },
  { key: 'products', title: '我的产品', href: '/app-gallery', description: '管理我的应用与工具' },
  { key: 'community', title: '广场', href: '/community', description: '探索分享，交流成长' },
  { key: 'profile', title: '我的', href: '/app-gallery', description: '查看收藏与最近使用' },
] as const satisfies readonly {
  description: string;
  href: MobileRoute;
  key: string;
  title: string;
}[];

export type HomeCardKey = (typeof homeCards)[number]['key'];
