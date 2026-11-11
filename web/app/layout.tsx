import '../global.css';
import { fontVariables } from './fonts';
export const metadata = { title: 'IntelliDeploy · 让想法成为真正可用的应用', description: '从真实业务需求出发，持续对话调整，按验收项验证并交付可以使用的应用。' };
export default function Layout({children}: {children: React.ReactNode}) {
  const bootstrap = `(function(){try{var v=localStorage.getItem('intellideploy:theme');var t=v==='light'||v==='dark'?v:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){var t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}})()`;
  return <html lang="zh-CN" className={fontVariables} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: bootstrap }} /></head><body>{children}</body></html>;
}
