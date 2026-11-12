import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";

import Svg, { G } from "react-native-svg";
import { MobileBackdrop } from "./MobileBackdrop";
import { FigmaText } from "./FigmaText";
import { miboRenderEvidence } from "../../design/miboRenderEvidence";
import type { JobVisualState } from "../../features/chatbot/jobVisualState";
import { mobileColors } from "../../theme/tokens";
import { mobileFontFamilies } from "../../theme/typography";

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
  robot: ImageSourcePropType;
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
};

function getArt(art?: Partial<MiboStageArt>): MiboStageArt {
  return {
    rippleLarge:
      art?.rippleLarge ??
      require("../../assets/mobile/generated/845-3518-1949e95938c28d6e69b0614f6df7cf5faf0e15df.png"),
    ripple:
      art?.ripple ??
      require("../../assets/mobile/generated/845-3519-cd9473e69b1bbe6ca3a605ad61dbe66e1a5753c2.png"),
    robot:
      art?.robot ??
      require("../../assets/mobile/generated/845-3520-61e75e928c998d78da3702299dfa112e9f577bd3.png"),
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
    <View
      style={[
        style,
        {
          display: node.visible ? "flex" : "none",
          overflow: "hidden",
          opacity: node.opacity,
          mixBlendMode: node.blendMode === "DARKEN" ? "darken" : "normal",
        },
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
    </View>
  );
}

export function MiboStage({
  state,
  question,
  errorMessage,
  art,
  titleTestID,
  hasDetails = false,
}: MiboStageProps) {
  const viewport = useWindowDimensions();
  const sources = getArt(art);
  const cat =
    state.kind === "greeting"
      ? sources.greetingCat
      : state.kind === "succeeded"
        ? sources.successCat
        : sources.workingCat;
  const workingNodeIds = {
    clarifying: "849:3651", retrieving: "849:3748",
    implementing: "849:3837", building: hasDetails ? "852:4193" : "849:3926",
    validating: "849:4015", deploying: "852:4104",
  } as const;
  const catNodeId: keyof typeof miboRenderEvidence.images =
    state.kind === "greeting"
      ? "845:3522"
      : state.kind === "succeeded"
        ? "852:4435"
        : workingNodeIds[state.kind as keyof typeof workingNodeIds] ?? "846:3587";
  const catNode = miboRenderEvidence.images[catNodeId];

  return (
    <View style={styles.stage} testID="mibo-stage">
      <View
        {...(Platform.OS === "web"
          ? { "aria-hidden": true }
          : { accessibilityElementsHidden: true })}
        style={styles.artViewport}
        testID="mibo-art-viewport"
      >
        <View style={styles.artCanvas} testID="mibo-art-canvas">
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width={375}
            height={330}
          >
            <G transform={`translate(${(375 - viewport.width) / 2} -137)`}>
              <MobileBackdrop
                width={viewport.width}
                height={viewport.height}
                variant="chatbot"
                prefix="mibo-art-background"
              />
            </G>
          </Svg>
          <SourceArt
            nodeId="845:3518"
            source={sources.rippleLarge}
            style={styles.rippleLarge}
            testID="mibo-ripple-large"
          />
          <SourceArt
            nodeId="845:3519"
            source={sources.ripple}
            style={styles.ripple}
            testID="mibo-ripple"
          />
          <SourceArt
            nodeId="845:3520"
            source={sources.robot}
            style={styles.robot}
            testID="mibo-robot"
          />
          <SourceArt
            nodeId={catNodeId}
            source={cat}
            style={[
              styles.cat,
              {
                height: catNode.size.y,
                left: catNode.transform.m02,
                top: catNode.transform.m12 - miboStageFigmaEvidence.art.rippleLarge.box.y,
                width: catNode.size.x,
              },
            ]}
            testID="mibo-cat"
          />
        </View>
      </View>
      {state.kind === "greeting" && !titleTestID ? (
        <View style={{ marginTop: -85,left:4 }}>
          <FigmaText
            evidence={miboRenderEvidence.text["845:3521"]}
            testID="mibo-source-greeting"
          />
        </View>
      ) : (
        <Text
          testID={titleTestID}
          accessibilityRole="header"
          style={[styles.title, { marginTop: -85 }]}
        >
          {state.title}
        </Text>
      )}
      {state.kind === "waiting_user" && Boolean(question) && (
        <Text style={styles.detail} testID="mibo-question">
          {question}
        </Text>
      )}
      {state.kind === "failed" && Boolean(errorMessage) && (
        <Text
          accessibilityRole="alert"
          style={styles.error}
          testID="mibo-error"
        >
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    alignSelf: "center",
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
  rippleLarge: {
    height: 336,
    left: -61,
    position: "absolute",
    top: 0,
    width: 504,
  },
  ripple: {
    height: 239,
    left: 8,
    position: "absolute",
    top: 59,
    width: 359,
  },
  robot: {
    height: 154,
    left: 72,
    position: "absolute",
    top: 96,
    width: 231,
  },
  cat: {
    position: "absolute",
  },
  title: {
    left:4,
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
    left:4,
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
