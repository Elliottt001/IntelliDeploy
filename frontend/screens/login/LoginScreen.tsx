import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { cssInterop } from "nativewind";
import {
  useMemo,
  useState,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ImageProps,
  type ImageSourcePropType,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { FigmaGeometry } from "../../components/mobile/FigmaGeometry";
import { FigmaTree } from "../../components/mobile/FigmaTree";
import { FigmaText } from "../../components/mobile/FigmaText";
import { mobileAssets } from "../../design/generated/mobileAssetManifest";
import { loginRenderEvidence } from "../../design/loginRenderEvidence";
import { fitSourceWidth } from "../../theme/responsive";
import { BrandHeader } from "../../components/mobile/BrandHeader";
import { MobileBackdrop } from "../../components/mobile/MobileBackdrop";
import Svg, { Rect } from "react-native-svg";
import { loginOptions } from "../../features/auth/loginOptions";
import {
  atmosphereXml,
  catXml,
  layersXml,
  logoXml,
  purpleGlowXml,
  rippleXml,
  settingsXml,
  socialCircleXml,
  wordMarkXml,
} from "./generated/loginSvgAssets";
import { sanitizeNextPath } from "../../features/navigation/routePolicy";
import { authAPI } from "../../services/api";

type ClassNameProp = {
  className?: string;
};

type LocalSvgProps = {
  xml: string;
  className: string;
  opacity?: number;
};

const TView = View as ComponentType<ViewProps & ClassNameProp>;
const TText = Text as ComponentType<TextProps & ClassNameProp>;
const TImage = Image as ComponentType<ImageProps & ClassNameProp>;
const TPressable = Pressable as ComponentType<PressableProps & ClassNameProp>;
const TTextInput = TextInput as ComponentType<TextInputProps & ClassNameProp>;

cssInterop(LinearGradient, { className: "style" });

const TLinearGradient = LinearGradient as ComponentType<
  ComponentProps<typeof LinearGradient> & ClassNameProp
>;

const googleLogo = mobileAssets["119:76727:2"].source as ImageSourcePropType;
const githubLogo = mobileAssets["119:76724:1"].source as ImageSourcePropType;
const appleLogo = mobileAssets["119:76721:0"].source as ImageSourcePropType;

interface MotionLayerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  fromY?: number;
  style?: ViewProps["style"];
}

interface SocialLoginOption {
  id: "google" | "github" | "apple";
  label: string;
  enabled: boolean;
  providerName: string;
  imageSource: ImageSourcePropType;
  imageClassName: string;
  imageStyle?: ImageProps["style"];
}

const socialArtwork: Record<
  (typeof loginOptions)[number]["id"],
  Omit<SocialLoginOption, "id" | "label" | "enabled">
> = {
  google: {
    providerName: "Google",
    imageSource: googleLogo,
    imageClassName: "absolute left-[1px] top-[6px] h-[28px] w-[38px]",
  },
  github: {
    providerName: "GitHub",
    imageSource: githubLogo,
    imageClassName: "absolute left-[7px] top-[8px] h-[24px] w-[26px]",
    imageStyle: { transform: [{ scale: 1.15 }] },
  },
  apple: {
    providerName: "Apple",
    imageSource: appleLogo,
    imageClassName: "absolute left-[9px] top-[8px] h-[22px] w-[22px]",
    imageStyle: { transform: [{ scale: 1.12 }] },
  },
};

const socialLoginOptions: SocialLoginOption[] = loginOptions.map((option) => ({
  ...option,
  ...socialArtwork[option.id],
}));

function LocalSvg({ xml, className, opacity = 1 }: LocalSvgProps) {
  return (
    <TView pointerEvents="none" className={className} style={{ opacity }}>
      <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="none" />
    </TView>
  );
}

function WebMotionLayer({
  children,
  className,
  style,
}: MotionLayerProps) {
  return <TView className={className} style={style}>{children}</TView>;
}

