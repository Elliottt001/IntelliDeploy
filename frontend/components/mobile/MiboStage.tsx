import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type ViewProps,
} from "react-native";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import Svg, { G } from "react-native-svg";
import { MobileBackdrop } from "./MobileBackdrop";
import { FigmaText } from "./FigmaText";
import { miboRenderEvidence } from "../../design/miboRenderEvidence";
import type { JobVisualState } from "../../features/chatbot/jobVisualState";
import { mobileColors } from "../../theme/tokens";
import { mobileFontFamilies } from "../../theme/typography";
import {
  getSourceMotion,
  type SourceMotion,
} from "../../design/sourceMotionEvidence";
import {
  shouldStartSourceTransition,
  type SourceTransitionReason,
} from "../../features/navigation/sourceMotionPolicy";
import { useSourceMotion } from "./useSourceMotion";

export const miboStageFigmaEvidence = {
  frameIds: [
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
  ],
  noSymbolReason:
    "approved chatbot frames are direct Kiwi compositions with no INSTANCE or SYMBOL descendants",
  art: {
    rippleLarge: {
      nodeId: "845:3518",
      assetHash: "1949e95938c28d6e69b0614f6df7cf5faf0e15df",
      box: { x: -61, y: 137, width: 504, height: 336 },
    },
    ripple: {
      nodeId: "845:3519",
      assetHash: "cd9473e69b1bbe6ca3a605ad61dbe66e1a5753c2",
      box: { x: 8, y: 196, width: 359, height: 239 },
    },
    robot: {
      nodeId: "845:3520",
      assetHash: "61e75e928c998d78da3702299dfa112e9f577bd3",
      box: { x: 72, y: 233, width: 231, height: 154 },
    },
    greetingCat: {
      nodeId: "845:3522",
      assetHash: "42811159c4b77210f20cb8dd8611c49872975bd9",
      box: { x: 110, y: 188, width: 157, height: 136 },
    },
    workingCat: {
      nodeId: "846:3587",
      assetHash: "17d82ba16376f25db33866ff5dc8c189dcadade3",
      box: { x: 91, y: 171, width: 194, height: 168 },
    },
    successCat: {
      nodeId: "852:4435",
      assetHash: "42811159c4b77210f20cb8dd8611c49872975bd9",
      box: { x: 99, y: 166, width: 178, height: 154 },
    },
  },
} as const;

export type MiboStageArt = {
  rippleLarge: ImageSourcePropType;
  ripple: ImageSourcePropType;
  greetingCat: ImageSourcePropType;
  workingCat: ImageSourcePropType;
  successCat: ImageSourcePropType;
};

export type MiboStageProps = {
  state: JobVisualState;
  question?: string | null;
  errorMessage?: string | null;
  art?: Partial<MiboStageArt>;
  titleTestID?: string;
  hasDetails?: boolean;
  snapshotKey?: string;
  sourceFrameHint?: keyof typeof miboRenderEvidence.frames;
  transitionReason?: SourceTransitionReason;
  reply?: ReactNode;
};

type MiboCompositionSnapshot = Pick<
  MiboStageProps,
  | "state"
  | "question"
  | "errorMessage"
  | "hasDetails"
  | "sourceFrameHint"
  | "reply"
> & { snapshotKey: string };

type MiboPresentation = {
  character: {
    name: string;
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  };
  status: {
    name: string;
    x: number;
    y: number;
    opacity: number;
  } | null;
  translateY: number;
};

type MiboTransition = {
  id: number;
  from: MiboCompositionSnapshot;
  to: MiboCompositionSnapshot;
  motion: SourceMotion;
  startPresentation: MiboPresentation;
  retainedPresentation: MiboPresentation | null;
};

type MiboMotionStyles = {
  currentStyle?: object;
  characterStyle?: object;
  statusStyle?: object;
  previousStyle?: object;
  previousCharacterStyle?: object;
  previousStatusStyle?: object;
};

