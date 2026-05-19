import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

type Phase = 'welcome' | 'analyzing' | 'installing' | 'complete';
const ARTBOARD_WIDTH = 375;
const ARTBOARD_HEIGHT = 812;

const stageImages = {
  welcome: require('../assets/images/mibo-stage-welcome.png'),
  analyzing: require('../assets/images/mibo-stage-analyzing.png'),
  installing: require('../assets/images/mibo-stage-installing.png'),
  complete: require('../assets/images/mibo-stage-complete.png'),
};

export default function Chatbot() {
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>('welcome');
  const [message, setMessage] = useState('');
  const [contentReady, setContentReady] = useState(false);
  const intro = useRef(new Animated.Value(0)).current;
  const phaseIntro = useRef(new Animated.Value(1)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
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

    Animated.timing(intro, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    timers.current.push(setTimeout(() => setContentReady(true), 650));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [intro]);

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
    phaseIntro.stopAnimation();
    phaseIntro.setValue(0);
    Animated.timing(phaseIntro, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [phase, phaseIntro]);

  const content = useMemo(() => {
    if (phase === 'welcome') {
      return {
        title: '你好！我是 Mibo^^',
        subtitle: '有什么可以帮助您的吗？',
        suggestions: ['推荐几款好用的开发工具', '如何使用Docker部署项目?', '帮我生成一个Python爬虫代码!'],
      };
    }

    if (phase === 'analyzing') {
      return {
        title: '正在分析论文环境需求…',
        subtitle: '',
        steps: ['阅读论文与环境要求', '提取依赖项'],
      };
    }

    if (phase === 'installing') {
      return {
        title: '正在安装依赖包…',
        subtitle: '',
        steps: ['解析论文环境需求', '锁定依赖版本', '安装并校验依赖'],
      };
    }

    return {
      title: '环境部署完成！🎉',
      subtitle: '',
      result: {
        deps: ['Python 3.9.18', 'PyTorch 2.1.0+cu118', 'CUDA 11.8', '其他依赖包 8/8'],
        next: ['运行示例代码测试环境', '开始论文实验'],
      },
    };
  }, [phase]);

  const beginFlow = (nextMessage?: string) => {
    const finalMessage = (nextMessage ?? message).trim();
    if (!finalMessage || phase !== 'welcome') {
      return;
    }

    timers.current.forEach(clearTimeout);
    timers.current = [];
    setContentReady(true);
    setMessage(finalMessage);
    setPhase('analyzing');
    timers.current.push(setTimeout(() => setPhase('installing'), 1800));
    timers.current.push(setTimeout(() => setPhase('complete'), 4200));
  };

  const submit = () => {
    beginFlow();
  };

  return (
    <KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" hidden translucent backgroundColor="transparent" />
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
        <View style={styles.header}>
          <Pressable style={styles.circleButton} onPress={() => router.back()}>
            <BackGlyph />
          </Pressable>
          <Text style={styles.headerTitle}><Text style={styles.headerAccent}>Mibo</Text> AI Chatbot</Text>
          <Pressable style={styles.circleButton}>
            <ShareGlyph />
          </Pressable>
        </View>

        <Animated.View
          style={[
            styles.stage,
            {
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
                },
              ],
            },
          ]}
        >
          <Image source={stageImages[phase]} resizeMode="contain" style={styles.stageImage} />
        </Animated.View>

        {contentReady ? (
          <Animated.View
            style={[
              styles.phaseContent,
              {
                opacity: phaseIntro,
                transform: [
                  {
                    translateY: phaseIntro.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.title}>{content.title}</Text>
            {content.subtitle ? <Text style={styles.subtitle}>{content.subtitle}</Text> : null}

            {phase === 'welcome' && content.suggestions ? (
              <View style={styles.suggestions}>
                {content.suggestions.map((item) => (
                  <Pressable key={item} style={styles.suggestionPill} onPress={() => beginFlow(item)}>
                    <Text style={styles.suggestionText}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {(phase === 'analyzing' || phase === 'installing') && content.steps ? (
              <View style={styles.steps}>
                {content.steps.map((step) => (
                  <View key={step} style={styles.stepRow}>
                    <View style={styles.spinner} />
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {phase === 'complete' && content.result ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>环境依赖:</Text>
                {content.result.deps.map((item) => (
                  <Text key={item} style={styles.resultLine}>• {item}</Text>
                ))}
                <Text style={[styles.resultLabel, styles.resultNext]}>下一步建议:</Text>
                {content.result.next.map((item) => (
                  <Text key={item} style={styles.resultLine}>• {item}</Text>
                ))}
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        <View style={styles.inputDock}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="在这里输入你的问题……"
            placeholderTextColor="#8B8FAF"
            editable={phase === 'welcome'}
            onSubmitEditing={submit}
            returnKeyType="send"
          />
          <Text style={styles.mic}>◕</Text>
          <Pressable style={styles.sendButton} onPress={submit}>
            <Text style={styles.sendText}>⌁</Text>
          </Pressable>
        </View>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ShareGlyph() {
  return (
    <View style={styles.shareGlyph}>
      <View style={[styles.shareNode, styles.shareNodeTop]} />
      <View style={[styles.shareNode, styles.shareNodeLeft]} />
      <View style={[styles.shareNode, styles.shareNodeRight]} />
      <View style={[styles.shareLink, styles.shareLinkLeft]} />
      <View style={[styles.shareLink, styles.shareLinkRight]} />
    </View>
  );
}

function BackGlyph() {
  return (
    <View style={styles.backGlyph}>
      <View style={styles.backShaft} />
      <View style={[styles.backWing, styles.backWingTop]} />
      <View style={[styles.backWing, styles.backWingBottom]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F3F5FF',
    position: 'relative',
  },
  header: {
    position: 'absolute',
    top: 45,
    left: 27,
    right: 27,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    width: 16,
    height: 14,
    position: 'relative',
  },
  backShaft: {
    position: 'absolute',
    left: 3,
    top: 6,
    width: 12,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#494A64',
  },
  backWing: {
    position: 'absolute',
    left: 2,
    width: 8,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#494A64',
  },
  backWingTop: {
    top: 3,
    transform: [{ rotate: '-45deg' }],
  },
  backWingBottom: {
    top: 9,
    transform: [{ rotate: '45deg' }],
  },
  shareGlyph: {
    width: 18,
    height: 18,
    position: 'relative',
  },
  shareNode: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#494A64',
    zIndex: 2,
  },
  shareNodeTop: {
    top: 1,
    left: 10,
  },
  shareNodeLeft: {
    top: 10,
    left: 1,
  },
  shareNodeRight: {
    top: 12,
    left: 12,
  },
  shareLink: {
    position: 'absolute',
    height: 1.6,
    borderRadius: 1,
    backgroundColor: '#494A64',
  },
  shareLinkLeft: {
    top: 8,
    left: 4,
    width: 9,
    transform: [{ rotate: '-34deg' }],
  },
  shareLinkRight: {
    top: 10,
    left: 10,
    width: 7,
    transform: [{ rotate: '45deg' }],
  },
  headerTitle: {
    color: '#111426',
    fontSize: 18,
    fontWeight: '700',
  },
  headerAccent: {
    color: '#7C62FF',
  },
  stage: {
    position: 'absolute',
    top: 181,
    left: 52,
    width: 270,
    height: 228,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageImage: {
    width: 270,
    height: 228,
  },
  phaseContent: {
    position: 'absolute',
    top: 410,
    left: 28,
    right: 28,
    alignItems: 'center',
  },
  title: {
    color: '#161823',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#6F7394',
    fontSize: 14,
    marginTop: 12,
  },
  suggestions: {
    marginTop: 26,
    gap: 14,
  },
  suggestionPill: {
    width: 228,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    color: '#6A6E88',
    fontSize: 13,
  },
  steps: {
    marginTop: 24,
    gap: 14,
    alignSelf: 'flex-start',
    marginLeft: 54,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#A490FF',
    borderTopColor: 'transparent',
  },
  stepText: {
    color: '#70738F',
    fontSize: 14,
  },
  resultCard: {
    width: 284,
    marginTop: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  resultLabel: {
    color: '#72758F',
    fontSize: 13,
    marginBottom: 8,
  },
  resultNext: {
    marginTop: 16,
  },
  resultLine: {
    color: '#747893',
    fontSize: 13,
    lineHeight: 20,
  },
  inputDock: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 21,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    color: '#555971',
    fontSize: 13,
  },
  mic: {
    color: '#7F80A1',
    fontSize: 18,
    marginRight: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8C5CFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
});
