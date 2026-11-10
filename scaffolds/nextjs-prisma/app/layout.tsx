export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body style={{fontFamily:'system-ui',maxWidth:960,margin:'auto',padding:24}}>{children}</body></html>;
}
