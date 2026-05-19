import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar as NativeStatusBar,
  Image,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const SOCIAL_GOOGLE = require('../assets/images/login-social-google.png');
const SOCIAL_GITHUB = require('../assets/images/login-social-github.png');
const SOCIAL_APPLE = require('../assets/images/login-social-apple.png');
const CAT_IMAGE = require('../assets/images/login-cat.png');
const ATMOSPHERE_IMAGE = require('../assets/images/login-atmosphere.png');
const WAVE_IMAGE = require('../assets/images/login-wave.png');
const DEPTH_LAYER_IMAGE = require('../assets/images/login-depth-layer.png');
const LOGO_IMAGE = require('../assets/images/login-logo.png');
const WORDMARK_IMAGE = require('../assets/images/login-wordmark.png');
const PURPLE_GLOW_IMAGE = require('../assets/images/login-purple-glow.png');

const ARTBOARD_WIDTH = 375;
const ARTBOARD_HEIGHT = 812;

export default function Login() {
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const riseUp = useRef(new Animated.Value(20)).current;
  const navIntro = useRef(new Animated.Value(0)).current;
  const catIntro = useRef(new Animated.Value(0)).current;
  const titleIntro = useRef(new Animated.Value(0)).current;
  const formIntro = useRef(new Animated.Value(0)).current;
  const socialIntro = useRef(new Animated.Value(0)).current;
  const bottomIntro = useRef(new Animated.Value(0)).current;
  const blobFloat = useRef(new Animated.Value(0)).current;
  const catFloat = useRef(new Animated.Value(0)).current;
  const glowSlide = useRef(new Animated.Value(0)).current;
  const menuIntro = useRef(new Animated.Value(0)).current;
  const artboardScale =
    Platform.OS === 'web'
      ? 1
      : Math.min(viewportWidth / ARTBOARD_WIDTH, viewportHeight / ARTBOARD_HEIGHT);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      NativeStatusBar.setHidden(true, 'none');
      NativeStatusBar.setTranslucent(true);
      NativeStatusBar.setBackgroundColor('transparent', false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        NativeStatusBar.setHidden(true, 'none');
        NativeStatusBar.setTranslucent(true);
        NativeStatusBar.setBackgroundColor('transparent', false);
      }
    }, [])
  );

  useEffect(() => {
    Animated.stagger(130, [
      Animated.timing(navIntro, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(catIntro, {
        toValue: 1,
        duration: 680,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(titleIntro, {
        toValue: 1,
        duration: 580,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formIntro, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(socialIntro, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bottomIntro, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(riseUp, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(glowSlide, {
        toValue: 1,
        duration: 2300,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    ).start();
  }, [
    blobFloat,
    bottomIntro,
    catFloat,
    catIntro,
    fadeIn,
    formIntro,
    glowSlide,
    navIntro,
    riseUp,
    socialIntro,
    titleIntro,
  ]);

  useEffect(() => {
    Animated.timing(menuIntro, {
      toValue: settingsOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [menuIntro, settingsOpen]);

  const handleLogin = async () => {
    if (!account.trim() || !password.trim()) {
      Alert.alert('提示', '请输入用户名/电话号码/邮箱和密码');
      return;
    }
    if (!agreePrivacy) {
      Alert.alert('提示', '请先同意隐私协议');
      return;
    }

    setLoading(true);
    setSettingsOpen(false);
    setTransitioning(true);
    try {
      const response = await authAPI.login(account, password);
      const { access_token } = response.data;
      await AsyncStorage.setItem('token', access_token);
      if (!rememberMe) {
        await AsyncStorage.removeItem('token');
      }
      setTimeout(() => {
        router.push('/');
      }, 1100);
    } catch (error: any) {
      setTransitioning(false);
      const message = error.response?.data?.detail || '登录失败，请检查账号和密码';
      Alert.alert('错误', message);
    } finally {
      setLoading(false);
    }
  };

  const blobTranslateY = blobFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0],
  });

  const catTranslateY = catFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0],
  });

  const catScale = catFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1],
  });

  const glowTranslateX = glowSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" hidden translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View
        style={[
          styles.artboardShell,
          {
            width: ARTBOARD_WIDTH * artboardScale,
            height: ARTBOARD_HEIGHT * artboardScale,
          },
        ]}
      >
      <View style={[styles.artboard, { transform: [{ scale: artboardScale }] }]}>
        <View style={styles.bg} />

        <Animated.Image
          source={ATMOSPHERE_IMAGE}
          resizeMode="stretch"
          style={[
            styles.atmosphereLayer,
            { transform: [{ translateY: Animated.multiply(blobTranslateY, -0.6) }] },
          ]}
        />
        <Image source={WAVE_IMAGE} resizeMode="stretch" style={styles.waveLayer} />
        <Image source={DEPTH_LAYER_IMAGE} resizeMode="stretch" style={styles.depthLayer} />
        <Image source={PURPLE_GLOW_IMAGE} resizeMode="stretch" style={styles.purpleGlow} />
        <View style={[styles.whiteGlow, transitioning && styles.handoffHidden]} />

        <Animated.View
          style={[
            styles.topBar,
            {
              opacity: navIntro,
              transform: [
                {
                  translateY: navIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.logoMark}>
            <View style={styles.logoSquare}>
              <Image source={LOGO_IMAGE} resizeMode="contain" style={styles.logoImage} />
            </View>
            <Image source={WORDMARK_IMAGE} resizeMode="contain" style={styles.wordmarkImage} />
          </View>
          <Pressable style={styles.settingButton} onPress={() => setSettingsOpen((open) => !open)}>
            <GearGlyph />
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents={settingsOpen ? 'auto' : 'none'}
          style={[
            styles.settingsMenu,
            {
              opacity: menuIntro,
              transform: [
                {
                  translateY: menuIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
                {
                  scale: menuIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {['偏好设置', '语言与地区', '联系我们'].map((item) => (
            <Pressable key={item} style={styles.settingsMenuItem}>
              <Text style={styles.settingsMenuText}>{item}</Text>
            </Pressable>
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.catWrap,
            {
              opacity: catIntro,
              transform: [
                {
                  translateY: Animated.add(
                    catTranslateY,
                    catIntro.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    })
                  ),
                },
                {
                  scale: Animated.multiply(catScale, catIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.82, 1],
                  })),
                },
              ],
            },
          ]}
        >
          <Image source={CAT_IMAGE} style={styles.catImage} resizeMode="contain" />
        </Animated.View>

        <Animated.View
          style={{
            opacity: titleIntro,
            transform: [
              {
                translateY: titleIntro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          }}
        >
          <Text style={styles.heroTitleShadow}>IntelliDeploy</Text>
          <Text style={styles.heroTitle}>IntelliDeploy</Text>

          <View style={styles.heroHint}>
            <Text style={[styles.heroHintMain, transitioning && styles.heroHintMainSubmitting]}>
              {transitioning ? '正在登录，精彩即刻呈现...' : '欢迎回来，开发者！'}
            </Text>
            {transitioning ? null : (
              <Text style={styles.heroHintSub} numberOfLines={1}>
                在这里，实现你的奇思妙想
              </Text>
            )}
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: transitioning ? 0 : formIntro,
            transform: [
              {
                translateY: formIntro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.formWrap}>
            <TextInput
              style={styles.input}
              placeholder="用户名/电话号码/邮箱"
              placeholderTextColor="#B4B4B4"
              value={account}
              onChangeText={setAccount}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="密码"
              placeholderTextColor="#B4B4B4"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <View style={styles.agreeRow}>
              <Pressable style={styles.checkRow} onPress={() => setAgreePrivacy((v) => !v)}>
                <View style={[styles.checkbox, agreePrivacy && styles.checkboxOn]} />
                <Text style={styles.checkText}>
                  点击即表示同意
                  <Text style={styles.privacyLink}>《隐私协议》</Text>
                </Text>
              </Pressable>
              <Pressable style={styles.checkRow} onPress={() => setRememberMe((v) => !v)}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxOn]} />
                <Text style={styles.checkText}>记住我</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            >
              <Animated.View pointerEvents="none" style={styles.loginBtnSpots}>
                <View style={styles.loginBtnLeftTint} />
                <View style={styles.loginBtnRightTint} />
                <Animated.View
                  style={[
                    styles.buttonSpot,
                    styles.buttonSpotA,
                    { transform: [{ translateX: glowTranslateX }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.buttonSpot,
                    styles.buttonSpotB,
                    { transform: [{ translateX: Animated.multiply(glowTranslateX, -0.7) }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.buttonSpot,
                    styles.buttonSpotC,
                    { transform: [{ translateX: Animated.multiply(glowTranslateX, 0.45) }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.buttonSpot,
                    styles.buttonSpotD,
                    { transform: [{ translateX: Animated.multiply(glowTranslateX, -0.35) }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.buttonSpot,
                    styles.buttonSpotE,
                    { transform: [{ translateX: Animated.multiply(glowTranslateX, 0.6) }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.buttonSpot,
                    styles.buttonSpotF,
                    { transform: [{ translateX: Animated.multiply(glowTranslateX, -0.55) }] },
                  ]}
                />
              </Animated.View>
              <Text style={styles.loginBtnText}>{loading ? '登录中...' : '立即登录'}</Text>
            </Pressable>

            <Pressable onPress={() => Alert.alert('提示', '忘记密码流程待接入')}>
            <Text style={styles.forgetPwd}>忘记密码？</Text>
          </Pressable>
        </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: transitioning ? 0 : socialIntro,
            transform: [
              {
                translateY: socialIntro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.otherLoginRow}>
            <View style={styles.line} />
            <Text style={styles.otherText}>其他登录方式</Text>
            <View style={styles.line} />
          </View>

          <View style={styles.socialRow}>
            <Pressable style={({ pressed }) => [styles.socialCircle, pressed && styles.socialPressed]}>
              <Image source={SOCIAL_GOOGLE} style={styles.socialGoogle} resizeMode="contain" />
            </Pressable>
            <Pressable style={({ pressed }) => [styles.socialCircle, pressed && styles.socialPressed]}>
              <View style={styles.socialGithubClip}>
                <Image source={SOCIAL_GITHUB} style={styles.socialGithub} resizeMode="contain" />
              </View>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.socialCircle, pressed && styles.socialPressed]}>
              <View style={styles.socialAppleClip}>
                <Image source={SOCIAL_APPLE} style={styles.socialApple} resizeMode="contain" />
              </View>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.bottomTip,
            {
              opacity: transitioning ? 0 : bottomIntro,
              transform: [
                {
                  translateY: bottomIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.bottomTipText}>还没有账号？</Text>
          <Pressable onPress={() => router.push('/register')}>
            <Text style={styles.bottomTipLink}>立即注册</Text>
          </Pressable>
        </Animated.View>

      </View>
      </View>
      </KeyboardAvoidingView>
    </>
  );
}

function GearGlyph() {
  return (
    <View style={styles.gearGlyph}>
      <View style={[styles.gearTooth, styles.gearToothTop]} />
      <View style={[styles.gearTooth, styles.gearToothTopRight]} />
      <View style={[styles.gearTooth, styles.gearToothRight]} />
      <View style={[styles.gearTooth, styles.gearToothBottomRight]} />
      <View style={[styles.gearTooth, styles.gearToothBottom]} />
      <View style={[styles.gearTooth, styles.gearToothBottomLeft]} />
      <View style={[styles.gearTooth, styles.gearToothLeft]} />
      <View style={[styles.gearTooth, styles.gearToothTopLeft]} />
      <View style={styles.gearOuter} />
      <View style={styles.gearInner} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  artboardShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artboard: {
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    backgroundColor: '#EFF3FF',
    position: 'relative',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EFF3FF',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(199.43deg, rgb(239, 243, 255) 10.309%, rgb(255, 255, 255) 100%)',
        } as any)
      : {}),
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobPink: {
    width: 280,
    height: 360,
    right: -68,
    bottom: -30,
    backgroundColor: 'rgba(246, 184, 255, 0.33)',
  },
  blobPurple: {
    width: 240,
    height: 250,
    right: -92,
    top: 495,
    backgroundColor: 'rgba(124, 98, 255, 0.22)',
  },
  blobWhite: {
    width: 159,
    height: 46,
    left: 108,
    top: 302,
    opacity: 0.85,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  atmosphereLayer: {
    position: 'absolute',
    left: -202.5,
    top: -29.5,
    width: 861,
    height: 814,
    opacity: 0.22,
  },
  waveLayer: {
    position: 'absolute',
    left: 18.4,
    top: 58.9,
    width: 353.6,
    height: 258.5,
    opacity: 0.5,
  },
  depthLayer: {
    position: 'absolute',
    left: 47,
    top: 88,
    width: 273,
    height: 137,
    opacity: 0.58,
  },
  purpleGlow: {
    position: 'absolute',
    left: -56.5,
    top: 270,
    width: 478,
    height: 330,
    opacity: 0.56,
  },
  whiteGlow: {
    position: 'absolute',
    left: 28,
    top: 507,
    width: 299,
    height: 46,
    borderRadius: 43,
    backgroundColor: '#FFFFFF',
    opacity: 0.5,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 2,
  },
  handoffHidden: {
    opacity: 0,
  },
  topBar: {
    position: 'absolute',
    top: 42,
    left: 14,
    right: 14,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoSquare: {
    width: 31.3,
    height: 31.3,
    borderRadius: 16,
    backgroundColor: '#7C62FF',
    borderWidth: 1.565,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 19,
    height: 14,
    tintColor: '#FFFFFF',
  },
  wordmarkImage: {
    width: 120,
    height: 20,
  },
  settingButton: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#AEB3C9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  gearGlyph: {
    width: 17,
    height: 17,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearOuter: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    borderColor: '#515268',
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  gearInner: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 2,
    borderColor: '#515268',
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  gearTooth: {
    position: 'absolute',
    width: 3,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: '#515268',
  },
  gearToothTop: {
    top: -0.5,
    left: 7,
  },
  gearToothTopRight: {
    top: 1.8,
    right: 2.2,
    transform: [{ rotate: '45deg' }],
  },
  gearToothRight: {
    right: -0.5,
    top: 6,
    transform: [{ rotate: '90deg' }],
  },
  gearToothBottomRight: {
    right: 2.2,
    bottom: 1.8,
    transform: [{ rotate: '135deg' }],
  },
  gearToothBottom: {
    bottom: -0.5,
    left: 7,
  },
  gearToothBottomLeft: {
    left: 2.2,
    bottom: 1.8,
    transform: [{ rotate: '45deg' }],
  },
  gearToothLeft: {
    left: -0.5,
    top: 6,
    transform: [{ rotate: '90deg' }],
  },
  gearToothTopLeft: {
    top: 1.8,
    left: 2.2,
    transform: [{ rotate: '135deg' }],
  },
  settingsMenu: {
    position: 'absolute',
    top: 82,
    right: 19,
    width: 126,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingVertical: 7,
    zIndex: 12,
    shadowColor: '#8F8FB0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  settingsMenuItem: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsMenuText: {
    color: '#3C3D53',
    fontSize: 13,
    fontWeight: '600',
  },
  catWrap: {
    position: 'absolute',
    left: 128,
    top: 124,
    width: 112,
    height: 102,
  },
  catImage: {
    width: '100%',
    height: '100%',
    opacity: 0.68,
    transform: [{ rotate: '-6.64deg' }, { skewX: '-1.93deg' }],
  },
  heroTitleShadow: {
    position: 'absolute',
    top: 249,
    left: 30,
    width: 315,
    textAlign: 'center',
    color: 'rgba(124,98,255,0.04)',
    fontSize: 40,
    fontWeight: '800',
    textShadowColor: 'rgba(200,200,200,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    transform: [{ scaleY: -1 }],
  },
  heroTitle: {
    position: 'absolute',
    top: 214,
    left: 30,
    width: 315,
    textAlign: 'center',
    color: '#7C62FF',
    fontSize: 40,
    fontWeight: '800',
    textShadowColor: 'rgba(200,200,200,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroHint: {
    position: 'absolute',
    top: 277,
    left: 87.5,
    width: 200,
    alignItems: 'center',
    gap: 8,
  },
  heroHintMain: {
    color: '#494A64',
    fontSize: 18,
    fontWeight: '700',
  },
  heroHintMainSubmitting: {
    color: '#626381',
    fontSize: 14,
    fontWeight: '500',
  },
  heroHintSub: {
    color: '#6D6E8D',
    fontSize: 14,
    includeFontPadding: false,
  },
  formWrap: {
    position: 'absolute',
    left: 32,
    top: 356,
    width: 299,
    gap: 16,
  },
  input: {
    width: 280,
    height: 48,
    marginLeft: 15,
    borderRadius: 12,
    borderWidth: 0.3,
    borderColor: '#A3B2FF',
    backgroundColor: '#FFFFFF',
    fontSize: 11,
    color: '#545454',
    paddingLeft: 28,
    paddingRight: 16,
  },
  agreeRow: {
    width: 278,
    marginLeft: 11.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkbox: {
    width: 11,
    height: 11,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: '#CECECE',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  checkboxOn: {
    backgroundColor: '#7C62FF',
    borderColor: '#7C62FF',
  },
  checkText: {
    fontSize: 10,
    color: '#545454',
  },
  privacyLink: {
    color: '#94ACF6',
    textDecorationLine: 'underline',
  },
  loginBtn: {
    width: 299,
    height: 46,
    borderRadius: 43,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C62FF',
    borderWidth: 0.5,
    borderColor: '#FDE0FF',
    shadowColor: '#939393',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  loginBtnSpots: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  loginBtnLeftTint: {
    position: 'absolute',
    left: -18,
    top: -8,
    width: 178,
    height: 62,
    borderRadius: 44,
    backgroundColor: '#D85CFF',
    opacity: 0.5,
  },
  loginBtnRightTint: {
    position: 'absolute',
    right: -20,
    top: -8,
    width: 176,
    height: 62,
    borderRadius: 44,
    backgroundColor: '#6A9BFF',
    opacity: 0.58,
  },
  buttonSpot: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  buttonSpotA: {
    left: -13,
    top: 39,
    width: 142,
    height: 12,
    borderRadius: 71,
    opacity: 0.62,
  },
  buttonSpotB: {
    left: -45,
    top: 3,
    width: 142,
    height: 19,
    borderRadius: 71,
    opacity: 0.32,
    transform: [{ rotate: '-3deg' }],
  },
  buttonSpotC: {
    left: -88,
    top: 31,
    width: 151,
    height: 97,
    borderRadius: 76,
    opacity: 0.24,
    transform: [{ rotate: '-20deg' }],
  },
  buttonSpotD: {
    left: -9,
    top: -22,
    width: 45,
    height: 43,
    borderRadius: 23,
    opacity: 0.3,
  },
  buttonSpotE: {
    left: 254,
    top: -19,
    width: 112,
    height: 65,
    borderRadius: 56,
    opacity: 0.34,
  },
  buttonSpotF: {
    left: 183,
    top: 31,
    width: 112,
    height: 21,
    borderRadius: 56,
    opacity: 0.28,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    zIndex: 2,
  },
  forgetPwd: {
    alignSelf: 'flex-end',
    color: '#545454',
    fontSize: 10,
    marginTop: 4,
  },
  otherLoginRow: {
    position: 'absolute',
    top: 619,
    left: 47,
    width: 289,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  line: {
    width: 101,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D8D8D8',
  },
  otherText: {
    fontSize: 11,
    color: '#B4B4B4',
  },
  socialRow: {
    position: 'absolute',
    top: 649,
    left: 97,
    width: 180,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  socialCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D0D0D0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  socialPressed: {
    transform: [{ scale: 0.96 }],
  },
  socialGoogle: {
    width: 30,
    height: 22,
  },
  socialGithubClip: {
    width: 26,
    height: 24,
    overflow: 'hidden',
  },
  socialGithub: {
    position: 'absolute',
    left: -18,
    top: 0,
    width: 63,
    height: 35,
  },
  socialAppleClip: {
    width: 22,
    height: 22,
    overflow: 'hidden',
  },
  socialApple: {
    position: 'absolute',
    left: -28,
    top: -7,
    width: 79,
    height: 52,
  },
  bottomTip: {
    position: 'absolute',
    top: 725,
    left: -5,
    width: 375,
    height: 113,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(172,159,203,0.1)',
  },
  bottomTipText: {
    fontSize: 12,
    color: '#B4B4B4',
  },
  bottomTipLink: {
    fontSize: 12,
    color: '#7C62FF',
  },
});
