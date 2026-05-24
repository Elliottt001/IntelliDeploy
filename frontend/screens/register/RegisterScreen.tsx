import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { cssInterop } from 'nativewind';
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Easing,
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
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
} from '../login/generated/loginSvgAssets';
import { authAPI } from '../../services/api';

declare const require: <T = unknown>(moduleName: string) => T;

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
const TAnimatedView = Animated.View as ComponentType<ComponentProps<typeof Animated.View> & ClassNameProp>;

cssInterop(LinearGradient, { className: 'style' });

const TLinearGradient = LinearGradient as ComponentType<ComponentProps<typeof LinearGradient> & ClassNameProp>;

const googleLogo = require<ImageSourcePropType>('../../assets/images/ui/google-logo.png');
const githubLogo = require<ImageSourcePropType>('../../assets/images/ui/github-logo.png');
const appleLogo = require<ImageSourcePropType>('../../assets/images/ui/apple-logo.png');

interface MotionLayerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  fromY?: number;
}

interface SocialLoginOption {
  id: 'google' | 'github' | 'apple';
  label: string;
  imageSource: ImageSourcePropType;
  imageClassName: string;
  imageStyle?: ImageProps['style'];
}

const socialLoginOptions: SocialLoginOption[] = [
  {
    id: 'google',
    label: 'Google',
    imageSource: googleLogo,
    imageClassName: 'absolute left-[1px] top-[6px] h-[28px] w-[38px]',
  },
  {
    id: 'github',
    label: 'GitHub',
    imageSource: githubLogo,
    imageClassName: 'absolute left-[7px] top-[8px] h-[24px] w-[26px]',
    imageStyle: { transform: [{ scale: 1.15 }] },
  },
  {
    id: 'apple',
    label: 'Apple',
    imageSource: appleLogo,
    imageClassName: 'absolute left-[9px] top-[8px] h-[22px] w-[22px]',
    imageStyle: { transform: [{ scale: 1.12 }] },
  },
];

function LocalSvg({ xml, className, opacity = 1 }: LocalSvgProps) {
  return (
    <TView className={className} style={{ opacity }}>
      <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="none" />
    </TView>
  );
}

function WebMotionLayer({ children, className, delay = 0, fromY = 16 }: MotionLayerProps) {
  const { motion } = require<typeof import('framer-motion')>('framer-motion');
  const MotionDiv = motion.div;

  return (
    <MotionDiv
      className={className}
      initial={{ opacity: 0, y: fromY }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.58, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionDiv>
  );
}

function NativeMotionLayer({ children, className, delay = 0, fromY = 16 }: MotionLayerProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 580,
        delay: delay * 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 580,
        delay: delay * 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <TAnimatedView className={className} style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </TAnimatedView>
  );
}

function MotionLayer(props: MotionLayerProps) {
  if (Platform.OS === 'web') {
    return <WebMotionLayer {...props} />;
  }

  return <NativeMotionLayer {...props} />;
}

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
}

function Checkbox({ checked, onPress }: CheckboxProps) {
  return (
    <TPressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      className={[
        'h-[11px] w-[11px] rounded-[3px] border-[0.5px]',
        checked ? 'border-[#7C62FF] bg-[#7C62FF]' : 'border-[#CECECE] bg-white/50',
      ].join(' ')}
    />
  );
}

