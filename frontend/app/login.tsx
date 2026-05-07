import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const SOCIAL_GOOGLE =
  'https://www.figma.com/api/mcp/asset/664f86c3-8c00-40b7-af1e-5b9198ad89a9';
const SOCIAL_GITHUB =
  'https://www.figma.com/api/mcp/asset/1e5da9b1-3bb1-46c8-a346-7fc9128737c6';
const SOCIAL_APPLE =
  'https://www.figma.com/api/mcp/asset/d6c1a107-0bd8-4ecd-8d19-782d90b2e16a';
const CAT_IMAGE =
  'https://www.figma.com/api/mcp/asset/e0cafd76-650a-40f3-a09a-7db39b3d1cf5';

export default function Login() {
  const router = useRouter();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [agreePrivacy, setAgreePrivacy] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

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
      Animated.sequence([
        Animated.timing(blobFloat, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(blobFloat, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(catFloat, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(catFloat, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

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

  const canSubmit = useMemo(() => {
    return agreePrivacy && account.trim().length > 0 && password.trim().length > 0;
  }, [agreePrivacy, account, password]);

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
    try {
      const response = await authAPI.login(account, password);
      const { access_token } = response.data;
      await AsyncStorage.setItem('token', access_token);
      if (!rememberMe) {
        await AsyncStorage.removeItem('token');
      }
      Alert.alert('成功', '登录成功！', [{ text: '确定', onPress: () => router.replace('/') }]);
    } catch (error: any) {
      const message = error.response?.data?.detail || '登录失败，请检查账号和密码';
      Alert.alert('错误', message);
    } finally {
      setLoading(false);
    }
  };

  const blobTranslateY = blobFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const catTranslateY = catFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const catScale = catFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const glowTranslateX = glowSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.artboard}>
        <View style={styles.bg} />

        <Animated.View style={[styles.blob, styles.blobPink, { transform: [{ translateY: blobTranslateY }] }]} />
        <Animated.View
          style={[
            styles.blob,
            styles.blobPurple,
            { transform: [{ translateY: Animated.multiply(blobTranslateY, -0.6) }] },
          ]}
        />
        <View style={[styles.blob, styles.blobWhite]} />

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
              <Text style={styles.logoGlyph}>✎</Text>
            </View>
            <View>
              <Text style={styles.logoTitle}>INTELLIDEPLOY</Text>
              <Text style={styles.logoSub}>Powered by Sealos | GitHub</Text>
            </View>
          </View>
          <View style={styles.settingButton}>
            <Text style={styles.settingGlyph}>⚙</Text>
          </View>
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
          <Image source={{ uri: CAT_IMAGE }} style={styles.catImage} resizeMode="contain" />
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
            <Text style={styles.heroHintMain}>欢迎回来，开发者！</Text>
            <Text style={styles.heroHintSub}>在这里，实现你的奇思妙想</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: formIntro,
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
                <Text style={styles.checkText}>点击即表示同意《隐私协议》</Text>
              </Pressable>
              <Pressable style={styles.checkRow} onPress={() => setRememberMe((v) => !v)}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxOn]} />
                <Text style={styles.checkText}>记住我</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={!canSubmit || loading}
              style={[styles.loginBtn, (!canSubmit || loading) && styles.loginBtnDisabled]}
            >
              <Animated.View pointerEvents="none" style={styles.loginBtnSpots}>
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
            opacity: socialIntro,
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
              <Image source={{ uri: SOCIAL_GOOGLE }} style={styles.socialGoogle} resizeMode="contain" />
            </Pressable>
            <Pressable style={({ pressed }) => [styles.socialCircle, pressed && styles.socialPressed]}>
              <Image source={{ uri: SOCIAL_GITHUB }} style={styles.socialGithub} resizeMode="contain" />
            </Pressable>
            <Pressable style={({ pressed }) => [styles.socialCircle, pressed && styles.socialPressed]}>
              <Image source={{ uri: SOCIAL_APPLE }} style={styles.socialApple} resizeMode="contain" />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.bottomTip,
            {
              opacity: bottomIntro,
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artboard: {
    width: 375,
    height: 812,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#EFF3FF',
    position: 'relative',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EFF3FF',
    ...(Platform.OS === 'web'
      ? ({
          background:
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
  topBar: {
    position: 'absolute',
    top: 47,
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
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#7C62FF',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: -1,
  },
  logoTitle: {
    fontSize: 27 / 1.5,
    fontWeight: '800',
    color: '#4B4C67',
    letterSpacing: 0.2,
  },
  logoSub: {
    fontSize: 4.7,
    color: '#9A9CB8',
    marginTop: 1,
  },
  settingButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 0.8,
    borderColor: '#DADAEA',
  },
  settingGlyph: {
    color: '#595A74',
    fontSize: 15,
  },
  catWrap: {
    position: 'absolute',
    left: 140,
    top: 130,
    width: 108,
    height: 103,
  },
  catImage: {
    width: '100%',
    height: '100%',
    opacity: 0.92,
  },
  heroTitleShadow: {
    position: 'absolute',
    top: 245,
    left: 38,
    width: 299,
    textAlign: 'center',
    color: 'rgba(124,98,255,0.25)',
    fontSize: 40,
    fontWeight: '800',
  },
  heroTitle: {
    position: 'absolute',
    top: 203,
    left: 38,
    width: 299,
    textAlign: 'center',
    color: '#7C62FF',
    fontSize: 50 / 1.25,
    fontWeight: '800',
    textShadowColor: 'rgba(200,200,200,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroHint: {
    position: 'absolute',
    top: 274,
    left: 104,
    width: 166,
    alignItems: 'center',
    gap: 8,
  },
  heroHintMain: {
    color: '#494A64',
    fontSize: 18,
    fontWeight: '700',
  },
  heroHintSub: {
    color: '#6D6E8D',
    fontSize: 14,
  },
  formWrap: {
    position: 'absolute',
    left: 47,
    top: 356,
    width: 280,
    gap: 16,
  },
  input: {
    width: 280,
    height: 48,
    borderRadius: 12,
    borderWidth: 0.3,
    borderColor: '#A3B2FF',
    backgroundColor: '#FFFFFF',
    fontSize: 11,
    color: '#545454',
    paddingHorizontal: 16,
  },
  agreeRow: {
    width: 278,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
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
  loginBtn: {
    width: 299,
    height: 46,
    borderRadius: 43,
    alignSelf: 'center',
    marginTop: 3,
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
    marginTop: 2,
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
  socialGithub: {
    width: 22,
    height: 22,
  },
  socialApple: {
    width: 18,
    height: 18,
  },
  bottomTip: {
    position: 'absolute',
    top: 730,
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