function getArt(art?: Partial<MiboStageArt>): MiboStageArt {
  return {
    rippleLarge:
      art?.rippleLarge ??
      require("../../assets/mobile/generated/845-3518-1949e95938c28d6e69b0614f6df7cf5faf0e15df.png"),
    ripple:
      art?.ripple ??
      require("../../assets/mobile/generated/845-3519-cd9473e69b1bbe6ca3a605ad61dbe66e1a5753c2.png"),
    greetingCat:
      art?.greetingCat ??
      require("../../assets/mobile/generated/845-3522-42811159c4b77210f20cb8dd8611c49872975bd9.png"),
    workingCat:
      art?.workingCat ??
      require("../../assets/mobile/generated/846-3587-17d82ba16376f25db33866ff5dc8c189dcadade3.png"),
    successCat:
      art?.successCat ??
      require("../../assets/mobile/generated/852-4435-42811159c4b77210f20cb8dd8611c49872975bd9.png"),
  };
}

export function getMiboStageLayout(
  state: JobVisualState,
  hasDetails: boolean,
  viewportWidth: number,
  sourceFrameHint?: keyof typeof miboRenderEvidence.frames,
) {
  const stateFrames = {
    greeting: "845:3479",
    thinking: "849:3608",
    clarifying: "849:3705",
    retrieving: "849:3794",
    implementing: "849:3883",
    building: hasDetails ? "852:4242" : "849:3972",
    validating: "852:4061",
    deploying: "852:4150",
    verifying_live: "852:4150",
    succeeded: "852:4391",
    waiting_user: "849:3608",
    paused_quota: "849:3608",
    failed: "849:3608",
    cancelled: "849:3608",
    working: "849:3608",
  } as const satisfies Record<
    typeof state.kind,
    keyof typeof miboRenderEvidence.frames
  >;
  const sourceFrame = sourceFrameHint ?? stateFrames[state.kind],
    frame = miboRenderEvidence.frames[sourceFrame];
  const imageNodes = frame.imageNodeIds.map(
    (id) => miboRenderEvidence.images[id],
  );
  const rippleLarge = imageNodes.find(
    (value) =>
      value.rawHash === miboStageFigmaEvidence.art.rippleLarge.assetHash,
  )!;
  const ripple = imageNodes.find(
    (value) => value.rawHash === miboStageFigmaEvidence.art.ripple.assetHash,
  )!;
  const backgroundHashes: readonly string[] = [
    rippleLarge.rawHash,
    ripple.rawHash,
    miboStageFigmaEvidence.art.robot.assetHash,
  ];
  const visibleCharacters = imageNodes.filter(
    (value) =>
      value.visible &&
      value.opacity > 0 &&
      !backgroundHashes.includes(value.rawHash),
  );
  const primaryCharacter = (visibleCharacters.find(
    (value) =>
      value.rawHash === miboStageFigmaEvidence.art.greetingCat.assetHash,
  ) ?? visibleCharacters[0])!;
  const artScale = Math.min(
    1,
    viewportWidth / miboRenderEvidence.frames["845:3479"].size.x,
  );
  const artViewportHeight = 330 * artScale;
  const artCanvasTop = -(330 - artViewportHeight) / 2;
  return {
    sourceFrame,
    frame,
    imageNodes,
    rippleLarge,
    ripple,
    visibleCharacters,
    primaryCharacter,
    artScale,
    artViewportHeight,
    artCanvasTop,
  };
}

