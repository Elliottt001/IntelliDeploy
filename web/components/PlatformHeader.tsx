import Link from 'next/link';

export default function PlatformHeader() {
  return <header className="platform-header">
    <nav aria-label="产品导航">
      <Link href="/" className="font-bold text-xl">IntelliDeploy</Link>
      <Link href="/create">创建应用</Link>
      <Link href="/apps">我的应用</Link>
      <Link href="/community">应用社区</Link>
      <Link href="/login">登录</Link>
    </nav>
  </header>;
}
