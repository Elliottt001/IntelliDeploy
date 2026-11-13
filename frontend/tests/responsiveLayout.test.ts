import { isValidElement, type ReactElement } from "react";
import { expect, test, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  StyleSheet: {
    absoluteFill: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    create: <T>(styles: T) => styles,
  },
  useWindowDimensions: () => ({
    fontScale: 1,
    height: 812,
    scale: 1,
    width: 375,
  }),
  View: "View",
}));

vi.mock("react-native-svg", () => ({
  Circle: "Circle",
  ClipPath: "ClipPath",
  Defs: "Defs",
  FeGaussianBlur: "FeGaussianBlur",
  Filter: "Filter",
  G: "G",
  LinearGradient: "SvgLinearGradient",
  Path: "Path",
  Rect: "Rect",
  Stop: "Stop",
  default: "Svg",
}));

import { AppBackground } from "../components/mobile/AppBackground";
import {
  bottomAnchor,
  composerViewportLayout,
  fitSourceWidth,
  resolveKeyboardViewport,
} from "../theme/responsive";

type ElementProps = Record<string, unknown> & {
  children?: ReactElement | ReactElement[];
  style?: unknown;
};

function propsOf(element: ReactElement) {
  return element.props as ElementProps;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (!Array.isArray(style)) {
    return (style ?? {}) as Record<string, unknown>;
  }
  return Object.assign({}, ...style.filter(Boolean));
}

test("relative source width grows with usable parent while fixed leaves stay bounded", () => {
  expect(fitSourceWidth(280, 375, 375, "relative")).toBe(280);
  expect(fitSourceWidth(280, 375, 430, "relative")).toBeGreaterThan(280);
  expect(fitSourceWidth(38, 375, 20, "fixed")).toBe(20);
  expect(fitSourceWidth(280, 375, 0, "relative")).toBe(0);
});

test("source width rejects invalid source geometry before producing layout", () => {
  expect(() => fitSourceWidth(280, 0, 375, "relative")).toThrow(
    "Invalid source width",
  );
  expect(() => fitSourceWidth(-1, 375, 375, "fixed")).toThrow(
    "Invalid source width",
  );
  expect(() => fitSourceWidth(280, 375, Number.NaN, "relative")).toThrow(
    "Invalid source width",
  );
});

test("composer anchor follows actual keyboard and clamps impossible space", () => {
  expect(bottomAnchor(812, 0, 0, 54, 29)).toBe(729);
  expect(bottomAnchor(812, 300, 20, 54, 29)).toBe(409);
  expect(bottomAnchor(120, 300, 20, 54, 29)).toBe(0);
  expect(bottomAnchor(812, Number.NaN, 0, 54, 29)).toBe(729);
});

test("chatbot composer consumes four safe insets and restores after keyboard hide", () => {
  const insets = { top: 31, bottom: 20, left: 13, right: 17 };
  expect(composerViewportLayout(812, 300, insets, 54, 29)).toEqual({
    contentBottom: 409,
    footerLeft: 13,
    footerRight: 17,
    footerTop: 409,
  });
  expect(composerViewportLayout(812, 0, insets, 54, 29)).toEqual({
    contentBottom: 709,
    footerLeft: 13,
    footerRight: 17,
    footerTop: 709,
  });
});

test("Android keyboard ordering never double subtracts adjustResize", () => {
  let baseline = 812;
  let layout = resolveKeyboardViewport(baseline, 812, 300);
  expect(layout).toEqual({
    unobscuredHeight: 812,
    effectiveKeyboardHeight: 300,
  });
  layout = resolveKeyboardViewport(layout.unobscuredHeight, 512, 300);
  expect(layout).toEqual({
    unobscuredHeight: 812,
    effectiveKeyboardHeight: 300,
  });
  layout = resolveKeyboardViewport(812, 512, 0);
  expect(layout).toEqual({
    unobscuredHeight: 812,
    effectiveKeyboardHeight: 300,
  });
  layout = resolveKeyboardViewport(layout.unobscuredHeight, 512, 300);
  expect(layout.effectiveKeyboardHeight).toBe(300);
  layout = resolveKeyboardViewport(layout.unobscuredHeight, 512, 0);
  expect(layout.effectiveKeyboardHeight).toBe(300);
  layout = resolveKeyboardViewport(layout.unobscuredHeight, 812, 0);
  expect(layout).toEqual({ unobscuredHeight: 812, effectiveKeyboardHeight: 0 });
});

test("app background ignores invalid explicit width before assigning safe space", () => {
  const background = AppBackground({
    children: "content",
    insets: { left: 0, right: 0 },
    width: Number.NaN,
  });
  const children = propsOf(background).children as ReactElement[];
  const safeArea = children.find(
    (child) => isValidElement(child) && child.type === "View",
  )!;
  const content = propsOf(safeArea).children as ReactElement;

  expect(flattenStyle(propsOf(safeArea).style)).toMatchObject({ width: 0 });
  expect(flattenStyle(propsOf(content).style)).toMatchObject({ width: 0 });
});
