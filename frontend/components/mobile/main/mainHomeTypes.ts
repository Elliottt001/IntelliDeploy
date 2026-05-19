import type { ImageSourcePropType } from 'react-native';

export type MainHomeTheme = 'light' | 'dark';

export type MainHomeCardId = 'gallery' | 'products' | 'square' | 'profile';

export type MainHomeNavId = 'home' | 'apps' | 'square' | 'profile';

export type MainHomeRouteId = Exclude<MainHomeCardId, 'profile'>;

export type MainHomeGalleryAppId = 'fastgpt' | 'keystats' | 'pawzzle' | 'stolen-buttons' | 'fairyc';

export type WordCloudTag = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity?: number;
  weight?: '400' | '500' | '600' | '700' | '800';
};

export type FeatureCardData = {
  id: MainHomeCardId;
  title: string;
  subtitle: string;
  iconUrl?: string | null;
  route?: string;
  collapsedTop: number;
  expandedTop: number;
  accent: string;
  stackOrder: number;
};

export type BottomNavItem = {
  id: MainHomeNavId;
  label: string;
  icon: string;
};

export type DarkCategory = {
  id: string;
  title: string;
  count: string;
  icon: string;
  backgroundColor: string;
  accentColor: string;
};

export type DarkAppItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  iconText: string;
  iconColor: string;
  rating?: string;
};

export type MainHomeAssets = {
  cat: ImageSourcePropType;
  featureAppstore: ImageSourcePropType;
  featureChat: ImageSourcePropType;
  featureCommunity: ImageSourcePropType;
  productsIcons: ImageSourcePropType;
};
