import localFont from 'next/font/local';

export const alibaba = localFont({
  src: [
    { path: '../../assets/fonts/AlibabaPuHuiTi-3-55-Regular-subset.woff2', weight: '400' },
    { path: '../../assets/fonts/AlibabaPuHuiTi-3-75-SemiBold-subset.woff2', weight: '600' },
  ],
  variable: '--font-alibaba',
  display: 'swap',
  preload: false,
});

export const inter = localFont({
  src: '../../assets/fonts/Inter-Variable.ttf',
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});

export const ibarra = localFont({
  src: '../../assets/fonts/IbarraRealNova-Variable.ttf',
  variable: '--font-ibarra',
  display: 'swap',
  preload: false,
});

export const instrument = localFont({
  src: '../../assets/fonts/InstrumentSans-Variable.ttf',
  variable: '--font-instrument',
  display: 'swap',
  preload: false,
});

export const pixelify = localFont({
  src: '../../assets/fonts/PixelifySans-Variable.ttf',
  variable: '--font-pixelify',
  display: 'swap',
  preload: false,
});

export const weijun = localFont({
  src: '../../assets/fonts/ZiTiQuanWeiJunHei-W3-subset.woff2',
  variable: '--font-weijun',
  display: 'swap',
  preload: false,
});

export const fontVariables = [
  alibaba.variable,
  inter.variable,
  ibarra.variable,
  instrument.variable,
  pixelify.variable,
  weijun.variable,
].join(' ');
