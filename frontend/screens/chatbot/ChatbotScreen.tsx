import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Animated, Easing, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEPLOYMENT_STATUS_STORAGE_KEY,
  RAG_RESULT_STORAGE_KEY,
  deploymentWebSocketUrl,
  ragAPI,
  type DeploymentWebSocketMessage,
  type PipelineStage,
  type PipelineStageMessage,
  type PipelineStageStatus,
  type RagCandidate,
  type RagChatResponse,
} from '../../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type StageViewModel = {
  stage: PipelineStage;
  status: PipelineStageStatus;
  message: string;
  progress?: number;
};

const PIPELINE_STAGES: PipelineStage[] = [
  'Thinking',
  'Building',
  'Reviewing',
  'SecurityCheck',
  'Consensus',
  'Generating',
  'Packaging',
  'Deploying',
  'HealthCheck',
  'Healing',
  'Finalize',
];

const STAGE_LABELS: Record<PipelineStage, string> = {
  Thinking: '理解需求',
  Building: '生成方案',
  Reviewing: '方案复核',
  SecurityCheck: '安全检查',
  Consensus: '共识决策',
  Generating: '生成任务',
  Packaging: '打包产物',
  Deploying: '部署应用',
  HealthCheck: '健康检查',
  Healing: '自愈修复',
  Finalize: '完成',
};

function initialStages(): StageViewModel[] {
  return PIPELINE_STAGES.map((stage) => ({
    stage,
    status: 'pending',
    message: '等待开始',
  }));
}

function upsertStage(stages: StageViewModel[], update: PipelineStageMessage): StageViewModel[] {
  return stages.map((item) =>
    item.stage === update.stage
      ? {
          stage: update.stage,
          status: update.status,
          message: update.message,
          progress: update.progress,
        }
      : item
  );
}

