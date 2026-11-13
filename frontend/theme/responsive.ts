import { mobileSpacing } from "./tokens";

type WidthPolicy = "relative" | "fixed";

function finiteOrZero(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function fitSourceWidth(
  sourceWidth: number,
  sourceParentWidth: number,
  availableWidth: number,
  policy: WidthPolicy,
) {
  if (
    ![sourceWidth, sourceParentWidth, availableWidth].every(Number.isFinite) ||
    sourceParentWidth <= 0 ||
    sourceWidth < 0
  ) {
    throw new Error("Invalid source width");
  }
  const usableWidth = Math.max(0, availableWidth);
  return Math.min(
    usableWidth,
    policy === "fixed"
      ? sourceWidth
      : (usableWidth * sourceWidth) / sourceParentWidth,
  );
}

export function bottomAnchor(
  viewportHeight: number,
  keyboardHeight: number,
  bottomInset: number,
  visibleHeight: number,
  bottomGap: number,
) {
  return Math.max(
    0,
    finiteOrZero(viewportHeight) -
      Math.max(0, finiteOrZero(keyboardHeight)) -
      Math.max(0, finiteOrZero(bottomInset)) -
      Math.max(0, finiteOrZero(visibleHeight)) -
      Math.max(0, finiteOrZero(bottomGap)),
  );
}

export function composerViewportLayout(
  viewportHeight: number,
  keyboardHeight: number,
  insets: { top: number; bottom: number; left: number; right: number },
  composerHeight: number,
  sourceBottomGap: number,
) {
  const footerTop = bottomAnchor(
    viewportHeight,
    keyboardHeight,
    insets.bottom,
    composerHeight,
    sourceBottomGap,
  );
  return {
    contentBottom: footerTop,
    footerLeft: Math.max(0, finiteOrZero(insets.left)),
    footerRight: Math.max(0, finiteOrZero(insets.right)),
    footerTop,
  };
}

export function resolveKeyboardViewport(
  previousUnobscuredHeight: number,
  observedWindowHeight: number,
  reportedKeyboardHeight: number,
) {
  const windowHeight = Math.max(0, finiteOrZero(observedWindowHeight));
  const unobscuredHeight = Math.max(
    windowHeight,
    Math.max(0, finiteOrZero(previousUnobscuredHeight)),
  );
  return {
    unobscuredHeight,
    effectiveKeyboardHeight: Math.max(
      Math.max(0, finiteOrZero(reportedKeyboardHeight)),
      unobscuredHeight - windowHeight,
    ),
  };
}

export function getMobileLayout(
  width: number,
  insets: { left: number; right: number },
) {
  const gutter =
    width < 375 ? mobileSpacing.gutterCompact : mobileSpacing.gutter;
  const available =
    finiteOrZero(width) -
    Math.max(0, finiteOrZero(insets.left)) -
    Math.max(0, finiteOrZero(insets.right)) -
    gutter * 2;
  const maxReadableWidth = 560;

  return {
    gutter,
    contentWidth: Math.min(
      fitSourceWidth(maxReadableWidth, maxReadableWidth, available, "relative"),
      maxReadableWidth,
    ),
    scale: 1 as const,
  };
}
