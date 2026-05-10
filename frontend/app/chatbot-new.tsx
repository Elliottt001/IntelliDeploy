import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatbotNewPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAICard, setShowAICard] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim1 = useRef(new Animated.Value(0)).current;
  const rippleAnim2 = useRef(new Animated.Value(0)).current;
  const rippleAnim3 = useRef(new Animated.Value(0)).current;
  const rippleAnim4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Float animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Ripple animations
    const createRipple = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 3000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    createRipple(rippleAnim1, 0);
    createRipple(rippleAnim2, 750);
    createRipple(rippleAnim3, 1500);
    createRipple(rippleAnim4, 2250);
  }, [fadeAnim, floatAnim, rippleAnim1, rippleAnim2, rippleAnim3, rippleAnim4]);

  const suggestions = [
    '推荐几款好用的开发工具',
    '如何使用Docker部署应用？',
    '帮我生成一个Python爬虫代码！',
  ];

  const handleSend = async (content: string) => {
    if (!content.trim()) return;

    setShowSuggestions(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    setIsLoading(true);
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '我已经理解了您的需求，正在为您生成应用方案...',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);

      setTimeout(() => {
        setShowAICard(true);
      }, 500);
    }, 1500);
  };

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const createRippleStyle = (anim: Animated.Value) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.8],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 0],
    }),
  });

  return (
    <View style={styles.container}>
      {/* Main Chat Container */}
      <Animated.View style={[styles.chatContainer, { opacity: fadeAnim }]}>
        {/* Background Gradient */}
        <View style={styles.background} />

        {/* Animated Blobs */}
        <View style={[styles.blob, styles.blobPink]} />
        <View style={[styles.blob, styles.blobPurple]} />

        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <Text style={styles.headerButtonText}>←</Text>
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={styles.titleText}>
              <Text style={styles.titleHighlight}>Mibo</Text> AI Chatbot
            </Text>
          </View>
          <Pressable style={styles.headerButton}>
            <Text style={styles.headerButtonText}>⋯</Text>
          </Pressable>
        </View>

        {/* Content Area */}
        <ScrollView
          style={styles.contentArea}
          contentContainerStyle={styles.contentContainer}
        >
          {messages.length === 0 ? (
            <>
              {/* Hero Section */}
              <View style={styles.hero}>
                {/* Ripple Animations */}
                <View style={styles.rippleContainer}>
                  <Animated.View style={[styles.ripple, createRippleStyle(rippleAnim1)]} />
                  <Animated.View style={[styles.ripple, createRippleStyle(rippleAnim2)]} />
                  <Animated.View style={[styles.ripple, createRippleStyle(rippleAnim3)]} />
                  <Animated.View style={[styles.ripple, createRippleStyle(rippleAnim4)]} />
                </View>

                {/* Robot Mascot */}
                <Animated.View style={[styles.robotContainer, { transform: [{ translateY: floatY }] }]}>
                  <View style={styles.robot}>
                    <View style={styles.robotFace}>
                      <View style={styles.robotEyes}>
                        <View style={styles.robotEye} />
                        <View style={styles.robotEye} />
                      </View>
                      <View style={styles.robotMouth} />
                    </View>
                  </View>
                  {/* Cat Ears */}
                  <View style={[styles.ear, styles.earLeft]} />
                  <View style={[styles.ear, styles.earRight]} />
                </Animated.View>

                {/* Welcome Message */}
                <View style={styles.welcomeMessage}>
                  <Text style={styles.welcomeTitle}>
                    你好！我是 <Text style={styles.welcomeHighlight}>Mibo^^</Text>
                  </Text>
                  <Text style={styles.welcomeSubtitle}>
                    有什么可以帮助您的吗？
                  </Text>
                </View>
              </View>

              {/* Suggestion Buttons */}
              {showSuggestions && (
                <View style={styles.suggestions}>
                  {suggestions.map((suggestion, index) => (
                    <Pressable
                      key={index}
                      style={styles.suggestionButton}
                      onPress={() => handleSend(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              {/* Chat Messages */}
              <View style={styles.messagesContainer}>
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.messageBubble,
                      message.role === 'user' ? styles.userBubble : styles.aiBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        message.role === 'user' ? styles.userText : styles.aiText,
                      ]}
                    >
                      {message.content}
                    </Text>
                  </View>
                ))}

                {isLoading && (
                  <View style={[styles.messageBubble, styles.aiBubble]}>
                    <Text style={styles.aiText}>正在思考中......</Text>
                  </View>
                )}
              </View>

              {/* AI Card */}
              {showAICard && (
                <Pressable style={styles.aiCard}>
                  <View style={styles.aiCardHeader}>
                    <View style={styles.aiCardIcon}>
                      <Text style={styles.aiCardIconText}>✨</Text>
                    </View>
                    <View style={styles.aiCardTitleContainer}>
                      <Text style={styles.aiCardTitle}>智能开发助手</Text>
                      <Text style={styles.aiCardMeta}>AI 生成卡片</Text>
                    </View>
                  </View>
                  <Text style={styles.aiCardDescription}>
                    已为您生成完整的应用架构方案，包括前端界面、后端API和数据库设计。
                  </Text>
                  <View style={styles.aiCardFooter}>
                    <Text style={styles.aiCardAction}>请帮我部署这个应用到云端</Text>
                    <Text style={styles.aiCardArrow}>→</Text>
                  </View>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="在这里输入你的问题......"
            placeholderTextColor="#8B8FAF"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend(inputText)}
          />
          <Pressable
            style={styles.sendButton}
            onPress={() => handleSend(inputText)}
          >
            <Text style={styles.sendButtonText}>↑</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    width: '100%',
    maxWidth: 420,
    height: 896,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#F7F9FF',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 60,
        elevation: 20,
      },
    }),
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F7F9FF',
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  blobPink: {
    right: -96,
    bottom: 80,
    width: 256,
    height: 320,
    backgroundColor: 'rgba(246, 184, 255, 0.25)',
  },
  blobPurple: {
    left: -80,
    top: 160,
    width: 256,
    height: 224,
    backgroundColor: 'rgba(124, 98, 255, 0.15)',
  },
  header: {
    position: 'absolute',
    top: 48,
    left: 28,
    right: 28,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  headerButtonText: {
    fontSize: 20,
    color: '#494A64',
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 16,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#161823',
  },
  titleHighlight: {
    color: '#7C62FF',
  },
  contentArea: {
    flex: 1,
    marginTop: 120,
    marginBottom: 100,
  },
  contentContainer: {
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    position: 'relative',
  },
  rippleContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    height: 192,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 256,
    height: 256,
    borderRadius: 128,
    borderWidth: 2,
    borderColor: 'rgba(124, 98, 255, 0.2)',
  },
  robotContainer: {
    width: 192,
    height: 192,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 10,
  },
  robot: {
    width: 128,
    height: 128,
    borderRadius: 32,
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px rgba(124, 98, 255, 0.3)',
      },
      default: {
        shadowColor: '#7C62FF',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 40,
        elevation: 10,
      },
    }),
  },
  robotFace: {
    alignItems: 'center',
  },
  robotEyes: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  robotEye: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E5FF',
  },
  robotMouth: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00E5FF',
  },
  ear: {
    position: 'absolute',
    width: 32,
    height: 32,
    backgroundColor: '#B39DFF',
  },
  earLeft: {
    top: -8,
    left: 32,
    borderTopLeftRadius: 32,
    transform: [{ rotate: '-12deg' }],
  },
  earRight: {
    top: -8,
    right: 32,
    borderTopRightRadius: 32,
    transform: [{ rotate: '12deg' }],
  },
  welcomeMessage: {
    marginTop: 32,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#161823',
    marginBottom: 8,
  },
  welcomeHighlight: {
    color: '#7C62FF',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#7F80A1',
  },
  suggestions: {
    marginTop: 24,
    gap: 12,
  },
  suggestionButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 14px rgba(175, 167, 215, 0.16)',
      },
      default: {
        shadowColor: '#AFA7D7',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
        elevation: 5,
      },
    }),
  },
  suggestionText: {
    fontSize: 14,
    color: '#494A64',
    textAlign: 'center',
  },
  messagesContainer: {
    gap: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#7C62FF',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      },
    }),
  },
  messageText: {
    fontSize: 14,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: '#494A64',
  },
  aiCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 14px rgba(137, 122, 185, 0.16)',
      },
      default: {
        shadowColor: '#897AB9',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
        elevation: 5,
      },
    }),
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  aiCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  aiCardIconText: {
    fontSize: 28,
  },
  aiCardTitleContainer: {
    flex: 1,
  },
  aiCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#161823',
    marginBottom: 4,
  },
  aiCardMeta: {
    fontSize: 11,
    color: '#7C62FF',
    fontWeight: '600',
  },
  aiCardDescription: {
    fontSize: 13,
    color: '#7F80A1',
    lineHeight: 20,
    marginBottom: 16,
  },
  aiCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E4F8',
  },
  aiCardAction: {
    fontSize: 12,
    color: '#7C62FF',
    fontWeight: '700',
  },
  aiCardArrow: {
    fontSize: 16,
    color: '#7C62FF',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 32,
    left: 28,
    right: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#494A64',
    paddingRight: 12,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
});