function PrimaryButtonOrnaments() {
  return (
    <TView pointerEvents="none" className="absolute inset-0 overflow-hidden">
      <TView className="absolute left-[-13px] top-[39.5px] h-[12px] w-[142px] rounded-full bg-white/30 opacity-60" />
      <TView
        className="absolute left-[-45px] top-[-4px] h-[19px] w-[142px] rounded-full bg-white/20 opacity-50"
        style={{ transform: [{ rotate: '-2.73deg' }] }}
      />
      <TView
        className="absolute left-[-88px] top-[-18.5px] h-[96.8px] w-[150.6px] rounded-full bg-white/20 opacity-40"
        style={{ transform: [{ rotate: '-20.49deg' }] }}
      />
      <TView className="absolute left-[-9px] top-[-22.5px] h-[43px] w-[45px] rounded-full bg-white/25" />
      <TView className="absolute left-[254px] top-[-19.5px] h-[65px] w-[112px] rounded-full bg-white/25" />
      <TView className="absolute left-[162px] top-[-6.5px] h-[18px] w-[112px] rounded-full bg-white/25" />
      <TView className="absolute left-[183px] top-[30.5px] h-[21px] w-[112px] rounded-full bg-white/20" />
      <TView className="absolute left-[296.5px] top-[28.5px] h-[43px] w-[45px] rounded-full bg-white/20" />
      <TView className="absolute left-[274.5px] top-[-5.5px] h-[43px] w-[45px] rounded-full bg-white/20" />
    </TView>
  );
}

interface SocialButtonProps {
  option: SocialLoginOption;
}

function SocialButton({ option }: SocialButtonProps) {
  return (
    <TPressable
      accessibilityRole="button"
      accessibilityLabel={`${option.label} 登录`}
      className="relative h-[40px] w-[40px] items-center justify-center overflow-hidden rounded-full active:scale-95"
    >
      <LocalSvg xml={socialCircleXml} className="absolute inset-0 h-[40px] w-[40px]" />
      <TImage source={option.imageSource} className={option.imageClassName} resizeMode="contain" style={option.imageStyle} />
    </TPressable>
  );
}

function showAlert(title: string, message: string, onConfirm?: () => void) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(`${title}\n${message}`);
    onConfirm?.();
    return;
  }

  Alert.alert(title, message, onConfirm ? [{ text: '确定', onPress: onConfirm }] : undefined);
}

function getRegisterErrorMessage(error: unknown): string {
  const maybeResponse = error as { response?: { data?: { detail?: string } } };
  return maybeResponse.response?.data?.detail || '注册失败，请稍后重试';
}

const DESIGN_WIDTH = 375;
const DESIGN_HEIGHT = 812;

