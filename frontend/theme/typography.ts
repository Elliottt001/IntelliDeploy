import { Platform } from 'react-native';

export const mobileFontFamilies = {
  display: 'ZiTiQuanWeiJunHei',
  body: 'AlibabaPuHuiTiRegular',
  emphasis: 'AlibabaPuHuiTiSemiBold',
  pingFang: Platform.select({
    ios: 'PingFang SC',
    web: 'PingFang SC',
    default: 'AlibabaPuHuiTiRegular',
  }),
  inter: Platform.select({
    web: 'Inter, sans-serif',
    default: 'AlibabaPuHuiTiRegular',
  }),
} as const;

export const mobileTypography = {
  display: {
    fontFamily: mobileFontFamilies.display,
    fontSize: 32,
    lineHeight: 40,
  },
  title: {
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 22,
    lineHeight: 30,
  },
  body: {
    fontFamily: mobileFontFamilies.body,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: mobileFontFamilies.body,
    fontSize: 13,
    lineHeight: 19,
  },
} as const;
