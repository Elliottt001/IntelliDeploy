import {SourceGlassSurface,sourceSurfacePaintStyle} from './glass/SourceGlassSurface';
import { Platform, StyleSheet, TextInput, View } from "react-native";

import { mobileColors, mobileSpacing } from "../../theme/tokens";
import { mobileFontFamilies } from "../../theme/typography";
import { CircleAction, MobileIcon } from "./CircleAction";

export type ChatComposerProps = {
  value: string;
  editable: boolean;
  busy: boolean;
  canSubmit?: boolean;
  inputTestID?: string;
  submitTestID?: string;
  inputLabel?: string;
  submitLabel?: string;
  testID?: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
};

export const chatComposerFigmaEvidence = {
  shellNodeId: "845:3530",
  contentNodeId: "845:3531",
  textNodeId:"845:3532",
  textOpacity:0.800000011920929,
  textAlign:'center',
  noSymbolReason:
    "composer subtree is direct Kiwi geometry with no INSTANCE or SYMBOL descendants",
  width: 335,
  height: 54,
  cornerRadius: 44.653347,
  borderWidth: 1.339601,
  fillOpacity: 0.7,
  effects: ["DROP_SHADOW", "GLASS"],
  microphoneNodeId: "845:3535",
  sendNodeIds: ["845:3539", "845:3540"],
} as const;

export function ChatComposer({
  value,
  editable,
  busy,
  canSubmit = editable,
  inputTestID = "message-input",
  submitTestID = "send-message",
  inputLabel = "继续对话",
  submitLabel = "发送",
  testID = "chat-composer",
  onChangeText,
  onSubmit,
}: ChatComposerProps) {
  const disabled = !editable || !canSubmit || busy || !value.trim();
  const submit = () => {
    if (!disabled) onSubmit();
  };

  return (
    <View style={[styles.composer,sourceSurfacePaintStyle(chatComposerFigmaEvidence.shellNodeId)]} testID={testID}>
      <SourceGlassSurface sourceNodeId={chatComposerFigmaEvidence.shellNodeId}/>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderWidth:sourceSurfacePaintStyle(chatComposerFigmaEvidence.shellNodeId)?0:chatComposerFigmaEvidence.borderWidth,borderColor:'#FFFFFF',borderRadius:chatComposerFigmaEvidence.cornerRadius}]}/>
      <TextInput
        accessibilityLabel={inputLabel}
        editable={editable && !busy}
        maxLength={20000}
        multiline
        numberOfLines={1}
        onChangeText={onChangeText}
        onSubmitEditing={submit}
        placeholder="在这里输入你的问题……"
        placeholderTextColor={mobileColors.muted}
        style={styles.input}
        testID={inputTestID}
        value={value}
      />
      <View accessibilityElementsHidden style={styles.microphone} testID="chat-composer-microphone">
        <View style={{position:'absolute',left:40.689514,top:2}}><MobileIcon color={mobileColors.muted} name="microphone" size={20} /></View>
      </View>
      <CircleAction
        accessibilityLabel={busy ? "正在提交" : submitLabel}
        disabled={disabled}
        icon="send"
        onPress={submit}
        testID={submitTestID}
        variant="primary"
        style={{position:'absolute',right:8.630871,top:5}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.70)",
    borderColor: "#FFFFFF",
    borderRadius: chatComposerFigmaEvidence.cornerRadius,
    borderWidth: 0,
    maxWidth: chatComposerFigmaEvidence.width,
    minHeight: chatComposerFigmaEvidence.height,
    shadowColor: "#BABABA",
    shadowOffset: { height: 1.786134, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 2.679201,
    width: "100%",
    position:'relative',
  },
  microphone: {
    position:'absolute',
    right:64.630871,
    top:15,
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    width: 58.684204,
  },
  input: {
    color: 'rgba(107,114,128,0.8)',
    textAlign:'center',
    position:'absolute',
    left:14.684925,
    right:137.315075,
    top:5,
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 12,
    lineHeight: 24,
    maxHeight: 120,
    minHeight: mobileSpacing.controlMin,
    // Source text frame begins10pt below the44pt target (729+7+8=744).
    // Chromium's measured
    //12/24 PingFang baseline is16pt; source derived baseline is16.32pt.
    paddingTop: Platform.OS === 'web' ? 10.32 : 10,
    paddingBottom: Platform.OS === 'web' ? 9.68 : 10,
  },
});
