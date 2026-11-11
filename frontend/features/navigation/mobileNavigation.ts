export type MobileNavKey = 'home' | 'store' | 'community' | 'products';

export type MobileRoute = '/' | '/store' | '/community' | '/app-gallery';

export const bottomNavItems = [
  {
    key: 'home',
    label: '首页',
    href: '/',
    icon: 'house',
    minTarget: 44,
  },
  {
    key: 'store',
    label: '应用',
    href: '/store',
    icon: 'layout-grid',
    minTarget: 44,
  },
  {
    key: 'community',
    label: '广场',
    href: '/community',
    icon: 'compass',
    minTarget: 44,
  },
  {
    key: 'products',
    label: '我的',
    href: '/app-gallery',
    icon: 'user',
    minTarget: 44,
  },
] as const;

export function getBottomNavTarget(key: MobileNavKey): MobileRoute {
  return bottomNavItems.find((item) => item.key === key)!.href;
}
