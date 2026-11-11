import '../global.css';
export const metadata = { title: 'IntelliDeploy', description: '描述你的需求，创建可以使用的应用' };
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
