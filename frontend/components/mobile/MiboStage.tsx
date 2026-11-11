import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";

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
      nodeId: "852:4285",
      assetHash: "42811159c4b77210f20cb8dd8611c49872975bd9",
      box: { x: 101, y: 164, width: 178, height: 154 },
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
      require("../../assets/mobile/generated/852-4285-42811159c4b77210f20cb8dd8611c49872975bd9.png"),
  };
}

export function MiboStage({
  state,
  question,
  errorMessage,
  art,
}: MiboStageProps) {
  const sources = getArt(art);
  const cat =
    state.kind === "greeting"
      ? sources.greetingCat
      : state.kind === "succeeded"
        ? sources.successCat
        : sources.workingCat;
  const catBox =
    state.kind === "greeting"
      ? miboStageFigmaEvidence.art.greetingCat.box
      : state.kind === "succeeded"
        ? miboStageFigmaEvidence.art.successCat.box
        : miboStageFigmaEvidence.art.workingCat.box;

  return (
    <View style={styles.stage} testID="mibo-stage">
      <View accessibilityElementsHidden style={styles.artboard}>
        <Image
          source={sources.rippleLarge}
          style={styles.rippleLarge}
          testID="mibo-ripple-large"
        />
        <Image
          source={sources.ripple}
          style={styles.ripple}
          testID="mibo-ripple"
        />
        <Image
          source={sources.robot}
          style={styles.robot}
          testID="mibo-robot"
        />
        <Image
          source={cat}
          style={[
            styles.cat,
            {
              height: catBox.height,
              left: catBox.x,
              top: catBox.y - miboStageFigmaEvidence.art.rippleLarge.box.y,
              width: catBox.width,
            },
          ]}
          testID="mibo-cat"
        />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {state.title}
      </Text>
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
    maxWidth: 375,
    width: "100%",
  },
  artboard: {
    height: 330,
    maxWidth: 375,
    overflow: "hidden",
    position: "relative",
    width: "100%",
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
    color: "#1E2140",
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 24,
    lineHeight: 34,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  detail: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.body,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  error: {
    color: mobileColors.danger,
    fontFamily: mobileFontFamilies.body,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    paddingHorizontal: 24,
    textAlign: "center",
  },
});
