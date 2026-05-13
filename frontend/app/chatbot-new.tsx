import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Animated, Easing, Image, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const MicrophoneIcon = ({ size = 18, color = '#8B8FAF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Microphone capsule */}
    <Rect x="9" y="4" width="6" height="10" rx="3" stroke={color} strokeWidth="2" fill="none" />
    {/* Microphone stand */}
    <Path d="M12 14 L12 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Microphone base */}
    <Path d="M9 20 L15 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* Sound arc left */}
    <Path d="M6 10 C6 13.5 8.5 16 12 16" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    {/* Sound arc right */}
    <Path d="M18 10 C18 13.5 15.5 16 12 16" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
  </Svg>
);

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

  // Entrance animation values
  const robotEnterAnim = useRef(new Animated.Value(-300)).current; // Start from top
  const underRobotScaleAnim = useRef(new Animated.Value(0)).current; // Start small
  const contentFadeAnim = useRef(new Animated.Value(0)).current; // Other content fade in

  useEffect(() => {
    // Entrance animation sequence
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(robotEnterAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(underRobotScaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
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

      const createRipple = (anim: Animated.Value, delay: number) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      createRipple(rippleAnim1, 0);
      createRipple(rippleAnim2, 666);
      createRipple(rippleAnim3, 1333);
    });
  }, [fadeAnim, floatAnim, rippleAnim1, rippleAnim2, rippleAnim3, robotEnterAnim, underRobotScaleAnim, contentFadeAnim]);

  const suggestions = [
    '推荐几款好用的开发工具',
    '如何使用Docker部署项目？',
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

  const createRippleStyle = (anim: Animated.Value, index: number) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1.3 + index * 0.1],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.4, 0.2, 0],
    }),
  });

  return (
    <View style={styles.container}>
      {/* Main Chat Container */}
      <Animated.View style={[styles.chatContainer, { opacity: fadeAnim }]}>
        {/* Background with gradient */}
        <View style={styles.background} />


        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => {
            if (router.canGoBack()) {
           router.back();
            } else {
              router.push('/');
            }
          }}>
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
                {/* Ripple Animations - 3 layers */}
                <View style={styles.rippleContainer}>
                  <Animated.View style={[styles.ripple, styles.ripple1, createRippleStyle(rippleAnim1, 0)]} />
                  <Animated.View style={[styles.ripple, styles.ripple2, createRippleStyle(rippleAnim2, 1)]} />
                  <Animated.View style={[styles.ripple, styles.ripple3, createRippleStyle(rippleAnim3, 2)]} />
                </View>

           {/* Robot Mascot with Image */}
         <Animated.View style={[
               styles.robotContainer,
                  {
                  transform: [
                  { translateY: Animated.add(robotEnterAnim, floatY) }
               ]
              }
                ]}>
        {/* Under Robot Ripple Platform - Using processed transparent image */}
          <Animated.Image
         source={require('../assets/chatbot/underrobot.png')}
            style={[
              styles.underRobotImage,
              {
            transform: [{ scale: underRobotScaleAnim }]
            }
            ]}
        resizeMode="contain"
          />


          {/* Robot Image */}
          <Image
          source={require('../assets/chatbot/robot.png')}
            style={styles.robotImage}
            resizeMode="contain"
          />
           </Animated.View>

                {/* Welcome Message */}
                <Animated.View style={[styles.welcomeMessage, { opacity: contentFadeAnim }]}>
                  <Text style={styles.welcomeTitle}>
                  你好！我是 <Text style={styles.welcomeHighlight}>Mibo^^</Text>
                  </Text>
             <Text style={styles.welcomeSubtitle}>
               有什么可以帮助您的吗？
               </Text>
                </Animated.View>
          </View>

            {/* Suggestion Buttons */}
              {showSuggestions && (
                <Animated.View style={[styles.suggestions, { opacity: contentFadeAnim }]}>
                  {suggestions.map((suggestion, index) => (
                <Pressable
                    key={index}
                      style={styles.suggestionButton}
                  onPress={() => handleSend(suggestion)}
                  >
              <Text style={styles.suggestionText}>{suggestion}</Text>
       </Pressable>
                ))}
           </Animated.View>
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
             <Pressable style={styles.micButton}>
          <MicrophoneIcon size={18} color="#8B8FAF" />
        </Pressable>
          <Pressable
            style={styles.sendButton}
        onPress={() => handleSend(inputText)}
          >
           <LinearGradient
         colors={['#C05CF6', '#7C62FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
        style={styles.sendButtonGradient}
            >
                    <Ionicons name="send" size={16} color="#FFFFFF" style={{ transform: [{ rotate: '-45deg' }] }} />
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    width: '100%',
    maxWidth: 420,
    height: 896,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#E8EBFF',
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
    backgroundColor: '#E8EBFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
    alignItems: 'center',
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
    paddingTop: 20,
    paddingBottom: 32,
    position: 'relative',
  },
  rippleContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  ripple1: {
    width: 200,
    height: 200,
  borderColor: 'rgba(200, 190, 255, 0.3)',
  },
  ripple2: {
    width: 260,
    height: 260,
    borderColor: 'rgba(200, 190, 255, 0.25)',
  },
  ripple3: {
    width: 320,
    height: 320,
    borderColor: 'rgba(200, 190, 255, 0.2)',
  },
  robotContainer: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 10,
  },
  robotImage: {
    width: 200,
    height: 200,
  },
  underRobotImage: {
    position: 'absolute',
    bottom: -40,
  width: 360,
    height: 180,
    zIndex: -1,
  },
  welcomeMessage: {
    marginTop: 20,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 22,
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
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    ...Platform.select({
      web: {
     backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 12px rgba(175, 167, 215, 0.15)',
    },
    default: {
        shadowColor: '#AFA7D7',
        shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 3,
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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