function MotionLayer(props: MotionLayerProps) {
  return <WebMotionLayer {...props} />;
}

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  testID?: string;
  style?: PressableProps['style'];
}

function Checkbox({ checked, onPress, testID, style }: CheckboxProps) {
  return (
    <TPressable
      accessibilityRole="checkbox"
      testID={testID}
      accessibilityState={{ checked }}
      onPress={onPress}
      className="h-[44px] w-[44px] items-center justify-center"
      style={style}
    >
      <TView
        className={[
          "h-[11px] w-[11px] rounded-[3px] border-[0.5px]",
          checked
            ? "border-[#7C62FF] bg-[#7C62FF]"
            : "border-[#CECECE] bg-white/50",
        ].join(" ")}
      />
    </TPressable>
  );
}

function LoginButtonOrnaments() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <FigmaGeometry
        geometry={loginRenderEvidence.button.geometry}
        width={299}
        height={46}
        prefix="login-button"
      />
    </View>
  );
}

interface SocialButtonProps {
  option: SocialLoginOption;
}

function SocialButton({ option }: SocialButtonProps) {
  const node=loginRenderEvidence.social[option.id],uv=node.paintTransform;
  return (
    <TPressable
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityState={{ disabled: !option.enabled }}
      disabled={!option.enabled}
      testID={`login-${option.id}`}
      className="relative h-[62px] w-[44px] rounded-[16px]"
    >
      <TView pointerEvents="none" className="absolute left-[2px] top-[2px] h-[40px] w-[40px]">
        <LocalSvg
          xml={socialCircleXml}
          className="absolute inset-0 h-[40px] w-[40px]"
        />
        <View style={{position:'absolute',left:node.transform.m02,top:node.transform.m12,width:node.size.x,height:node.size.y,overflow:'hidden'}}>
          <Image source={option.imageSource} resizeMode="stretch" style={{position:'absolute',width:node.size.x/uv.m00,height:node.size.y/uv.m11,left:-node.size.x*uv.m02/uv.m00,top:-node.size.y*uv.m12/uv.m11}}/>
        </View>
      </TView>
      <TText
        className="absolute top-[44px] w-[44px] text-center text-[9px] text-[#7F80A1]"
        style={styles.alibabaRegular}
      >
        暂未开放
      </TText>
    </TPressable>
  );
}

type LoginInputKind = "account" | "password";

interface SourceInputProps extends Omit<TextInputProps, "style"> {
  kind: LoginInputKind;
  inputWidth: number;
}

function SourceInput({ kind, inputWidth, ...props }: SourceInputProps) {
  const source = loginRenderEvidence.input[kind];
  const { surface, text } = source;
  const strokeWidth = surface.strokeWeight;
  const rectInset = strokeWidth / 2;
  const rectRadius = Math.max(0, surface.cornerRadius - rectInset);

  return (
    <View
      style={{
        width: inputWidth,
        height: surface.size.y,
        position: "relative",
      }}
    >
      {Platform.OS === "web" ? (
        <style>
          {`[data-testid="login-${kind}"]{font-family:AlibabaPuHuiTiLight,"Alibaba PuHuiTi 3.0",sans-serif!important;}[data-testid="login-${kind}"]::placeholder{color:${text.fill.color};}`}
        </style>
      ) : null}
      <Svg
        pointerEvents="none"
        testID={`login-${kind}-surface`}
        width={inputWidth}
        height={surface.size.y}
        style={StyleSheet.absoluteFill}
      >
        <Rect
          x={rectInset}
          y={rectInset}
          width={inputWidth - strokeWidth}
          height={surface.size.y - strokeWidth}
          rx={rectRadius}
          ry={rectRadius}
          fill={surface.fill.color}
          fillOpacity={surface.fill.opacity}
          stroke={surface.stroke.color}
          strokeOpacity={surface.stroke.opacity}
          strokeWidth={strokeWidth}
        />
      </Svg>
      <TTextInput
        {...props}
        placeholder={text.characters}
        placeholderTextColor={text.fill.color}
        style={[
          styles.inputText,
          {
            ...StyleSheet.absoluteFillObject,
            width: inputWidth,
            height: surface.size.y,
            borderWidth: 0,
            backgroundColor: "transparent",
            color: "#545454",
            fontFamily:
              Platform.OS === "web"
                ? "AlibabaPuHuiTiLight, Alibaba PuHuiTi 3.0, sans-serif"
                : "AlibabaPuHuiTiLight",
            fontSize: text.fontSize,
            lineHeight: text.size.y,
            paddingLeft: text.transform.m02,
            paddingRight: text.transform.m02,
            paddingTop: text.transform.m12,
            paddingBottom: 0,
          },
        ]}
      />
    </View>
  );
}

