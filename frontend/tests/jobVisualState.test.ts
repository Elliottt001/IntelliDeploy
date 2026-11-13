import fs from "node:fs";
import path from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { components } from "@intellideploy/api-client";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("react-native", () => ({
  Image: "Image",
  Platform: {
    OS: "ios",
    select: (options: Record<string, string>) => options.default,
  },
  Pressable: "Pressable",
  StyleSheet: { create: <T>(styles: T) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  useWindowDimensions: () => ({ width: 375, height: 812 }),
}));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
vi.mock("react-native-svg", () => ({
  Rect: "Rect",
  ClipPath: "ClipPath",
  Filter: "Filter",
  FeGaussianBlur: "FeGaussianBlur",
  G: "G",
  Defs: "Defs",
  LinearGradient: "SvgLinearGradient",
  Stop: "Stop",
  Path: "Path",
  default: "Svg",
}));

import {
  ChatComposer,
  chatComposerFigmaEvidence,
} from "../components/mobile/ChatComposer";
import { Platform } from "react-native";
import { MobileIcon } from "../components/mobile/CircleAction";
import { JobProgress } from "../components/mobile/JobProgress";
import {
  getMiboStageLayout,
  miboStageFigmaEvidence,
} from "../components/mobile/MiboStage";
import { getJobVisualState } from "../features/chatbot/jobVisualState";
import { miboRenderEvidence } from "../design/miboRenderEvidence";
import { miboSourceAudit } from "../design/miboSourceAudit";

type Job = components["schemas"]["JobSnapshot"];
type ElementProps = Record<string, unknown> & {
  children?: ReactNode;
  style?: unknown;
};
const figmaSource = process.env.INTELLIDEPLOY_FIGMA_SOURCE;

const job = (
  status: Job["status"],
  phase = "clarifying",
  overrides: Partial<Job> = {},
): Job => ({
  id: "j",
  app_id: "a",
  kind: "GENERATE",
  status,
  phase,
  usage_units: 0,
  event_cursor: 0,
  question: null,
  result: null,
  error: null,
  created_at: "",
  updated_at: "",
  ...overrides,
});

function propsOf(element: ReactElement) {
  return element.props as ElementProps;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (!Array.isArray(style)) {
    return (style ?? {}) as Record<string, unknown>;
  }
  return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
}

function walkRenderedTree(
  node: ReactNode,
  visit: (element: ReactElement) => void,
) {
  if (!isValidElement(node)) {
    return;
  }
  if (typeof node.type === "function") {
    const render = node.type as (props: unknown) => ReactNode;
    walkRenderedTree(render(node.props), visit);
    return;
  }
  visit(node);
  const children = propsOf(node).children;
  if (Array.isArray(children)) {
    children.forEach((child) => walkRenderedTree(child, visit));
  } else {
    walkRenderedTree(children, visit);
  }
}

function findByTestId(tree: ReactNode, testID: string) {
  let found: ReactElement | undefined;
  walkRenderedTree(tree, (element) => {
    if (propsOf(element).testID === testID) {
      found = element;
    }
  });
  return found;
}

beforeEach(() => vi.clearAllMocks());

test.each([
  [null, "greeting", "告诉 Mibo 你想做什么", true, false, false],
  [job("QUEUED"), "thinking", "任务已提交", false, true, false],
  [
    job("RUNNING", "clarifying"),
    "clarifying",
    "正在理解需求",
    false,
    true,
    false,
  ],
  [
    job("RUNNING", "retrieving"),
    "retrieving",
    "正在查找可复用项目",
    false,
    true,
    false,
  ],
  [
    job("RUNNING", "implementing"),
    "implementing",
    "正在分析并实现需求",
    false,
    true,
    false,
  ],
  [job("RUNNING", "building"), "building", "正在构建应用", false, true, false],
  [
    job("RUNNING", "validating"),
    "validating",
    "正在验证功能",
    false,
    true,
    false,
  ],
  [
    job("RUNNING", "deploying"),
    "deploying",
    "正在发布应用",
    false,
    true,
    false,
  ],
  [
    job("RUNNING", "verifying_live"),
    "verifying_live",
    "正在验证使用入口",
    false,
    true,
    false,
  ],
  [
    job("WAITING_USER"),
    "waiting_user",
    "需要你补充一点信息",
    true,
    false,
    false,
  ],
  [
    job("PAUSED_QUOTA"),
    "paused_quota",
    "额度不足，任务已暂停",
    false,
    false,
    true,
  ],
  [job("SUCCEEDED"), "succeeded", "应用已交付", true, false, false],
  [job("FAILED"), "failed", "本次调整未完成", true, false, false],
  [job("CANCELLED"), "cancelled", "任务已取消", true, false, false],
] as const)(
  "%s maps to exact truthful copy and compose/cancel/resume actions",
  (input, kind, title, canCompose, canCancel, canResume) => {
    expect(getJobVisualState(input)).toMatchObject({
      kind,
      title,
      percentage: null,
      canCompose,
      canCancel,
      canResume,
    });
  },
);

test("new internal selection work stays in stable business phases", () => {
  expect(getJobVisualState(job("RUNNING", "retrieving")).title).toBe(
    "正在查找可复用项目",
  );
  expect(getJobVisualState(job("RUNNING", "profiling")).title).toBe(
    "正在处理需求",
  );
});

test("unknown phases stay neutral and expose no fake build details", () => {
  expect(getJobVisualState(job("RUNNING", "future_phase"))).toEqual({
    kind: "working",
    title: "正在处理需求",
    percentage: null,
    detailItems: [],
    canCompose: false,
    canCancel: true,
    canResume: false,
  });
});

test("only backend-provided failure details enter the visual state", () => {
  expect(
    getJobVisualState(
      job("FAILED", "validating", {
        error: {
          code: "CHECK_FAILED",
          message: "健康检查未通过",
          retryable: false,
        },
      }),
    ).detailItems,
  ).toEqual(["健康检查未通过"]);
  expect(getJobVisualState(job("FAILED")).detailItems).toEqual([]);
  expect(getJobVisualState(job("RUNNING", "building")).detailItems).toEqual([]);
});

test("progress highlights only the backend current phase or genuine terminal success", () => {
  const progress = JobProgress({
    state: getJobVisualState(job("RUNNING", "implementing")),
    testID: "job-status",
  });
  const clarifying = findByTestId(progress, "job-progress-clarifying");
  const retrieving = findByTestId(progress, "job-progress-retrieving");
  const implementing = findByTestId(progress, "job-progress-implementing");
  const success = findByTestId(progress, "job-progress-succeeded");

  expect(propsOf(clarifying!).accessibilityState).toEqual({ selected: false });
  expect(propsOf(retrieving!).accessibilityState).toEqual({ selected: false });
  expect(propsOf(implementing!).accessibilityState).toEqual({ selected: true });
  expect(propsOf(success!).accessibilityState).toEqual({ selected: false });

  const terminal = JobProgress({
    state: getJobVisualState(job("SUCCEEDED")),
  });
  expect(
    propsOf(findByTestId(terminal, "job-progress-succeeded")!)
      .accessibilityState,
  ).toEqual({ selected: true });
  expect(
    propsOf(findByTestId(terminal, "job-progress-validating")!)
      .accessibilityState,
  ).toEqual({ selected: false });
});

test.each([
  [null, miboStageFigmaEvidence.art.greetingCat.box],
  [job("RUNNING", "building"), { x: 94, y: 188, width: 194, height: 168 }],
  [job("SUCCEEDED"), miboStageFigmaEvidence.art.successCat.box],
] as const)("Mibo cat uses the measured art geometry for %s", (input, box) => {
  const { primaryCharacter } = getMiboStageLayout(
    getJobVisualState(input),
    false,
    375,
  );
  expect({
    height: primaryCharacter.size.y,
    left: primaryCharacter.transform.m02,
    top:
      primaryCharacter.transform.m12 -
      miboStageFigmaEvidence.art.rippleLarge.box.y,
    width: primaryCharacter.size.x,
  }).toEqual({
    height: box.height,
    left: box.x,
    top: box.y - miboStageFigmaEvidence.art.rippleLarge.box.y,
    width: box.width,
  });
});

test("Mibo source layout retains exact visible image UV and hidden robot state", () => {
  const layout = getMiboStageLayout(getJobVisualState(null), false, 375);
  expect(layout.rippleLarge).toMatchObject({
    size: { x: 504, y: 336 },
    transform: { m02: -61, m12: 137 },
    paintTransform: { m00: 1, m11: 1, m02: 0, m12: 0 },
    opacity: 1,
  });
  expect(layout.ripple).toMatchObject({
    size: { x: 359, y: 239 },
    transform: { m02: 8, m12: 196 },
    paintTransform: { m00: 1, m11: 1, m02: 0, m12: 0 },
    opacity: 1,
  });
  expect(
    layout.imageNodes.find(
      (value) => value.rawHash === miboStageFigmaEvidence.art.robot.assetHash,
    )?.visible,
  ).toBe(false);
});

test.each([
  [320, 320 / 375],
  [360, 360 / 375],
  [375, 1],
  [390, 1],
  [430, 1],
] as const)(
  "Mibo scales only its local art to fit a %ipt viewport",
  (viewportWidth, expectedScale) => {
    const layout = getMiboStageLayout(
      getJobVisualState(null),
      false,
      viewportWidth,
    );
    expect(layout.artScale).toBeCloseTo(expectedScale, 8);
    expect(375 * layout.artScale).toBeLessThanOrEqual(viewportWidth);
    expect(layout.artCanvasTop).toBeCloseTo(
      -(330 - 330 * expectedScale) / 2,
      8,
    );
    expect(layout.artCanvasTop + (330 - 330 * expectedScale) / 2).toBeCloseTo(
      0,
      8,
    );
    expect(330 * layout.artScale).toBeCloseTo(layout.artViewportHeight, 8);
  },
);

test("composer blocks busy, disabled, and blank submission while preserving 44pt controls", () => {
  const onSubmit = vi.fn();
  for (const props of [
    { value: "发送我", editable: false, busy: false },
    { value: "发送我", editable: true, busy: true },
    { value: "   ", editable: true, busy: false },
  ]) {
    const composer = ChatComposer({
      ...props,
      onChangeText: vi.fn(),
      onSubmit,
    });
    const input = findByTestId(composer, "message-input");
    const send = findByTestId(composer, "send-message");
    expect(propsOf(send!).disabled).toBe(true);
    (propsOf(send!).onPress as () => void)();
    expect(
      flattenStyle(propsOf(input!).style).minHeight,
    ).toBeGreaterThanOrEqual(44);
    expect(flattenStyle(propsOf(send!).style).minHeight).toBeGreaterThanOrEqual(
      44,
    );
    expect(flattenStyle(propsOf(send!).style).minWidth).toBeGreaterThanOrEqual(
      44,
    );
  }
  expect(onSubmit).not.toHaveBeenCalled();

  const enabled = ChatComposer({
    value: " 发送我 ",
    editable: true,
    busy: false,
    onChangeText: vi.fn(),
    onSubmit,
  });
  const send = findByTestId(enabled, "send-message");
  expect(propsOf(send!).disabled).toBe(false);
  (propsOf(send!).onPress as () => void)();
  expect(onSubmit).toHaveBeenCalledOnce();
});

test("composer shell uses measured Kiwi surface geometry and remains fluid", () => {
  const composer = ChatComposer({
    value: "",
    editable: true,
    busy: false,
    onChangeText: vi.fn(),
    onSubmit: vi.fn(),
  });
  expect(flattenStyle(propsOf(composer).style)).toMatchObject({
    backgroundColor: "rgba(255, 255, 255, 0.70)",
    borderColor: "#FFFFFF",
    borderRadius: 44.653347,
    borderWidth: 0,
    maxWidth: 335,
    minHeight: 54,
    shadowColor: "#BABABA",
    shadowOffset: { height: 1.786134, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 2.679201,
    width: "100%",
  });
  const paint = (propsOf(composer).children as ReactElement[])[0];
  expect(flattenStyle(propsOf(paint).style)).toMatchObject({
    borderWidth: 1.339601,
    borderColor: "#FFFFFF",
  });
  expect(chatComposerFigmaEvidence.shellNodeId).toBe("845:3530");
  expect(chatComposerFigmaEvidence.noSymbolReason).toMatch(
    /no INSTANCE or SYMBOL/,
  );
});

test.skipIf(!figmaSource)(
  "external Figma provenance audit (NOT_RUN unless INTELLIDEPLOY_FIGMA_SOURCE is set)",
  () => {
    const sourceRoot = figmaSource!;
    const document = JSON.parse(
      fs.readFileSync(
        path.join(sourceRoot, "design-data/document.kiwi.json"),
        "utf8",
      ),
    ) as { nodeChanges: Array<Record<string, any>> };
    const rawAssets = JSON.parse(
      fs.readFileSync(
        path.join(sourceRoot, "design-data/raw-assets.json"),
        "utf8",
      ),
    ) as Array<{ archive_path: string; local_path: string }>;
    const id = (node: Record<string, any>) =>
      `${node.guid?.sessionID}:${node.guid?.localID}`;
    const parentId = (node: Record<string, any>) =>
      `${node.parentIndex?.guid?.sessionID}:${node.parentIndex?.guid?.localID}`;
    const nodes = new Map(document.nodeChanges.map((node) => [id(node), node]));
    const children = new Map<string, Array<Record<string, any>>>();
    document.nodeChanges.forEach((node) => {
      const siblings = children.get(parentId(node)) ?? [];
      siblings.push(node);
      children.set(parentId(node), siblings);
    });
    const descendants = (rootId: string) => {
      const result: Array<Record<string, any>> = [];
      const pending = [...(children.get(rootId) ?? [])];
      while (pending.length > 0) {
        const node = pending.shift()!;
        result.push(node);
        pending.push(...(children.get(id(node)) ?? []));
      }
      return result;
    };

    expect(miboStageFigmaEvidence.frameIds).toEqual([
      "845:3479",
      "846:3544",
      "849:3608",
      "849:3705",
      "849:3794",
      "849:3883",
      "849:3972",
      "852:4061",
      "852:4150",
      "852:4242",
      "852:4391",
    ]);
    for (const frameId of miboStageFigmaEvidence.frameIds) {
      expect(nodes.get(frameId)?.size).toEqual({ x: 375, y: 812 });
      const frameDescendants = descendants(frameId);
      expect(
        frameDescendants.filter((node) =>
          ["INSTANCE", "SYMBOL"].includes(String(node.type)),
        ),
      ).toEqual([]);
      const rawFrame = [nodes.get(frameId)!, ...frameDescendants];
      const auditById = new Map(
        miboSourceAudit.frames[frameId].map((node) => [id(node), node]),
      );
      expect(auditById.size).toBe(rawFrame.length);
      for (const rawNode of rawFrame)
        expect(auditById.get(id(rawNode))).toEqual(rawNode);
      const runtimeFrame = miboRenderEvidence.frames[frameId];
      expect(runtimeFrame.nodeCount).toBe(rawFrame.length);
      expect(runtimeFrame.geometryNodeCount).toBe(
        rawFrame.filter(
          (node) => node.fillGeometry?.length || node.strokeGeometry?.length,
        ).length,
      );
      expect(runtimeFrame.paintNodeCount).toBe(
        rawFrame.filter(
          (node) => node.fillPaints?.length || node.strokePaints?.length,
        ).length,
      );
      const imageNodes = rawFrame.filter((node) =>
        node.fillPaints?.some(
          (paint: Record<string, any>) =>
            paint.type === "IMAGE" && paint.visible !== false,
        ),
      );
      expect(new Set(runtimeFrame.imageNodeIds)).toEqual(
        new Set(imageNodes.map(id)),
      );
      for (const imageNode of imageNodes) {
        const paint = imageNode.fillPaints.find(
            (value: Record<string, any>) =>
              value.type === "IMAGE" && value.visible !== false,
          ),
          runtime =
            miboRenderEvidence.images[
              id(imageNode) as keyof typeof miboRenderEvidence.images
            ];
        expect(runtime).toEqual({
          sourceNodeId: id(imageNode),
          visible: imageNode.visible !== false,
          size: imageNode.size,
          transform: imageNode.transform,
          paintTransform: paint.transform,
          blendMode: paint.blendMode,
          opacity: (imageNode.opacity ?? 1) * (paint.opacity ?? 1),
          rawHash: Buffer.from(paint.image.hash.data, "base64").toString("hex"),
        });
      }
      const rawInteractions = rawFrame.flatMap((node) =>
        (node.prototypeInteractions ?? []).map(
          (interaction: Record<string, any>) => {
            const action = interaction.actions?.[0];
            return {
              sourceNodeId: id(node),
              interactionId: `${interaction.id.sessionID}:${interaction.id.localID}`,
              event: interaction.event,
              transitionNodeId: action?.transitionNodeID
                ? `${action.transitionNodeID.sessionID}:${action.transitionNodeID.localID}`
                : null,
              transitionType: action?.transitionType ?? null,
              transitionDuration: action?.transitionDuration ?? 0,
              easingType: action?.easingType ?? null,
              easingFunction: action?.easingFunction ?? [],
            };
          },
        ),
      );
      expect(runtimeFrame.interactions).toEqual(rawInteractions);
    }
    expect(
      fs.statSync(path.join(process.cwd(), "design/miboRenderEvidence.ts"))
        .size,
    ).toBeLessThan(250_000);
    for (const runtimeFile of [
      "components/mobile/MiboStage.tsx",
      "screens/app-detail/AppDetailScreen.tsx",
      "features/chatbot/CreateWorkspaceView.tsx",
    ])
      expect(
        fs.readFileSync(path.join(process.cwd(), runtimeFile), "utf8"),
      ).not.toContain("miboSourceAudit");
    for (const art of Object.values(miboStageFigmaEvidence.art)) {
      const node = nodes.get(art.nodeId)!;
      expect({
        height: node.size.y,
        width: node.size.x,
        x: node.transform.m02,
        y: node.transform.m12,
      }).toEqual(art.box);
      expect(node.fillPaints[0].type).toBe("IMAGE");
      expect(
        Buffer.from(node.fillPaints[0].image.hash.data, "base64").toString(
          "hex",
        ),
      ).toBe(art.assetHash);
      expect(
        rawAssets.some((asset) => asset.archive_path.endsWith(art.assetHash)),
      ).toBe(true);
    }

    const composerShell = nodes.get(chatComposerFigmaEvidence.shellNodeId)!;
    expect(composerShell.size).toEqual({
      x: chatComposerFigmaEvidence.width,
      y: chatComposerFigmaEvidence.height,
    });
    expect(composerShell.cornerRadius).toBeCloseTo(
      chatComposerFigmaEvidence.cornerRadius,
    );
    expect(composerShell.fillPaints[0].opacity).toBeCloseTo(
      chatComposerFigmaEvidence.fillOpacity,
    );
    expect(
      composerShell.effects.map((effect: Record<string, any>) => effect.type),
    ).toEqual(["DROP_SHADOW", "GLASS"]);
  },
);

test("creation composer uses custom stable IDs and its input label", () => {
  const tree = ChatComposer({
    value: "需求",
    editable: true,
    busy: false,
    inputTestID: "create-prompt",
    submitTestID: "create-app",
    inputLabel: "你想做什么应用",
    submitLabel: "开始创建",
    onChangeText: vi.fn(),
    onSubmit: vi.fn(),
  });
  expect(propsOf(findByTestId(tree, "create-prompt")!).accessibilityLabel).toBe(
    "你想做什么应用",
  );
  expect(propsOf(findByTestId(tree, "create-app")!).accessibilityLabel).toBe(
    "开始创建",
  );
  expect(findByTestId(tree, "message-input")).toBeUndefined();
});

test("running composer keeps the draft editable while preventing button and keyboard submission", () => {
  const send = vi.fn();
  const change = vi.fn();
  const tree = ChatComposer({
    value: "下一项需求",
    editable: true,
    busy: false,
    canSubmit: false,
    onChangeText: change,
    onSubmit: send,
  });
  const input = propsOf(findByTestId(tree, "message-input")!);
  const button = propsOf(findByTestId(tree, "send-message")!);
  expect(input.editable).toBe(true);
  expect(button.disabled).toBe(true);
  (input.onChangeText as (value: string) => void)("保存下一项需求");
  expect(change).toHaveBeenCalledWith("保存下一项需求");
  (input.onSubmitEditing as () => void)();
  (button.onPress as () => void)();
  expect(send).not.toHaveBeenCalled();
});

test.each(["web", "ios", "android"])(
  "decorative icons preserve native hiding without leaking native props on %s",
  (platform) => {
    const mockedPlatform = Platform as unknown as { OS: string };
    const original = mockedPlatform.OS;
    mockedPlatform.OS = platform;
    try {
      const icon = propsOf(MobileIcon({ name: "send" }));
      if (platform === "web") {
        expect(icon.accessibilityElementsHidden).toBeUndefined();
        expect(icon["aria-hidden"]).toBe(true);
      } else expect(icon.accessibilityElementsHidden).toBe(true);
    } finally {
      mockedPlatform.OS = original;
    }
  },
);
