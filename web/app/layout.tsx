import Link from 'next/link';
import '../global.css';
export const metadata = { title: 'IntelliDeploy', description: '描述你的需求，创建可以使用的应用' };
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="zh-CN"><body><header><nav><Link href="/" className="font-bold text-xl">IntelliDeploy</Link><Link href="/apps">我的应用</Link><Link href="/community">应用社区</Link><Link href="/login">登录</Link></nav></header><main>{children}</main></body></html>;
}