export default function RegisterScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const scale = screenWidth / DESIGN_WIDTH;
  const scaledHeight = DESIGN_HEIGHT * scale;
  const availableHeight = Math.max(screenHeight, scaledHeight);

  const canSubmit = useMemo(
    () =>
      agreePrivacy &&
      username.trim().length > 0 &&
      email.trim().length > 0 &&
      password.trim().length > 0 &&
      confirmPassword.trim().length > 0 &&
      !loading,
    [agreePrivacy, confirmPassword, email, loading, password, username]
  );

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      showAlert('提示', '请填写所有必填字段');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('提示', '两次输入的密码不一致');
      return;
    }

    if (!agreePrivacy) {
      showAlert('提示', '请先同意隐私协议');
      return;
    }

    setLoading(true);
    try {
      await authAPI.register(username.trim(), email.trim(), password);
      const loginResponse = await authAPI.login(username.trim(), password);
      await authAPI.setToken(loginResponse.data.access_token);
      showAlert('成功', '注册成功！', () => router.replace('/'));
    } catch (error: unknown) {
      showAlert('错误', getRegisterErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1" style={styles.screenBackground} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={[styles.scrollContent, { minHeight: availableHeight, paddingTop: insets.top, paddingBottom: insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <TView
          style={[
            styles.artboardBackground,
            {
              width: screenWidth,
              height: scaledHeight,
            },
          ]}
          className="relative overflow-hidden"
        >
          <TView
            style={{
              width: DESIGN_WIDTH,
              height: DESIGN_HEIGHT,
              transform: [{ scale }],
              transformOrigin: 'top left',
            }}
            className="relative"
          >
            <LocalSvg xml={atmosphereXml} className="absolute left-[-101px] top-[72px] h-[611.33px] w-[658.45px]" />

          <TView className="absolute left-[28px] top-[93px] h-[195px] w-[344px]">
            <LocalSvg xml={rippleXml} className="absolute left-[5px] top-[55px] h-[139.74px] w-[339px]" />

            <TView className="absolute left-[105px] top-[29px] h-[117.22px] w-[120.11px]">
              <TView
                className="absolute left-[7px] top-[8px] h-[102.96px] w-[106.96px]"
                style={{ transform: [{ rotate: '-6.64deg' }, { skewX: '-1.93deg' }] }}
              >
                <SvgXml xml={catXml} width="100%" height="100%" preserveAspectRatio="none" />
              </TView>
            </TView>

            <LocalSvg xml={layersXml} className="absolute left-[29px] top-[5px] h-[117px] w-[253px]" />
          </TView>

          <MotionLayer className="absolute left-[14px] top-[47px] h-[38px] w-[347px]" delay={0.04} fromY={-10}>
            <TView className="h-full w-full flex-row items-end justify-between">
              <TView className="relative h-[36px] w-[170.61px]">
                <TView
                  className="absolute left-[6.78px] top-[1.04px] h-[31.3px] w-[31.3px] rounded-full border-[1.565px] border-white bg-[#7C62FF]"
                  style={styles.logoShadow}
                />
                <TView className="absolute left-[13.04px] top-[9.91px] h-[13.18px] w-[18.8px]">
                  <SvgXml xml={logoXml} width="100%" height="100%" preserveAspectRatio="none" />
                </TView>
                <TView className="absolute left-[43.83px] top-[10.43px] h-[19.83px] w-[120px]">
                  <SvgXml xml={wordMarkXml} width="100%" height="100%" preserveAspectRatio="none" />
                </TView>
              </TView>

              <TPressable accessibilityRole="button" accessibilityLabel="设置" className="relative h-[38px] w-[38px] active:scale-95">
                <SvgXml xml={settingsXml} width="100%" height="100%" preserveAspectRatio="none" />
              </TPressable>
            </TView>
          </MotionLayer>

          <LocalSvg xml={purpleGlowXml} className="absolute left-[43.5px] top-[370px] h-[130px] w-[278px]" opacity={0.9} />

          <MotionLayer className="absolute left-[38px] top-[203px] w-[299px]" delay={0.16} fromY={12}>
            <TView>
              <TText
                className="absolute left-0 top-[42px] h-[54px] w-[299px] text-center text-[40px] font-extrabold opacity-10"
                style={styles.heroTitleReflection}
              >
                IntelliDeploy
              </TText>
              <TText className="h-[66px] w-[299px] text-center text-[40px] font-extrabold" style={styles.heroTitle}>
                IntelliDeploy
              </TText>
            </TView>
          </MotionLayer>

          <MotionLayer className="absolute left-[88px] top-[274px] w-[200px]" delay={0.24} fromY={12}>
            <TView className="items-center justify-center gap-[8px]">
              <TText className="text-[18px] font-bold text-[#494A64]" style={styles.alibabaBold}>
                创建账号，开启之旅！
              </TText>
              <TText className="text-[14px] font-light text-[#494A64]" style={styles.alibabaLight}>
                在这里，实现你的奇思妙想
              </TText>
            </TView>
          </MotionLayer>

          <MotionLayer className="absolute left-[47px] top-[360px] w-[280px]" delay={0.32} fromY={18}>
            <TView className="w-full gap-[10px]">
              <TTextInput
                value={username}
                onChangeText={setUsername}
                placeholder="用户名"
                placeholderTextColor="#B4B4B4"
                autoCapitalize="none"
                autoCorrect={false}
                className="h-[36px] w-[280px] rounded-[12px] border-[0.3px] border-[#A3B2FF] bg-white px-[16.5px] text-[11px] text-[#545454]"
                style={styles.inputText}
              />
              <TTextInput
                value={email}
                onChangeText={setEmail}
                placeholder="邮箱"
                placeholderTextColor="#B4B4B4"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="h-[36px] w-[280px] rounded-[12px] border-[0.3px] border-[#A3B2FF] bg-white px-[16.5px] text-[11px] text-[#545454]"
                style={styles.inputText}
              />
              <TTextInput
                value={password}
                onChangeText={setPassword}
                placeholder="密码"
                placeholderTextColor="#B4B4B4"
                secureTextEntry
                className="h-[36px] w-[280px] rounded-[12px] border-[0.3px] border-[#A3B2FF] bg-white px-[16.5px] text-[11px] text-[#545454]"
                style={styles.inputText}
              />
              <TTextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="确认密码"
                placeholderTextColor="#B4B4B4"
                secureTextEntry
                className="h-[36px] w-[280px] rounded-[12px] border-[0.3px] border-[#A3B2FF] bg-white px-[16.5px] text-[11px] text-[#545454]"
                style={styles.inputText}
              />
            </TView>
          </MotionLayer>

          <MotionLayer className="absolute left-[48.5px] top-[548px] h-[15px] w-[278px]" delay={0.4} fromY={12}>
            <TView className="h-full w-full flex-row items-start justify-between">
              <TView className="h-[15px] flex-row items-center gap-[3px]">
                <Checkbox checked={agreePrivacy} onPress={() => setAgreePrivacy((value) => !value)} />
                <TText className="text-[10px]" style={styles.alibabaRegular}>
                  <TText className="text-[#545454]">点击即表示同意</TText>
                  <TText className="text-[#94ACF6] underline">《隐私协议》</TText>
                </TText>
              </TView>

              <TView className="flex-row items-center gap-[6px]">
                <Checkbox checked={rememberMe} onPress={() => setRememberMe((value) => !value)} />
                <TText className="text-[10px] text-[#545454]" style={styles.alibabaRegular}>
                  记住我
                </TText>
              </TView>
            </TView>
          </MotionLayer>

          <MotionLayer className="absolute left-[37px] top-[574px] h-[46px] w-[299px]" delay={0.48} fromY={14}>
            <TPressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={handleRegister}
              className={[
                'relative h-[46px] w-[299px] items-center justify-center overflow-hidden rounded-full border-[0.5px] border-[#FDE0FF] active:scale-[0.98]',
                !canSubmit ? 'opacity-60' : 'opacity-100',
              ].join(' ')}
              style={styles.loginButtonShadow}
            >
              <TLinearGradient
                colors={['#8A6BFF', '#6E8DFF']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                className="absolute inset-0"
              />
              <PrimaryButtonOrnaments />
              <TText className="z-10 text-[16px] font-semibold text-white" style={styles.alibabaSemiBold}>
                {loading ? '注册中...' : '立即注册'}
              </TText>
            </TPressable>
          </MotionLayer>

          {/* <TPressable
            accessibilityRole="button"
            onPress={() => showAlert('提示', '忘记密码流程待接入')}
            className="absolute left-[37px] top-[632px] w-[299px]"
          >
            <TText className="text-right text-[10px] text-[#545454]" style={styles.alibabaRegular}>
              忘记密码？
            </TText>
          </TPressable> */}

          <MotionLayer className="absolute left-[47px] top-[655px] h-[15px] w-[289px]" delay={0.56} fromY={14}>
            <TView className="h-full w-full flex-row items-center justify-between">
              <TView className="h-[0.5px] w-[101px] bg-[#D8D8D8]" />
              <TText className="text-[11px] text-[#B4B4B4]" style={styles.alibabaRegular}>
                其他注册方式
              </TText>
              <TView className="h-[0.5px] w-[101px] bg-[#D8D8D8]" />
            </TView>
          </MotionLayer>

          <MotionLayer className="absolute left-[97px] top-[683px] h-[40px] w-[180px]" delay={0.64} fromY={14}>
            <TView className="h-full w-full flex-row justify-between">
              {socialLoginOptions.map((option) => (
                <SocialButton key={option.id} option={option} />
              ))}
            </TView>
          </MotionLayer>

          <TLinearGradient
            colors={['rgba(172,159,203,0.10)', 'rgba(217,217,217,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            className="absolute left-0 top-[730px] h-[113px] w-[375px] items-center pt-[33px]"
          >
            <TView className="flex-row">
              <TText className="text-[12px] text-[#B4B4B4]" style={styles.alibabaRegular}>
                已有账号？
              </TText>
              <TPressable accessibilityRole="button" onPress={() => router.push('/login')}>
                <TText className="text-[12px] text-[#7C62FF]" style={styles.alibabaRegular}>
                  立即登录
                </TText>
              </TPressable>
            </TView>
          </TLinearGradient>
          </TView>
        </TView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenBackground: {
    backgroundColor: '#EFF3FF',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  artboardBackground: {
    backgroundColor: '#EFF3FF',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'linear-gradient(199.43deg, rgb(239, 243, 255) 10.309%, rgb(255, 255, 255) 100%)',
        }
      : undefined),
  },
  logoShadow: {
    shadowColor: '#BABABA',
    shadowOffset: { width: 0, height: 2.087 },
    shadowOpacity: 0.25,
    shadowRadius: 3.13,
    elevation: 3,
  },
  heroTitle: {
    color: '#7C62FF',
    fontFamily: Platform.select({
      ios: 'ZiTiQuanWeiJunHei',
      android: 'ZiTiQuanWeiJunHei',
      default: 'ZiTiQuanWeiJunHei, Alibaba PuHuiTi 3.0, sans-serif',
    }),
    textShadowColor: 'rgba(200, 200, 200, 0.25)',
    textShadowOffset: { width: 0, height: 0.707 },
    textShadowRadius: 1.768,
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'linear-gradient(0deg, rgba(175,201,246,0) 12.881%, rgba(181,149,251,0.5) 32.83%, #7C62FF 57.983%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }
      : undefined),
  },
  heroTitleReflection: {
    color: '#7C62FF',
    fontFamily: Platform.select({
      ios: 'ZiTiQuanWeiJunHei',
      android: 'ZiTiQuanWeiJunHei',
      default: 'ZiTiQuanWeiJunHei, Alibaba PuHuiTi 3.0, sans-serif',
    }),
    transform: [{ scaleY: -1 }],
    ...(Platform.OS === 'web'
      ? {
          filter: 'blur(2px)',
          backgroundImage:
            'linear-gradient(0deg, rgba(175,201,246,0) 12.881%, rgba(181,149,251,0.5) 32.83%, #7C62FF 57.983%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }
      : undefined),
  },
  alibabaBold: {
    fontFamily: Platform.select({
      ios: 'AlibabaPuHuiTiBold',
      android: 'AlibabaPuHuiTiBold',
      default: 'AlibabaPuHuiTiBold, Alibaba PuHuiTi 3.0, sans-serif',
    }),
    fontWeight: '700',
  },
  alibabaSemiBold: {
    fontFamily: Platform.select({
      ios: 'AlibabaPuHuiTiSemiBold',
      android: 'AlibabaPuHuiTiSemiBold',
      default: 'AlibabaPuHuiTiSemiBold, Alibaba PuHuiTi 3.0, sans-serif',
    }),
    fontWeight: '600',
  },
  alibabaRegular: {
    fontFamily: Platform.select({
      ios: 'AlibabaPuHuiTiRegular',
      android: 'AlibabaPuHuiTiRegular',
      default: 'AlibabaPuHuiTiRegular, Alibaba PuHuiTi 3.0, sans-serif',
    }),
    fontWeight: '400',
  },
  alibabaLight: {
    fontFamily: Platform.select({
      ios: 'AlibabaPuHuiTiThin',
      android: 'AlibabaPuHuiTiThin',
      default: 'AlibabaPuHuiTiThin, Alibaba PuHuiTi 3.0, sans-serif',
    }),
    fontWeight: '300',
  },
  inputText: {
    fontFamily: Platform.select({
      ios: 'AlibabaPuHuiTiLight',
      android: 'AlibabaPuHuiTiLight',
      default: 'AlibabaPuHuiTiLight, Alibaba PuHuiTi 3.0, sans-serif',
    }),
    fontWeight: '300',
    outlineStyle: 'none' as never,
  },
  whiteGlow: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 25,
    elevation: 2,
    ...(Platform.OS === 'web' ? { filter: 'blur(25px)' } : undefined),
  },
  loginButtonShadow: {
    shadowColor: '#939393',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
});
