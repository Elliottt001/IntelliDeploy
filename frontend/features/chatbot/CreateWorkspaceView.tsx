import {SourceRouteNode} from '../../components/mobile/sourceRouteShared';
import { getSourceMotion } from '../../design/sourceMotionEvidence';
import {SourceGlassSurface,sourceSurfacePaintStyle} from '../../components/mobile/glass/SourceGlassSurface';
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { formalMobileControls } from "../../design/formalMobileControls";
import { FigmaText } from "../../components/mobile/FigmaText";
import { miboRenderEvidence } from "../../design/miboRenderEvidence";
import {
  AppBackground,
  CircleAction,
  MiboStage,
} from "../../components/mobile";
import {
  ChatComposer,
  chatComposerFigmaEvidence,
} from "../../components/mobile/ChatComposer";
import { mobileColors } from "../../theme/tokens";
import { mobileFontFamilies } from "../../theme/typography";
import { getJobVisualState, type JobVisualState } from "./jobVisualState";
import {
  composerViewportLayout,
  resolveKeyboardViewport,
} from "../../theme/responsive";

// Direct Kiwi composition: the approved 845:3479 subtree has no Instance/Symbol.
export const chatbotLayoutEvidence = {
  frameId: "845:3479",
  headerNodeId: "845:3502",
  titleNodeId: "845:3509",
  headerWidth: 334,
  headerHeight: 38,
  headerY: 47,
  titleSize: 16,
  titleLineHeight: 26,
  titleColor: "#000000",
  composerNodeId: "845:3530",
  composerY: 729,
  gutter: 20,
  suggestions: [
    { nodeId: "845:3524", width: 197, label: "推荐几款好用的开发工具" },
    { nodeId: "845:3526", width: 205, label: "如何使用Docker部署项目？" },
    { nodeId: "845:3528", width: 239, label: "帮我生成一个Python爬虫代码！" },
  ],
} as const;

