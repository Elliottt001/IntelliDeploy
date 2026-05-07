import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

const catImage =
  'https://www.figma.com/api/mcp/asset/be3df654-ec89-4c35-a63a-f7e408efb85c';

export default function Chatbot() {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<'keyboard' | 'voice'>('keyboard');
  const [message, setMessage] = useState('');
  const [sentMessage, setSentMessage] = useState('帮我生成一个可以部署到云上的宠物救助 App');
  const [isGenerating, setIsGenerating] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const intro = useRef(new Animated.Value(0)).current;
  const botIntro = useRef(new Animated.Value(0)).current;
  const userIntro = useRef(new Animated.Value(0)).current;
  const generateIntro = useRef(new Animated.Value(0)).current;
  const generating = useRef(new Animated.Value(0)).current;
  const cardIntro = useRef(new Animated.Value(0)).current;
  const inputIntro = useRef(new Animated.Value(0)).current;
  const dockMode = useRef(new Animated.Value(0)).current;
  const voicePulse = useRef(new Animated.Value(0)).current;
  const sendPulse = useRef(new Animated.Value(0)).current;
  const cardPress = useRef(new Animated.Value(0)).current;
  const detailIntro = useRef(new Animated.Value(0)).current;
  const ambientFloat = useRef(new Animated.Value(0)).current;
  const avatarBreath = useRef(new Animated.Value(0)).current;
  const voiceLoop = useRef<Animated.CompositeAnimation | null>(null);
  const generationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(intro, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(170, [
        Animated.timing(botIntro, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(userIntro, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(generateIntro, {
          toValue: 1,
          duration: 440,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(cardIntro, {
          toValue: 1,
          speed: 12,
          bounciness: 8,
          useNativeDriver: true,
        }),
        Animated.timing(inputIntro, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => setIsGenerating(false));

    const generatingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(generating, {
          toValue: 1,
          duration: 980,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(generating, {
          toValue: 0,
          duration: 980,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    generatingLoop.start();

    const ambientLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientFloat, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ambientFloat, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    ambientLoop.start();

    const avatarLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarBreath, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(avatarBreath, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    avatarLoop.start();

    return () => {
      generatingLoop.stop();
      ambientLoop.stop();
      avatarLoop.stop();
      voiceLoop.current?.stop();
      if (generationTimer.current) {
        clearTimeout(generationTimer.current);
      }
    };
  }, [
    ambientFloat,
    avatarBreath,
    botIntro,
    cardIntro,
    generateIntro,
    generating,
    inputIntro,
    intro,
    userIntro,
  ]);

  useEffect(() => {
    Animated.timing(dockMode, {
      toValue: inputMode === 'keyboard' ? 0 : 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [dockMode, inputMode]);

  useEffect(() => {
    Animated.timing(detailIntro, {
      toValue: detailOpen ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [detailIntro, detailOpen]);

  const submit = () => {
    if (!message.trim()) {
      return;
    }
    if (generationTimer.current) {
      clearTimeout(generationTimer.current);
    }
    setSentMessage(message.trim());
    setMessage('');
    setDetailOpen(false);
    setIsGenerating(true);
    cardIntro.setValue(0);
    sendPulse.setValue(0);

    Animated.sequence([
      Animated.timing(sendPulse, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sendPulse, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.timing(userIntro, {
        toValue: 0.82,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(userIntro, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    generationTimer.current = setTimeout(() => {
      setIsGenerating(false);
      Animated.spring(cardIntro, {
        toValue: 1,
        speed: 11,
        bounciness: 9,
        useNativeDriver: true,
      }).start();
    }, 1380);
  };

  const startVoicePress = () => {
    voiceLoop.current?.stop();
    voicePulse.setValue(0);
    voiceLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(voicePulse, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(voicePulse, {
          toValue: 0,
          duration: 520,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    voiceLoop.current.start();
  };

  const stopVoicePress = () => {
    voiceLoop.current?.stop();
    voicePulse.stopAnimation(() => {
      Animated.timing(voicePulse, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const pressCardIn = () => {
    Animated.spring(cardPress, {
      toValue: 1,
      speed: 22,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  const ambientY = ambientFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -9],
  });

  const avatarY = avatarBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const avatarScale = avatarBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const pressCardOut = () => {
    Animated.spring(cardPress, {
      toValue: 0,
      speed: 18,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  };

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.artboard}>
        <View style={styles.bg} />
        <Animated.View style={[styles.blobPink, { transform: [{ translateY: ambientY }] }]} />
        <Animated.View
          style={[
            styles.blobPurple,
            { transform: [{ translateY: Animated.multiply(ambientY, -0.65) }] },
          ]}
        />

        <Animated.View
          style={[
            styles.topBar,
            {
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Mibo ChatBot</Text>
            <Text style={styles.subtitle}>AI 产品生成助手</Text>
          </View>
          <Animated.View
            style={[
              styles.avatarDot,
              {
                transform: [
                  { translateY: avatarY },
                  { scale: avatarScale },
                ],
              },
            ]}
          >
            <Image source={{ uri: catImage }} style={styles.avatarCat} resizeMode="contain" />
          </Animated.View>
        </Animated.View>

        <View style={styles.chatArea}>
          <Animated.View
            style={[
              styles.messageBubble,
              styles.botBubble,
              styles.heroBubble,
              {
                opacity: botIntro,
                transform: [
                  {
                    translateY: botIntro.interpolate({
                      inputRange: [0, 1],
                      outputRange: [22, 0],
                    }),
                  },
                  {
                    scale: botIntro.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.97, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.botText}>
              你好，我是 Mibo。告诉我你的产品想法，我会帮你拆解功能、生成应用卡片，并准备部署方案。
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.messageBubble,
              styles.userBubble,
              {
                opacity: userIntro,
                transform: [
                  {
                    translateX: userIntro.interpolate({
                      inputRange: [0, 1],
                      outputRange: [26, 0],
                    }),
                  },
                  {
                    scale: userIntro.interpolate({
                      inputRange: [0, 0.82, 1],
                      outputRange: [0.96, 0.985, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.userText}>{sentMessage}</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.messageBubble,
              styles.botBubble,
              styles.generateBubble,
              {
                opacity: Animated.multiply(
                  generateIntro,
                  generating.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.72, 1],
                  })
                ),
                transform: [
                  {
                    translateX: generateIntro.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.generatingText}>
              {isGenerating ? '产品生成中……' : '产品已生成'}
            </Text>
            <View style={styles.generatingDots}>
              {[0, 1, 2].map((dot) => (
                <Animated.View
                  key={dot}
                  style={[
                    styles.generatingDot,
                    {
                      opacity: generating.interpolate({
                        inputRange: [0, 0.35, 0.7, 1],
                        outputRange: dot === 0 ? [1, 0.45, 0.45, 1] : dot === 1 ? [0.45, 1, 0.45, 0.45] : [0.45, 0.45, 1, 0.45],
                      }),
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    transform: [
                      {
                        translateX: generating.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-86, 156],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
          </Animated.View>

          <Pressable
            onPress={() => setDetailOpen((open) => !open)}
            onPressIn={pressCardIn}
            onPressOut={pressCardOut}
          >
            <Animated.View
              style={[
                styles.appCard,
                {
                  opacity: cardIntro,
                  transform: [
                    {
                      translateY: cardIntro.interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                    {
                      scale: Animated.multiply(
                        cardIntro.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.96, 1],
                        }),
                        cardPress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.975],
                        })
                      ),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.appIcon}>
                <Image source={{ uri: catImage }} style={styles.appIconCat} resizeMode="contain" />
              </View>
              <View style={styles.appCardCopy}>
                <Text style={styles.appCardTitle}>Pawzzle 寻爪</Text>
                <Text style={styles.appCardMeta}>救助社区 · App 卡片</Text>
                <Text style={styles.appCardDesc}>
                  领养列表、走失发布、志愿者协作和一键部署已生成。
                </Text>
                <Text style={styles.tapHint}>轻触查看生成详情</Text>
              </View>
            </Animated.View>
          </Pressable>

          <Animated.View
            pointerEvents={detailOpen ? 'auto' : 'none'}
            style={[
              styles.detailPanel,
              {
                opacity: detailIntro,
                transform: [
                  {
                    translateY: detailIntro.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: detailIntro.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.detailTitle}>已拆解为 3 个阶段</Text>
            <Text style={styles.detailLine}>1. 需求卡片 · 领养 / 走失 / 志愿者协作</Text>
            <Text style={styles.detailLine}>2. 原型预览 · App Gallery 可继续查看</Text>
            <Text style={styles.detailLine}>3. 部署方案 · 云端一键发布准备中</Text>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.inputDock,
            {
              opacity: inputIntro,
              transform: [
                {
                  translateY: inputIntro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {inputMode === 'keyboard' ? (
            <TextInput
              style={styles.input}
              placeholder="输入你的想法..."
              placeholderTextColor="#8B8FAF"
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={submit}
              returnKeyType="send"
            />
          ) : (
            <Pressable
              style={styles.voicePad}
              onPressIn={startVoicePress}
              onPressOut={stopVoicePress}
            >
              <Animated.View
                style={[
                  styles.voiceRipple,
                  {
                    opacity: voicePulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.28],
                    }),
                    transform: [
                      {
                        scale: voicePulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.78, 1.2],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text style={styles.voiceText}>按住说话</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.modeButton}
            onPress={() => setInputMode((mode) => (mode === 'keyboard' ? 'voice' : 'keyboard'))}
          >
            <Animated.Text
              style={[
                styles.modeButtonText,
                {
                  transform: [
                    {
                      translateY: dockMode.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {inputMode === 'keyboard' ? '语音\n麦克风' : '打字\n键盘'}
            </Animated.Text>
          </Pressable>
          <Pressable style={styles.sendButton} onPress={submit}>
            <Animated.View
              style={[
                styles.sendFlash,
                {
                  opacity: sendPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.34],
                  }),
                  transform: [
                    {
                      scale: sendPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.7, 1.35],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artboard: {
    width: 402,
    height: 874,
    backgroundColor: '#F7F9FF',
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F7F9FF',
  },
  blobPink: {
    position: 'absolute',
    right: -90,
    bottom: 80,
    width: 260,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(246,184,255,0.24)',
  },
  blobPurple: {
    position: 'absolute',
    left: -80,
    top: 160,
    width: 260,
    height: 220,
    borderRadius: 140,
    backgroundColor: 'rgba(124,98,255,0.13)',
  },
  topBar: {
    position: 'absolute',
    top: 48,
    left: 28,
    right: 28,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#494A64',
    fontSize: 24,
    lineHeight: 26,
  },
  titleWrap: {
    marginLeft: 14,
    flex: 1,
  },
  title: {
    color: '#161823',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#7F80A1',
    fontSize: 10,
    marginTop: 2,
  },
  avatarDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1E8FF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCat: {
    width: 34,
    height: 32,
  },
  chatArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 120,
    bottom: 106,
  },
  messageBubble: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#AFA7D7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  botBubble: {
    marginLeft: 36,
    width: 265,
    backgroundColor: 'rgba(255,255,255,0.76)',
    padding: 18,
  },
  heroBubble: {
    height: 174,
    justifyContent: 'center',
  },
  userBubble: {
    alignSelf: 'flex-end',
    marginRight: 32,
    marginTop: 40,
    width: 265,
    minHeight: 53,
    backgroundColor: '#7C62FF',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  botText: {
    color: '#494A64',
    fontSize: 15,
    lineHeight: 24,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
  },
  generatingText: {
    color: '#161823',
    fontSize: 24,
    fontWeight: '600',
  },
  generateBubble: {
    marginTop: 40,
  },
  generatingDots: {
    position: 'absolute',
    right: 18,
    top: 22,
    flexDirection: 'row',
    gap: 5,
  },
  generatingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#7C62FF',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ECEAF8',
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    width: 86,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#7C62FF',
  },
  appCard: {
    marginLeft: 36,
    marginTop: 22,
    width: 265,
    minHeight: 141,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.82)',
    flexDirection: 'row',
    padding: 16,
    shadowColor: '#897AB9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  appIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#EAF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconCat: {
    width: 48,
    height: 42,
  },
  appCardCopy: {
    flex: 1,
    marginLeft: 14,
  },
  appCardTitle: {
    color: '#161823',
    fontSize: 15,
    fontWeight: '700',
  },
  appCardMeta: {
    color: '#7C62FF',
    fontSize: 9,
    marginTop: 4,
  },
  appCardDesc: {
    color: '#7F80A1',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 8,
  },
  tapHint: {
    color: '#7C62FF',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 10,
  },
  detailPanel: {
    marginLeft: 36,
    marginTop: 12,
    width: 265,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#897AB9',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  detailTitle: {
    color: '#161823',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
  },
  detailLine: {
    color: '#6C6E8E',
    fontSize: 10,
    lineHeight: 16,
  },
  inputDock: {
    position: 'absolute',
    left: 27,
    top: 788,
    width: 359,
    height: 46,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  input: {
    flex: 1,
    color: '#494A64',
    fontSize: 14,
    padding: 0,
  },
  voicePad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  voiceRipple: {
    position: 'absolute',
    width: 138,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#7C62FF',
  },
  voiceText: {
    color: '#7C62FF',
    fontSize: 14,
    fontWeight: '600',
  },
  modeButton: {
    width: 60,
    height: 38,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonText: {
    color: '#494A64',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sendFlash: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 22,
  },
});
