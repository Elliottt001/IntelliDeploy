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
import { useEffect, useMemo, useRef, useState } from "react";

import Svg, { G } from "react-native-svg";
import { MobileBackdrop } from "./MobileBackdrop";
import { FigmaText } from "./FigmaText";
import { miboRenderEvidence } from "../../design/miboRenderEvidence";
import type { JobVisualState } from "../../features/chatbot/jobVisualState";
import { mobileColors } from "../../theme/tokens";
import { mobileFontFamilies } from "../../theme/typography";
import { getSourceMotion, type SourceMotion } from "../../design/sourceMotionEvidence";
import { shouldStartSourceTransition, type SourceTransitionReason } from "../../features/navigation/sourceMotionPolicy";
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
  snapshotKey?: string;
  sourceFrameHint?: keyof typeof miboRenderEvidence.frames;
  transitionReason?: SourceTransitionReason;
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

export function getMiboStageLayout(state:JobVisualState,hasDetails:boolean,viewportWidth:number,sourceFrameHint?:keyof typeof miboRenderEvidence.frames) {
 const stateFrames = {
  greeting:"845:3479",thinking:"849:3608",clarifying:"849:3705",retrieving:"849:3794",
  implementing:"849:3883",building:hasDetails?"852:4242":"849:3972",validating:"852:4061",
  deploying:"852:4150",verifying_live:"852:4150",succeeded:"852:4391",waiting_user:"849:3608",
  paused_quota:"849:3608",failed:"849:3608",cancelled:"849:3608",working:"849:3608",
 } as const satisfies Record<typeof state.kind,keyof typeof miboRenderEvidence.frames>;
 const sourceFrame=sourceFrameHint??stateFrames[state.kind],frame=miboRenderEvidence.frames[sourceFrame];
 const imageNodes=frame.imageNodeIds.map(id=>miboRenderEvidence.images[id]);
 const rippleLarge=imageNodes.find(value=>value.rawHash===miboStageFigmaEvidence.art.rippleLarge.assetHash)!;
 const ripple=imageNodes.find(value=>value.rawHash===miboStageFigmaEvidence.art.ripple.assetHash)!;
 const backgroundHashes:readonly string[]=[rippleLarge.rawHash,ripple.rawHash,miboStageFigmaEvidence.art.robot.assetHash];
 const visibleCharacters=imageNodes.filter(value=>value.visible&&value.opacity>0&&!backgroundHashes.includes(value.rawHash));
 const primaryCharacter=(visibleCharacters.find(value=>value.rawHash===miboStageFigmaEvidence.art.greetingCat.assetHash)??visibleCharacters[0])!;
 return {sourceFrame,frame,imageNodes,rippleLarge,ripple,visibleCharacters,primaryCharacter,artScale:Math.min(1,viewportWidth/miboRenderEvidence.frames["845:3479"].size.x)};
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
  snapshotKey = state.kind,
  sourceFrameHint,
  transitionReason = "snapshot",
}: MiboStageProps) {
  const viewport = useWindowDimensions();
  const sources = getArt(art);
  const {sourceFrame,rippleLarge,ripple,visibleCharacters,primaryCharacter,artScale}=getMiboStageLayout(state,hasDetails,viewport.width,sourceFrameHint);
  const sourceFor=(value:typeof primaryCharacter)=>value.rawHash===miboStageFigmaEvidence.art.greetingCat.assetHash?(state.kind==='greeting'?sources.greetingCat:sources.successCat):sources.workingCat;
  const previousFrame=useRef(sourceFrame),previousSnapshot=useRef(snapshotKey);
  const [transition,setTransition]=useState<{from:keyof typeof miboRenderEvidence.frames;to:keyof typeof miboRenderEvidence.frames;motion:SourceMotion|null}|null>(null);
  useEffect(()=>{
    const from=previousFrame.current,previousKey=previousSnapshot.current;
    const motion=from==="845:3479"&&sourceFrame==="846:3544"
      ?getSourceMotion("845:3539","ON_CLICK",sourceFrame)
      :getSourceMotion(from,"AFTER_TIMEOUT",sourceFrame);
    if(previousKey!==snapshotKey&&motion&&shouldStartSourceTransition(motion,transitionReason,previousKey,snapshotKey))setTransition({from,to:sourceFrame,motion});
    else if(previousKey!==snapshotKey)setTransition(null);
    previousFrame.current=sourceFrame;previousSnapshot.current=snapshotKey;
  },[snapshotKey,sourceFrame,transitionReason]);
  const {progress,start}=useSourceMotion(transition?.motion??null);
  useEffect(()=>{if(transition?.motion)start();},[start,transition]);
  const animatedStyle=useMemo(()=>{
    if(!transition?.motion||transition.to!==sourceFrame)return undefined;
    if(transition.motion.transition==="SLIDE_FROM_BOTTOM")return {transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[330,0]})}]};
    const fromFrame=miboRenderEvidence.frames[transition.from];
    const fromImages=fromFrame.imageNodeIds.map(id=>miboRenderEvidence.images[id]);
    const fromCharacter=fromImages.find(value=>value.visible&&value.opacity>0&&value.rawHash===primaryCharacter?.rawHash)??fromImages.find(value=>value.visible&&value.opacity>0&&value.rawHash===miboStageFigmaEvidence.art.workingCat.assetHash);
    if(!fromCharacter||!primaryCharacter)return undefined;
    return {transform:[
      {translateX:progress.interpolate({inputRange:[0,1],outputRange:[fromCharacter.transform.m02-primaryCharacter.transform.m02,0]})},
      {translateY:progress.interpolate({inputRange:[0,1],outputRange:[fromCharacter.transform.m12-primaryCharacter.transform.m12,0]})},
    ]};
  },[primaryCharacter,progress,sourceFrame,transition]);
  const sourceData=Platform.OS==='web'?({dataSet:{sourceFrame,sourceMotion:transition?.motion?.interactionId??''}} as unknown as ViewProps):{};

  return (
    <View {...sourceData} style={styles.stage} testID="mibo-stage">
      <View
        {...(Platform.OS === "web"
          ? { "aria-hidden": true }
          : { accessibilityElementsHidden: true })}
        style={[styles.artViewport,{height:330*artScale}]}
        testID="mibo-art-viewport"
      >
        <View style={[styles.artCanvas,{transform:[{scale:artScale}]}]} testID="mibo-art-canvas">
         <Animated.View style={[StyleSheet.absoluteFill,animatedStyle]}>
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
                prefix="mibo-art-background"
              />
            </G>
          </Svg>
          <SourceArt
            nodeId={rippleLarge.sourceNodeId}
            source={sources.rippleLarge}
            style={{height:rippleLarge.size.y,left:rippleLarge.transform.m02,position:'absolute',top:rippleLarge.transform.m12-137,width:rippleLarge.size.x}}
            testID="mibo-ripple-large"
          />
          <SourceArt
            nodeId={ripple.sourceNodeId}
            source={sources.ripple}
            style={{height:ripple.size.y,left:ripple.transform.m02,position:'absolute',top:ripple.transform.m12-137,width:ripple.size.x}}
            testID="mibo-ripple"
          />
          {visibleCharacters.map(value=><SourceArt key={value.sourceNodeId} nodeId={value.sourceNodeId} source={sourceFor(value)} style={{height:value.size.y,left:value.transform.m02,position:'absolute',top:value.transform.m12-137,width:value.size.x}} testID={value.sourceNodeId===primaryCharacter.sourceNodeId?'mibo-cat':`mibo-cat-layer-${value.sourceNodeId}`}/>) }
         </Animated.View>
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
          style={[styles.title, { marginTop: -85*artScale }]}
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
