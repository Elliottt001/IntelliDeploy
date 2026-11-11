import { fontVariables } from './fonts';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className={fontVariables}>{children}</div>;
}
