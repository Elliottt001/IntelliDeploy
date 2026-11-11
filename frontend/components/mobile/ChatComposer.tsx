import { StyleSheet, TextInput, View } from "react-native";

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
  onChangeText: (value: string) => void;
  onSubmit: () => void;
};

export const chatComposerFigmaEvidence = {
  shellNodeId: "845:3530",
  contentNodeId: "845:3531",
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
  onChangeText,
  onSubmit,
}: ChatComposerProps) {
  const disabled = !editable || !canSubmit || busy || !value.trim();
  const submit = () => {
    if (!disabled) onSubmit();
  };

  return (
    <View style={styles.composer}>
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
      <View accessibilityElementsHidden style={styles.microphone}>
        <MobileIcon color={mobileColors.muted} name="microphone" size={20} />
      </View>
      <CircleAction
        accessibilityLabel={busy ? "正在提交" : submitLabel}
        disabled={disabled}
        icon="send"
        onPress={submit}
        testID={submitTestID}
        variant="primary"
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
    borderWidth: chatComposerFigmaEvidence.borderWidth,
    flexDirection: "row",
    gap: 14,
    maxWidth: chatComposerFigmaEvidence.width,
    minHeight: chatComposerFigmaEvidence.height,
    paddingLeft: 13.027027,
    paddingRight: 8.972973,
    shadowColor: "#BABABA",
    shadowOffset: { height: 1.786134, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 2.679201,
    width: "100%",
  },
  microphone: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    width: 58.684204,
  },
  input: {
    color: mobileColors.text,
    flex: 1,
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 12,
    lineHeight: 24,
    maxHeight: 120,
    minHeight: mobileSpacing.controlMin,
    paddingVertical: 10,
  },
});