function formatScore(score: number): string {
  return Number.isFinite(score) ? `${Math.round(score)}` : '-';
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

export default function ChatbotScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [chatResult, setChatResult] = useState<RagChatResponse | null>(null);
  const [pipelineStages, setPipelineStages] = useState<StageViewModel[]>(initialStages);
  const [socketState, setSocketState] = useState<'idle' | 'connecting' | 'connected' | 'closed' | 'error'>('idle');
  const [lastEventMessage, setLastEventMessage] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

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
    '部署一个 React 管理后台',
    '找一个 FastAPI 项目并生成 Dockerfile',
    '帮我生成一个简单的在线备忘录应用',
  ];

  const handleSend = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;

    setShowSuggestions(false);
    setChatResult(null);
    setPipelineStages(initialStages());
    setSocketState('idle');
    setLastEventMessage('');
    closeSocket();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    setIsLoading(true);
    try {
      const response = await ragAPI.chat(trimmed);
      const result = response.data;
      setChatResult(result);
      await AsyncStorage.multiSet([
        [RAG_RESULT_STORAGE_KEY, JSON.stringify(result.search)],
        [DEPLOYMENT_STATUS_STORAGE_KEY, result.deployment_id],
      ]);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: buildAssistantSummary(result),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      connectDeploymentSocket(result.deployment_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求失败';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `真实算法链路启动失败：${message}`,
          timestamp: new Date(),
        },
      ]);
      setSocketState('error');
    } finally {
      setIsLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const closeSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const connectDeploymentSocket = (deploymentId: string) => {
    closeSocket();
    setSocketState('connecting');

    const socket = new WebSocket(deploymentWebSocketUrl(deploymentId));
    socketRef.current = socket;

    socket.onopen = () => {
      setSocketState('connected');
      socket.send('ping');
    };

    socket.onmessage = (event) => {
      if (event.data === 'pong') {
        return;
      }

      try {
        const message = JSON.parse(String(event.data)) as DeploymentWebSocketMessage;
        if (message.type === 'pipeline_stage') {
          setPipelineStages((current) => upsertStage(current, message));
          setLastEventMessage(message.message);
          return;
        }

        if (message.type === 'status' && message.status) {
          setLastEventMessage(`部署状态：${message.status}`);
          return;
        }

        if (message.type === 'log' && message.log) {
          setLastEventMessage(message.log);
          return;
        }

        if (message.type === 'error' && message.error_message) {
          setLastEventMessage(message.error_message);
          setSocketState('error');
        }
      } catch {
        setLastEventMessage(String(event.data));
      }
    };

    socket.onerror = () => {
      setSocketState('error');
      setLastEventMessage('WebSocket 连接异常，正在等待后端推送恢复。');
    };

    socket.onclose = () => {
      if (socketRef.current === socket) {
        setSocketState((state) => (state === 'error' ? 'error' : 'closed'));
        socketRef.current = null;
      }
    };
  };

  useEffect(() => () => closeSocket(), []);

  const buildAssistantSummary = (result: RagChatResponse): string => {
    const selected = result.search.selected || result.search.candidates[0];
    const selectedText = selected ? `已选择 ${selected.full_name}` : '未选中候选仓库';
    return `${selectedText}，生成任务 ${result.generation.task_id} 已进入真实算法流水线。`;
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

  const selectedCandidate = chatResult?.search.selected || chatResult?.search.candidates[0] || null;
  const visibleCandidates = chatResult?.search.candidates.slice(0, 3) || [];
  const currentProgress = pipelineStages.reduce((max, item) => Math.max(max, item.progress || 0), 0);
  const socketBadgeStyle = {
    idle: styles.socket_idle,
    connecting: styles.socket_connecting,
    connected: styles.socket_connected,
    closed: styles.socket_closed,
    error: styles.socket_error,
  }[socketState];
  const stageStatusStyles: Record<PipelineStageStatus, object> = {
    pending: styles.stage_pending,
    running: styles.stage_running,
    success: styles.stage_success,
    failed: styles.stage_failed,
    skipped: styles.stage_skipped,
  };

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
          ref={scrollRef}
          style={styles.contentArea}
          contentContainerStyle={styles.contentContainer}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
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
         source={require('../../assets/chatbot/underrobot.png')}
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
          source={require('../../assets/chatbot/robot.png')}
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

              {chatResult && (
                <View style={styles.resultPanel}>
                  <View style={styles.aiCardHeader}>
                    <View style={styles.aiCardIcon}>
                      <Ionicons name="git-branch" size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.aiCardTitleContainer}>
                      <Text style={styles.aiCardTitle}>真实算法流水线</Text>
                      <Text style={styles.aiCardMeta}>
                        部署 #{chatResult.deployment_id} · 任务 {chatResult.generation.task_id.slice(0, 8)}
                      </Text>
                    </View>
                    <View style={[styles.socketBadge, socketBadgeStyle]}>
                      <Text style={styles.socketBadgeText}>{socketState}</Text>
                    </View>
                  </View>

                  {/*
                  Top 3 repository result UI is intentionally hidden for now.
                  Keep selectedCandidate, visibleCandidates, and formatScore logic above
                  so the repository panel can be restored without touching data flow.
                  {selectedCandidate && (
                    <View style={styles.selectedRepo}>
                      <Text style={styles.sectionLabel}>当前选择</Text>
                      <Text style={styles.selectedRepoName}>{selectedCandidate.full_name}</Text>
                      <Text style={styles.selectedRepoMeta}>
                        综合 {formatScore(selectedCandidate.final_score)} · 部署 {formatScore(selectedCandidate.deployability_score)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.candidateList}>
                    <Text style={styles.sectionLabel}>Top 3 仓库</Text>
                    {visibleCandidates.map((candidate: RagCandidate) => (
                      <View key={candidate.repo_url} style={styles.candidateRow}>
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankText}>{candidate.rank}</Text>
                        </View>
                        <View style={styles.candidateBody}>
                          <Text style={styles.candidateName} numberOfLines={1}>
                            {candidate.full_name}
                          </Text>
                          <Text style={styles.candidateMeta} numberOfLines={1}>
                            {candidate.language || 'Unknown'} · ★ {candidate.stars} · {candidate.missing_components.length} 个缺口
                          </Text>
                        </View>
                        <Text style={styles.scoreText}>{formatScore(candidate.final_score)}</Text>
                      </View>
                    ))}
                  </View>
                  */}

                  <View style={styles.pipelinePanel}>
                    <View style={styles.pipelineHeader}>
                      <Text style={styles.sectionLabel}>实时阶段</Text>
                      <Text style={styles.progressText}>{Math.round(currentProgress * 100)}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.max(currentProgress * 100, 4)}%` }]} />
                    </View>
                    {pipelineStages.map((item) => (
                      <View key={item.stage} style={styles.stageRow}>
                        <View style={[styles.stageDot, stageStatusStyles[item.status]]} />
                        <View style={styles.stageBody}>
                          <Text style={styles.stageName}>{STAGE_LABELS[item.stage]}</Text>
                          <Text style={styles.stageMessage} numberOfLines={2}>
                            {item.message}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {!!lastEventMessage && (
                    <View style={styles.eventBox}>
                      <Text style={styles.eventText} numberOfLines={3}>
                        {lastEventMessage}
                      </Text>
                    </View>
                  )}
                </View>
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
            editable={!isLoading}
          />
             <Pressable style={styles.micButton}>
          <MicrophoneIcon size={18} color="#8B8FAF" />
        </Pressable>
          <Pressable
            style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
        onPress={() => handleSend(inputText)}
            disabled={isLoading}
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
  resultPanel: {
    marginTop: 24,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    gap: 16,
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
  socketBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  socketBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  socket_idle: {
    backgroundColor: '#9CA3AF',
  },
  socket_connecting: {
    backgroundColor: '#F59E0B',
  },
  socket_connected: {
    backgroundColor: '#10B981',
  },
  socket_closed: {
    backgroundColor: '#6B7280',
  },
  socket_error: {
    backgroundColor: '#EF4444',
  },
  selectedRepo: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#F4F1FF',
    borderWidth: 1,
    borderColor: '#E5DDFF',
  },
  sectionLabel: {
    fontSize: 11,
    color: '#7C62FF',
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  selectedRepoName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#161823',
    marginBottom: 4,
  },
  selectedRepoMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  candidateList: {
    gap: 10,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FAFAFF',
    borderWidth: 1,
    borderColor: '#ECEBFF',
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#7C62FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  candidateBody: {
    flex: 1,
    minWidth: 0,
  },
  candidateName: {
    fontSize: 13,
    color: '#24253A',
    fontWeight: '700',
  },
  candidateMeta: {
    marginTop: 3,
    fontSize: 11,
    color: '#7F80A1',
  },
  scoreText: {
    marginLeft: 10,
    fontSize: 13,
    color: '#7C62FF',
    fontWeight: '800',
  },
  pipelinePanel: {
    gap: 10,
  },
  pipelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    color: '#7C62FF',
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ECEBFF',
    overflow: 'hidden',
    marginBottom: 2,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#7C62FF',
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 10,
  },
  stage_pending: {
    backgroundColor: '#D1D5DB',
  },
  stage_running: {
    backgroundColor: '#F59E0B',
  },
  stage_success: {
    backgroundColor: '#10B981',
  },
  stage_failed: {
    backgroundColor: '#EF4444',
  },
  stage_skipped: {
    backgroundColor: '#9CA3AF',
  },
  stageBody: {
    flex: 1,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EEFA',
  },
  stageName: {
    fontSize: 12,
    color: '#24253A',
    fontWeight: '800',
  },
  stageMessage: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: '#7F80A1',
  },
  eventBox: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8F7FF',
    borderWidth: 1,
    borderColor: '#E8E4F8',
  },
  eventText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#494A64',
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
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
