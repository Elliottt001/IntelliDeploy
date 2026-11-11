import '../global.css';
import { fontVariables } from './fonts';
export const metadata = { title: 'IntelliDeploy', description: '描述你的需求，创建可以使用的应用' };
export default function Layout({children}: {children: React.ReactNode}) {
  const bootstrap = `(function(){try{var v=localStorage.getItem('intellideploy:theme');var t=v==='light'||v==='dark'?v:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){var t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}})()`;
  return <html lang="zh-CN" className={fontVariables} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: bootstrap }} /></head><body>{children}</body></html>;
}