function rawPresentation(
  snapshot: MiboCompositionSnapshot,
  viewportWidth: number,
): MiboPresentation {
  const layout = getMiboStageLayout(
    snapshot.state,
    snapshot.hasDetails ?? false,
    viewportWidth,
    snapshot.sourceFrameHint,
  );
  const character = layout.primaryCharacter;
  const status = layout.frame.statusNode;
  return {
    character: {
      name: character.name,
      left: character.transform.m02,
      top: character.transform.m12 - 137,
      width: character.size.x,
      height: character.size.y,
      opacity: character.opacity,
    },
    status: status
      ? {
          name: status.name,
          x: status.transform.m02,
          y: status.transform.m12,
          opacity: status.opacity,
        }
      : null,
    translateY: 0,
  };
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function resolvedPresentation(
  transition: MiboTransition,
  progress: number,
  viewportWidth: number,
  viewportHeight: number,
): MiboPresentation {
  const target = rawPresentation(transition.to, viewportWidth);
  if (transition.motion.transition === "SLIDE_FROM_BOTTOM") {
    return {
      ...target,
      translateY: interpolate(viewportHeight, 0, progress),
    };
  }
  const start = transition.startPresentation;
  const characterMatches = start.character.name === target.character.name;
  const statusMatches =
    start.status && target.status && start.status.name === target.status.name;
  return {
    character: characterMatches
      ? {
          name: target.character.name,
          left: interpolate(
            start.character.left,
            target.character.left,
            progress,
          ),
          top: interpolate(start.character.top, target.character.top, progress),
          width: interpolate(
            start.character.width,
            target.character.width,
            progress,
          ),
          height: interpolate(
            start.character.height,
            target.character.height,
            progress,
          ),
          opacity: interpolate(
            start.character.opacity,
            target.character.opacity,
            progress,
          ),
        }
      : target.character,
    status: statusMatches
      ? {
          name: target.status!.name,
          x: interpolate(start.status!.x, target.status!.x, progress),
          y: interpolate(start.status!.y, target.status!.y, progress),
          opacity: interpolate(
            start.status!.opacity,
            target.status!.opacity,
            progress,
          ),
        }
      : target.status,
    translateY: 0,
  };
}

function SourceArt({
  source,
  nodeId,
  style,
  testID,
}: {
  source: ImageSourcePropType;
  nodeId: keyof typeof miboRenderEvidence.images;
  style: object;
  testID: string;
}) {
  const node = miboRenderEvidence.images[nodeId],
    uv = node.paintTransform;
  return (
    <Animated.View
      style={[
        {
          display: node.visible ? "flex" : "none",
          overflow: "hidden",
          opacity: node.opacity,
          mixBlendMode: node.blendMode === "DARKEN" ? "darken" : "normal",
        },
        style,
      ]}
      testID={testID}
    >
      <Image
        source={source}
        testID={`${testID}-image`}
        resizeMode="stretch"
        style={{
          position: "absolute",
          width: node.size.x / uv.m00,
          height: node.size.y / uv.m11,
          left: (-node.size.x * uv.m02) / uv.m00,
          top: (-node.size.y * uv.m12) / uv.m11,
        }}
      />
    </Animated.View>
  );
}

function MiboComposition({
  snapshot,
  sources,
  viewport,
  testID,
  style,
  characterStyle,
  statusStyle,
  titleTestID,
  visualOnly = false,
}: {
  snapshot: MiboCompositionSnapshot;
  sources: MiboStageArt;
  viewport: { width: number; height: number };
  testID: string;
  style?: object;
  characterStyle?: object;
  statusStyle?: object;
  titleTestID?: string;
  visualOnly?: boolean;
}) {
  const {
    sourceFrame,
    rippleLarge,
    ripple,
    visibleCharacters,
    primaryCharacter,
    artScale,
    artViewportHeight,
    artCanvasTop,
  } = getMiboStageLayout(
    snapshot.state,
    snapshot.hasDetails ?? false,
    viewport.width,
    snapshot.sourceFrameHint,
  );
  const sourceFor = (value: typeof primaryCharacter) =>
    value.rawHash === miboStageFigmaEvidence.art.greetingCat.assetHash
      ? snapshot.state.kind === "greeting"
        ? sources.greetingCat
        : sources.successCat
      : sources.workingCat;

  return (
    <Animated.View
      {...(visualOnly
        ? Platform.OS === "web"
          ? { "aria-hidden": true }
          : {
              accessibilityElementsHidden: true,
              importantForAccessibility: "no-hide-descendants" as const,
              accessible: false,
            }
        : {})}
      pointerEvents={visualOnly ? "none" : "auto"}
      style={[styles.composition, style]}
      testID={testID}
    >
      <View
        {...(Platform.OS === "web"
          ? { "aria-hidden": true }
          : { accessibilityElementsHidden: true })}
        style={[styles.artViewport, { height: artViewportHeight }]}
        testID={
          testID === "mibo-composition-current"
            ? "mibo-art-viewport"
            : undefined
        }
      >
        <View
          style={[
            styles.artCanvas,
            { top: artCanvasTop, transform: [{ scale: artScale }] },
          ]}
          testID={
            testID === "mibo-composition-current"
              ? "mibo-art-canvas"
              : undefined
          }
        >
          <View style={StyleSheet.absoluteFill}>
            <Svg
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              width={375}
              height={330}
            >
              <G transform="translate(0 -137)">
                <MobileBackdrop
                  width={375}
                  height={viewport.height}
                  variant="chatbot"
                  prefix={`mibo-art-background-${sourceFrame}`}
                />
              </G>
            </Svg>
            <SourceArt
              nodeId={rippleLarge.sourceNodeId}
              source={sources.rippleLarge}
              style={{
                height: rippleLarge.size.y,
                left: rippleLarge.transform.m02,
                position: "absolute",
                top: rippleLarge.transform.m12 - 137,
                width: rippleLarge.size.x,
              }}
              testID={
                testID === "mibo-composition-current"
                  ? "mibo-ripple-large"
                  : `mibo-previous-${rippleLarge.sourceNodeId}`
              }
            />
            <SourceArt
              nodeId={ripple.sourceNodeId}
              source={sources.ripple}
              style={{
                height: ripple.size.y,
                left: ripple.transform.m02,
                position: "absolute",
                top: ripple.transform.m12 - 137,
                width: ripple.size.x,
              }}
              testID={
                testID === "mibo-composition-current"
                  ? "mibo-ripple"
                  : `mibo-previous-${ripple.sourceNodeId}`
              }
            />
            {visibleCharacters.map((value) => (
              <SourceArt
                key={value.sourceNodeId}
                nodeId={value.sourceNodeId}
                source={sourceFor(value)}
                style={{
                  height: value.size.y,
                  left: value.transform.m02,
                  position: "absolute",
                  top: value.transform.m12 - 137,
                  width: value.size.x,
                  ...(value.sourceNodeId === primaryCharacter.sourceNodeId
                    ? characterStyle
                    : {}),
                }}
                testID={
                  testID === "mibo-composition-current"
                    ? value.sourceNodeId === primaryCharacter.sourceNodeId
                      ? "mibo-cat"
                      : `mibo-cat-layer-${value.sourceNodeId}`
                    : `mibo-previous-${value.sourceNodeId}`
                }
              />
            ))}
          </View>
        </View>
      </View>
      <View style={styles.stateContent}>
        {snapshot.state.kind === "greeting" && !titleTestID ? (
          <View style={{ marginTop: -85, left: 4 }}>
            <FigmaText
              evidence={miboRenderEvidence.text["845:3521"]}
              testID={
                testID === "mibo-composition-current"
                  ? "mibo-source-greeting"
                  : undefined
              }
            />
          </View>
        ) : (
          <Animated.Text
            testID={visualOnly ? undefined : titleTestID}
            accessibilityRole={visualOnly ? undefined : "header"}
            style={[styles.title, { marginTop: -85 * artScale }, statusStyle]}
          >
            {snapshot.state.title}
          </Animated.Text>
        )}
        {snapshot.state.kind === "waiting_user" &&
          Boolean(snapshot.question) && (
            <Text
              style={styles.detail}
              testID={
                testID === "mibo-composition-current"
                  ? "mibo-question"
                  : undefined
              }
            >
              {snapshot.question}
            </Text>
          )}
        {snapshot.state.kind === "failed" && Boolean(snapshot.errorMessage) && (
          <Text
            accessibilityRole={visualOnly ? undefined : "alert"}
            style={styles.error}
            testID={
              testID === "mibo-composition-current" ? "mibo-error" : undefined
            }
          >
            {snapshot.errorMessage}
          </Text>
        )}
        {snapshot.reply ? (
          <View style={styles.replySlot}>{snapshot.reply}</View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function MiboStage({
  state,
  question,
  errorMessage,
  art,
  titleTestID,
  hasDetails = false,
  snapshotKey = state.kind,
  sourceFrameHint,
  transitionReason = "snapshot",
  reply,
}: MiboStageProps) {
  const viewport = useWindowDimensions();
  const sources = getArt(art);
  const current: MiboCompositionSnapshot = {
    state,
    question,
    errorMessage,
    hasDetails,
    sourceFrameHint,
    reply,
    snapshotKey,
  };
  const currentLayout = getMiboStageLayout(
    state,
    hasDetails,
    viewport.width,
    sourceFrameHint,
  );
  const previousComposition = useRef(current);
  const transitionId = useRef(0);
  const [transition, setTransition] = useState<MiboTransition | null>(null);
  const { progress, start, getCurrentValue } = useSourceMotion(
    transition?.motion ?? null,
  );
  useLayoutEffect(() => {
    const previous = previousComposition.current;
    const previousFrame = getMiboStageLayout(
      previous.state,
      previous.hasDetails ?? false,
      viewport.width,
      previous.sourceFrameHint,
    ).sourceFrame;
    const frameChanged = previousFrame !== currentLayout.sourceFrame;
    const snapshotChanged = previous.snapshotKey !== snapshotKey;
    if (frameChanged || snapshotChanged) {
      const motion =
        previousFrame === "845:3479" && currentLayout.sourceFrame === "846:3544"
          ? getSourceMotion("845:3539", "ON_CLICK", currentLayout.sourceFrame)
          : getSourceMotion(
              previousFrame,
              "AFTER_TIMEOUT",
              currentLayout.sourceFrame,
            );
      if (
        snapshotChanged &&
        motion &&
        shouldStartSourceTransition(
          motion,
          transitionReason,
          previous.snapshotKey,
          snapshotKey,
        )
      ) {
        const activeProgress = getCurrentValue();
        const presented = transition
          ? resolvedPresentation(
              transition,
              activeProgress,
              viewport.width,
              viewport.height,
            )
          : rawPresentation(previous, viewport.width);
        const crossTransition =
          transition && transition.motion.transition !== motion.transition;
        setTransition({
          id: ++transitionId.current,
          from: previous,
          to: current,
          motion,
          startPresentation: crossTransition
            ? rawPresentation(previous, viewport.width)
            : presented,
          retainedPresentation:
            motion.transition === "SLIDE_FROM_BOTTOM" || crossTransition
              ? presented
              : null,
        });
      } else {
        setTransition(null);
      }
    }
    previousComposition.current = current;
  });
  useEffect(() => {
    if (!transition) return;
    const id = transition.id;
    start(() => {
      setTransition((active) => (active?.id === id ? null : active));
    });
  }, [start, transition]);
  const motionStyles = useMemo<MiboMotionStyles>(() => {
    if (!transition) return {};
    const target = rawPresentation(transition.to, viewport.width);
    const isSlide = transition.motion.transition === "SLIDE_FROM_BOTTOM";
    const retained = transition.retainedPresentation;
    const retainedRaw = rawPresentation(transition.from, viewport.width);
    const retainedStatusMatches =
      retained?.status &&
      retainedRaw.status &&
      retained.status.name === retainedRaw.status.name;
    const previousStyles = retained
      ? {
          previousStyle: {
            transform: [{ translateY: retained.translateY }],
          },
          previousCharacterStyle: {
            left: retained.character.left,
            top: retained.character.top,
            width: retained.character.width,
            height: retained.character.height,
            opacity: retained.character.opacity,
          },
          previousStatusStyle: retainedStatusMatches
            ? {
                transform: [
                  { translateX: retained.status!.x - retainedRaw.status!.x },
                  { translateY: retained.status!.y - retainedRaw.status!.y },
                ],
                opacity: retained.status!.opacity,
              }
            : undefined,
        }
      : {};
    if (isSlide) {
      return {
        ...previousStyles,
        currentStyle: {
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [viewport.height, 0],
              }),
            },
          ],
        },
      };
    }
    const matchingCharacter =
      transition.startPresentation.character.name === target.character.name;
    const matchingStatus =
      transition.startPresentation.status &&
      target.status &&
      transition.startPresentation.status.name === target.status.name;
    return {
      ...previousStyles,
      characterStyle: matchingCharacter
        ? {
            left: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                transition.startPresentation.character.left,
                target.character.left,
              ],
            }),
            top: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                transition.startPresentation.character.top,
                target.character.top,
              ],
            }),
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                transition.startPresentation.character.width,
                target.character.width,
              ],
            }),
            height: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                transition.startPresentation.character.height,
                target.character.height,
              ],
            }),
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                transition.startPresentation.character.opacity,
                target.character.opacity,
              ],
            }),
          }
        : undefined,
      statusStyle: matchingStatus
        ? {
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    transition.startPresentation.status!.x - target.status!.x,
                    0,
                  ],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    transition.startPresentation.status!.y - target.status!.y,
                    0,
                  ],
                }),
              },
            ],
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [
                transition.startPresentation.status!.opacity,
                target.status!.opacity,
              ],
            }),
          }
        : undefined,
    };
  }, [progress, transition, viewport.height, viewport.width]);
  const sourceData =
    Platform.OS === "web"
      ? ({
          dataSet: {
            sourceFrame: currentLayout.sourceFrame,
            sourceMotion: transition?.motion?.interactionId ?? "",
          },
        } as unknown as ViewProps)
      : {};

  return (
    <View {...sourceData} style={styles.stage} testID="mibo-stage">
      {transition?.retainedPresentation && (
        <MiboComposition
          snapshot={{ ...transition.from, reply: undefined }}
          sources={sources}
          viewport={viewport}
          testID="mibo-composition-previous"
          style={[styles.previousComposition, motionStyles.previousStyle]}
          characterStyle={motionStyles.previousCharacterStyle}
          statusStyle={motionStyles.previousStatusStyle}
          visualOnly
        />
      )}
      <MiboComposition
        snapshot={current}
        sources={sources}
        viewport={viewport}
        testID="mibo-composition-current"
        titleTestID={titleTestID}
        style={motionStyles.currentStyle}
        characterStyle={motionStyles.characterStyle}
        statusStyle={motionStyles.statusStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
  },
  composition: {
    alignItems: "center",
    width: "100%",
  },
  previousComposition: {
    left: 0,
    position: "absolute",
    top: 0,
    width: "100%",
  },
  stateContent: {
    alignItems: "center",
    width: "100%",
  },
  replySlot: {
    marginTop: 14,
    width: "100%",
  },
  artViewport: {
    height: 330,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  artCanvas: {
    height: 330,
    left: "50%",
    marginLeft: -187.5,
    position: "absolute",
    top: 0,
    width: 375,
  },
  title: {
    left: 4,
    color: "#1E2140",
    fontFamily: mobileFontFamilies.pingFang,
    fontWeight: "500",
    fontSize: 24,
    lineHeight: 34,
    maxWidth: 375,
    paddingHorizontal: 24,
    textAlign: "center",
    width: "100%",
  },
  detail: {
    left: 4,
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.body,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 375,
    paddingHorizontal: 24,
    textAlign: "center",
    width: "100%",
  },
  error: {
    color: mobileColors.danger,
    fontFamily: mobileFontFamilies.body,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 375,
    paddingHorizontal: 24,
    textAlign: "center",
    width: "100%",
  },
});
