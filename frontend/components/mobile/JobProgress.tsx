import { Pressable, StyleSheet, Text, View } from "react-native";

import type {
  JobVisualKind,
  JobVisualState,
} from "../../features/chatbot/jobVisualState";
import { mobileColors } from "../../theme/tokens";
import { mobileFontFamilies } from "../../theme/typography";

const stages: ReadonlyArray<{ kind: JobVisualKind; label: string }> = [
  { kind: "clarifying", label: "理解需求" },
  { kind: "retrieving", label: "准备应用" },
  { kind: "implementing", label: "分析并实现" },
  { kind: "building", label: "构建应用" },
  { kind: "validating", label: "验证功能" },
  { kind: "deploying", label: "发布应用" },
  { kind: "verifying_live", label: "验证入口" },
  { kind: "succeeded", label: "应用已交付" },
];

export type JobProgressProps = {
  state: JobVisualState;
  compact?:boolean;
  showToggle?:boolean;
  expanded?:boolean;
  onToggle?:()=>void;
  testID?: string;
};

export function JobProgress({ state, testID, compact=false, showToggle=true, expanded=!compact, onToggle }: JobProgressProps) {
  return (
    <View style={styles.container}>
      {testID&&<Text style={styles.title} testID={testID}>{state.title}</Text>}
      {compact&&showToggle&&<Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={onToggle} style={styles.toggle}><Text style={styles.label}>查看任务阶段</Text></Pressable>}
      <View accessibilityRole="list" style={styles.stages}>
        {(expanded?stages:stages.filter(stage=>stage.kind===state.kind)).map((stage) => {
          const selected = stage.kind === state.kind;
          return (
            <View
              accessibilityLabel={stage.label}
              accessibilityState={{ selected }}
              key={stage.kind}
              style={styles.stage}
              testID={`job-progress-${stage.kind}`}
            >
              <View style={[styles.dot, selected && styles.dotSelected]} />
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {stage.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {minHeight:44,minWidth:44,alignSelf:'center',justifyContent:'center'},
  container: {
    alignSelf: "center",
    maxWidth: 560,
    paddingHorizontal: 16,
    width: "100%",
  },
  title: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  stages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
  },
  stage: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 8,
  },
  dot: {
    backgroundColor: "#D7D9E7",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  dotSelected: {
    backgroundColor: mobileColors.primary,
  },
  label: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 12,
    lineHeight: 18,
  },
  labelSelected: {
    color: mobileColors.primary,
    fontFamily: mobileFontFamilies.emphasis,
  },
});
