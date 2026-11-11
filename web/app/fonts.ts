import localFont from 'next/font/local';

export const alibaba = localFont({
  src: [
    { path: '../assets/fonts/AlibabaPuHuiTi-3-55-Regular.ttf', weight: '400' },
    { path: '../assets/fonts/AlibabaPuHuiTi-3-75-SemiBold.ttf', weight: '600' },
  ],
  variable: '--font-alibaba',
  display: 'swap',
});
export const inter = localFont({ src: '../assets/fonts/Inter-Variable.ttf', variable: '--font-inter', display: 'swap' });
export const geist = localFont({ src: '../assets/fonts/Geist-Variable.ttf', variable: '--font-geist', display: 'swap' });
export const ibarra = localFont({ src: '../assets/fonts/IbarraRealNova-Variable.ttf', variable: '--font-ibarra', display: 'swap' });
export const instrument = localFont({ src: '../assets/fonts/InstrumentSans-Variable.ttf', variable: '--font-instrument', display: 'swap' });
export const pixelify = localFont({ src: '../assets/fonts/PixelifySans-Variable.ttf', variable: '--font-pixelify', display: 'swap' });
export const weijun = localFont({ src: '../assets/fonts/ZiTiQuanWeiJunHei-W3.ttf', variable: '--font-weijun', display: 'swap' });

export const fontVariables = [alibaba.variable, inter.variable, geist.variable, ibarra.variable, instrument.variable, pixelify.variable, weijun.variable].join(' ');