function showAlert(title: string, message: string, onConfirm?: () => void) {
  if (Platform.OS === "web") {
    globalThis.alert?.(`${title}\n${message}`);
    onConfirm?.();
    return;
  }

  Alert.alert(
    title,
    message,
    onConfirm ? [{ text: "确定", onPress: onConfirm }] : undefined,
  );
}

function getLoginErrorMessage(error: unknown): string {
  const maybeResponse = error as {
    response?: { data?: { error?: { message?: string }; detail?: string } };
  };
  return (
    maybeResponse.response?.data?.error?.message ||
    maybeResponse.response?.data?.detail ||
    "登录失败，请检查账号和密码"
  );
}

function getMobileLayout(screenWidth: number) {
  const gutter = screenWidth < 360 ? 16 : 20;
  const contentWidth = Math.min(375, Math.max(0, screenWidth - gutter * 2));
  const inputSource = loginRenderEvidence.input.account.surface;
  const inputRightMargin =
    375 - loginRenderEvidence.input.transform.m02 - inputSource.size.x;
  return {
    contentWidth,
    formWidth: Math.min(299, contentWidth),
    inputWidth: fitSourceWidth(inputSource.size.x, 375, screenWidth, "relative"),
    inputOffsetX: (loginRenderEvidence.input.transform.m02 - inputRightMargin) / 2,
    heroWidth: Math.min(344, contentWidth),
    gutter,
  };
}

