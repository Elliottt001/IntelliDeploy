import PlatformHeader from '@/components/PlatformHeader';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <><PlatformHeader /><main className="platform-shell">{children}</main></>;
}