type Navigation = {
  onBack: () => void;
  onProducts: () => void;
  onBilling: () => void;
};
export function ChatbotPage({
  children,
  insets,
  onBack,
  onProducts,
  onBilling,
  footer,
  detailActions,
  keyboardHeight: keyboardHeightOverride,
}: PropsWithChildren<
  Navigation & {
    footer?: React.ReactNode;
    detailActions?: readonly {
      id: string;
      label: string;
      expanded: boolean;
      onPress: () => void;
    }[];
    insets: { top: number; bottom: number; left: number; right: number };
    keyboardHeight?: number;
  }
>) {
  const viewport = useWindowDimensions();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [observedKeyboardHeight, setObservedKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => setObservedKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setObservedKeyboardHeight(0),
    );
    if (Platform.OS !== "web" || !window.visualViewport) {
      return () => {
        show.remove();
        hide.remove();
      };
    }
    const visualViewport = window.visualViewport;
    const updateWebKeyboard = () =>
      setObservedKeyboardHeight(
        Math.max(
          0,
          window.innerHeight - visualViewport.height - visualViewport.offsetTop,
        ),
      );
    visualViewport.addEventListener("resize", updateWebKeyboard);
    return () => {
      show.remove();
      hide.remove();
      visualViewport.removeEventListener("resize", updateWebKeyboard);
    };
  }, []);
  const reportedKeyboardHeight =
    keyboardHeightOverride ?? observedKeyboardHeight;
  const unobscuredViewportHeight = useRef(viewport.height);
  const keyboardViewport = resolveKeyboardViewport(
    unobscuredViewportHeight.current,
    viewport.height,
    reportedKeyboardHeight,
  );
  unobscuredViewportHeight.current = keyboardViewport.unobscuredHeight;
  const headerSource = formalMobileControls.productHeader;
  const headerLeft =
      headerSource.transform.m02 - 3 + Math.max(0, (viewport.width - 375) / 2),
    headerWidth = Math.min(
      headerSource.size.x + 6,
      viewport.width - insets.left - insets.right - 35,
    );
  const contentWidth = Math.max(
    0,
    Math.min(
      560,
      viewport.width -
        insets.left -
        insets.right -
        chatbotLayoutEvidence.gutter * 2,
    ),
  );
  const composerLayout = composerViewportLayout(
    keyboardViewport.unobscuredHeight,
    keyboardViewport.effectiveKeyboardHeight,
    insets,
    chatComposerFigmaEvidence.height,
    29,
  );
  return (
    <AppBackground
      atmosphere="chatbot"
      insets={insets}
      contentStyle={{ width: contentWidth }}
      testID="chatbot-page"
    >
      <KeyboardAvoidingView
        style={viewStyles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SourceRouteNode sourceNodeId="845:3502"
          style={[
            viewStyles.header,
            {
              marginTop: Math.max(insets.top, 44),
              alignSelf: "flex-start",
              width: headerWidth,
              maxWidth: headerWidth,
              marginLeft: headerLeft - (viewport.width - contentWidth) / 2,
            },
          ]}
        >
          <CircleAction
            accessibilityLabel="返回"
            icon="back"
            surfaceOffset={headerSource.back.surfaceOffset}
            iconOffset={headerSource.back.iconOffset}
            sourceMotion={getSourceMotion("845:3503","ON_CLICK")} canonicalTarget="/"
            onPress={onBack}
            testID="chatbot-back"
          />
          <FigmaText
            evidence={miboRenderEvidence.text["845:3509"]}
            testID="mibo-source-header"
          />
          <CircleAction
            accessibilityLabel="应用与额度操作"
            icon="share"
            surfaceOffset={headerSource.share.surfaceOffset}
            iconOffset={headerSource.share.iconOffset}
            onPress={() => setActionsOpen((value) => !value)}
            testID="chatbot-settings"
          />
        </SourceRouteNode>
        {actionsOpen && (
          <View style={viewStyles.actionsMenu}>
            {detailActions?.map((action) => (
              <Pressable
                key={action.id}
                accessibilityRole="button"
                accessibilityState={{ expanded: action.expanded }}
                testID={action.id}
                onPress={() => {
                  setActionsOpen(false);
                  action.onPress();
                }}
                style={viewStyles.menuAction}
              >
                <Text style={viewStyles.caption}>{action.label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setActionsOpen(false);
                onProducts();
              }}
              style={viewStyles.menuAction}
              testID="chatbot-products"
            >
              <Text style={viewStyles.caption}>我的应用</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setActionsOpen(false);
                onBilling();
              }}
              style={viewStyles.menuAction}
              testID="chatbot-billing"
            >
              <Text style={viewStyles.caption}>额度与用量</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActionsOpen(false)}
              style={viewStyles.menuAction}
            >
              <Text style={viewStyles.caption}>关闭操作菜单</Text>
            </Pressable>
          </View>
        )}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={
            footer
              ? {
                  marginBottom: Math.max(
                    0,
                    keyboardViewport.unobscuredHeight -
                      composerLayout.contentBottom,
                  ),
                }
              : undefined
          }
          contentContainerStyle={[
            viewStyles.scroll,
            { paddingBottom: footer ? 24 : Math.max(insets.bottom, 29) },
          ]}
        >
          {children}
        </ScrollView>
        {footer && (
          <View
            testID="chatbot-composer-anchor"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: composerLayout.footerTop,
            }}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

export type CreateWorkspaceViewProps = {
  prompt: string;
  quotaText: string;
  policyText: string;
  lastApp: string | null;
  busy: boolean;
  editable: boolean;
  error: string;
  onChangePrompt: (value: string) => void;
  onCreate: () => void;
  onContinue: () => void;
};
export function CreateWorkspaceView({
  prompt,
  quotaText,
  policyText,
  lastApp,
  busy,
  editable,
  error,
  onChangePrompt,
  onCreate,
  onContinue,
}: CreateWorkspaceViewProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const initialState = getJobVisualState(null);
  const pendingState: JobVisualState = {
    ...initialState,
    kind: "thinking",
    title: "Mibo 正在思考中",
  };
  return (
    <View style={{ flexGrow: 1 }}>
      <MiboStage
        state={busy ? pendingState : initialState}
        sourceFrameHint={busy ? "846:3544" : "845:3479"}
        snapshotKey={busy ? "create:submitting" : "create:idle"}
        transitionReason="interaction"
      />
      <View style={viewStyles.suggestions}>
        {chatbotLayoutEvidence.suggestions.map((suggestion) => {
          const text =
            miboRenderEvidence.text[
              `${suggestion.nodeId.split(":")[0]}:${Number(suggestion.nodeId.split(":")[1]) + 1}` as keyof typeof miboRenderEvidence.text
            ];
          return (
            <Pressable
              key={suggestion.nodeId}
              accessibilityRole="button"
              disabled={!editable || busy}
              onPress={() => onChangePrompt(suggestion.label)}
              style={[viewStyles.suggestionTarget, { width: suggestion.width }]}
            >
              <View
                testID={`mibo-suggestion-face-${suggestion.nodeId}`}
                style={[viewStyles.suggestion, { width: suggestion.width },sourceSurfacePaintStyle(suggestion.nodeId)]}
              ><SourceGlassSurface sourceNodeId={suggestion.nodeId}/></View>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: text.transform.m02,
                  top: (44 - 35) / 2 + text.transform.m12,
                }}
              >
                <FigmaText
                  testID={`mibo-suggestion-text-${suggestion.nodeId}`}
                  evidence={text}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsOpen }}
        onPress={() => setDetailsOpen((value) => !value)}
        style={viewStyles.products}
        testID="create-account-details"
      >
        <Text style={viewStyles.caption}>额度与计费说明</Text>
      </Pressable>
      {detailsOpen && (
        <View>
          <Text style={viewStyles.caption}>{quotaText}</Text>
          {Boolean(policyText) && (
            <Text style={viewStyles.caption}>{policyText}</Text>
          )}
        </View>
      )}
      {Boolean(error) && (
        <Text
          testID="workspace-error"
          accessibilityRole="alert"
          style={viewStyles.error}
        >
          {error}
        </Text>
      )}
      <SourceRouteNode sourceNodeId="845:3530" style={{ marginTop: "auto", paddingTop: 16 }}>
        <ChatComposer
          value={prompt}
          editable={editable}
          busy={busy}
          onChangeText={onChangePrompt}
          onSubmit={onCreate}
          inputTestID="create-prompt"
          submitTestID="create-app"
          inputLabel="你想做什么应用"
          submitLabel="开始创建"
        />
      </SourceRouteNode>
      {lastApp && (
        <Pressable
          accessibilityRole="button"
          testID="last-app"
          onPress={onContinue}
          style={viewStyles.products}
        >
          <Text style={viewStyles.caption}>继续上次的应用</Text>
        </Pressable>
      )}
    </View>
  );
}

export const viewStyles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    alignSelf: "center",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    maxWidth: chatbotLayoutEvidence.headerWidth,
    minHeight: 44,
    width: "100%",
  },
  headerTitle: {
    color: chatbotLayoutEvidence.titleColor,
    fontFamily: mobileFontFamilies.emphasis,
    fontSize: chatbotLayoutEvidence.titleSize,
    lineHeight: chatbotLayoutEvidence.titleLineHeight,
  },
  products: {
    alignSelf: "center",
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  scroll: { flexGrow: 1, gap: 14, paddingTop: 49 },
  actionsMenu: {
    position: "absolute",
    right: 0,
    top: 91,
    zIndex: 10,
    width: 240,
    maxWidth: "100%",
    backgroundColor: "#FFFFFF",
    borderColor: "#D0C7FE",
    borderWidth: 1,
    borderRadius: 20,
    padding: 8,
  },
  menuAction: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  caption: {
    color: mobileColors.muted,
    fontFamily: mobileFontFamilies.body,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  error: {
    color: mobileColors.danger,
    fontFamily: mobileFontFamilies.body,
    fontSize: 14,
    lineHeight: 22,
  },
  suggestions: { alignItems: "center", gap: 5, marginTop: 15, left: 4 },
  suggestionTarget: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    maxWidth: "100%",
  },
  suggestion: {
    alignItems: "center",
    justifyContent: "center",
    height: 35,
    maxWidth: "100%",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: chatComposerFigmaEvidence.cornerRadius,
    borderColor: "#FFFFFF",
    borderWidth: chatComposerFigmaEvidence.borderWidth,
    shadowColor: "#BABABA",
    shadowOffset: { width: 0, height: 1.786134 },
    shadowOpacity: 0.25,
    shadowRadius: 2.679201,
  },
  suggestionText: {
    color: mobileColors.text,
    fontFamily: mobileFontFamilies.pingFang,
    fontSize: 12,
    lineHeight: 24,
  },
});