export default function LoginScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string | string[] }>();
  const safeNextPath = sanitizeNextPath(next);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { contentWidth, formWidth, gutter, heroWidth, inputOffsetX, inputWidth } =
    getMobileLayout(screenWidth);
  const heroScale = heroWidth / 344;
  const heroHeight = 189.740463 * heroScale;

  const canSubmit = useMemo(
    () =>
      agreePrivacy &&
      account.trim().length > 0 &&
      password.trim().length > 0 &&
      !loading,
    [account, agreePrivacy, loading, password],
  );

  const handleLogin = async () => {
    if (!account.trim() || !password.trim()) {
      setError("");
      showAlert("提示", "请输入用户名/电话号码/邮箱和密码");
      return;
    }

    if (!agreePrivacy) {
      setError("");
      showAlert("提示", "请先同意隐私协议");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const response = await authAPI.login(account.trim(), password);
      await authAPI.setToken(response.data.access_token);
      router.replace(safeNextPath as Href);
    } catch (error: unknown) {
      setError(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={styles.screenBackground}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight: screenHeight,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: gutter,
            paddingTop: Math.max(insets.top, 44),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <TView
          style={[styles.artboardBackground, { width: contentWidth }]}
          className="relative self-center"
        >
          <Svg
            pointerEvents="none"
            style={{
              position: "absolute",
              left: -gutter,
              top: -Math.max(insets.top, 44),
            }}
            width={screenWidth}
            height={screenHeight}
          >
            <MobileBackdrop width={screenWidth} height={screenHeight} />
          </Svg>

          <View style={{ height: 44, width: Math.min(347, screenWidth - 28), alignSelf: 'center' }}>
            <BrandHeader
              paintOffsetY={1}
              action={
                <TPressable
                  accessibilityRole="button"
                  accessibilityLabel="设置"
                  onPress={() => showAlert("设置", "语言与联系入口暂未开放")}
                  className="relative h-[44px] w-[44px]"
                >
                  {/* Source ellipse center18.521731,18.724612 within38pt;
                      exported center19.8261,18.7246 includes1.304369pt X padding. */}
                  <View style={{ position: 'absolute', left: 4.695631, top: 3, width: 39.6522, height: 40.7536 }}>
                    <SvgXml xml={settingsXml} width={39.6522} height={40.7536} />
                  </View>
                </TPressable>
              }
            />
          </View>

          <View style={{position:'absolute',left:loginRenderEvidence.hero.transform.m02-gutter,top:loginRenderEvidence.hero.transform.m12-Math.max(insets.top,44)}}>
            <FigmaTree node={loginRenderEvidence.hero} prefix="login-hero" testID="login-source-hero"/>
          </View>
          <View style={{height:heroHeight,marginTop:10}}/>

          <View
            style={{
              marginTop: 208 - 98 - heroHeight,
              alignSelf: "center",
              width: formWidth,
              height: 66,
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                top: 42,
                opacity: 0.1,
                transform: [{ scaleY: -1 }],
              }}
            >
              <FigmaText evidence={loginRenderEvidence.text["119:76680"]} />
            </View>
            <FigmaText evidence={loginRenderEvidence.text["119:76681"]} />
          </View>
          <View style={{ height: 53, width: 166, alignSelf: "center" }}>
            <View style={{ marginLeft: 3 }}>
              <FigmaText evidence={loginRenderEvidence.text["119:76683"]} />
            </View>
            <View style={{ position: "absolute", top: 33 }}>
              <FigmaText evidence={loginRenderEvidence.text["119:76684"]} />
            </View>
          </View>

          <MotionLayer
            className="mt-[29px] self-center"
            style={{ transform: [{ translateX: inputOffsetX }] }}
          >
            <TView className="gap-[16px]" style={{ width: inputWidth }}>
              <SourceInput
                kind="account"
                testID="login-account"
                value={account}
                onChangeText={setAccount}
                inputWidth={inputWidth}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <SourceInput
                kind="password"
                testID="login-password"
                value={password}
                onChangeText={setPassword}
                inputWidth={inputWidth}
                secureTextEntry
              />
            </TView>
          </MotionLayer>

          {Boolean(error) && (
            <TText
              accessibilityRole="alert"
              testID="login-error"
              className="mt-[10px] self-center text-[12px] text-[#C0362C]"
              style={[styles.alibabaRegular, { width: inputWidth }]}
            >
              {error}
            </TText>
          )}

          {/* Source 119:76691–76729. Visual positions are independent of
              the 44pt hit rectangles; backend errors move this whole section. */}
          <View style={{ marginTop: 21, width: screenWidth, height: 354, alignSelf: "center" }}>
            <View style={{ position: "absolute", left: (screenWidth - 278) / 2, top: 0, width: 278, height: 15 }}>
              <Checkbox testID="login-privacy" checked={agreePrivacy}
                onPress={() => setAgreePrivacy((value) => !value)}
                style={{ position: "absolute", left: -16.5, top: -14.5 }} />
              <TText className="text-[10px]" style={[styles.alibabaRegular, { position: "absolute", left: 14, top: 0.5 }]}>
                <TText className="text-[#545454]">点击即表示同意</TText>
                <TText className="text-[#94ACF6] underline">《隐私协议》</TText>
              </TText>
              <Checkbox testID="login-remember" checked={rememberMe}
                onPress={() => setRememberMe((value) => !value)}
                style={{ position: "absolute", left: 231 - 16.5, top: -15 }} />
              <TText className="text-[10px] text-[#545454]"
                style={[styles.alibabaRegular, { position: "absolute", left: 248, top: 0 }]}>
                记住我
              </TText>
            </View>

            <TView pointerEvents="none"
              className="absolute h-[46px] rounded-full border-[0.3px] border-[#CCC5E6] bg-white/75"
              style={[styles.whiteGlow, { left: 33 + (screenWidth - 375) / 2, top: 23, width: formWidth }]} />
            <TPressable accessibilityRole="button" disabled={!canSubmit}
              testID="login-submit" onPress={handleLogin}
              className="absolute h-[46px] items-center justify-center overflow-hidden rounded-full border-[0.5px] border-[#FDE0FF] active:scale-[0.98]"
              style={[styles.loginButtonShadow, { left: (screenWidth - formWidth) / 2 - (formWidth === 299 ? 1 : 0), top: 35, width: formWidth }]}>
              <LoginButtonOrnaments />
              <TText className="z-10 text-[16px] font-semibold text-white" style={styles.alibabaSemiBold}>
                {loading ? "登录中..." : "立即登录"}
              </TText>
            </TPressable>

            <TPressable accessibilityRole="button"
              onPress={() => showAlert("提示", "忘记密码流程待接入")}
              className="absolute h-[44px] justify-center"
              style={{ left: (screenWidth - formWidth) / 2 - (formWidth === 299 ? 1 : 0), top: 86, width: formWidth }}>
              <TText className="text-right text-[10px] text-[#545454]" style={styles.alibabaRegular}>
                忘记密码？
              </TText>
            </TPressable>

            <View style={{ position: "absolute", left: 47 + (screenWidth - 375) / 2, top: 130, width: 289, height: 15 }}>
              <View style={{ position: "absolute", left: 0, top: 8, width: 101, height: 0.5, backgroundColor: "#D8D8D8" }} />
              <TText className="text-[11px] text-[#B4B4B4]"
                style={[styles.alibabaRegular, { position: "absolute", left: 115, top: 0 }]}>
                其他登录方式
              </TText>
              <View style={{ position: "absolute", left: 188, top: 8, width: 101, height: 0.5, backgroundColor: "#D8D8D8" }} />
            </View>

            <View style={{ position: "absolute", left: 97 + (screenWidth - 375) / 2, top: 160, width: 180, height: 62 }}>
              {socialLoginOptions.map((option, index) => (
                <View key={option.id} style={{ position: "absolute", left: index * 70 - 2, top: -2 }}>
                  <SocialButton option={option} />
                </View>
              ))}
            </View>

            <TLinearGradient colors={["rgba(172,159,203,0.10)", "rgba(217,217,217,0)"]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={{ position: "absolute", left: 0, top: 241, width: screenWidth, height: 113 }}>
              <TView className="h-[44px] flex-row items-center"
                style={{ position: "absolute", top: 19.5, left: 133 + (screenWidth - 375) / 2 }}>
                <TText className="text-[12px] text-[#B4B4B4]" style={styles.alibabaRegular}>
                  还没有账号？
                </TText>
                <TPressable accessibilityRole="button" testID="login-register"
                  className="min-h-[44px] min-w-[44px] justify-center"
                  onPress={() => router.push({ pathname: "/register", params: { next: safeNextPath } })}>
                  <TText className="text-[12px] text-[#7C62FF]" style={styles.alibabaRegular}>
                    立即注册
                  </TText>
                </TPressable>
              </TView>
            </TLinearGradient>
          </View>
          {/* Export adds 100pt padding on each edge for source radius100
              blur. Keep that viewport at 1:1 so the ellipse stays 278x130. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: (contentWidth - 478) / 2, top: 231, width: 478, height: 330 }}>
            <SvgXml xml={purpleGlowXml} width={478} height={330} />
          </View>
        </TView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenBackground: {
    backgroundColor: "#EFF3FF",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  artboardBackground: {
    backgroundColor: "#EFF3FF",
    ...(Platform.OS === "web"
      ? {
          backgroundImage:
            "linear-gradient(199.43deg, rgb(239, 243, 255) 10.309%, rgb(255, 255, 255) 100%)",
        }
      : undefined),
  },
  logoShadow: {
    shadowColor: "#BABABA",
    shadowOffset: { width: 0, height: 2.087 },
    shadowOpacity: 0.25,
    shadowRadius: 3.13,
    elevation: 3,
  },
  heroTitle: {
    color: "#7C62FF",
    fontFamily: Platform.select({
      ios: "ZiTiQuanWeiJunHei",
      android: "ZiTiQuanWeiJunHei",
      default: "ZiTiQuanWeiJunHei, Alibaba PuHuiTi 3.0, sans-serif",
    }),
    textShadowColor: "rgba(200, 200, 200, 0.25)",
    textShadowOffset: { width: 0, height: 0.707 },
    textShadowRadius: 1.768,
    ...(Platform.OS === "web"
      ? {
          backgroundImage:
            "linear-gradient(0deg, rgba(175,201,246,0) 12.881%, rgba(181,149,251,0.5) 32.83%, #7C62FF 57.983%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }
      : undefined),
  },
  heroTitleReflection: {
    color: "#7C62FF",
    fontFamily: Platform.select({
      ios: "ZiTiQuanWeiJunHei",
      android: "ZiTiQuanWeiJunHei",
      default: "ZiTiQuanWeiJunHei, Alibaba PuHuiTi 3.0, sans-serif",
    }),
    transform: [{ scaleY: -1 }],
    ...(Platform.OS === "web"
      ? {
          filter: "blur(2px)",
          backgroundImage:
            "linear-gradient(0deg, rgba(175,201,246,0) 12.881%, rgba(181,149,251,0.5) 32.83%, #7C62FF 57.983%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }
      : undefined),
  },
  alibabaBold: {
    fontFamily: Platform.select({
      ios: "AlibabaPuHuiTiBold",
      android: "AlibabaPuHuiTiBold",
      default: "AlibabaPuHuiTiBold, Alibaba PuHuiTi 3.0, sans-serif",
    }),
    fontWeight: "700",
  },
  alibabaSemiBold: {
    fontFamily: Platform.select({
      ios: "AlibabaPuHuiTiSemiBold",
      android: "AlibabaPuHuiTiSemiBold",
      default: "AlibabaPuHuiTiSemiBold, Alibaba PuHuiTi 3.0, sans-serif",
    }),
    fontWeight: "600",
  },
  alibabaRegular: {
    fontFamily: Platform.select({
      ios: "AlibabaPuHuiTiRegular",
      android: "AlibabaPuHuiTiRegular",
      default: "AlibabaPuHuiTiRegular, Alibaba PuHuiTi 3.0, sans-serif",
    }),
    fontWeight: "400",
  },
  alibabaLight: {
    fontFamily: Platform.select({
      ios: "AlibabaPuHuiTiLight",
      android: "AlibabaPuHuiTiLight",
      default: "AlibabaPuHuiTiLight, Alibaba PuHuiTi 3.0, sans-serif",
    }),
    fontWeight: "300",
  },
  inputText: {
    fontFamily: Platform.select({
      ios: "AlibabaPuHuiTiLight",
      android: "AlibabaPuHuiTiLight",
      web: "AlibabaPuHuiTiLight, Alibaba PuHuiTi 3.0, sans-serif",
      default: "AlibabaPuHuiTiLight, Alibaba PuHuiTi 3.0, sans-serif",
    }),
    fontWeight: "300",
    outlineStyle: "none" as never,
  },
  whiteGlow: {
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 25,
    elevation: 2,
    ...(Platform.OS === "web" ? { filter: "blur(25px)" } : undefined),
  },
  loginButtonShadow: {
    shadowColor: "#939393",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
});
