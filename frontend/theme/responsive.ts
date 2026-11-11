import { mobileSpacing } from './tokens';

export function getMobileLayout(
  width: number,
  insets: { left: number; right: number },
) {
  const gutter =
    width < 375 ? mobileSpacing.gutterCompact : mobileSpacing.gutter;
  const available = width - insets.left - insets.right - gutter * 2;

  return {
    gutter,
    contentWidth: Math.min(available, 560),
    scale: 1 as const,
  };
}
